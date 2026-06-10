/**
 * Generates supabase/seed.sql from the single source of truth (prisma/data/catalogue.ts).
 * Output is plain Postgres INSERTs using Prisma's quoted PascalCase table / camelCase column
 * names, so it loads cleanly into the schema produced by supabase/schema.sql.
 *
 * Run: npm run gen:seed-sql   (offline; no DB required)
 *
 * IDs are stable, human-readable natural keys (business codes) so foreign keys are explicit and
 * the file is reviewable. New rows created by the app still use Prisma cuid()s — IDs are arbitrary
 * text, so the two coexist.
 */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import bcrypt from "bcryptjs";
import {
  PRODUCTS,
  PRODUCT_MODELS,
  PROJS,
  ORDERS,
  FINISHES_STD,
  FINISHES_BASIC,
  FINISHES_ENGOBE,
} from "../data/catalogue";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- helpers ----
const q = (v: string | null | undefined) => (v == null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null | undefined) => (v == null ? "NULL" : String(v));
const j = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const lines: string[] = [];
const w = (s = "") => lines.push(s);

// ---- RBAC (mirrors prisma/seed.ts) ----
const PERMISSIONS = [
  "dashboard.read", "pricing.read", "pricing.manage", "products.read", "products.write",
  "inventory.read", "inventory.write", "orders.read", "orders.write", "leads.read", "leads.write",
  "customers.read", "customers.write", "quotes.read", "quotes.write", "quotes.approve",
  "purchase.read", "purchase.write", "settings.manage", "users.manage", "audit.read",
];
const ROLES: { key: string; label: string; perms: string[] | "*" }[] = [
  { key: "SUPER_ADMIN", label: "Super Admin", perms: "*" },
  { key: "ADMIN", label: "Admin Console", perms: PERMISSIONS.filter((p) => p !== "users.manage") },
  { key: "SALES_MANAGER", label: "Sales Manager", perms: ["customers.read", "customers.write", "quotes.read", "quotes.write", "quotes.approve", "leads.read", "leads.write", "orders.read"] },
  { key: "SALES_EXECUTIVE", label: "Sales Console", perms: ["customers.read", "customers.write", "quotes.read", "quotes.write", "leads.read", "leads.write"] },
  { key: "INVENTORY_MANAGER", label: "Inventory Manager", perms: ["inventory.read", "inventory.write", "products.read", "dashboard.read"] },
  { key: "CUSTOMER", label: "Customer", perms: [] },
];
const DEMO_USERS = [
  { email: "superadmin@watcon.net", name: "Super Admin", role: "SUPER_ADMIN" },
  { email: "admin@watcon.net", name: "Maison Admin", role: "ADMIN" },
  { email: "sales.manager@watcon.net", name: "Sales Manager", role: "SALES_MANAGER" },
  { email: "sales@watcon.net", name: "Sales Executive", role: "SALES_EXECUTIVE" },
  { email: "inventory@watcon.net", name: "Inventory Manager", role: "INVENTORY_MANAGER" },
];
const DEMO_PASSWORD = "Maison@2026";
const DEMO_HASH = bcrypt.hashSync(DEMO_PASSWORD, 12);

const tierFor = (finishes: string[]): string => {
  const set = new Set(finishes);
  if (FINISHES_ENGOBE.every((f) => set.has(f))) return "ENGOBE";
  if (FINISHES_STD.every((f) => set.has(f))) return "STD";
  if (FINISHES_BASIC.every((f) => set.has(f))) return "BASIC";
  return "STD";
};

// ---- header + reset ----
w("-- ============================================================================");
w("-- Maison Vierkant India — Supabase seed (generated; do not edit by hand)");
w("-- Source: prisma/data/catalogue.ts (auto-extracted from the HTML prototype).");
w("-- Preserves EXACT EUR prices, dimensions, finishes, stock, projects and orders.");
w("-- Apply AFTER supabase/schema.sql. Idempotent: truncates then re-inserts.");
w("-- ============================================================================");
w("BEGIN;");
w("");
w(`TRUNCATE TABLE
  "AuditLog","OrderItem","Payment","Invoice","Order","Address","CustomerNote","Customer",
  "PriceOverride","InventoryTransaction","Inventory","ProductFinish","ProductImage",
  "ProductVariant","ProductCollection","Product","Finish","Category","Collection","Project",
  "PricingRule","UploadedFile","RolePermission","User","Permission","Role","Setting"
RESTART IDENTITY CASCADE;`);
w("");

