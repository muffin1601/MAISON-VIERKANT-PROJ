"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { packagingInr, gstOnSubtotal } from "@/services/pricing/charges";
import { quoteSchema, type QuoteInput } from "@/validations/quote";

const QUOTE_STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"] as const;

function quoteNumber(): string {
  return "MVI-QT-" + Date.now().toString().slice(-6);
}

export async function saveQuote(input: QuoteInput): Promise<{ id: string; number: string }> {
  const user = await requirePermission("quotes.write");
  const d = quoteSchema.parse(input);

  // Mirror the storefront checkout model: ex-GST prices + packaging (₹30,000 × qty) +
  // GST (18% on the discounted subtotal). subtotalInr stays the gross, pre-discount base.
  const discount = d.discountPct / 100;
  const subtotal = d.lines.reduce((s, l) => s + l.unitInr * l.qty, 0);
  const netSubtotal = Math.round(subtotal * (1 - discount));
  const packaging = packagingInr(d.lines.reduce((s, l) => s + l.qty, 0));
  const gst = gstOnSubtotal(netSubtotal);
  const total = netSubtotal + packaging + gst;

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

  await recordAudit({ actorId: user.id, action: "quote.create", entity: "Quote", entityId: quote.id, after: { number, total } });
  revalidatePath("/admin/saved-quotes");
  return { id: quote.id, number };
}

export async function setQuoteStatus(id: string, status: string): Promise<{ ok: boolean }> {
  const user = await requirePermission("quotes.approve");
  if (!(QUOTE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Invalid quote status: ${status}`);
  }
  try {
    await prisma.quote.update({ where: { id }, data: { status } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return { ok: false };
    }
    throw err;
  }
  await recordAudit({ actorId: user.id, action: "quote.status", entity: "Quote", entityId: id, after: { status } });
  revalidatePath("/admin/saved-quotes");
  return { ok: true };
}
