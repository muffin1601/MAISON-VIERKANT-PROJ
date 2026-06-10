"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { quoteSchema, type QuoteInput } from "@/validations/quote";

function quoteNumber(): string {
  return "MVI-QT-" + Date.now().toString().slice(-6);
}

export async function saveQuote(input: QuoteInput): Promise<{ id: string; number: string }> {
  await requirePermission("quotes.write");
  const d = quoteSchema.parse(input);

  const discount = d.discountPct / 100;
  const subtotal = d.lines.reduce((s, l) => s + l.unitInr * l.qty, 0);
  const total = Math.round(subtotal * (1 - discount));

  // Upsert a customer record from the quote's billing details.
  const customer = await prisma.customer.create({
    data: {
      name: d.customer.name,
      company: d.customer.company || null,
      email: d.customer.email || null,
      phone: d.customer.phone || null,
    },
  });

  // Map product ids (accepts product.id or product.code).
  const products = await prisma.product.findMany({
    where: { OR: [{ id: { in: d.lines.map((l) => l.productId) } }, { code: { in: d.lines.map((l) => l.productId) } }] },
  });
  const byKey = new Map<string, string>();
  for (const p of products) {
    byKey.set(p.id, p.id);
    byKey.set(p.code, p.id);
  }

  const number = quoteNumber();
  const quote = await prisma.quote.create({
    data: {
      number,
      customerId: customer.id,
      status: "DRAFT",
      dealerMarkupPct: 0,
      billingJson: d.customer,
      subtotalInr: subtotal,
      totalInr: total,
      items: {
        create: d.lines
          .filter((l) => byKey.has(l.productId))
          .map((l) => ({
            productId: byKey.get(l.productId)!,
            variantCode: l.variantCode || null,
            finish: l.finish,
            qty: l.qty,
            unitPriceInr: l.unitInr,
          })),
      },
      versions: {
        create: { version: 1, snapshot: { lines: d.lines, discountPct: d.discountPct, total } },
      },
    },
  });

  revalidatePath("/admin/saved-quotes");
  return { id: quote.id, number };
}

export async function setQuoteStatus(id: string, status: string): Promise<{ ok: boolean }> {
  await requirePermission("quotes.approve");
  await prisma.quote.update({ where: { id }, data: { status } });
  revalidatePath("/admin/saved-quotes");
  return { ok: true };
}