// ---- Permissions ----
w("-- Permissions");
w(`INSERT INTO "Permission" ("id","key") VALUES`);
w(PERMISSIONS.map((p) => `  (${q(p)}, ${q(p)})`).join(",\n") + ";");
w("");

// ---- Roles ----
w("-- Roles");
w(`INSERT INTO "Role" ("id","key","label") VALUES`);
w(ROLES.map((r) => `  (${q(r.key)}, ${q(r.key)}, ${q(r.label)})`).join(",\n") + ";");
w("");

// ---- RolePermission ----
w("-- Role ↔ Permission");
const rp: string[] = [];
for (const r of ROLES) {
  const grant = r.perms === "*" ? PERMISSIONS : r.perms;
  for (const p of grant) rp.push(`  (${q(r.key)}, ${q(p)})`);
}
w(`INSERT INTO "RolePermission" ("roleId","permissionId") VALUES`);
w(rp.join(",\n") + ";");
w("");

// ---- Users ----
w(`-- Demo console users — bcrypt-hashed password for all: ${DEMO_PASSWORD}`);
w(`INSERT INTO "User" ("id","email","name","passwordHash","roleId","isActive","createdAt","updatedAt") VALUES`);
w(
  DEMO_USERS.map(
    (u) => `  (${q(u.email)}, ${q(u.email)}, ${q(u.name)}, ${q(DEMO_HASH)}, ${q(u.role)}, true, now(), now())`,
  ).join(",\n") + ";",
);
w("");

// ---- Categories ----
const categoryKeys = Array.from(new Set(PRODUCTS.map((p: any) => p.series).filter(Boolean)));
w("-- Categories (series groups)");
w(`INSERT INTO "Category" ("id","key","name") VALUES`);
w(categoryKeys.map((k) => `  (${q("cat-" + slug(k))}, ${q(k)}, ${q(k)})`).join(",\n") + ";");
w("");

// ---- Collections ----
w("-- Collections");
w(`INSERT INTO "Collection" ("id","slug","name") VALUES`);
w(`  ('col-featured', 'featured', 'Featured Series');`);
w("");

// ---- Finishes ----
const allFinishes = Array.from(
  new Set([...FINISHES_ENGOBE, ...FINISHES_STD, ...FINISHES_BASIC, ...PRODUCTS.flatMap((p: any) => p.finishes)]),
);
const finishId = (name: string) => "fin-" + slug(name);
w("-- Finishes catalogue");
w(`INSERT INTO "Finish" ("id","name") VALUES`);
w(allFinishes.map((f) => `  (${q(finishId(f))}, ${q(f)})`).join(",\n") + ";");
w("");

// ---- Products + children ----
const usedSlugs = new Set<string>();
const uniqueSlug = (base: string) => {
  let s = base || "series";
  let i = 2;
  while (usedSlugs.has(s)) s = `${base}-${i++}`;
  usedSlugs.add(s);
  return s;
};

const productRows: string[] = [];
const imageRows: string[] = [];
const finishRows: string[] = [];
const variantRows: string[] = [];
const inventoryRows: string[] = [];
const collectionRows: string[] = [];
let variantCount = 0;

PRODUCTS.forEach((p: any, idx: number) => {
  const pslug = uniqueSlug(slug(p.name || p.id));
  productRows.push(
    `  (${q(p.id)}, ${q(p.id)}, ${q(pslug)}, ${q(p.name)}, ${q(p.desc)}, ${q(p.dims)}, ${n(p.eurPrice ?? 0)}, 'ACTIVE', ${q(p.series ? "cat-" + slug(p.series) : null)}, now(), now())`,
  );
  (p.imgs ?? []).forEach((url: string, i: number) => {
    imageRows.push(
      `  (${q(p.id + "-img-" + i)}, ${q(p.id)}, ${q(url)}, ${q(i === 0 ? "HERO" : "GALLERY")}, ${i})`,
    );
  });
  const tier = tierFor(p.finishes ?? []);
  (p.finishes ?? []).forEach((f: string) => {
    finishRows.push(`  (${q(p.id)}, ${q(finishId(f))}, ${q(tier)})`);
  });
  const models = (PRODUCT_MODELS as Record<string, { code: string; eur: number; dims: string }[]>)[p.id];
  (models ?? []).forEach((m) => {
    variantRows.push(`  (${q(m.code)}, ${q(p.id)}, ${q(m.code)}, ${n(m.eur)}, ${q(m.dims)})`);
    variantCount++;
  });
  inventoryRows.push(`  (${q("inv-" + p.id)}, ${q(p.id)}, ${n(p.stock ?? 0)}, 2, 'MAIN')`);
  if (idx < 8) collectionRows.push(`  (${q(p.id)}, 'col-featured')`);
});

