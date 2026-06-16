import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPaymentSignature } from "@/services/payments/razorpay";

const verifySchema = z.object({
  gatewayOrderId: z.string().min(1), // razorpay_order_id
  gatewayPaymentId: z.string().min(1), // razorpay_payment_id
  signature: z.string().min(1), // razorpay_signature
});

/**
 * Confirm a Razorpay payment after the browser checkout handler returns.
 * Verifies the signature server-side, then captures the Payment and confirms
 * the Order. Idempotent: replaying the same successful payment is a no-op, and
 * the unique gatewayPaymentId index prevents a captured payment being reused.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Validation failed" } }, { status: 422 });
  }
  const { gatewayOrderId, gatewayPaymentId, signature } = parsed.data;

  if (!verifyPaymentSignature({ gatewayOrderId, gatewayPaymentId, signature })) {
    return NextResponse.json(
      { error: { message: "Payment signature verification failed." } },
      { status: 400 },
    );
  }

  const payment = await prisma.payment.findUnique({
    where: { gatewayOrderId },
    include: { order: true },
  });
  if (!payment) {
    return NextResponse.json({ error: { message: "Unknown payment." } }, { status: 404 });
  }

  // Already captured → idempotent success.
  if (payment.status === "CAPTURED") {
    return NextResponse.json(
      { data: { orderId: payment.orderId, number: payment.order.number, status: "CONFIRMED" } },
      { status: 200 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", gatewayPaymentId, signature, method: "razorpay" },
      }),
      prisma.order.update({ where: { id: payment.orderId }, data: { status: "CONFIRMED" } }),
    ]);
  } catch (err) {
    // gatewayPaymentId already used elsewhere → reject the replay.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { error: { message: "This payment has already been processed." } },
        { status: 409 },
      );
    }
    throw err;
  }

  return NextResponse.json(
    { data: { orderId: payment.orderId, number: payment.order.number, status: "CONFIRMED" } },
    { status: 200 },
  );
}
