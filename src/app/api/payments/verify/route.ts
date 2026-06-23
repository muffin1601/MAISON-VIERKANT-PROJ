import { NextResponse } from "next/server";
import { z } from "zod";
import { razorpayReady } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { verifyPaymentSignature } from "@/services/payment/razorpayService";
import { captureCardFromPayment } from "@/services/payment/savedCards";
import {
  getUsableSession,
  finalizeSessionToOrder,
  markSessionFailedByGatewayOrder,
} from "@/services/checkout/checkoutSession";

export const runtime = "nodejs";

const schema = z.object({
  sessionToken: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Verify the Razorpay success payload and CREATE the real order. We never trust
 * the browser callback alone — the HMAC-SHA256 signature is checked server-side
 * first; only then is the permanent Order created from the draft session.
 * Idempotent + race-safe with the webhook (both call finalizeSessionToOrder).
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`pay-verify:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: { message: "Too many attempts." } }, { status: 429 });
  }
  if (!razorpayReady) {
    return NextResponse.json({ error: { message: "Online payment is disabled." } }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Validation failed" } }, { status: 422 });
  }
  const { sessionToken, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  const valid = verifyPaymentSignature({
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    signature: razorpay_signature,
  });
  if (!valid) {
    logger.warn({ sessionToken, razorpay_order_id }, "verify: signature mismatch");
    await markSessionFailedByGatewayOrder(razorpay_order_id).catch(() => {});
    return NextResponse.json(
      { error: { message: "Payment could not be verified. If you were charged, it will be refunded." } },
      { status: 400 },
    );
  }

  try {
    const session = await getUsableSession(sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: { message: "Checkout session not found. If you were charged, contact support." } },
        { status: 410 },
      );
    }
    // Bind the signed gateway order to THIS session (defends against token swap).
    if (session.gatewayOrderId && session.gatewayOrderId !== razorpay_order_id) {
      return NextResponse.json({ error: { message: "Payment/session mismatch." } }, { status: 409 });
    }

    const order = await finalizeSessionToOrder(session, {
      method: "RAZORPAY",
      paid: true,
      payment: {
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        signature: razorpay_signature,
        method: null,
        viaWebhook: false,
      },
    });

    // Best-effort: if a signed-in customer chose to save their card, persist the
    // token. No-op when there's no token or tokenisation is disabled.
    if (session.customerUserId) {
      const cust = await prisma.customer.findUnique({
        where: { userId: session.customerUserId },
        select: { id: true, razorpayCustomerId: true },
      });
      if (cust?.razorpayCustomerId) {
        void captureCardFromPayment({
          customerId: cust.id,
          razorpayCustomerId: cust.razorpayCustomerId,
          paymentId: razorpay_payment_id,
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      data: {
        status: "PAID",
        orderNumber: order.orderNumber,
        paymentId: razorpay_payment_id,
        amountPaid: order.advanceInr,
        alreadyExisted: order.alreadyExisted,
      },
    });
  } catch (err) {
    logger.error({ err, sessionToken }, "verify: finalize failed");
    return NextResponse.json(
      { error: { message: "We could not finalize your payment. Please contact support." } },
      { status: 500 },
    );
  }
}