w("-- Products");
w(`INSERT INTO "Product" ("id","code","slug","name","description","dimsSummary","eurPrice","status","categoryId","createdAt","updatedAt") VALUES`);
w(productRows.join(",\n") + ";");
w("");
w("-- Product images");
w(`INSERT INTO "ProductImage" ("id","productId","url","type","sort") VALUES`);
w(imageRows.join(",\n") + ";");
w("");
w("-- Product variants (models)");
w(`INSERT INTO "ProductVariant" ("id","productId","code","eurPrice","dims") VALUES`);
w(variantRows.join(",\n") + ";");
w("");
w("-- Product finishes");
w(`INSERT INTO "ProductFinish" ("productId","finishId","tier") VALUES`);
w(finishRows.join(",\n") + ";");
w("");
w("-- Inventory");
w(`INSERT INTO "Inventory" ("id","productId","quantity","lowStockThreshold","warehouse") VALUES`);
w(inventoryRows.join(",\n") + ";");
w("");
w("-- Featured collection membership");
w(`INSERT INTO "ProductCollection" ("productId","collectionId") VALUES`);
w(collectionRows.join(",\n") + ";");
w("");

// ---- Projects ----
w("-- Projects");
w(`INSERT INTO "Project" ("id","name","location","summary","imageUrl","sort","createdAt") VALUES`);
w(
  PROJS.map(
    (pr: any, i: number) => `  (${q("proj-" + i)}, ${q(pr.name)}, ${q(pr.loc)}, ${q(pr.desc)}, ${q(pr.img)}, ${i}, now())`,
  ).join(",\n") + ";",
);
w("");

// ---- Pricing rule (exact prototype defaults) ----
w("-- Default pricing rule (BR: rate 93.5, transport 18, packing flat 1500, duty 25, gst 18, profit 25)");
w(`INSERT INTO "PricingRule" ("id","name","rate","discountPct","transportPct","packingFlat","dutyPct","gstPct","profitPct","dealerMarkupPct","formulaKey","isActive","createdAt") VALUES`);
w(`  ('rule-default', 'Default', 93.5, 0, 18, 1500, 25, 18, 25, 0, 'STANDARD', true, now());`);
w("");

// ---- Settings ----
w("-- Settings");
w(`INSERT INTO "Setting" ("id","key","value") VALUES`);
w(
  [
    `  ('set-company', 'company', ${j({ name: "Maison Vierkant India", curatedBy: "Watcon", supplier: "Atelier Vierkant" })})`,
    `  ('set-tax', 'tax', ${j({ gstPct: 18, currency: "INR", baseCurrency: "EUR" })})`,
    `  ('set-shipping', 'shipping', ${j({ freeZones: ["delhi", "new delhi", "ncr", "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"], advancePct: 50 })})`,
  ].join(",\n") + ";",
);
w("");

// ---- Demo customers + orders ----
const statusMap: Record<string, string> = { pending: "PENDING", confirmed: "CONFIRMED", shipped: "SHIPPED", delivered: "DELIVERED" };
w("-- Demo customers");
w(`INSERT INTO "Customer" ("id","name","createdAt") VALUES`);
w(ORDERS.map((o: any) => `  (${q("cust-" + o.id)}, ${q(o.client)}, now())`).join(",\n") + ";");
w("");
w("-- Demo orders");
w(`INSERT INTO "Order" ("id","number","customerId","status","subtotalInr","totalInr","advanceInr","createdAt","updatedAt") VALUES`);
w(
  ORDERS.map(
    (o: any) =>
      `  (${q("ord-" + o.id)}, ${q("MVI-" + o.id)}, ${q("cust-" + o.id)}, ${q(statusMap[o.status] ?? "PENDING")}, ${n(o.total)}, ${n(o.total)}, ${n(Math.round(o.total * 0.5))}, ${q(o.date)}, now())`,
  ).join(",\n") + ";",
);
w("");
w("COMMIT;");
w("");
w(`-- Summary: ${PRODUCTS.length} products, ${variantCount} variants, ${PROJS.length} projects, ${ORDERS.length} orders, ${ROLES.length} roles, ${DEMO_USERS.length} users.`);

const out = resolve(__dirname, "../../supabase/seed.sql");
writeFileSync(out, lines.join("\n") + "\n");
console.log(`✓ Wrote ${out}`);
console.log(`  products=${PRODUCTS.length} variants=${variantCount} projects=${PROJS.length} orders=${ORDERS.length}`);
