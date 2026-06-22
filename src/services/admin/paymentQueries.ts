import "server-only";
import { prisma } from "@/lib/prisma";

/** A payment submission row enriched with order + customer context for the admin queue. */
export interface PaymentRow {
  id: string;
  orderNumber: string;
  orderStatus: string;
  customer: string;
  email: string;
  amountInr: number;
  orderTotalInr: number;
  method: string;
  transactionId: string;
  paidAt: string;
  submittedAt: string;
  status: string;
  rejectionReason: string | null;
  hasProof: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

function map(s: Awaited<ReturnType<typeof rawSubmissions>>[number]): PaymentRow {
  return {
    id: s.id,
    orderNumber: s.order.number,
    orderStatus: s.order.status,
    customer: s.order.customer?.name ?? "—",
    email: s.order.customer?.email ?? "",
    amountInr: Number(s.amountInr),
    orderTotalInr: Number(s.order.totalInr),
    method: s.method,
    transactionId: s.transactionId,
    paidAt: s.paidAt.toISOString().slice(0, 10),
    submittedAt: s.createdAt.toISOString().slice(0, 10),
    status: s.status,
    rejectionReason: s.rejectionReason,
    hasProof: !!s.proofKey,
    reviewedBy: s.reviewedBy?.name ?? null,
    reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString().slice(0, 10) : null,
  };
}

function rawSubmissions(where?: { status?: string }) {
  return prisma.paymentSubmission.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reviewedBy: { select: { name: true } },
      order: { select: { number: true, status: true, totalInr: true, customer: { select: { name: true, email: true } } } },
    },
  });
}

/** All submissions, newest first, SUBMITTED bubbling to the top for review. */
export async function getPaymentSubmissions(): Promise<PaymentRow[]> {
  const rows = await rawSubmissions();
  // SUBMITTED first (awaiting review), then the rest by recency.
  return rows
    .map(map)
    .sort((a, b) => {
      const pri = (s: string) => (s === "SUBMITTED" ? 0 : 1);
      return pri(a.status) - pri(b.status) || b.submittedAt.localeCompare(a.submittedAt);
    });
}

/** A Razorpay (online) payment row enriched with order + customer context. */
export interface OnlinePaymentRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  customer: string;
  email: string;
  provider: string;
  status: string; // PENDING | PROCESSING | CAPTURED | FAILED | REFUNDED
  amountInr: number;
  amountRefundedInr: number;
  currency: string;
  method: string | null;
  gatewayOrderId: string | null;
  gatewayPaymentId: string | null;
  webhookVerified: boolean;
  paidAt: string | null;
  createdAt: string;
}

/**
 * Online (Razorpay/COD) payments for the admin dashboard. The offline bank-transfer
 * proofs live in `getPaymentSubmissions`; this is the gateway-transaction ledger,
 * with provider / order id / payment id / status / paid date / verification flag.
 */
export async function getOnlinePayments(): Promise<OnlinePaymentRow[]> {
  const rows = await prisma.payment.findMany({
    where: { provider: { in: ["RAZORPAY", "COD"] } },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: { id: true, number: true, status: true, customer: { select: { name: true, email: true } } },
      },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    orderNumber: p.order.number,
    orderStatus: p.order.status,
    customer: p.order.customer?.name ?? "—",
    email: p.order.customer?.email ?? "",
    provider: p.provider,
    status: p.status,
    amountInr: Number(p.amountInr),
    amountRefundedInr: Number(p.amountRefundedInr),
    currency: p.currency,
    method: p.method,
    gatewayOrderId: p.gatewayOrderId,
    gatewayPaymentId: p.gatewayPaymentId,
    webhookVerified: p.webhookVerified,
    paidAt: p.paidAt ? p.paidAt.toISOString().slice(0, 10) : null,
    createdAt: p.createdAt.toISOString().slice(0, 10),
  }));
}

export interface PaymentStats {
  awaitingReview: number;
  verifiedCount: number;
  rejectedCount: number;
  pendingPaymentOrders: number;
  revenueReceived: number;
  inProduction: number;
  readyToDispatch: number;
}

/** Aggregate metrics for the dashboard + payments page. */
export async function getPaymentStats(): Promise<PaymentStats> {
  // Revenue received = the actual order advances for orders whose payment was
  // verified (or beyond), NOT the customer-claimed amount on the submission.
  const PAID_STATES = ["PAYMENT_VERIFIED", "IN_PRODUCTION", "READY_TO_DISPATCH", "DISPATCHED", "DELIVERED"];
  const [awaiting, verified, rejected, pendingOrders, revenueAgg, inProd, ready] = await Promise.all([
    prisma.paymentSubmission.count({ where: { status: "SUBMITTED" } }),
    prisma.paymentSubmission.count({ where: { status: "VERIFIED" } }),
    prisma.paymentSubmission.count({ where: { status: "REJECTED" } }),
    prisma.order.count({ where: { status: { in: ["PENDING_PAYMENT", "PAYMENT_REJECTED"] } } }),
    prisma.order.aggregate({ _sum: { advanceInr: true }, where: { status: { in: PAID_STATES } } }),
    prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
    prisma.order.count({ where: { status: "READY_TO_DISPATCH" } }),
  ]);
  return {
    awaitingReview: awaiting,
    verifiedCount: verified,
    rejectedCount: rejected,
    pendingPaymentOrders: pendingOrders,
    revenueReceived: Number(revenueAgg._sum.advanceInr ?? 0),
    inProduction: inProd,
    readyToDispatch: ready,
  };
}
