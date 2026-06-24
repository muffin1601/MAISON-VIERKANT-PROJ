/**
 * gen-reconciliation-csv.ts — READ ONLY. Emits the finish-reconciliation worksheet
 * (Excel-only + all DB-only outliers) to prisma/tools/FINISH-RECONCILIATION.csv.
 * Writes no database changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import pkg from "xlsx";

const XLSX = (pkg as unknown as { default?: typeof pkg }).default ?? pkg;
const prisma = new PrismaClient();

// 11 canonical catalogue finishes (source of truth vocabulary).
const CANONICAL = new Set(
  ["Natural Clay", "White", "Ivory", "Terracotta Red", "Bordeaux Red", "Deep Blue",
   "Anthracite", "Cork", "Nordic White", "Taupe Grey", "Leather Option"].map((s) => s.toLowerCase()),
);

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

async function main() {
  // Excel codes (source of truth membership)
  const wb = XLSX.read(readFileSync(path.resolve(process.cwd(), "catalogue-products.xlsx")), { type: "buffer" });
  const xrows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Products"], { defval: null });
  const excelCodes = new Set(xrows.map((r) => String(r["Code"] ?? "").trim().toLowerCase()).filter(Boolean));

  const db = await prisma.product.findMany({
    select: { code: true, name: true, finishes: { select: { finish: { select: { name: true } } } } },
    orderBy: { code: "asc" },
  });

  const rows: string[][] = [
    ["Product Code", "Product Name", "Status", "Current Finishes in DB", "Recommended Action", "Notes"],
  ];

  // E — Excel-only (codes in Excel with no DB match)
  const dbCodes = new Set(db.map((p) => p.code.toLowerCase()));
  for (const code of excelCodes) {
    if (!dbCodes.has(code)) {
      const orig = xrows.find((r) => String(r["Code"] ?? "").trim().toLowerCase() === code);
      const name = String(orig?.["Name"] ?? code);
      rows.push([code.toUpperCase(), name, "Exists in Excel Only", "", "Manual Review",
        "Product present in Excel but not found in database"]);
    }
  }

  // F — DB-only, split into "no finishes" vs "non-standard finishes"
  for (const p of db) {
    if (excelCodes.has(p.code.toLowerCase())) continue; // covered by catalogue, already correct
    const finishes = p.finishes.map((x) => x.finish.name);
    if (finishes.length === 0) {
      rows.push([p.code, p.name, "DB Only - No Finishes Applied", "", "Add Finishes",
        "Product exists in database but not in Excel source"]);
    } else {
      const nonStd = finishes.filter((f) => !CANONICAL.has(f.toLowerCase()));
      const status = nonStd.length ? "DB Only - Non Standard Finishes" : "DB Only - Standard Finishes";
      const note = nonStd.length
        ? `Uses non-catalogue finish names: ${nonStd.join(", ")}`
        : "Standard finishes present; product not in Excel catalogue";
      rows.push([p.code, p.name, status, finishes.join(", "), "Manual Review", note]);
    }
  }

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  const out = path.resolve(process.cwd(), "prisma/tools/FINISH-RECONCILIATION.csv");
  writeFileSync(out, csv, "utf8");
  console.log(csv);
  console.log(`Rows (excl. header): ${rows.length - 1}`);
  console.log(`Written: ${out}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
