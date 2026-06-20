import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { createSignedUrl } from "@/lib/supabase/admin";

/**
 * Serve a payment-proof file from the PRIVATE bucket via a short-lived signed URL.
 *
 * Access control (defense-in-depth):
 *  - Admins with `payments.read` may view any proof.
 *  - The owning customer (the logged-in user linked to the order's customer) may
 *    view their own proof.
 *  - Everyone else gets 404 (not 403 — don't reveal the id exists).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });

  const sub = await prisma.paymentSubmission.findUnique({
    where: { id },
    select: {
      proofBucket: true,
      proofKey: true,
      order: { select: { customer: { select: { userId: true } } } },
    },
  });
  if (!sub || !sub.proofBucket || !sub.proofKey) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }

  const isAdmin = hasPermission(user.permissions, "payments.read");
  const isOwner = sub.order.customer?.userId === user.id;
  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }

  const signed = await createSignedUrl(sub.proofBucket, sub.proofKey, 120);
  if (!signed) {
    return NextResponse.json({ error: { message: "Proof unavailable" } }, { status: 502 });
  }
  return NextResponse.redirect(signed);
}
