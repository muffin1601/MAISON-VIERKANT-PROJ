import "server-only";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActivePricing } from "@/services/catalogue/catalogue";
import { calcBreakdown } from "@/services/pricing/PricingService";
import { packagingInr as calcPackagingInr, gstOnSubtotal } from "@/services/pricing/charges";
import { sendOfflineOrderCreated, sendOrderConfirmation } from "@/services/orders/notify";
import { ensureInvoice } from "@/services/payment/paymentOrders";
import { validateCoupon, recordRedemption } from "@/services/coupons/coupons";
import { logger } from "@/lib/logger";
import {
  CheckoutSessionStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentType,
  PaymentStatus,
  PaymentOrderStatus,
} from "@/lib/paymentStatus";

/**
 * Draft-checkout engine. Holds the cart + customer + SERVER-COMPUTED totals in a
 * CheckoutSession; the permanent Order is created only when payment is confirmed
 * (Razorpay) or explicitly placed (bank transfer). This is the single source of
 * truth for pricing and order finalization — the client never supplies amounts.
 */

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface CheckoutCustomer {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  gst?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  state?: string;
  pin?: string;
  notes?: string;
}
export interface CheckoutItemInput {
  code: string; // product code
  variantCode: string; // model/variant code
  finish: string;
  qty: number;
}

/** Built order line + the running money figures, computed server-side. */
interface PricedCart {
  orderItems: {
    productId: string;
    variantId: string | null;
    finish: string;
    qty: number;
    eurAtOrder: number;
    unitPriceInr: number;
    pricingSnapshot: Prisma.InputJsonValue;
  }[];
  subtotalInr: number; // ex-GST product total (Σ unit × qty)
  packagingInr: number; // ₹30,000 × total quantity
  gstInr: number; // 18% of subtotal
  totalInr: number; // subtotal + packaging + gst
  advanceInr: number;
}

