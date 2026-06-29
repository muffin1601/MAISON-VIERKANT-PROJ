/** Admin read queries (server-only). DB-backed via Prisma. */
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { DEFAULT_PRICING, type PricingConfig } from "@/services/pricing/PricingService";
import { getActivePricing } from "@/services/catalogue/catalogue";
import { getPaymentStats } from "@/services/admin/paymentQueries";
import type { LeadRow } from "@/features/leads/LeadsView";

export interface DashStat {
  label: string;
  value: string;
  sub: string;
}

export async function getDashboard() {
  const pricing = await getActivePricing();
  // Aggregate in the DB instead of pulling every order row into memory.
  const [productCount, active, recentOrders, payStats] = await Promise.all([
    prisma.product.count(),
    prisma.order.count({ where: { status: { not: "DELIVERED" } } }),
    prisma.order.findMany({ include: { customer: true }, orderBy: { createdAt: "desc" }, take: 6 }),
    getPaymentStats(),
  ]);

  const stats: DashStat[] = [
    { label: "Revenue Received", value: inr(payStats.revenueReceived), sub: "Verified advances" },
    { label: "Payments to Review", value: String(payStats.awaitingReview), sub: "Awaiting verification" },
    { label: "Pending Payment", value: String(payStats.pendingPaymentOrders), sub: "Orders" },
    { label: "In Production", value: String(payStats.inProduction), sub: "Verified & building" },
    { label: "Ready to Dispatch", value: String(payStats.readyToDispatch), sub: "Awaiting shipment" },
    { label: "Active Orders", value: String(active), sub: "Not delivered" },
    { label: "Series", value: String(productCount), sub: "In catalogue" },
  ];

  const recent = recentOrders.map((o) => ({
    id: o.number,
    date: o.createdAt.toISOString().slice(0, 10),
    client: o.customer?.name ?? "—",
    total: Number(o.totalInr),
    status: String(o.status ?? "").toLowerCase(),
  }));

  return { stats, recent, pricing };
}

export interface LeadsResult {
  leads: LeadRow[];
  /** True when the underlying query failed and `leads` is an empty fallback. */
  failed: boolean;
}

/**
 * Catalogue & contact leads for the admin console.
 *
 * Never throws: a DB/connection/Prisma failure is logged with full context and
 * degraded to an empty result with `failed: true`, so the admin page renders a
 * friendly banner instead of crashing into the error boundary.
 */
export async function getLeads(): Promise<LeadsResult> {
  try {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
    const rows: LeadRow[] = leads.map((l) => ({
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
    return { leads: rows, failed: false };
  } catch (err) {
    const e = err as { code?: string; message?: string; stack?: string };
    logger.error(
      {
        page: "/admin/leads",
        fn: "getLeads",
        query: "prisma.lead.findMany",
        prismaCode: e?.code ?? null,
        message: e?.message ?? String(err),
        stack: e?.stack ?? null,
        at: new Date().toISOString(),
      },
      "Failed to load catalogue leads",
    );
    return { leads: [], failed: true };
  }
}

/**
 * Commerce analytics for the dashboard: payment success rate, checkout conversion,
 * average order value, and confirmed revenue. Cheap aggregate queries.
 */
export async function getCommerceMetrics() {
  const [captured, failed, sessionsTotal, sessionsCompleted, orderAgg] = await Promise.all([
    prisma.payment.count({ where: { status: "CAPTURED" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.checkoutSession.count(),
    prisma.checkoutSession.count({ where: { status: "COMPLETED" } }),
    prisma.order.aggregate({ _avg: { totalInr: true }, _count: { _all: true } }),
  ]);
  const payTotal = captured + failed;
  const paymentSuccessRate = payTotal === 0 ? null : Math.round((captured / payTotal) * 100);
  const conversionRate = sessionsTotal === 0 ? null : Math.round((sessionsCompleted / sessionsTotal) * 100);
  const aov = orderAgg._avg.totalInr ? Number(orderAgg._avg.totalInr) : 0;
  return {
    paymentSuccessRate,
    conversionRate,
    aov,
    orderCount: orderAgg._count._all,
    capturedPayments: captured,
    failedPayments: failed,
  };
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
    items: o.items.map((it) => `${it.product?.name ?? "Item"} ×${it.qty}`).join(", ") || "—",
    total: Number(o.totalInr),
    status: String(o.status ?? "").toLowerCase(),
    trackingNumber: o.trackingNumber ?? "",
    courier: o.courier ?? "",
    trackingUrl: o.trackingUrl ?? "",
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
