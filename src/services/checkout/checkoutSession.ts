import "server-only";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActivePricing } from "@/services/catalogue/catalogue";
import { calcBreakdown } from "@/services/pricing/PricingService";
import { sendOfflineOrderCreated, sendOrderConfirmation } from "@/services/orders/notify";
import { ensureInvoice } from "@/services/payment/paymentOrders";
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
  subtotalInr: number; // ex-GST
  gstInr: number;
  totalInr: number;
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

  const totalInr = orderItems.reduce((s, it) => s + it.unitPriceInr * it.qty, 0);
  const gstInr = orderItems.reduce(
    (s, it) => s + (it.pricingSnapshot as { unitGst: number }).unitGst * it.qty,
    0,
  );
  const subtotalInr = totalInr - gstInr;
  const advanceInr = Math.round(totalInr * 0.5);
  return { orderItems, subtotalInr, gstInr, totalInr, advanceInr };
}

function newOrderNumber(): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `MVI-ORD-${rand}`;
}

export interface CreatedSession {
  token: string;
  orderNumber: string;
  subtotalInr: number;
  gstInr: number;
  shippingInr: number;
  discountInr: number;
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
}): Promise<CreatedSession> {
  const priced = await priceCart(input.items);
  if (priced.orderItems.length === 0) {
    throw new Error("EMPTY_CART");
  }

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
      discountInr: 0, // discount is already baked into unitPriceInr via the pricing rule
      totalInr: priced.totalInr,
      advanceInr: priced.advanceInr,
      customerUserId: input.customerUserId ?? null,
      expiresAt,
    },
  });

  return {
    token,
    orderNumber,
    subtotalInr: priced.subtotalInr,
    gstInr: priced.gstInr,
    shippingInr: 0,
    discountInr: 0,
    totalInr: priced.totalInr,
    advanceInr: priced.advanceInr,
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
 *  - paid=true  → Razorpay path: creates a CAPTURED Payment, decrements stock,
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

  // Stock decrement ops (paid path only, stocked items only — made-to-order skipped).
  const inventoryOps: Prisma.PrismaPromise<unknown>[] = [];
  if (opts.paid) {
    const products = await prisma.product.findMany({
      where: { id: { in: priced.orderItems.map((i) => i.productId) } },
      include: { inventory: true },
    });
    const invByProduct = new Map(products.map((p) => [p.id, p.inventory]));
    for (const it of priced.orderItems) {
      const inv = invByProduct.get(it.productId);
      if (!inv || inv.quantity < it.qty) continue;
      inventoryOps.push(
        prisma.inventory.update({ where: { id: inv.id }, data: { quantity: { decrement: it.qty } } }),
        prisma.inventoryTransaction.create({
          data: {
            inventoryId: inv.id,
            delta: -it.qty,
            reason: "SALE",
            balanceAfter: inv.quantity - it.qty,
            note: `Order ${session.orderNumber} — advance paid`,
          },
        }),
      );
    }
  }

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
          totalInr: priced.totalInr,
          advanceInr: priced.advanceInr,
          items: { create: priced.orderItems },
          ...(opts.paid
            ? {
                payments: {
                  create: {
                    provider: PaymentProvider.RAZORPAY,
                    type: PaymentType.ADVANCE,
                    status: PaymentStatus.CAPTURED,
                    amountInr: priced.advanceInr,
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
      ...inventoryOps,
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
    totalInr: priced.totalInr,
    advanceInr: priced.advanceInr,
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
