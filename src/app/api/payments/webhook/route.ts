import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { razorpayWebhookReady } from "@/lib/env";
import { verifyWebhookSignature } from "@/services/payment/razorpayService";
import { markPaymentRefunded } from "@/services/payment/paymentOrders";
import { finalizeSessionToOrder, markSessionFailedByGatewayOrder } from "@/services/checkout/checkoutSession";
import { RazorpayEvent } from "@/lib/paymentStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Razorpay webhook receiver — the authoritative payment source of truth, resilient
 * to the browser closing before /verify runs. On payment.captured it CREATES the
 * real order from the draft session (idempotent with /verify). Verifies the
 * X-Razorpay-Signature against the RAW body; rejects anything unsigned/invalid.
 */
export async function POST(req: Request) {
  // Coarse abuse guard. Legit Razorpay bursts are small; this only blunts floods.
  const rl = await rateLimit(`pay-webhook:${clientIp(req)}`, 240, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // Loud, actionable signal when the webhook secret was never configured: every
  // event will be rejected below, silently breaking async payment confirmation.
  if (!razorpayWebhookReady) {
    logger.error(
      "webhook: RAZORPAY_WEBHOOK_SECRET is not set — webhook confirmation is DISABLED. " +
        "Set it from Razorpay Dashboard → Settings → Webhooks to enable paid-but-tab-closed recovery.",
    );
  }

  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    logger.warn({ hasSig: !!signature }, "webhook: signature rejected");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; method?: string; error_description?: string } };
      refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const type = event.event;
  const p = event.payload?.payment?.entity;
  const r = event.payload?.refund?.entity;
  logger.info({ type }, "webhook received");

  // Persist the verified event (ids/amounts/status only — no secrets) for debugging.
  void recordAudit({
    action: `razorpay.webhook.${type ?? "unknown"}`,
    entity: "RazorpayWebhook",
    entityId: p?.id ?? r?.id ?? null,
    after: {
      type,
      paymentId: p?.id ?? null,
      orderId: p?.order_id ?? null,
      method: p?.method ?? null,
      error: p?.error_description ?? null,
      refundId: r?.id ?? null,
      refundPaymentId: r?.payment_id ?? null,
      amount: (p as { amount?: number } | undefined)?.amount ?? r?.amount ?? null,
    },
  });

  try {
    switch (type) {
      case RazorpayEvent.PAYMENT_CAPTURED: {
        if (p?.order_id && p?.id) {
          // Find the draft session this gateway order belongs to and finalize it.
          const session = await prisma.checkoutSession.findUnique({ where: { gatewayOrderId: p.order_id } });
          if (session) {
            await finalizeSessionToOrder(session, {
              method: "RAZORPAY",
              paid: true,
              payment: {
                gatewayOrderId: p.order_id,
                gatewayPaymentId: p.id,
                method: p.method ?? null,
                viaWebhook: true,
              },
            });
          } else {
            logger.warn({ orderId: p.order_id }, "webhook captured: no session for gateway order");
          }
        }
        break;
      }
      case RazorpayEvent.PAYMENT_FAILED: {
        if (p?.order_id) await markSessionFailedByGatewayOrder(p.order_id);
        break;
      }
      case RazorpayEvent.REFUND_CREATED: {
        if (r?.payment_id) {
          await markPaymentRefunded({
            gatewayPaymentId: r.payment_id,
            refundId: r.id ?? null,
            refundAmountInr: Number(r.amount ?? 0) / 100,
            viaWebhook: true,
          });
        }
        break;
      }
      default:
        logger.info({ type }, "webhook: unhandled event acknowledged");
    }
  } catch (err) {
    logger.error({ err, type }, "webhook handler failed");
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
