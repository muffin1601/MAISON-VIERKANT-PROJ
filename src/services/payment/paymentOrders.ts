import "server-only";
import { prisma } from "@/lib/prisma";
import { getActivePricing } from "@/services/catalogue/catalogue";
import { calcBreakdown } from "@/services/pricing/PricingService";
import { sendOrderConfirmation } from "@/services/orders/notify";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import {
  PaymentStatus,
  PaymentProvider,
  PaymentType,
  PaymentOrderStatus,
  PAYABLE_ORDER_STATUSES,
} from "@/lib/paymentStatus";

/**
 * Order ↔ Razorpay payment orchestration. Pure server logic shared by the
 * create-order / verify / webhook / refund routes so the lifecycle transitions
 * live in exactly one place and stay idempotent.
 */

export type OrderForPayment = NonNullable<Awaited<ReturnType<typeof loadOrderForPayment>>>;

export function loadOrderForPayment(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { product: { include: { variants: true, inventory: true } }, variant: true } },
      payments: true,
    },
  });
}

export interface CartValidationResult {
  ok: boolean;
  /** Server-authoritative advance (50%) in whole rupees. */
  advanceInr: number;
  reason?: string;
}

/**
 * Re-validate an order immediately before charging. The frontend can never alter
 * the payable amount — it is recomputed here from the stored order. Aborts if a
 * product was archived, went out of stock, or its price drifted since checkout.
 */
export async function validateOrderPayable(order: OrderForPayment): Promise<CartValidationResult> {
  const advanceInr = Math.round(Number(order.totalInr) * 0.5);

  if (order.items.length === 0) {
    return { ok: false, advanceInr, reason: "Order has no items." };
  }

  const pricing = await getActivePricing();

  for (const it of order.items) {
    const product = it.product;
    if (!product) return { ok: false, advanceInr, reason: "A product in this order no longer exists." };
    if (product.status !== "ACTIVE") {
      return { ok: false, advanceInr, reason: `“${product.name}” is no longer available for purchase.` };
    }

    // Price-unchanged: recompute the current selling price and compare to what the
    // order was created with. A drift means the catalogue/pricing changed mid-flow.
    const eur = Number(it.variant?.eurPrice ?? product.eurPrice);
    const current = calcBreakdown(eur, pricing).selling;
    if (Math.abs(current - Number(it.unitPriceInr)) > 1) {
      return {
        ok: false,
        advanceInr,
        reason: `Pricing for “${product.name}” has changed. Please review your order again.`,
      };
    }

    // Inventory (best-effort): block only when the item is actively stocked AND
    // short. Made-to-order items (no inventory record / untracked) always pass —
    // production starts after the advance, so zero on-hand is expected.
    const inv = product.inventory;
    if (inv && inv.quantity > 0 && inv.quantity < it.qty) {
      return { ok: false, advanceInr, reason: `Insufficient stock for “${product.name}”.` };
    }
  }

  return { ok: true, advanceInr };
}

/**
 * Capture transition (called from /verify after signature check, and from the
 * payment.captured webhook). Idempotent: a second call for the same payment is a
 * no-op that returns `alreadyPaid: true`. Sends the confirmation email + creates
 * the invoice exactly once, on the first capture.
 */
export async function markPaymentCaptured(params: {
  orderId: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  signature?: string | null;
  amountInr: number;
  method?: string | null;
  viaWebhook: boolean;
}): Promise<{ ok: true; alreadyPaid: boolean } | { ok: false; reason: string }> {
  const existing = await prisma.payment.findFirst({
    where: { gatewayOrderId: params.gatewayOrderId },
    include: { order: true },
  });
  if (!existing) return { ok: false, reason: "No payment record for this gateway order." };
  if (existing.orderId !== params.orderId) {
    return { ok: false, reason: "Payment/order mismatch." };
  }

  // Already captured → just upgrade webhook-verification flag if this is the webhook.
  if (existing.status === PaymentStatus.CAPTURED) {
    if (params.viaWebhook && !existing.webhookVerified) {
      await prisma.payment.update({
        where: { id: existing.id },
        data: { webhookVerified: true },
      });
    }
    return { ok: true, alreadyPaid: true };
  }

  // Build inventory-decrement ops for STOCKED items (made-to-order items, which
  // carry no inventory row or zero on-hand, are skipped — production starts after
  // the advance, so zero stock is expected and must not block/oversell).
  const itemsWithStock = await prisma.orderItem.findMany({
    where: { orderId: params.orderId },
    include: { product: { include: { inventory: true } } },
  });
  const inventoryOps = itemsWithStock.flatMap((it) => {
    const inv = it.product?.inventory;
    if (!inv || inv.quantity < it.qty) return [];
    const balanceAfter = inv.quantity - it.qty;
    return [
      prisma.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: it.qty } } }),
      prisma.inventoryTransaction.create({
        data: {
          inventoryId: inv.id,
          delta: -it.qty,
          reason: "SALE",
          balanceAfter,
          note: `Order ${existing.order.number} — advance paid`,
        },
      }),
    ];
  });

  const paidAt = new Date();
  await prisma.$transaction([
    prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: PaymentStatus.CAPTURED,
        gatewayPaymentId: params.gatewayPaymentId,
        signature: params.signature ?? existing.signature,
        method: params.method ?? existing.method,
        paidAt,
        webhookVerified: params.viaWebhook || existing.webhookVerified,
      },
    }),
    // Advance the order only from a still-payable state — never regress an order an
    // admin already pushed into production.
    prisma.order.updateMany({
      where: { id: params.orderId, status: { in: PAYABLE_ORDER_STATUSES } },
      data: { status: PaymentOrderStatus.PAID },
    }),
    // Decrement stock atomically with the capture (only for genuinely stocked items).
    ...inventoryOps,
  ]);

  await ensureInvoice(params.orderId);

  // Customer order+payment confirmation + admin "new paid order" alert (once).
  void sendOrderConfirmation(params.orderId, "razorpay").catch((err) =>
    logger.error({ err, orderId: params.orderId }, "razorpay confirmation email failed"),
  );

  logger.info(
    { orderId: params.orderId, paymentId: params.gatewayPaymentId, viaWebhook: params.viaWebhook },
    "payment captured",
  );
  return { ok: true, alreadyPaid: false };
}

