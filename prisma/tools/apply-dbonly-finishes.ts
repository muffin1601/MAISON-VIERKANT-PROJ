/**
 * apply-dbonly-finishes.ts — Sets a fixed 9-finish palette on every DB-only product
 * (products whose `code` is NOT present in catalogue-products.xlsx). Overwrites their
 * existing ProductFinish rows. Creates any missing Finish records. Touches ONLY finishes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import pkg from "xlsx";

const XLSX = (pkg as unknown as { default?: typeof pkg }).default ?? pkg;
const prisma = new PrismaClient();

const PALETTE = ["White", "Sand", "Taupe", "Grey", "Anthracite", "Black", "Green", "Nordic White", "Clay"];
const TIER = "STD";

async function main() {
  // Excel catalogue codes = source-of-truth membership (these are LEFT UNTOUCHED).
  const wb = XLSX.read(readFileSync(path.resolve(process.cwd(), "catalogue-products.xlsx")), { type: "buffer" });
  const xrows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Products"], { defval: null });
  const excelCodes = new Set(xrows.map((r) => String(r["Code"] ?? "").trim().toLowerCase()).filter(Boolean));

  // Ensure the 9 Finish records exist (case-insensitive against existing names).
  const existing = await prisma.finish.findMany({ select: { id: true, name: true } });
  const byLower = new Map(existing.map((f) => [f.name.toLowerCase(), f]));
  const finishIds: string[] = [];
  const created: string[] = [];
  for (const name of PALETTE) {
    let rec = byLower.get(name.toLowerCase());
    if (!rec) {
      rec = await prisma.finish.create({ data: { name }, select: { id: true, name: true } });
      byLower.set(name.toLowerCase(), rec);
      created.push(name);
    }
    finishIds.push(rec.id);
  }
  console.log(`Finish records — existing: ${PALETTE.length - created.length}, created: ${created.length}${created.length ? " (" + created.join(", ") + ")" : ""}`);

  // DB-only products = code not in the Excel catalogue.
  const all = await prisma.product.findMany({ select: { id: true, code: true, name: true } });
  const targets = all.filter((p) => !excelCodes.has(p.code.toLowerCase()));
  console.log(`Target DB-only products: ${targets.length}\n`);

  let updated = 0;
  for (const p of targets) {
    await prisma.$transaction([
      prisma.productFinish.deleteMany({ where: { productId: p.id } }),
      prisma.productFinish.createMany({
        data: finishIds.map((fid) => ({ productId: p.id, finishId: fid, tier: TIER })),
        skipDuplicates: true,
      }),
    ]);
    updated++;
    console.log(`  ✅ ${p.code} (${p.name}) ← ${PALETTE.length} finishes`);
  }

  console.log(`\nDone. Products updated: ${updated}. ProductFinish rows written: ${updated * PALETTE.length}.`);
  console.log(`Catalogue products left untouched: ${all.length - targets.length}.`);
}

main().catch((e) => { console.error("FATAL:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