/** Recompute every line + total from live products + the active pricing rule. */
async function priceCart(items: CheckoutItemInput[]): Promise<PricedCart> {
  const pricing = await getActivePricing();
  const ruleSnapshot = {
    rate: pricing.rate,
    discountPct: pricing.discountPct,
    transportPct: pricing.transportPct,
    packingFlat: pricing.packingFlat,
    dutyPct: pricing.dutyPct,
    swsPct: pricing.swsPct ?? 0,
    gstPct: pricing.gstPct,
    profitPct: pricing.profitPct,
    dealerMarkupPct: pricing.dealerMarkupPct ?? 0,
  };

  const products = await prisma.product.findMany({
    where: { code: { in: items.map((i) => i.code) } },
    include: { variants: true },
  });
  const byCode = new Map(products.map((p) => [p.code, p]));

  const orderItems = items
    .map((i) => {
      const p = byCode.get(i.code);
      if (!p || p.status !== "ACTIVE") return null;
      const variant = p.variants.find((v) => v.code === i.variantCode);
      const eur = Number(variant?.eurPrice ?? p.eurPrice);
      const bd = calcBreakdown(eur, pricing);
      return {
        productId: p.id,
        variantId: variant?.id ?? null,
        finish: i.finish,
        qty: i.qty,
        eurAtOrder: eur,
        unitPriceInr: bd.selling,
        pricingSnapshot: {
          code: i.variantCode,
          rule: ruleSnapshot,
          unitSelling: bd.selling,
          unitExGst: Math.round(bd.sellingExGst),
          unitGst: Math.round(bd.outputGst),
        } as Prisma.InputJsonValue,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Order-summary model: displayed product prices are treated as GST-EXCLUSIVE, then
  // packaging and GST (18%) are added on top. No duty line — import duty is already
  // embedded in the landed product price by PricingService.
  const subtotalInr = orderItems.reduce((s, it) => s + it.unitPriceInr * it.qty, 0);
  const totalQty = orderItems.reduce((s, it) => s + it.qty, 0);
  const packagingInr = calcPackagingInr(totalQty);
  const gstInr = gstOnSubtotal(subtotalInr);
  const totalInr = subtotalInr + packagingInr + gstInr;
  const advanceInr = Math.round(totalInr * 0.5);
  return { orderItems, subtotalInr, packagingInr, gstInr, totalInr, advanceInr };
}

function newOrderNumber(): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `MVI-ORD-${rand}`;
}

export interface CreatedSession {
  token: string;
  orderNumber: string;
  subtotalInr: number;
  packagingInr: number;
  gstInr: number;
  shippingInr: number;
  discountInr: number;
  couponCode: string | null;
  totalInr: number;
  advanceInr: number;
  itemCount: number;
}

/**
 * Create a draft session from a cart. Validates the cart, computes authoritative
 * totals, and persists a 24h-expiry session. Returns the public token + figures.
 * Throws on an empty/invalid cart.
 */
export async function createCheckoutSession(input: {
  customer: CheckoutCustomer;
  items: CheckoutItemInput[];
  customerUserId?: string | null;
  couponCode?: string | null;
  payFull?: boolean; // true → charge 100% now; false/undefined → 50% advance
}): Promise<CreatedSession> {
  const priced = await priceCart(input.items);
  if (priced.orderItems.length === 0) {
    throw new Error("EMPTY_CART");
  }

  // Optional coupon: validated server-side against the SERVER total. An invalid
  // code is ignored (no discount) rather than blocking checkout — the dedicated
  // /api/coupons/validate endpoint gives the user precise feedback beforehand.
  let discountInr = 0;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const customerId = input.customerUserId
      ? (await prisma.customer.findUnique({ where: { userId: input.customerUserId }, select: { id: true } }))?.id ?? null
      : null;
    const res = await validateCoupon(input.couponCode, priced.totalInr, customerId);
    if (res.ok) {
      discountInr = res.discountInr;
      couponCode = res.code;
    }
  }

  const totalInr = Math.max(0, priced.totalInr - discountInr);
  // Customer chooses how much to pay now: 100% (full) or 50% (advance).
  const advanceInr = input.payFull ? totalInr : Math.round(totalInr * 0.5);

  const token = crypto.randomBytes(24).toString("base64url");
  const orderNumber = newOrderNumber();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.checkoutSession.create({
    data: {
      token,
      orderNumber,
      status: CheckoutSessionStatus.DRAFT,
      customerJson: input.customer as unknown as Prisma.InputJsonValue,
      itemsJson: input.items as unknown as Prisma.InputJsonValue,
      subtotalInr: priced.subtotalInr,
      gstInr: priced.gstInr,
      shippingInr: 0, // ex-Delhi model: transport quoted separately, not charged here
      discountInr,
      couponCode,
      totalInr,
      advanceInr,
      customerUserId: input.customerUserId ?? null,
      expiresAt,
    },
  });

  return {
    token,
    orderNumber,
    subtotalInr: priced.subtotalInr,
    packagingInr: priced.packagingInr,
    gstInr: priced.gstInr,
    shippingInr: 0,
    discountInr,
    couponCode,
    totalInr,
    advanceInr,
    itemCount: priced.orderItems.length,
  };
}

export type SessionRow = NonNullable<Awaited<ReturnType<typeof prisma.checkoutSession.findUnique>>>;

/**
 * Load a session by token if it is still usable (not consumed, not expired).
 * Lazily marks expired rows EXPIRED. Returns null when unusable.
 */
export async function getUsableSession(token: string): Promise<SessionRow | null> {
  const s = await prisma.checkoutSession.findUnique({ where: { token } });
  if (!s) return null;
  if (s.status === CheckoutSessionStatus.COMPLETED) return s; // allow re-read for confirmation
  if (s.expiresAt.getTime() < Date.now()) {
    await prisma.checkoutSession
      .update({ where: { id: s.id }, data: { status: CheckoutSessionStatus.EXPIRED } })
      .catch(() => {});
    return null;
  }
  return s;
}

/** Attach the Razorpay order id to a session and mark it processing. */
export async function attachGatewayOrder(sessionId: string, gatewayOrderId: string): Promise<void> {
  await prisma.checkoutSession.update({
    where: { id: sessionId },
    data: { gatewayOrderId, paymentMethod: PaymentMethod.RAZORPAY, status: CheckoutSessionStatus.PAYMENT_PROCESSING },
  });
}

/** Mark the session failed (payment failed/cancelled). Retryable — cart is preserved. */
export async function markSessionFailedByGatewayOrder(gatewayOrderId: string): Promise<void> {
  await prisma.checkoutSession.updateMany({
    where: { gatewayOrderId, status: { not: CheckoutSessionStatus.COMPLETED } },
    data: { status: CheckoutSessionStatus.FAILED },
  });
}

export interface FinalizedOrder {
  orderId: string;
  orderNumber: string;
  totalInr: number;
  advanceInr: number;
  alreadyExisted: boolean;
}

/**
 * Create the permanent Order from a session — the ONLY place an Order is born.
 * Idempotent: if the session already produced an order, returns it untouched.
 *
 *  - paid=true  → Razorpay path: creates a CAPTURED Payment,
 *                 order status PAID (PAYMENT_VERIFIED), invoice + confirmation email.
 *  - paid=false → bank-transfer path: order status PENDING_PAYMENT, instructions email.
 */
export async function finalizeSessionToOrder(
  session: SessionRow,
  opts:
    | { method: "RAZORPAY"; paid: true; payment: { gatewayOrderId: string; gatewayPaymentId: string; signature?: string | null; method?: string | null; viaWebhook: boolean } }
    | { method: "BANK_TRANSFER"; paid: false },
): Promise<FinalizedOrder> {
  // Idempotency: this session already produced an order.
  if (session.orderId) {
    const existing = await prisma.order.findUnique({ where: { id: session.orderId } });
    if (existing) {
      return {
        orderId: existing.id,
        orderNumber: existing.number,
        totalInr: Number(existing.totalInr),
        advanceInr: Number(existing.advanceInr),
        alreadyExisted: true,
      };
    }
  }
  // Or an order with this pre-allocated number already exists (race / retry).
  const byNumber = await prisma.order.findUnique({ where: { number: session.orderNumber } });
  if (byNumber) {
    await prisma.checkoutSession
      .update({ where: { id: session.id }, data: { orderId: byNumber.id, status: CheckoutSessionStatus.COMPLETED } })
      .catch(() => {});
    return {
      orderId: byNumber.id,
      orderNumber: byNumber.number,
      totalInr: Number(byNumber.totalInr),
      advanceInr: Number(byNumber.advanceInr),
      alreadyExisted: true,
    };
  }

  const customer = session.customerJson as unknown as CheckoutCustomer;
  const items = session.itemsJson as unknown as CheckoutItemInput[];
  const priced = await priceCart(items); // re-price at finalize time (authoritative)
  if (priced.orderItems.length === 0) throw new Error("EMPTY_CART");

  // Apply the discount captured on the (server-authored) session. We trust the
  // session figures here — they were computed and stored server-side at creation.
  const discountInr = Number(session.discountInr ?? 0);
  const couponCode = session.couponCode ?? null;
  const finalTotalInr = Math.max(0, priced.totalInr - discountInr);
  // Honor the customer's pay-now choice captured on the session: if the stored
  // amount-to-pay was the full total (≈ total), this was a 100% payment; else 50%.
  const wasFull = Number(session.advanceInr) >= Number(session.totalInr) - 1;
  const finalAdvanceInr = wasFull ? finalTotalInr : Math.round(finalTotalInr * 0.5);

  // Resolve / create the customer CRM record.
  const linkedCustomer = session.customerUserId
    ? await prisma.customer.findUnique({ where: { userId: session.customerUserId } })
    : null;
  const addressCreate = customer.addr1
    ? {
        create: {
          type: "SHIPPING" as const,
          line1: customer.addr1,
          line2: customer.addr2 || null,
          city: customer.city || "",
          state: customer.state || "",
          pincode: customer.pin || "",
        },
      }
    : undefined;
  const cust = linkedCustomer
    ? await prisma.customer.update({
        where: { id: linkedCustomer.id },
        data: {
          phone: linkedCustomer.phone ?? customer.phone ?? null,
          company: linkedCustomer.company ?? customer.company ?? null,
          ...(addressCreate ? { addresses: addressCreate } : {}),
        },
      })
    : await prisma.customer.create({
        data: {
          name: customer.name,
          email: customer.email || null,
          phone: customer.phone || null,
          company: customer.company || null,
          ...(addressCreate ? { addresses: addressCreate } : {}),
        },
      });

  const status = opts.paid ? PaymentOrderStatus.PAID : PaymentOrderStatus.PENDING_PAYMENT;

  let orderId = "";
  try {
    await prisma.$transaction([
      prisma.order.create({
        data: {
          number: session.orderNumber,
          customerId: cust.id,
          status,
          subtotalInr: priced.subtotalInr,
          gstInr: priced.gstInr,
          discountInr,
          couponCode,
          totalInr: finalTotalInr,
          advanceInr: finalAdvanceInr,
          items: { create: priced.orderItems },
          ...(opts.paid
            ? {
                payments: {
                  create: {
                    provider: PaymentProvider.RAZORPAY,
                    type: wasFull ? PaymentType.FULL : PaymentType.ADVANCE,
                    status: PaymentStatus.CAPTURED,
                    amountInr: finalAdvanceInr,
                    currency: "INR",
                    gatewayOrderId: opts.payment.gatewayOrderId,
                    gatewayPaymentId: opts.payment.gatewayPaymentId,
                    signature: opts.payment.signature ?? null,
                    method: opts.payment.method ?? null,
                    webhookVerified: opts.payment.viaWebhook,
                    paidAt: new Date(),
                  },
                },
              }
            : {}),
        },
      }),
    ]);
    const created = await prisma.order.findUnique({ where: { number: session.orderNumber }, select: { id: true } });
    orderId = created!.id;
  } catch (err) {
    // Unique race on order number → another path already finalized it.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      const ex = await prisma.order.findUnique({ where: { number: session.orderNumber } });
      if (ex) {
        await prisma.checkoutSession
          .update({ where: { id: session.id }, data: { orderId: ex.id, status: CheckoutSessionStatus.COMPLETED } })
          .catch(() => {});
        return {
          orderId: ex.id,
          orderNumber: ex.number,
          totalInr: Number(ex.totalInr),
          advanceInr: Number(ex.advanceInr),
          alreadyExisted: true,
        };
      }
    }
    throw err;
  }

  await prisma.checkoutSession.update({
    where: { id: session.id },
    data: { orderId, status: CheckoutSessionStatus.COMPLETED, paymentMethod: opts.method },
  });

  // Record coupon redemption once, only for a freshly-created order.
  if (couponCode && discountInr > 0) {
    void recordRedemption({
      code: couponCode,
      amountInr: discountInr,
      customerId: cust.id,
      orderNumber: session.orderNumber,
    }).catch((e) => logger.error({ err: e, orderNumber: session.orderNumber }, "coupon redemption failed"));
  }

  // Side effects (never block / fail the order).
  if (opts.paid) {
    await ensureInvoice(orderId);
    void sendOrderConfirmation(orderId, "razorpay").catch((e) =>
      logger.error({ err: e, orderId }, "confirmation email failed"),
    );
  } else {
    void sendOfflineOrderCreated(orderId).catch((e) =>
      logger.error({ err: e, orderId }, "offline order email failed"),
    );
  }

  logger.info({ orderId, orderNumber: session.orderNumber, paid: opts.paid }, "order finalized from session");
  return {
    orderId,
    orderNumber: session.orderNumber,
    totalInr: finalTotalInr,
    advanceInr: finalAdvanceInr,
    alreadyExisted: false,
  };
}

/** Delete expired/failed draft sessions (lazy backstop; pg_cron handles the bulk). */
export async function purgeExpiredSessions(): Promise<number> {
  const res = await prisma.checkoutSession.deleteMany({
    where: {
      status: { in: [CheckoutSessionStatus.DRAFT, CheckoutSessionStatus.FAILED, CheckoutSessionStatus.PAYMENT_PROCESSING, CheckoutSessionStatus.EXPIRED] },
      expiresAt: { lt: new Date() },
    },
  });
  return res.count;
}
