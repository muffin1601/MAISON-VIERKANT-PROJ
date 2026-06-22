/**
 * Generate an Excel workbook from the catalogue source data.
 *
 *   npx tsx prisma/tools/gen-catalogue-xlsx.ts
 *
 * Imports the SAME data the seed uses (prisma/data/catalogue.ts), so the sheet can
 * never drift from the app. Produces `catalogue.xlsx` at the project root with four
 * sheets: Product Models · Products · Orders · Projects.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PRODUCT_MODELS, PRODUCTS, ORDERS, PROJS } from "../data/catalogue";

// ---- Sheet 1: every model/variant (the priced SKUs) -----------------------
const modelRows = Object.entries(PRODUCT_MODELS).flatMap(([series, models]) =>
  models.map((m) => ({
    Series: series,
    "Model Code": m.code,
    "EUR Price": m.eur,
    Dimensions: m.dims,
  })),
);

// ---- Sheet 2: product series summaries ------------------------------------
const productRows = PRODUCTS.map((p) => ({
  ID: p.id,
  Series: p.series,
  Name: p.name,
  Description: p.desc,
  Sizes: p.sizes,
  "Representative Dims": p.dims,
  Finishes: p.finishes.join(", "),
  "EUR Price (from)": p.eurPrice,
  Stock: p.stock,
  Images: p.imgs.join("  |  "),
}));

// ---- Sheet 3: sample orders -----------------------------------------------
const orderRows = ORDERS.map((o) => ({
  "Order ID": o.id,
  Date: o.date,
  Client: o.client,
  Items: o.items,
  Status: o.status,
  "Total (INR)": o.total,
}));

// ---- Sheet 4: projects -----------------------------------------------------
const projectRows = PROJS.map((p) => ({
  Location: p.loc,
  Name: p.name,
  Description: p.desc,
  Image: p.img,
}));

/** Build a worksheet and give every column a sensible width. */
function sheet(rows: Record<string, unknown>[]): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (rows.length) {
    ws["!cols"] = Object.keys(rows[0]).map((key) => {
      const max = Math.max(
        key.length,
        ...rows.map((r) => String(r[key] ?? "").length),
      );
      return { wch: Math.min(Math.max(max + 2, 10), 70) };
    });
  }
  return ws;
}

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet(modelRows), "Product Models");
XLSX.utils.book_append_sheet(wb, sheet(productRows), "Products");
XLSX.utils.book_append_sheet(wb, sheet(orderRows), "Orders");
XLSX.utils.book_append_sheet(wb, sheet(projectRows), "Projects");

const out = path.join(process.cwd(), "catalogue.xlsx");
// Write via Buffer so we control the path (XLSX.writeFile also works).
const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync(out, buf);

console.log(
  `Wrote ${out}\n  Product Models: ${modelRows.length} variants\n  Products: ${productRows.length}\n  Orders: ${orderRows.length}\n  Projects: ${projectRows.length}`,
);
