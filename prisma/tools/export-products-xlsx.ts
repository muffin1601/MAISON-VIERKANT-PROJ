/**
 * Exports the catalogue PRODUCTS data to an Excel workbook.
 *   npx tsx prisma/tools/export-products-xlsx.ts
 * Writes catalogue-products.xlsx to the project root.
 */
import * as XLSX from "xlsx";
import path from "node:path";
import { PRODUCTS, PRODUCT_MODELS } from "../data/catalogue";

type ProductModel = { code: string; eur: number; dims: string };

const rows = PRODUCTS.map((p, i) => {
  const models = (PRODUCT_MODELS as Record<string, ProductModel[]>)[p.id] ?? [];
  const eurs = models.map((m) => m.eur);
  return {
    "#": i + 1,
    Code: p.id,
    Series: p.series,
    Name: p.name,
    Description: p.desc,
    Sizes: p.sizes,
    "Representative Dimensions": p.dims,
    "Base EUR Price": p.eurPrice,
    "Variant Count": models.length,
    "Variant Codes": models.map((m) => m.code).join(", "),
    "EUR Min": eurs.length ? Math.min(...eurs) : p.eurPrice,
    "EUR Max": eurs.length ? Math.max(...eurs) : p.eurPrice,
    Finishes: p.finishes.join(", "),
    "Finish Count": p.finishes.length,
    Stock: p.stock,
    Images: p.imgs.length,
  };
});

const ws = XLSX.utils.json_to_sheet(rows);

// Sensible column widths.
ws["!cols"] = [
  { wch: 4 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 50 }, { wch: 30 },
  { wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 10 },
  { wch: 60 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
];
ws["!autofilter"] = { ref: `A1:P${rows.length + 1}` };

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Products");

const out = path.join(process.cwd(), "catalogue-products.xlsx");
XLSX.writeFile(wb, out);
console.log(`Wrote ${rows.length} products → ${out}`);
