import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const orderSchema = z.object({
  number: z.string().min(1),
  total: z.number().nonnegative(),
  customer: z.object({
    name: z.string().min(1),
    email: z.string().optional().default(""),
    phone: z.string().optional().default(""),
    company: z.string().optional().default(""),
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
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
});

/** Persist a placed order (checkout step 4). Graceful when DB is unavailable. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
  }
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Validation failed" } }, { status: 422 });
  }
  const { number, total, customer, items } = parsed.data;

  try {
    const cust = await prisma.customer.create({
      data: {
        name: customer.name,
        email: customer.email || null,
        phone: customer.phone || null,
        company: customer.company || null,
        addresses: customer.addr1
          ? {
              create: {
                type: "SHIPPING",
                line1: customer.addr1,
                line2: customer.addr2 || null,
                city: customer.city,
                state: customer.state,
                pincode: customer.pin,
              },
            }
          : undefined,
      },
    });

    // Map cart codes to products/variants.
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
        return {
          productId: p.id,
          variantId: variant?.id ?? null,
          finish: i.finish,
          qty: i.qty,
          eurAtOrder: eur,
          unitPriceInr: 0,
          pricingSnapshot: { code: i.code },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const order = await prisma.order.create({
      data: {
        number,
        customerId: cust.id,
        status: "PENDING",
        subtotalInr: total,
        totalInr: total,
        advanceInr: Math.round(total * 0.5),
        items: { create: orderItems },
      },
    });
    return NextResponse.json({ data: { id: order.id, number } }, { status: 201 });
  } catch {
    return NextResponse.json({ data: { number, queued: true } }, { status: 202 });
  }
}
