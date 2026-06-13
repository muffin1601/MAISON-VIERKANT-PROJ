"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import type { PricingConfig } from "@/services/pricing/PricingService";

export interface PriceEntryInput {
  code: string;
  eur: number;
}

/** Apply extracted/CSV EUR prices to matching variants & products. */
export async function applyPriceEntries(
  entries: PriceEntryInput[],
): Promise<{ updated: number }> {
  const user = await requirePermission("pricing.manage");
  let updated = 0;
  for (const e of entries) {
    if (!e.code || !(e.eur > 0)) continue;
    const variant = await prisma.productVariant.findUnique({ where: { code: e.code } });
    if (variant) {
      await prisma.productVariant.update({ where: { id: variant.id }, data: { eurPrice: e.eur } });
      updated++;
      continue;
    }
    const product = await prisma.product.findUnique({ where: { code: e.code } });
    if (product) {
      await prisma.product.update({ where: { id: product.id }, data: { eurPrice: e.eur } });
      updated++;
    }
  }
  if (updated) {
    await recordAudit({ actorId: user.id, action: "pricing.applyEntries", entity: "ProductVariant", after: { updated } });
    revalidatePath("/admin/pricing");
    revalidatePath("/collection");
  }
  return { updated };
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
  return { ok: true };
}
