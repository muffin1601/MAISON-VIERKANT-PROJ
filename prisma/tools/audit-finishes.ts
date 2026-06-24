/**
 * audit-finishes.ts — READ-ONLY reconciliation between the Excel source of truth
 * (catalogue-products.xlsx → sheet "Products") and the Supabase/Postgres database.
 *
 * Writes NOTHING. Produces a full audit (reports A–G + summary + update preview)
 * to stdout and to prisma/tools/AUDIT-FINISHES-REPORT.md.
 *
 *   npx tsx prisma/tools/audit-finishes.ts
 *
 * SQL used for verification is printed inline in PHASE 2 / SQL section.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import pkg from "xlsx";

const XLSX = (pkg as unknown as { default?: typeof pkg }).default ?? pkg;
const prisma = new PrismaClient();

const FILE = "catalogue-products.xlsx";
const SHEET = "Products";

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------
const normName = (s: string) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

const normFinish = (s: string) => String(s ?? "").replace(/\s+/g, " ").trim();

const PLACEHOLDERS = new Set(["", "na", "n/a", "none", "null", "-", "—", "tbd", "on request"]);

function parseFinishes(raw: unknown): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const tok of String(raw ?? "").split(",")) {
    const c = normFinish(tok);
    if (!c) continue;
    if (PLACEHOLDERS.has(c.toLowerCase())) invalid.push(c);
    else if (!valid.some((v) => v.toLowerCase() === c.toLowerCase())) valid.push(c);
  }
  return { valid, invalid };
}

// Set comparison (case-insensitive) → missing (in Excel, absent in DB) / extra (in DB, absent in Excel)
function diffFinishes(excel: string[], db: string[]) {
  const el = new Set(excel.map((x) => x.toLowerCase()));
  const dl = new Set(db.map((x) => x.toLowerCase()));
  const missing = excel.filter((x) => !dl.has(x.toLowerCase()));
  const extra = db.filter((x) => !el.has(x.toLowerCase()));
  const exact = missing.length === 0 && extra.length === 0 && excel.length > 0;
  return { missing, extra, exact };
}

type ExcelRow = { code: string; name: string; finishes: string[]; invalid: string[]; rowNo: number };
type DbProduct = { id: string; code: string; slug: string; name: string; finishes: string[] };

async function main() {
  // =====================================================================
  // PHASE 1 — EXCEL ANALYSIS
  // =====================================================================
  const wb = XLSX.read(readFileSync(path.resolve(process.cwd(), FILE)), { type: "buffer" });
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[SHEET], { defval: null });

  const excelRows: ExcelRow[] = raw.map((r, i) => {
    const { valid, invalid } = parseFinishes(r["Finishes"]);
    return {
      code: String(r["Code"] ?? "").trim(),
      name: String(r["Name"] ?? "").trim(),
      finishes: valid,
      invalid,
      rowNo: i + 2, // header is row 1
    };
  });

  // Excel duplicates (by code, and by normalized name)
  const excelCodeCount = new Map<string, number>();
  const excelNameCount = new Map<string, number>();
  for (const r of excelRows) {
    if (r.code) excelCodeCount.set(r.code, (excelCodeCount.get(r.code) ?? 0) + 1);
    const n = normName(r.name);
    if (n) excelNameCount.set(n, (excelNameCount.get(n) ?? 0) + 1);
  }
  const excelDupCodes = [...excelCodeCount].filter(([, c]) => c > 1);
  const excelDupNames = [...excelNameCount].filter(([, c]) => c > 1);
  const excelMissingFinishes = excelRows.filter((r) => r.finishes.length === 0);
  const excelInvalid = excelRows.filter((r) => r.invalid.length > 0);

  // =====================================================================
  // PHASE 2 — SUPABASE / DB ANALYSIS
  // =====================================================================
  // SQL equivalents (printed for verification):
  const SQL = {
    totalProducts: `SELECT count(*) FROM "Product";`,
    productsWithFinishes: `
      SELECT p.code, p.slug, p.name,
             coalesce(array_agg(f.name) FILTER (WHERE f.name IS NOT NULL), '{}') AS finishes
      FROM "Product" p
      LEFT JOIN "ProductFinish" pf ON pf."productId" = p.id
      LEFT JOIN "Finish" f         ON f.id = pf."finishId"
      GROUP BY p.id, p.code, p.slug, p.name
      ORDER BY p.code;`,
    dbDuplicateCodes: `
      SELECT code, count(*) FROM "Product" GROUP BY code HAVING count(*) > 1;`,
  };

  const dbRaw = await prisma.product.findMany({
    select: {
      id: true, code: true, slug: true, name: true,
      finishes: { select: { finish: { select: { name: true } } } },
    },
    orderBy: { code: "asc" },
  });
  const dbProducts: DbProduct[] = dbRaw.map((p) => ({
    id: p.id, code: p.code, slug: p.slug, name: p.name,
    finishes: p.finishes.map((x) => x.finish.name),
  }));

  // DB duplicates (code is @unique so structurally none; check normalized name collisions)
  const dbNameCount = new Map<string, number>();
  for (const p of dbProducts) {
    const n = normName(p.name);
    if (n) dbNameCount.set(n, (dbNameCount.get(n) ?? 0) + 1);
  }
  const dbDupNames = [...dbNameCount].filter(([, c]) => c > 1);

  // =====================================================================
  // PHASE 3 — MATCHING (priority: code → slug → exact name → normalized name)
  // =====================================================================
  const byCode = new Map(dbProducts.map((p) => [p.code.toLowerCase(), p]));
  const bySlug = new Map(dbProducts.map((p) => [p.slug.toLowerCase(), p]));
  const byExactName = new Map<string, DbProduct[]>();
  const byNormName = new Map<string, DbProduct[]>();
  for (const p of dbProducts) {
    (byExactName.get(p.name) ?? byExactName.set(p.name, []).get(p.name)!).push(p);
    const n = normName(p.name);
    (byNormName.get(n) ?? byNormName.set(n, []).get(n)!).push(p);
  }

  type Match = { excel: ExcelRow; db: DbProduct | null; method: string; confidence: number };
  const matchedDbIds = new Set<string>();
  const matches: Match[] = excelRows.map((r) => {
    let db: DbProduct | null = null;
    let method = "none";
    let confidence = 0;

    if (r.code && byCode.has(r.code.toLowerCase())) {
      db = byCode.get(r.code.toLowerCase())!; method = "product_code"; confidence = 100;
    } else if (r.code && bySlug.has(r.code.toLowerCase())) {
      db = bySlug.get(r.code.toLowerCase())!; method = "slug"; confidence = 97;
    } else if (byExactName.get(r.name)?.length === 1) {
      db = byExactName.get(r.name)![0]; method = "exact_name"; confidence = 95;
    } else if (byNormName.get(normName(r.name))?.length === 1) {
      db = byNormName.get(normName(r.name))![0]; method = "normalized_name"; confidence = 88;
    } else if ((byExactName.get(r.name)?.length ?? 0) > 1 || (byNormName.get(normName(r.name))?.length ?? 0) > 1) {
      method = "ambiguous_name"; confidence = 50; // multiple candidates → manual review
    }
    if (db) matchedDbIds.add(db.id);
    return { excel: r, db, method, confidence };
  });

  // =====================================================================
  // PHASE 4 — CLASSIFY
  // =====================================================================
  const A_correct: Match[] = [];
  const B_missingInDb: Match[] = [];
  const C_missingInExcel: Match[] = [];
  const D_mismatch: (Match & { missing: string[]; extra: string[] })[] = [];
  const E_excelOnly: Match[] = [];
  const lowConfidence: Match[] = [];

  for (const m of matches) {
    if (m.confidence < 95 || !m.db) {
      if (!m.db) E_excelOnly.push(m);
      else lowConfidence.push(m);
      continue;
    }
    const { missing, extra, exact } = diffFinishes(m.excel.finishes, m.db.finishes);
    if (m.excel.finishes.length > 0 && m.db.finishes.length === 0) {
      B_missingInDb.push(m);
    } else if (m.excel.finishes.length === 0 && m.db.finishes.length > 0) {
      C_missingInExcel.push(m);
    } else if (exact) {
      A_correct.push(m);
    } else {
      D_mismatch.push({ ...m, missing, extra });
    }
  }

  // F — DB products not present in Excel (by matched id)
  const F_dbOnly = dbProducts.filter((p) => !matchedDbIds.has(p.id));

  // =====================================================================
  // BUILD REPORT
  // =====================================================================
  const L: string[] = [];
  const w = (s = "") => L.push(s);
  const fin = (a: string[]) => (a.length ? a.join(", ") : "∅ (empty)");
  const tbl = (head: string[], rows: string[][]) => {
    w(`| ${head.join(" | ")} |`);
    w(`| ${head.map(() => "---").join(" | ")} |`);
    for (const r of rows) w(`| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`);
    if (!rows.length) w(`| ${head.map(() => "—").join(" | ")} |`);
  };

  w(`# Finishes Reconciliation Audit — READ ONLY`);
  w(`Source of truth: \`${FILE}\` → sheet \`${SHEET}\`. Database: Supabase/Postgres via Prisma.`);
  w("");

  // PHASE 1
  w(`## PHASE 1 — Excel Analysis`);
  w(`- Sheet names: ${wb.SheetNames.map((s) => `\`${s}\``).join(", ")} (audited: \`${SHEET}\`)`);
  w(`- Identifier column: \`Code\`  ·  Name column: \`Name\`  ·  Finish column: \`Finishes\` (comma-separated string)`);
  w(`- Total products in Excel: **${excelRows.length}**`);
  w(`- Duplicate codes: **${excelDupCodes.length}**${excelDupCodes.length ? " → " + excelDupCodes.map(([c, n]) => `${c}×${n}`).join(", ") : ""}`);
  w(`- Duplicate names (normalized): **${excelDupNames.length}**${excelDupNames.length ? " → " + excelDupNames.map(([c, n]) => `${c}×${n}`).join(", ") : ""}`);
  w(`- Rows with missing finishes: **${excelMissingFinishes.length}**${excelMissingFinishes.length ? " → " + excelMissingFinishes.map((r) => r.code || r.name).join(", ") : ""}`);
  w(`- Rows with invalid finish tokens: **${excelInvalid.length}**${excelInvalid.length ? " → " + excelInvalid.map((r) => `${r.code}[${r.invalid.join("/")}]`).join(", ") : ""}`);
  w("");

  // PHASE 2
  w(`## PHASE 2 — Supabase / Database Analysis`);
  w(`- Products table: \`Product\`  ·  Primary key: \`id\` (cuid)  ·  Code field: \`code\` (\`@unique\`)  ·  Slug: \`slug\` (\`@unique\`)  ·  Name: \`name\``);
  w(`- **SKU field: none** — no SKU column exists in the schema; matching falls back to slug/name.`);
  w(`- Finishes field: **relation** \`finishes Product → ProductFinish(tier) → Finish(name)\` (many-to-many). Not a scalar/array column.`);
  w(`- Total products in Database: **${dbProducts.length}**`);
  w(`- DB duplicate codes: **0** (\`code\` is \`@unique\`). Normalized-name collisions: **${dbDupNames.length}**${dbDupNames.length ? " → " + dbDupNames.map(([c, n]) => `"${c}"×${n}`).join(", ") : ""}`);
  w("");
  w(`<details><summary>SQL used for verification</summary>`);
  w("");
  w("```sql");
  w(`-- total products`); w(SQL.totalProducts.trim());
  w(`-- products with their finishes`); w(SQL.productsWithFinishes.trim());
  w(`-- duplicate codes`); w(SQL.dbDuplicateCodes.trim());
  w("```");
  w(`</details>`);
  w("");

  // PHASE 3
  w(`## PHASE 3 — Matching Confidence`);
  const methodCount = matches.reduce<Record<string, number>>((a, m) => ((a[m.method] = (a[m.method] ?? 0) + 1), a), {});
  tbl(["Match method", "Confidence", "Count"], Object.entries(methodCount).map(([k, v]) => [
    k, { product_code: "100%", slug: "97%", exact_name: "95%", normalized_name: "88%", ambiguous_name: "50%", none: "0%" }[k] ?? "?", String(v),
  ]));
  w("");
  w(`Matches below 95% confidence are flagged for **manual review** (not auto-actioned).`);
  w("");

  // PHASE 4
  w(`## PHASE 4 — Audit Reports`);

  w(`### A. Products with Correct Finishes (Exact Match) — ${A_correct.length}`);
  tbl(["Product Name", "Code", "Excel Finishes", "DB Finishes", "Status"],
    A_correct.map((m) => [m.db!.name, m.db!.code, fin(m.excel.finishes), fin(m.db!.finishes), "✅ Exact Match"]));
  w("");

  w(`### B. Missing Finishes in Database — ${B_missingInDb.length}`);
  tbl(["Product Name", "Code", "Excel Finishes", "DB Finishes", "Action"],
    B_missingInDb.map((m) => [m.db!.name, m.db!.code, fin(m.excel.finishes), "∅ (empty)", "INSERT finishes from Excel"]));
  w("");

  w(`### C. Missing Finishes in Excel — ${C_missingInExcel.length}`);
  tbl(["Product Name", "Code", "DB Finishes", "Excel Finishes", "Action"],
    C_missingInExcel.map((m) => [m.db!.name, m.db!.code, fin(m.db!.finishes), "∅ (empty)", "Review Excel / keep DB"]));
  w("");

  w(`### D. Finish Mismatches — ${D_mismatch.length}`);
  tbl(["Product Name", "Code", "Excel (truth)", "DB (current)", "Missing in DB", "Extra in DB", "Recommended"],
    D_mismatch.map((m) => [m.db!.name, m.db!.code, fin(m.excel.finishes), fin(m.db!.finishes),
      fin(m.missing), fin(m.extra), fin(m.excel.finishes)]));
  w("");

  w(`### E. In Excel but Not in Database — ${E_excelOnly.length}`);
  tbl(["Product Name", "Code (Excel)", "Note"],
    E_excelOnly.map((m) => [m.excel.name, m.excel.code, "No code/slug/name match in DB"]));
  w("");

  w(`### F. In Database but Not in Excel — ${F_dbOnly.length}`);
  tbl(["Product Name", "Code", "DB Finishes"],
    F_dbOnly.map((p) => [p.name, p.code, fin(p.finishes)]));
  w("");

  w(`### G. Duplicates`);
  w(`- Excel duplicate codes: ${excelDupCodes.length ? excelDupCodes.map(([c, n]) => `${c}×${n}`).join(", ") : "none"}`);
  w(`- Excel duplicate names: ${excelDupNames.length ? excelDupNames.map(([c, n]) => `"${c}"×${n}`).join(", ") : "none"}`);
  w(`- Database duplicate codes: none (\`@unique\`)`);
  w(`- Database duplicate names: ${dbDupNames.length ? dbDupNames.map(([c, n]) => `"${c}"×${n}`).join(", ") : "none"}`);
  w("");

  // Low-confidence / manual review
  w(`### ⚠ Flagged for Manual Review (confidence < 95%) — ${lowConfidence.length}`);
  tbl(["Excel Name", "Excel Code", "Method", "Confidence"],
    lowConfidence.map((m) => [m.excel.name, m.excel.code, m.method, `${m.confidence}%`]));
  w("");

  // PHASE 5 — Dashboard
  const totalMatched = matches.filter((m) => m.db).length;
  w(`## PHASE 5 — Summary Dashboard`);
  tbl(["Metric", "Value"], [
    ["Total products in Excel", String(excelRows.length)],
    ["Total products in Database", String(dbProducts.length)],
    ["Total matched products", String(totalMatched)],
    ["Exact finish matches (A)", String(A_correct.length)],
    ["Missing finishes in DB (B)", String(B_missingInDb.length)],
    ["Missing finishes in Excel (C)", String(C_missingInExcel.length)],
    ["Finish mismatches (D)", String(D_mismatch.length)],
    ["Excel-only products (E)", String(E_excelOnly.length)],
    ["Database-only products (F)", String(F_dbOnly.length)],
    ["Duplicate products (Excel codes+names)", String(excelDupCodes.length + excelDupNames.length)],
    ["Flagged for manual review", String(lowConfidence.length)],
  ]);
  w("");

  // PHASE 6 — Update Preview
  const toUpdate = [...B_missingInDb, ...D_mismatch];
  let affected = 0;
  w(`## PHASE 6 — Update Preview (NO changes applied)`);
  w(`These are the products that *would* be updated, with old → new finishes. Mismatches (D) and DB-missing (B) only; correct (A) and DB-only (F) are left untouched.`);
  w("");
  tbl(["Code", "Product", "Old (DB) Finishes", "New (Excel) Finishes", "Records affected (ProductFinish rows)"],
    toUpdate.map((m) => {
      const newCount = m.excel.finishes.length;
      affected += newCount;
      return [m.db!.code, m.db!.name, fin(m.db!.finishes), fin(m.excel.finishes), String(newCount)];
    }));
  w("");
  w(`- Products that would be updated: **${toUpdate.length}**`);
  w(`- ProductFinish rows that would be written: **${affected}**`);
  w(`- Confidence on all previewed updates: ≥95% (lower-confidence rows excluded above).`);
  w("");
  w(`> Audit only — no database changes were made. Use \`update-finishes.ts --apply\` to act on these after review.`);

  const out = L.join("\n");
  console.log(out);
  const outPath = path.resolve(process.cwd(), "prisma/tools/AUDIT-FINISHES-REPORT.md");
  writeFileSync(outPath, out, "utf8");
  console.log(`\n📄 Written: ${outPath}`);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
