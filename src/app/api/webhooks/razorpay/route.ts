import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/services/payments/razorpay";
import { sendOrderConfirmation } from "@/services/orders/notify";

/**
 * Razorpay webhook — the authoritative, out-of-band confirmation of payment
 * state (the browser verify call can be lost if the user closes the tab). The
 * raw body is read verbatim for HMAC verification, then events are applied
 * idempotently so Razorpay's at-least-once delivery never double-processes.
 *
 * Configure in the Razorpay dashboard:
 *   URL:    https://<domain>/api/webhooks/razorpay
 *   Secret: RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, payment.failed
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: { message: "Invalid signature" } }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; method?: string } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;
  const gatewayOrderId = entity?.order_id;
  const gatewayPaymentId = entity?.id;
  if (!gatewayOrderId) return NextResponse.json({ received: true });

  const payment = await prisma.payment.findUnique({ where: { gatewayOrderId } });
  if (!payment) return NextResponse.json({ received: true });

  if (event.event === "payment.captured" && payment.status !== "CAPTURED") {
    try {
      await prisma.$transaction([
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "CAPTURED",
            gatewayPaymentId: gatewayPaymentId ?? payment.gatewayPaymentId,
            method: entity?.method ?? payment.method,
          },
        }),
        prisma.order.update({ where: { id: payment.orderId }, data: { status: "CONFIRMED" } }),
      ]);
      // This webhook won the capture race → it owns sending the confirmation email.
      await sendOrderConfirmation(payment.orderId, "razorpay");
    } catch (err) {
      // Concurrent verify() already captured it → fine, idempotent (it sent the email).
      if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err;
    }
  } else if (event.event === "payment.failed" && payment.status === "PENDING") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
  }

  return NextResponse.json({ received: true });
}
