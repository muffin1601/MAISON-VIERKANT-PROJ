"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import type { PricingConfig } from "@/services/pricing/PricingService";

export interface PriceEntryInput {
  code: string;
  eur: number;
}

export interface ApplyPriceResult {
  updated: number;
  /** Model codes from the file that matched no variant or product (price NOT applied). */
  unmatched: string[];
}

/**
 * Normalise a model code for tolerant matching. Handles the real-world mismatches
 * between an uploaded price list and the (historically messy) catalogue codes:
 *  - case differences            A40 ⇄ a40
 *  - parenthetical descriptors   "AS60 (Felix)" ⇄ "AS60",  "ASL (bronze)" ⇄ "ASL"
 *  - asterisk footnote markers   "BR80*" ⇄ "BR80"
 *  - spaces / . _ - separators   "ADAMAS 60" ⇄ "ADAMAS60",  "KH3-60" ⇄ "KH360"
 */
function normCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/\([^)]*\)/g, "") // drop "(Felix)", "(2colors)", "(Cognac)" …
    .replace(/\*/g, "") // drop footnote asterisks
    .replace(/[\s._-]/g, "") // drop spaces and separators
    .trim();
}

/**
 * Apply uploaded EUR prices to the matching model. Each row's `code` is matched
 * against `ProductVariant.code` first (the model number, e.g. A40), then `Product.code`
 * (series-level). Matching is exact first, then tolerant of case and spacing
 * (so `ADAMAS60` matches a stored `ADAMAS 60`). Codes that match nothing — or that are
 * ambiguous under normalisation — are returned in `unmatched` so the admin can see
 * exactly which prices did not land. Reads the catalogue once, then writes in a batch.
 */
export async function applyPriceEntries(
  entries: PriceEntryInput[],
): Promise<ApplyPriceResult> {
  const user = await requirePermission("pricing.manage");

  const [variants, products] = await Promise.all([
    prisma.productVariant.findMany({ select: { id: true, code: true } }),
    prisma.product.findMany({ select: { id: true, code: true } }),
  ]);

  // Exact lookup maps.
  const variantByCode = new Map(variants.map((v) => [v.code, v.id]));
  const productByCode = new Map(products.map((p) => [p.code, p.id]));

  // Normalised maps (null = ambiguous: >1 record normalises to the same key → don't guess).
  const variantByNorm = new Map<string, string | null>();
  for (const v of variants) {
    const k = normCode(v.code);
    variantByNorm.set(k, variantByNorm.has(k) ? null : v.id);
  }
  const productByNorm = new Map<string, string | null>();
  for (const p of products) {
    const k = normCode(p.code);
    productByNorm.set(k, productByNorm.has(k) ? null : p.id);
  }

  const variantUpdates: { id: string; eur: number }[] = [];
  const productUpdates: { id: string; eur: number }[] = [];
  const unmatched: string[] = [];

  for (const e of entries) {
    const code = e.code?.trim();
    if (!code || !(e.eur > 0)) continue;

    // Exact variant match wins.
    const exactV = variantByCode.get(code);
    if (exactV) {
      variantUpdates.push({ id: exactV, eur: e.eur });
      continue;
    }
    // Normalised variant match. `null` = ambiguous (>1 variant normalises here) →
    // do NOT guess and do NOT fall through to a product; report as unmatched.
    const normV = variantByNorm.get(normCode(code));
    if (normV) {
      variantUpdates.push({ id: normV, eur: e.eur });
      continue;
    }
    if (normV === null) {
      unmatched.push(code);
      continue;
    }
    // Then product-level, with the same ambiguity guard.
    const exactP = productByCode.get(code);
    if (exactP) {
      productUpdates.push({ id: exactP, eur: e.eur });
      continue;
    }
    const normP = productByNorm.get(normCode(code));
    if (normP) {
      productUpdates.push({ id: normP, eur: e.eur });
      continue;
    }
    unmatched.push(code);
  }

  const updated = variantUpdates.length + productUpdates.length;
  if (updated) {
    await prisma.$transaction([
      ...variantUpdates.map((u) =>
        prisma.productVariant.update({ where: { id: u.id }, data: { eurPrice: u.eur } }),
      ),
      ...productUpdates.map((u) =>
        prisma.product.update({ where: { id: u.id }, data: { eurPrice: u.eur } }),
      ),
    ]);
    await recordAudit({
      actorId: user.id,
      action: "pricing.applyEntries",
      entity: "ProductVariant",
      after: { updated, unmatched: unmatched.length },
    });
    revalidatePath("/admin/pricing");
    revalidatePath("/collection");
    // Bulk price entries mutate ProductVariant.eurPrice → the catalogue cache is stale.
    revalidateTag("catalogue");
  }
  return { updated, unmatched };
}

/** Persist the active pricing rule. Updates every INR price across the site. */
export async function savePricing(config: PricingConfig): Promise<{ ok: boolean }> {
  const user = await requirePermission("pricing.manage");
  const active = await prisma.pricingRule.findFirst({ where: { isActive: true } });
  const data = {
    rate: config.rate,
    discountPct: config.discountPct,
    transportPct: config.transportPct,
    packingFlat: config.packingFlat,
    dutyPct: config.dutyPct,
    swsPct: config.swsPct ?? 0,
    gstPct: config.gstPct,
    profitPct: config.profitPct,
    dealerMarkupPct: config.dealerMarkupPct ?? 0,
  };
  if (active) {
    await prisma.pricingRule.update({ where: { id: active.id }, data });
  } else {
    await prisma.pricingRule.create({ data: { name: "Default", isActive: true, ...data } });
  }
  await recordAudit({ actorId: user.id, action: "pricing.update", entity: "PricingRule", entityId: active?.id ?? null, after: data });
  // The active pricing rule changes every INR price site-wide — invalidate the cached
  // pricing (and revalidate the storefront) so the new rates appear immediately.
  revalidateTag("pricing");
  revalidatePath("/collection");
  revalidatePath("/admin/pricing");
  return { ok: true };
}
