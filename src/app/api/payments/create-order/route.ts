import { NextResponse } from "next/server";
import { z } from "zod";
import { env, razorpayReady } from "@/lib/env";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { createRazorpayOrder, buildReceipt } from "@/services/payment/razorpayService";
import { getUsableSession, attachGatewayOrder } from "@/services/checkout/checkoutSession";
import { CheckoutSessionStatus } from "@/lib/paymentStatus";

export const runtime = "nodejs";

const schema = z.object({ sessionToken: z.string().min(1) });

/**
 * Create (or reuse) a Razorpay order for a DRAFT checkout session's 50% advance.
 * No permanent Order exists yet — that is created only after the payment verifies.
 * The amount is taken from the server-computed session; the client sends only a
 * token. Idempotent per session (reuses the existing Razorpay order on retry).
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`pay-create:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: { message: "Too many attempts. Please wait a moment." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }
  if (!razorpayReady) {
    return NextResponse.json(
      { error: { message: "Online payment is not available right now.", code: "RAZORPAY_DISABLED" } },
      { status: 503 },
    );
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

  try {
    const session = await getUsableSession(parsed.data.sessionToken);
    if (!session) {
      return NextResponse.json(
        { error: { message: "Your checkout session expired. Please review your cart again.", code: "SESSION_EXPIRED" } },
        { status: 410 },
      );
    }
    if (session.status === CheckoutSessionStatus.COMPLETED) {
      return NextResponse.json(
        { error: { message: "This order is already paid.", code: "ALREADY_PAID" } },
        { status: 409 },
      );
    }

    const amountInr = Number(session.advanceInr);
    const customer = session.customerJson as { name?: string; email?: string; phone?: string };

    // Idempotency: reuse the Razorpay order already attached to this session.
    let gatewayOrderId = session.gatewayOrderId ?? "";
    if (!gatewayOrderId) {
      const rzp = await createRazorpayOrder({
        amountInr,
        receipt: buildReceipt(session.orderNumber),
        notes: { sessionToken: session.token, orderNumber: session.orderNumber },
      });
      gatewayOrderId = rzp.id;
      await attachGatewayOrder(session.id, gatewayOrderId);
    }

    return NextResponse.json({
      data: {
        keyId: env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? env.RAZORPAY_KEY_ID,
        gatewayOrderId,
        amount: Math.round(amountInr * 100),
        amountInr,
        currency: "INR",
        sessionToken: session.token,
        orderNumber: session.orderNumber,
        customer: { name: customer.name ?? "", email: customer.email ?? "", contact: customer.phone ?? "" },
      },
    });
  } catch (err) {
    logger.error({ err }, "create-order failed");
    return NextResponse.json(
      { error: { message: "Could not start payment. Please try again." } },
      { status: 500 },
    );
  }
}
