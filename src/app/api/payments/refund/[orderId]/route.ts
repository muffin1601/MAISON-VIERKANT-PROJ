import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { razorpayReady } from "@/lib/env";
import { requirePermission, AuthError } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { createRefund } from "@/services/payment/razorpayService";
import { markPaymentRefunded, PaymentStatus } from "@/services/payment/paymentOrders";
import { PaymentProvider } from "@/lib/paymentStatus";

export const runtime = "nodejs";

const schema = z.object({
  // Omit for a full refund; provide a value (₹) for a partial refund.
  amountInr: z.number().positive().optional(),
  reason: z.string().max(300).optional(),
});

/**
 * Admin-only refund (full or partial) for an order's captured Razorpay advance.
 * Requires `payments.write`. The order flips to REFUNDED on a full refund.
 */
export async function POST(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  let admin;
  try {
    admin = await requirePermission("payments.write");
  } catch (e) {
    const status = e instanceof AuthError && e.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: { message: "Not authorized" } }, { status });
  }

  if (!razorpayReady) {
    return NextResponse.json({ error: { message: "Razorpay is not configured." } }, { status: 503 });
  }

  const { orderId } = await params;
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* empty body = full refund */
  }
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Validation failed" } }, { status: 422 });
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId, provider: PaymentProvider.RAZORPAY, status: PaymentStatus.CAPTURED },
    orderBy: { createdAt: "desc" },
  });
  if (!payment?.gatewayPaymentId) {
    return NextResponse.json(
      { error: { message: "No captured Razorpay payment found for this order." } },
      { status: 404 },
    );
  }

  const alreadyRefunded = Number(payment.amountRefundedInr);
  const captured = Number(payment.amountInr);
  const requested = parsed.data.amountInr;
  if (requested && requested > captured - alreadyRefunded + 0.5) {
    return NextResponse.json(
      { error: { message: "Refund exceeds the remaining captured amount." } },
      { status: 422 },
    );
  }

  try {
    const refund = await createRefund({
      razorpayPaymentId: payment.gatewayPaymentId,
      amountInr: requested,
      notes: { orderId, reason: parsed.data.reason ?? "admin_refund" },
    });

    await markPaymentRefunded({
      gatewayPaymentId: payment.gatewayPaymentId,
      refundId: refund.id,
      refundAmountInr: refund.amountInr || requested || captured,
      viaWebhook: false,
    });

    await recordAudit({
      actorId: admin.id,
      action: "payment.refund",
      entity: "Payment",
      entityId: payment.id,
      after: { refundId: refund.id, amountInr: refund.amountInr, reason: parsed.data.reason ?? null },
    });

    return NextResponse.json({ data: { refundId: refund.id, status: refund.status, amountInr: refund.amountInr } });
  } catch (err) {
    logger.error({ err, orderId }, "refund failed");
    return NextResponse.json(
      { error: { message: "Refund could not be processed. Please check the Razorpay dashboard." } },
      { status: 502 },
    );
  }
}
