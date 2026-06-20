/**
 * Seed — Maison Vierkant India
 * Populates roles/permissions, demo users, the full catalogue (82 series / 460+ models),
 * finishes, projects, a default pricing rule, settings, and demo orders/customers.
 *
 * Source catalogue data is auto-extracted from the prototype into ./data/catalogue.ts.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  PRODUCTS,
  PRODUCT_MODELS,
  PROJS,
  ORDERS,
  FINISHES_STD,
  FINISHES_BASIC,
  FINISHES_ENGOBE,
} from "./data/catalogue";

const prisma = new PrismaClient();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---- RBAC definitions ----
const PERMISSIONS = [
  "dashboard.read",
  "pricing.read",
  "pricing.manage",
  "products.read",
  "products.write",
  "inventory.read",
  "inventory.write",
  "orders.read",
  "orders.write",
  "payments.read",
  "payments.write",
  "leads.read",
  "leads.write",
  "customers.read",
  "customers.write",
  "quotes.read",
  "quotes.write",
  "quotes.approve",
  "purchase.read",
  "purchase.write",
  "settings.manage",
  "users.manage",
  "audit.read",
];

const ROLES: { key: string; label: string; perms: string[] | "*" }[] = [
  { key: "SUPER_ADMIN", label: "Super Admin", perms: "*" },
  {
    key: "ADMIN",
    label: "Admin Console",
    perms: PERMISSIONS.filter((p) => p !== "users.manage"),
  },
  {
    key: "SALES_MANAGER",
    label: "Sales Manager",
    perms: [
      "customers.read",
      "customers.write",
      "quotes.read",
      "quotes.write",
      "quotes.approve",
      "leads.read",
      "leads.write",
      "orders.read",
      "payments.read",
      "payments.write",
    ],
  },
  {
    key: "SALES_EXECUTIVE",
    label: "Sales Console",
    perms: [
      "customers.read",
      "customers.write",
      "quotes.read",
      "quotes.write",
      "leads.read",
      "leads.write",
    ],
  },
  {
    key: "INVENTORY_MANAGER",
    label: "Inventory Manager",
    perms: ["inventory.read", "inventory.write", "products.read", "dashboard.read"],
  },
  { key: "CUSTOMER", label: "Customer", perms: [] },
];

// Shared demo password for every seeded console user (change in production!).
const DEMO_PASSWORD = "Maison@2026";
const DEMO_HASH = bcrypt.hashSync(DEMO_PASSWORD, 12);

const DEMO_USERS = [
  { email: "superadmin@watcon.net", name: "Super Admin", role: "SUPER_ADMIN" },
  { email: "admin@watcon.net", name: "Maison Admin", role: "ADMIN" },
  { email: "sales.manager@watcon.net", name: "Sales Manager", role: "SALES_MANAGER" },
  { email: "sales@watcon.net", name: "Sales Executive", role: "SALES_EXECUTIVE" },
  { email: "inventory@watcon.net", name: "Inventory Manager", role: "INVENTORY_MANAGER" },
];

function tierFor(finishes: string[]): string {
  const set = new Set(finishes);
  if (FINISHES_ENGOBE.every((f) => set.has(f))) return "ENGOBE";
  if (FINISHES_STD.every((f) => set.has(f))) return "STD";
  if (FINISHES_BASIC.every((f) => set.has(f))) return "BASIC";
  return "STD";
}

async function main() {
  console.log("→ Resetting tables…");
  // Order matters for FK constraints.
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.order.deleteMany(),
    prisma.address.deleteMany(),
    prisma.customerNote.deleteMany(),
    prisma.priceOverride.deleteMany(),
    prisma.inventoryTransaction.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.productFinish.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.productCollection.deleteMany(),
    prisma.product.deleteMany(),
    prisma.finish.deleteMany(),
    prisma.category.deleteMany(),
    prisma.collection.deleteMany(),
    prisma.project.deleteMany(),
    prisma.pricingRule.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.user.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  // ---- Permissions & roles ----
  console.log("→ Seeding RBAC…");
  const permRecords = await Promise.all(
    PERMISSIONS.map((key) => prisma.permission.create({ data: { key } })),
  );
  const permByKey = new Map(permRecords.map((p) => [p.key, p.id]));

  const roleByKey = new Map<string, string>();
  for (const role of ROLES) {
    const created = await prisma.role.create({ data: { key: role.key, label: role.label } });
    roleByKey.set(role.key, created.id);
    const grant = role.perms === "*" ? PERMISSIONS : role.perms;
    await prisma.rolePermission.createMany({
      data: grant.map((p) => ({ roleId: created.id, permissionId: permByKey.get(p)! })),
    });
  }

  // ---- Demo users ----
  for (const u of DEMO_USERS) {
    await prisma.user.create({
      data: { email: u.email, name: u.name, passwordHash: DEMO_HASH, roleId: roleByKey.get(u.role)! },
    });
  }

  // ---- Finishes catalogue ----
  console.log("→ Seeding finishes…");
  const allFinishes = Array.from(
    new Set([...FINISHES_ENGOBE, ...FINISHES_STD, ...FINISHES_BASIC, ...PRODUCTS.flatMap((p) => p.finishes)]),
  );
  const finishByName = new Map<string, string>();
  for (const name of allFinishes) {
    const f = await prisma.finish.create({ data: { name } });
    finishByName.set(name, f.id);
  }

  // ---- Categories (series groups) ----
  console.log("→ Seeding categories & products…");
  const categoryKeys = Array.from(new Set(PRODUCTS.map((p) => p.series).filter(Boolean)));
  const categoryByKey = new Map<string, string>();
  for (const key of categoryKeys) {
    const c = await prisma.category.create({ data: { key, name: key } });
    categoryByKey.set(key, c.id);
  }

  // Curated marketing collection.
  const featured = await prisma.collection.create({
    data: { slug: "featured", name: "Featured Series" },
  });

  // ---- Products + variants + images + finishes + inventory ----
  const usedSlugs = new Set<string>();
  const uniqueSlug = (base: string) => {
    let s = base || "series";
    let i = 2;
    while (usedSlugs.has(s)) s = `${base}-${i++}`;
    usedSlugs.add(s);
    return s;
  };

  let variantCount = 0;
  for (const [idx, p] of PRODUCTS.entries()) {
    const slug = uniqueSlug(slugify(p.name || p.id));
    const product = await prisma.product.create({
      data: {
        code: p.id,
        slug,
        name: p.name,
        description: p.desc ?? null,
        dimsSummary: p.dims ?? null,
        eurPrice: p.eurPrice ?? 0,
        categoryId: p.series ? categoryByKey.get(p.series) : null,
        images: {
          create: (p.imgs ?? []).map((url: string, i: number) => ({
            url,
            type: i === 0 ? "HERO" : "GALLERY",
            sort: i,
          })),
        },
      },
    });

    // finishes
    const tier = tierFor(p.finishes ?? []);
    for (const fname of p.finishes ?? []) {
      const fid = finishByName.get(fname);
      if (fid) {
        await prisma.productFinish.create({
          data: { productId: product.id, finishId: fid, tier },
        });
      }
    }

    // variants (models)
    const models = (PRODUCT_MODELS as Record<string, { code: string; eur: number; dims: string }[]>)[
      p.id
    ];
    if (models?.length) {
      for (const m of models) {
        await prisma.productVariant.create({
          data: { productId: product.id, code: m.code, eurPrice: m.eur, dims: m.dims },
        });
        variantCount++;
      }
    }

    // inventory (stock from prototype)
    await prisma.inventory.create({
      data: { productId: product.id, quantity: p.stock ?? 0, lowStockThreshold: 2 },
    });

    // first 8 products → featured collection
    if (idx < 8) {
      await prisma.productCollection.create({
        data: { productId: product.id, collectionId: featured.id },
      });
    }
  }

  // ---- Projects ----
  console.log("→ Seeding projects…");
  for (const [i, pr] of PROJS.entries()) {
    await prisma.project.create({
      data: { name: pr.name, location: pr.loc, summary: pr.desc, imageUrl: pr.img, sort: i },
    });
  }

  // ---- Default pricing rule (exact prototype defaults) ----
  console.log("→ Seeding pricing rule & settings…");
  await prisma.pricingRule.create({
    data: {
      name: "Default",
      rate: 93.5,
      discountPct: 0,
      transportPct: 18,
      packingFlat: 1500,
      dutyPct: 25,
      gstPct: 18,
      profitPct: 25,
      dealerMarkupPct: 0,
      formulaKey: "STANDARD",
      isActive: true,
    },
  });

  await prisma.setting.createMany({
    data: [
      { key: "company", value: { name: "Maison Vierkant India", curatedBy: "Watcon", supplier: "Atelier Vierkant" } },
      { key: "tax", value: { gstPct: 18, currency: "INR", baseCurrency: "EUR" } },
      { key: "shipping", value: { freeZones: ["delhi", "new delhi", "ncr", "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"], advancePct: 50 } },
    ],
  });

  // ---- Demo customers + orders ----
  console.log("→ Seeding demo orders…");
  for (const o of ORDERS) {
    const customer = await prisma.customer.create({ data: { name: o.client } });
    const statusMap: Record<string, string> = {
      pending: "PENDING",
      confirmed: "CONFIRMED",
      shipped: "SHIPPED",
      delivered: "DELIVERED",
    };
    await prisma.order.create({
      data: {
        number: "MVI-" + o.id,
        customerId: customer.id,
        status: statusMap[o.status] ?? "PENDING",
        subtotalInr: o.total,
        totalInr: o.total,
        advanceInr: Math.round(o.total * 0.5),
        createdAt: new Date(o.date),
      },
    });
  }

  const productTotal = await prisma.product.count();
  console.log(
    `✓ Seed complete: ${productTotal} products, ${variantCount} variants, ${PROJS.length} projects, ${ORDERS.length} orders, ${ROLES.length} roles, ${DEMO_USERS.length} users.`,
  );
  console.log(`  Demo console login → any seeded email, password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
