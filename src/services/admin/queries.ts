/** Admin read queries (server-only). DB-backed via Prisma. */
import { prisma } from "@/lib/prisma";
import { calcINR, DEFAULT_PRICING, type PricingConfig } from "@/services/pricing/PricingService";
import { getActivePricing } from "@/services/catalogue/catalogue";

export interface DashStat {
  label: string;
  value: string;
  sub: string;
}

export async function getDashboard() {
  const pricing = await getActivePricing();
  // Aggregate in the DB instead of pulling every order/inventory row into memory.
  const [revenueAgg, productCount, active, recentOrders, inventories] = await Promise.all([
    prisma.order.aggregate({ _sum: { totalInr: true } }),
    prisma.product.count(),
    prisma.order.count({ where: { status: { not: "DELIVERED" } } }),
    prisma.order.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.inventory.findMany({ include: { product: true } }),
  ]);

  const revenue = Number(revenueAgg._sum.totalInr ?? 0);
  const low = inventories.filter((i) => i.quantity <= i.lowStockThreshold);

  const stats: DashStat[] = [
    { label: "Total Revenue", value: inr(revenue), sub: "All orders" },
    { label: "Active Orders", value: String(active), sub: "Pending" },
    { label: "Series", value: String(productCount), sub: "In catalogue" },
    { label: "Low Stock", value: String(low.length), sub: "≤2 units" },
  ];

  const recent = recentOrders.map((o) => ({
    id: o.number,
    date: o.createdAt.toISOString().slice(0, 10),
    client: o.customer?.name ?? "—",
    total: Number(o.totalInr),
    status: o.status.toLowerCase(),
  }));

  const lowStock = low.map((i) => ({
    id: i.product?.code ?? i.id,
    name: i.product?.name ?? "—",
    qty: i.quantity,
  }));

  return { stats, recent, lowStock, pricing };
}

export async function getLeads() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  return leads.map((l) => ({
    id: l.id,
    date: l.createdAt.toISOString().slice(0, 10),
    name: l.name,
    email: l.email ?? "—",
    phone: l.phone ?? "—",
    type: l.type ?? l.source,
    company: l.company ?? "—",
    source: l.source,
    status: l.status,
  }));
}

export async function getOrders() {
  const orders = await prisma.order.findMany({
    include: { customer: true, items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });
  return orders.map((o) => ({
    id: o.number,
    date: o.createdAt.toISOString().slice(0, 10),
    client: o.customer?.name ?? "—",
    items: o.items.map((it) => `${it.product.name} ×${it.qty}`).join(", ") || "—",
    total: Number(o.totalInr),
    status: o.status.toLowerCase(),
  }));
}

export async function getStockRows() {
  const pricing = await getActivePricing();
  const products = await prisma.product.findMany({
    include: { category: true, variants: true, inventory: true },
    orderBy: { name: "asc" },
  });
  return products.map((p) => ({
    id: p.id,
    series: p.category?.name ?? "",
    name: p.name,
    sizes: p.variants.map((v) => v.code).join(", "),
    dims: p.dimsSummary ?? "",
    eur: Number(p.eurPrice),
    inr: calcINR(Number(p.eurPrice), pricing),
    stock: p.inventory?.quantity ?? 0,
  }));
}

export async function getCustomers() {
  const customers = await prisma.customer.findMany({
    include: { orders: true, addresses: true, _count: { select: { orders: true, quotes: true } } },
    orderBy: { name: "asc" },
  });
  return customers.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    company: c.company ?? "",
    orders: c._count.orders,
    quotes: c._count.quotes,
    value: c.orders.reduce((s, o) => s + Number(o.totalInr), 0),
  }));
}

function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export const _pricingFallback: PricingConfig = DEFAULT_PRICING;