/** Mark the gateway transaction failed and surface the order as PAYMENT_FAILED (still retryable). */
export async function markPaymentFailed(params: {
  gatewayOrderId: string;
  gatewayPaymentId?: string | null;
  reason?: string | null;
}): Promise<void> {
  const existing = await prisma.payment.findFirst({ where: { gatewayOrderId: params.gatewayOrderId } });
  if (!existing || existing.status === PaymentStatus.CAPTURED) return; // never override a success

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: existing.id },
      data: {
        status: PaymentStatus.FAILED,
        gatewayPaymentId: params.gatewayPaymentId ?? existing.gatewayPaymentId,
        reference: params.reason ?? existing.reference,
      },
    }),
    prisma.order.updateMany({
      where: { id: existing.orderId, status: { in: PAYABLE_ORDER_STATUSES } },
      data: { status: PaymentOrderStatus.PAYMENT_FAILED },
    }),
  ]);
  logger.warn({ orderId: existing.orderId, reason: params.reason }, "payment failed");
}

/**
 * Record a refund (full/partial) against a captured payment.
 *
 * Idempotent on the Razorpay refund id (`refundId`): the admin API issues the
 * refund AND the `refund.created` webhook reports it, so without de-duping the
 * amount would be counted twice. We record each applied refund id in the audit
 * log and skip if already seen. A partial refund keeps the payment CAPTURED (so a
 * further partial can still be issued); only a full refund flips it to REFUNDED.
 */
export async function markPaymentRefunded(params: {
  gatewayPaymentId: string;
  refundId?: string | null;
  refundAmountInr: number;
  viaWebhook: boolean;
}): Promise<void> {
  const existing = await prisma.payment.findFirst({ where: { gatewayPaymentId: params.gatewayPaymentId } });
  if (!existing) return;

  // Idempotency: skip if THIS refund id was already applied (admin path + webhook).
  if (params.refundId) {
    const seen = await prisma.auditLog.findFirst({
      where: { entity: "RazorpayRefund", entityId: params.refundId },
      select: { id: true },
    });
    if (seen) {
      // Still upgrade webhook-verification if the webhook arrived after the admin call.
      if (params.viaWebhook && !existing.webhookVerified) {
        await prisma.payment.update({ where: { id: existing.id }, data: { webhookVerified: true } });
      }
      return;
    }
  }

  const totalRefunded = Number(existing.amountRefundedInr) + params.refundAmountInr;
  const fullyRefunded = totalRefunded >= Number(existing.amountInr) - 1;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: existing.id },
      data: {
        // Keep CAPTURED on a partial so the remaining balance stays refundable.
        status: fullyRefunded ? PaymentStatus.REFUNDED : PaymentStatus.CAPTURED,
        amountRefundedInr: totalRefunded,
        webhookVerified: params.viaWebhook || existing.webhookVerified,
      },
    }),
    // Only flip the order to REFUNDED on a full refund; a partial leaves it paid.
    ...(fullyRefunded
      ? [
          prisma.order.updateMany({
            where: { id: existing.orderId },
            data: { status: PaymentOrderStatus.REFUNDED },
          }),
        ]
      : []),
  ]);

  // Durable idempotency key for this refund id.
  if (params.refundId) {
    await recordAudit({
      action: "payment.refund.applied",
      entity: "RazorpayRefund",
      entityId: params.refundId,
      after: {
        orderId: existing.orderId,
        gatewayPaymentId: params.gatewayPaymentId,
        refundAmountInr: params.refundAmountInr,
        totalRefundedInr: totalRefunded,
        fullyRefunded,
        viaWebhook: params.viaWebhook,
      },
    });
  }
  logger.info(
    { orderId: existing.orderId, refundAmountInr: params.refundAmountInr, fullyRefunded },
    "refund recorded",
  );
}

/** Ensure an Invoice row exists for a paid order (idempotent). Returns the invoice number. */
export async function ensureInvoice(orderId: string): Promise<string | null> {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { number: true } });
    if (!order) return null;
    const number = `MVI-INV-${order.number.replace(/^MVI-ORD-/, "")}`;
    const invoice = await prisma.invoice.upsert({
      where: { orderId },
      update: {},
      create: { orderId, number },
    });
    return invoice.number;
  } catch (err) {
    logger.error({ err, orderId }, "ensureInvoice failed");
    return null;
  }
}

/** Provider/type constants re-exported so route handlers don't import from two places. */
export { PaymentProvider, PaymentType, PaymentStatus };
