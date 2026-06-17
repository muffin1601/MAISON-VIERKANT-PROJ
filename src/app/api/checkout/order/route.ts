import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env, razorpayReady } from "@/lib/env";
import { getActivePricing } from "@/services/catalogue/catalogue";
import { calcBreakdown } from "@/services/pricing/PricingService";
import { createRazorpayOrder } from "@/services/payments/razorpay";
import { getCurrentUser } from "@/lib/auth/session";
import { sendOrderConfirmation } from "@/services/orders/notify";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const orderSchema = z.object({
  number: z.string().min(1),
  paymentMethod: z.enum(["razorpay", "cod"]).default("razorpay"),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email().optional().or(z.literal("")).default(""),
    phone: z.string().optional().default(""),
    company: z.string().optional().default(""),
    gst: z.string().optional().default(""),
    addr1: z.string().optional().default(""),
    addr2: z.string().optional().default(""),
    city: z.string().optional().default(""),
    state: z.string().optional().default(""),
    pin: z.string().optional().default(""),
    notes: z.string().optional().default(""),
  }),
  items: z
    .array(
      z.object({
        id: z.string(),
        code: z.string(),
        finish: z.string(),
        qty: z.number().int().positive().max(999),
      }),
    )
    .min(1),
});

/**
 * Create a B2C order and initiate payment.
 *
 * Security/correctness guarantees:
 *  - All prices are recomputed server-side from the active pricing rule + stored
 *    EUR. The client-sent total is never trusted.
 *  - Order numbers are unique (DB constraint) → re-submitting the same checkout
 *    cannot create duplicate orders.
 *  - For Razorpay, a gateway order is created and its id stored on a PENDING
 *    Payment row; capture is confirmed later in /api/checkout/verify (or the
 *    webhook), never here.
 */
export async function POST(req: Request) {
  const rl = rateLimit(`checkout:${clientIp(req)}`, 20, 10 * 60 * 1000); // 20 / 10 min / IP
  if (!rl.ok) {
    return NextResponse.json(
      { error: { message: "Too many checkout attempts. Please try again shortly." } },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation failed", issues: parsed.error.flatten() } },
      { status: 422 },
    );
  }
  const { number, customer, items, paymentMethod } = parsed.data;

  if (paymentMethod === "cod" && !env.COD_ENABLED) {
    return NextResponse.json(
      { error: { message: "Cash on Delivery is not available." } },
      { status: 400 },
    );
  }

  try {
    // Idempotency: if this order number already exists, return it rather than duplicating.
    const existing = await prisma.order.findUnique({
      where: { number },
      include: { payments: true },
    });
    if (existing) {
      const pay = existing.payments[0];
      return NextResponse.json(
        {
          data: {
            orderId: existing.id,
            number: existing.number,
            payment: pay
              ? {
                  provider: pay.provider.toLowerCase(),
                  gatewayOrderId: pay.gatewayOrderId,
                  amountInr: Number(pay.amountInr),
                  keyId: razorpayReady ? env.RAZORPAY_KEY_ID : undefined,
                  currency: "INR",
                }
              : null,
          },
        },
        { status: 200 },
      );
    }

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
      where: { code: { in: items.map((i) => i.id) } },
      include: { variants: true },
    });
    const byCode = new Map(products.map((p) => [p.code, p]));

    const orderItems = items
      .map((i) => {
        const p = byCode.get(i.id);
        if (!p) return null;
        const variant = p.variants.find((v) => v.code === i.code);
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
            code: i.code,
            rule: ruleSnapshot,
            unitSelling: bd.selling,
            unitExGst: Math.round(bd.sellingExGst),
            unitGst: Math.round(bd.outputGst),
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (orderItems.length === 0) {
      return NextResponse.json(
        { error: { message: "None of the cart items could be matched to live products." } },
        { status: 422 },
      );
    }

    const totalInr = orderItems.reduce((sum, it) => sum + it.unitPriceInr * it.qty, 0);
    const gstInr = orderItems.reduce((sum, it) => sum + it.pricingSnapshot.unitGst * it.qty, 0);
    const subtotalInr = totalInr - gstInr;
    const advanceInr = Math.round(totalInr * 0.5); // 50% advance secures the order

    // Attach the order to the signed-in customer's CRM record when available, so it
    // appears in their dashboard; otherwise create a fresh guest Customer.
    const sessionUser = await getCurrentUser();
    const linkedCustomer =
      sessionUser?.role === "CUSTOMER"
        ? await prisma.customer.findUnique({ where: { userId: sessionUser.id } })
        : null;

    const addressCreate = customer.addr1
      ? {
          create: {
            type: "SHIPPING" as const,
            line1: customer.addr1,
            line2: customer.addr2 || null,
            city: customer.city,
            state: customer.state,
            pincode: customer.pin,
          },
        }
      : undefined;

    const cust = linkedCustomer
      ? await prisma.customer.update({
          where: { id: linkedCustomer.id },
          data: {
            // keep CRM contact details fresh from checkout, fill only when missing
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

    // For COD nothing is charged online; for online we charge the 50% advance.
    const useRazorpay = paymentMethod === "razorpay" && razorpayReady;

    const order = await prisma.order.create({
      data: {
        number,
        customerId: cust.id,
        status: "PENDING", // becomes CONFIRMED once payment is captured (or immediately for COD)
        subtotalInr,
        gstInr,
        totalInr,
        advanceInr,
        items: { create: orderItems },
      },
    });

    // ---- Cash on Delivery: no gateway, order is confirmed immediately ----
    if (paymentMethod === "cod") {
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            orderId: order.id,
            provider: "COD",
            method: "cod",
            type: "ADVANCE",
            status: "PENDING", // collected on delivery
            amountInr: advanceInr,
          },
        }),
        prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } }),
      ]);
      await sendOrderConfirmation(order.id, "cod");
      return NextResponse.json(
        {
          data: {
            orderId: order.id,
            number,
            payment: { provider: "cod", amountInr: advanceInr, currency: "INR" },
          },
        },
        { status: 201 },
      );
    }

    // ---- Razorpay (live keys configured) ----
    if (useRazorpay) {
      const rzpOrder = await createRazorpayOrder({
        amountInr: advanceInr,
        receipt: number,
        notes: { orderId: order.id, orderNumber: number },
      });
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "RAZORPAY",
          type: "ADVANCE",
          status: "PENDING",
          amountInr: advanceInr,
          gatewayOrderId: rzpOrder.id,
        },
      });
      return NextResponse.json(
        {
          data: {
            orderId: order.id,
            number,
            payment: {
              provider: "razorpay",
              keyId: env.RAZORPAY_KEY_ID,
              gatewayOrderId: rzpOrder.id,
              amountInr: advanceInr,
              currency: "INR",
            },
          },
        },
        { status: 201 },
      );
    }

    // ---- Mock provider (no live keys in this environment) ----
    // Lets local/preview deployments complete checkout end-to-end. In production
    // with PAYMENT_PROVIDER=razorpay + keys, this branch is never reached.
    await prisma.$transaction([
      prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "MOCK",
          type: "ADVANCE",
          status: "CAPTURED",
          amountInr: advanceInr,
        },
      }),
      prisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } }),
    ]);
    await sendOrderConfirmation(order.id, "mock");
    return NextResponse.json(
      {
        data: {
          orderId: order.id,
          number,
          payment: { provider: "mock", amountInr: advanceInr, currency: "INR" },
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // Duplicate order number race → unique violation; treat as already-created.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json(
        { error: { message: "This order was already submitted." } },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: { message: "Could not create order. Please try again." } },
      { status: 500 },
    );
  }
}
