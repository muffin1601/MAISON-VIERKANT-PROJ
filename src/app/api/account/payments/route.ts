import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { uploadPrivate } from "@/lib/supabase/admin";
import { buildObjectKey, MAX_PROOF_BYTES, sniffProofMime } from "@/lib/upload/validate";
import { recordAudit } from "@/lib/audit";
import { notifyAdminPaymentSubmitted } from "@/lib/email/notify";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const maxDuration = 60;

const PROOF_BUCKET = "payment-proofs";
const METHODS = ["BANK_TRANSFER", "UPI", "NEFT", "RTGS", "WIRE"] as const;

// Statuses from which a customer may (re)submit a payment.
const SUBMITTABLE = new Set(["PENDING_PAYMENT", "PAYMENT_REJECTED"]);

const fieldSchema = z.object({
  orderNumber: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")).default(""),
  transactionId: z.string().min(2).max(120),
  method: z.enum(METHODS),
  amountPaid: z.coerce.number().positive().max(100_000_000),
  paymentDate: z.coerce.date(),
  notes: z.string().max(1000).optional().default(""),
});

/**
 * Customer submits proof of an offline payment. Multipart form:
 *   orderNumber, transactionId, method, amountPaid, paymentDate, notes, proof (file)
 *
 * Ownership: the order must belong to the logged-in customer, OR the supplied email
 * must match the order's customer email (guest checkout). The proof file is stored in
 * a PRIVATE bucket and only ever served through /api/payment-proof/[id].
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit(`paysubmit:${ip}`, 10, 60 * 60 * 1000); // 10 / hour / IP
  if (!rl.ok) {
    return NextResponse.json(
      { error: { message: "Too many submissions. Please try again later." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: { message: "Invalid form data" } }, { status: 400 });
  }

  const parsed = fieldSchema.safeParse({
    orderNumber: form.get("orderNumber"),
    email: form.get("email") ?? "",
    transactionId: form.get("transactionId"),
    method: form.get("method"),
    amountPaid: form.get("amountPaid"),
    paymentDate: form.get("paymentDate"),
    notes: form.get("notes") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Please check the form fields.", issues: parsed.error.flatten() } },
      { status: 422 },
    );
  }
  const f = parsed.data;

  // Validate the proof file.
  const file = form.get("proof");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { message: "Please attach your payment proof." } }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: { message: "The uploaded file is empty." } }, { status: 400 });
  }
  if (file.size > MAX_PROOF_BYTES) {
    return NextResponse.json({ error: { message: "File exceeds the 10 MB limit." } }, { status: 413 });
  }
  // Verify by file signature, not the client-declared Content-Type.
  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffedMime = sniffProofMime(bytes);
  if (!sniffedMime) {
    return NextResponse.json(
      { error: { message: "Proof must be a valid JPG, PNG, or PDF." } },
      { status: 415 },
    );
  }

  // Resolve the order + ownership.
  const order = await prisma.order.findUnique({
    where: { number: f.orderNumber },
    include: { customer: true, paymentSubmissions: { where: { status: "SUBMITTED" } } },
  });
  if (!order) {
    return NextResponse.json({ error: { message: "Order not found." } }, { status: 404 });
  }

  const user = await getCurrentUser();
  const isOwner = !!user && order.customer.userId === user.id;
  // The email-match path is ONLY for true guest orders (no linked account). If the
  // order belongs to a registered customer, require that authenticated owner —
  // otherwise anyone who knows the order number + email could hijack it.
  const emailMatches =
    !order.customer.userId &&
    !!f.email &&
    !!order.customer.email &&
    f.email.toLowerCase() === order.customer.email.toLowerCase();
  if (!isOwner && !emailMatches) {
    // Don't reveal whether the order exists to a non-owner.
    return NextResponse.json({ error: { message: "Order not found." } }, { status: 404 });
  }

  if (!SUBMITTABLE.has(order.status)) {
    return NextResponse.json(
      { error: { message: "This order is not awaiting payment." } },
      { status: 409 },
    );
  }
  if (order.paymentSubmissions.length > 0) {
    return NextResponse.json(
      { error: { message: "A payment for this order is already under review." } },
      { status: 409 },
    );
  }

  // Store the proof privately (using the sniffed, trusted content-type).
  const key = buildObjectKey(`orders/${order.id}`, file.name, randomUUID());
  let stored;
  try {
    stored = await uploadPrivate(PROOF_BUCKET, key, bytes, sniffedMime);
  } catch (e) {
    logger.error({ err: e }, "proof upload failed");
    return NextResponse.json({ error: { message: "Could not store your file. Please try again." } }, { status: 502 });
  }

  // Persist the submission + advance the order status atomically.
  const submission = await prisma.$transaction(async (tx) => {
    const sub = await tx.paymentSubmission.create({
      data: {
        orderId: order.id,
        customerId: order.customerId,
        method: f.method,
        transactionId: f.transactionId,
        amountInr: f.amountPaid,
        paidAt: f.paymentDate,
        notes: f.notes || null,
        proofBucket: stored.bucket,
        proofKey: stored.key,
        proofMime: sniffedMime,
        proofSizeBytes: file.size,
        status: "SUBMITTED",
        submitterIp: ip,
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: "PAYMENT_SUBMITTED" } });
    return sub;
  });

  await recordAudit({
    actorId: user?.id ?? null,
    action: "payment.submit",
    entity: "PaymentSubmission",
    entityId: submission.id,
    after: { orderNumber: order.number, amount: f.amountPaid, method: f.method, ref: f.transactionId },
  });

  void notifyAdminPaymentSubmitted({
    number: order.number,
    name: order.customer.name,
    amountInr: f.amountPaid,
    method: f.method,
    transactionId: f.transactionId,
  }).catch((err) => logger.error({ err }, "admin payment-submitted email failed"));

  return NextResponse.json({ data: { id: submission.id, status: "SUBMITTED" } }, { status: 201 });
}
