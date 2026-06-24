/**
 * update-finishes.ts — UPDATE-ONLY migration: backfill Product `finishes`.
 *
 * Reads `catalogue-products.xlsx` (sheet "Products"), extracts the comma-separated
 * `Finishes` column, matches each row to an existing Product, and replaces ONLY that
 * product's ProductFinish join rows. No products are created/deleted; no other field
 * (name, description, pricing, images, category, stock, SEO, timestamps, …) is touched.
 *
 * `finishes` is a many-to-many relation (Product → ProductFinish → Finish), so the
 * "field" is the set of ProductFinish rows. We ensure each Finish exists (by unique
 * name), compute `tier` exactly like prisma/seed.ts, and set the join rows in a
 * per-product transaction so a failure on one product never half-writes.
 *
 * USAGE:
 *   npx tsx prisma/tools/update-finishes.ts            # DRY RUN (default — writes nothing)
 *   npx tsx prisma/tools/update-finishes.ts --apply    # ACTUAL update
 *   npx tsx prisma/tools/update-finishes.ts --apply --batch=25
 *   npx tsx prisma/tools/update-finishes.ts --file="catalogue-products.xlsx" --sheet="Products"
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import pkg from "xlsx";
import { FINISHES_STD, FINISHES_BASIC, FINISHES_ENGOBE } from "../data/catalogue";

// xlsx ships CJS; normalize the default-interop shape for ESM ("type":"module").
const XLSX = (pkg as unknown as { default?: typeof pkg }).default ?? pkg;

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  const eq = hit.indexOf("=");
  return eq === -1 ? "true" : hit.slice(eq + 1);
};

const APPLY = flag("apply") !== undefined; // default: dry run
const FILE = flag("file") ?? "catalogue-products.xlsx";
const SHEET = flag("sheet") ?? "Products";
const BATCH = Math.max(1, Number(flag("batch") ?? 25) || 25);

// ---------------------------------------------------------------------------
// Tier logic — copied verbatim from prisma/seed.ts so results match the seed.
// ---------------------------------------------------------------------------
function tierFor(finishes: string[]): string {
  const set = new Set(finishes);
  if (FINISHES_ENGOBE.every((f) => set.has(f))) return "ENGOBE";
  if (FINISHES_STD.every((f) => set.has(f))) return "STD";
  if (FINISHES_BASIC.every((f) => set.has(f))) return "BASIC";
  return "STD";
}

// ---------------------------------------------------------------------------
// Finish-name normalization (PHASE 4: clean)
//   - trim, collapse internal whitespace
//   - drop empties / placeholders ("NA", "N/A", "-", "ON REQUEST", …)
//   - canonicalize casing against names already known in the DB (case-insensitive),
//     so "white" / "WHITE" both resolve to the existing "White" Finish and we never
//     create a duplicate Finish that differs only by case.
// ---------------------------------------------------------------------------
const PLACEHOLDERS = new Set(["", "na", "n/a", "none", "null", "-", "—", "tbd", "on request"]);

function cleanToken(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}
function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

type Report = {
  totalRows: number;
  matched: number;
  updated: number;
  unchanged: number;
  skippedNoFinish: number;
  notFound: { code: unknown; name: unknown }[];
  duplicateRows: { code: unknown; count: number }[];
  invalidFinishTokens: { code: unknown; token: string }[];
  newFinishesCreated: string[];
  errors: { code: unknown; error: string }[];
};

async function main() {
  console.log("=".repeat(72));
  console.log(`FINISHES UPDATE MIGRATION  —  mode: ${APPLY ? "🟢 APPLY (writing)" : "🟡 DRY RUN (no writes)"}`);
  console.log(`File: ${FILE}  |  Sheet: ${SHEET}  |  Batch: ${BATCH}`);
  console.log("=".repeat(72));

  const report: Report = {
    totalRows: 0, matched: 0, updated: 0, unchanged: 0, skippedNoFinish: 0,
    notFound: [], duplicateRows: [], invalidFinishTokens: [], newFinishesCreated: [], errors: [],
  };

  // ---- Read Excel -------------------------------------------------------
  const abs = path.resolve(process.cwd(), FILE);
  const wb = XLSX.read(readFileSync(abs), { type: "buffer" });
  if (!wb.SheetNames.includes(SHEET)) {
    throw new Error(`Sheet "${SHEET}" not found. Available: ${wb.SheetNames.join(", ")}`);
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEET], { defval: null });
  report.totalRows = rows.length;

  // ---- Detect duplicate codes (logged, but each is still processed) -----
  const codeCounts = new Map<string, number>();
  for (const r of rows) {
    const c = String(r["Code"] ?? "").trim();
    if (c) codeCounts.set(c, (codeCounts.get(c) ?? 0) + 1);
  }
  for (const [code, count] of codeCounts) {
    if (count > 1) report.duplicateRows.push({ code, count });
  }

  // ---- Preload existing Finish names for case-insensitive canonicalization
  const existingFinishes = await prisma.finish.findMany({ select: { id: true, name: true } });
  // lower(name) -> canonical record
  const finishByLower = new Map(existingFinishes.map((f) => [f.name.toLowerCase(), f]));

  // Resolve a cleaned token to a canonical Finish name (creating it if new, when APPLY).
  // Returns null for placeholders/empties.
  async function resolveFinishId(token: string, ownerCode: unknown): Promise<string | null> {
    const cleaned = cleanToken(token);
    if (PLACEHOLDERS.has(cleaned.toLowerCase())) {
      if (cleaned) report.invalidFinishTokens.push({ code: ownerCode, token });
      return null;
    }
    const hit = finishByLower.get(cleaned.toLowerCase());
    if (hit) return hit.id;

    // Unknown finish — keep existing casing if it already looks intentional, else title-case.
    const canonical = cleaned === cleaned.toLowerCase() || cleaned === cleaned.toUpperCase()
      ? titleCase(cleaned)
      : cleaned;

    if (!report.newFinishesCreated.includes(canonical)) report.newFinishesCreated.push(canonical);

    if (!APPLY) {
      // In dry-run we can't get a real id; use a sentinel so counting still works.
      const sentinel = `__new__:${canonical}`;
      finishByLower.set(canonical.toLowerCase(), { id: sentinel, name: canonical });
      return sentinel;
    }
    const created = await prisma.finish.create({ data: { name: canonical }, select: { id: true, name: true } });
    finishByLower.set(canonical.toLowerCase(), created);
    return created.id;
  }

  // ---- Process rows in batches -----------------------------------------
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    const batchNo = Math.floor(start / BATCH) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH);

    for (const row of batch) {
      const code = (row["Code"] ?? "") as string;
      const name = (row["Name"] ?? "") as string;
      const slug = (row["Slug"] ?? row["slug"] ?? "") as string; // optional, if present

      try {
        // --- Match by priority: code → slug → exact name -----------------
        let product: { id: string } | null = null;
        const codeS = String(code).trim();
        const slugS = String(slug).trim();
        const nameS = String(name).trim();

        if (codeS) product = await prisma.product.findUnique({ where: { code: codeS }, select: { id: true } });
        if (!product && slugS) product = await prisma.product.findUnique({ where: { slug: slugS }, select: { id: true } });
        if (!product && nameS) {
          const byName = await prisma.product.findMany({ where: { name: nameS }, select: { id: true } });
          if (byName.length === 1) product = byName[0]; // only match if unambiguous
        }

        if (!product) {
          report.notFound.push({ code: code, name: name });
          continue;
        }
        report.matched++;

        // --- Parse + clean finishes (PHASE 4) ----------------------------
        const rawFinishes = String(row["Finishes"] ?? "").split(",");
        const seen = new Set<string>();
        const finishIds: string[] = [];
        const finishNames: string[] = [];
        for (const tok of rawFinishes) {
          const id = await resolveFinishId(tok, code);
          if (!id) continue;
          const canon = finishByLower.get(cleanToken(tok).toLowerCase())?.name ?? cleanToken(tok);
          if (seen.has(id)) continue; // dedupe
          seen.add(id);
          finishIds.push(id);
          finishNames.push(canon);
        }

        if (finishIds.length === 0) {
          report.skippedNoFinish++;
          console.log(`  ⏭  ${codeS || nameS}: no valid finishes after cleaning — skipped`);
          continue;
        }

        const tier = tierFor(finishNames);

        // --- Compare to current state (idempotency) ----------------------
        const current = await prisma.productFinish.findMany({
          where: { productId: product.id },
          select: { finishId: true, tier: true },
        });
        const currentSet = new Set(current.map((c) => `${c.finishId}|${c.tier}`));
        const desiredSet = new Set(finishIds.map((fid) => `${fid}|${tier}`));
        const identical =
          currentSet.size === desiredSet.size && [...desiredSet].every((d) => currentSet.has(d));

        if (identical) {
          report.unchanged++;
          continue;
        }

        // --- Write ONLY the finishes relation, atomically ----------------
        if (APPLY) {
          await prisma.$transaction([
            prisma.productFinish.deleteMany({ where: { productId: product!.id } }),
            prisma.productFinish.createMany({
              data: finishIds.map((fid) => ({ productId: product!.id, finishId: fid, tier })),
              skipDuplicates: true,
            }),
          ]);
        }
        report.updated++;
        console.log(`  ${APPLY ? "✅" : "📝"} ${codeS || nameS}: ${finishIds.length} finishes [${tier}] → ${finishNames.join(", ")}`);
      } catch (err) {
        report.errors.push({ code, error: err instanceof Error ? err.message : String(err) });
        console.error(`  ❌ ${code}: ${err instanceof Error ? err.message : err}`);
      }
    }
    console.log(`  …batch ${batchNo}/${totalBatches} done (${Math.min(start + BATCH, rows.length)}/${rows.length} rows)`);
  }

  // ---- PHASE 6: Final report -------------------------------------------
  console.log("\n" + "=".repeat(72));
  console.log("FINAL REPORT" + (APPLY ? "" : "  (DRY RUN — nothing was written)"));
  console.log("=".repeat(72));
  console.log(`Total Excel rows .............. ${report.totalRows}`);
  console.log(`Products matched .............. ${report.matched}`);
  console.log(`Products updated ${APPLY ? "" : "(would update)"} . ${report.updated}`);
  console.log(`Products unchanged (already ok) ${report.unchanged}`);
  console.log(`Skipped (no valid finishes) .. ${report.skippedNoFinish}`);
  console.log(`Not found in DB .............. ${report.notFound.length}`);
  console.log(`Duplicate rows (by Code) ..... ${report.duplicateRows.length}`);
  console.log(`Invalid finish tokens ........ ${report.invalidFinishTokens.length}`);
  console.log(`New Finish records ${APPLY ? "created" : "needed"} .. ${report.newFinishesCreated.length}`);
  console.log(`Errors ....................... ${report.errors.length}`);

  if (report.notFound.length)
    console.log("\nNot found:", report.notFound.map((n) => n.code || n.name).join(", "));
  if (report.duplicateRows.length)
    console.log("\nDuplicates:", JSON.stringify(report.duplicateRows));
  if (report.invalidFinishTokens.length)
    console.log("\nInvalid finish tokens:", JSON.stringify(report.invalidFinishTokens.slice(0, 50)));
  if (report.newFinishesCreated.length)
    console.log("\nNew finishes:", report.newFinishesCreated.join(", "));
  if (report.errors.length)
    console.log("\nErrors:", JSON.stringify(report.errors, null, 2));

  if (!APPLY)
    console.log("\n👉 Re-run with --apply to commit these changes.");
}

main()
  .catch((e) => {
    console.error("\nFATAL:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
