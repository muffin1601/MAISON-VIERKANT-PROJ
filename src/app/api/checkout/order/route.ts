import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getActivePricing } from "@/services/catalogue/catalogue";
import { calcBreakdown } from "@/services/pricing/PricingService";
import { getCurrentUser } from "@/lib/auth/session";
import { sendOfflineOrderCreated } from "@/services/orders/notify";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const orderSchema = z.object({
  number: z.string().min(1),
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
 * Create a B2C order for OFFLINE payment (bank transfer / UPI / NEFT / RTGS / wire).
 *
 * No money is taken online. The order is created with status PENDING_PAYMENT; the
 * customer then transfers the advance and uploads proof (POST /api/account/payments),
 * which an admin verifies.
 *
 * Security/correctness guarantees:
 *  - All prices are recomputed server-side from the active pricing rule + stored EUR.
 *    The client-sent total is never trusted.
 *  - Order numbers are unique (DB constraint) → re-submitting cannot duplicate orders.
 */
export async function POST(req: Request) {
  const rl = await rateLimit(`checkout:${clientIp(req)}`, 20, 10 * 60 * 1000); // 20 / 10 min / IP
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
  const { number, customer, items } = parsed.data;

  try {
    // Idempotency: if this order number already exists, return it ONLY to the same
    // customer that owns it (or a guest who created it). Never echo another
    // customer's order id/amounts to a stranger replaying a guessed number.
    const existing = await prisma.order.findUnique({
      where: { number },
      include: { customer: { select: { userId: true } } },
    });
    if (existing) {
      const replayUser = await getCurrentUser();
      const ownsIt =
        // guest order (no linked account) → only the original guest reaches here on retry
        !existing.customer?.userId ||
        (replayUser?.role === "CUSTOMER" && replayUser.id === existing.customer.userId);
      if (!ownsIt) {
        return NextResponse.json(
          { error: { message: "This order was already submitted." } },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          data: {
            orderId: existing.id,
            number: existing.number,
            totalInr: Number(existing.totalInr),
            advanceInr: Number(existing.advanceInr),
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

    const order = await prisma.order.create({
      data: {
        number,
        customerId: cust.id,
        status: "PENDING_PAYMENT",
        subtotalInr,
        gstInr,
        totalInr,
        advanceInr,
        items: { create: orderItems },
      },
    });

    // Email the customer payment instructions + notify admin (fire-and-forget).
    await sendOfflineOrderCreated(order.id);

    return NextResponse.json(
      {
        data: {
          orderId: order.id,
          number,
          totalInr,
          advanceInr,
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
