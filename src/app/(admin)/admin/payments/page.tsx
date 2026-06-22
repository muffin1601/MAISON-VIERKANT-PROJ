import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getPaymentSubmissions, getPaymentStats, getOnlinePayments } from "@/services/admin/paymentQueries";
import { fmt } from "@/lib/format";
import { PaymentQueue } from "@/features/payments/PaymentQueue";
import { OnlinePaymentsTable } from "@/features/payments/OnlinePaymentsTable";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "payments.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Payments</div>
        <div className="a-sub">You do not have access to payments.</div>
      </div>
    );
  }

  const [rows, stats, onlinePayments] = await Promise.all([
    getPaymentSubmissions(),
    getPaymentStats(),
    getOnlinePayments(),
  ]);
  const canWrite = hasPermission(user.permissions, "payments.write");

  const cards = [
    { label: "Awaiting Review", value: String(stats.awaitingReview), sub: "Submitted" },
    { label: "Pending Payment", value: String(stats.pendingPaymentOrders), sub: "Orders" },
    { label: "Verified", value: String(stats.verifiedCount), sub: "Payments" },
    { label: "Revenue Received", value: fmt(stats.revenueReceived), sub: "Verified advances" },
  ];

  return (
    <div className="a-page active">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="a-title">Payments</div>
          <div className="a-sub">Offline payment submissions awaiting verification</div>
        </div>
        <a
          href="/api/admin/payments/export"
          className="btn-ghost"
          style={{ padding: "9px 18px", fontSize: 12, textDecoration: "none" }}
        >
          Export CSV
        </a>
      </div>

      <div className="stat-grid">
        {cards.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-l">{s.label}</div>
            <div className="stat-v">{s.value}</div>
            <div className="stat-s">{s.sub}</div>
          </div>
        ))}
      </div>

      <PaymentQueue rows={rows} canWrite={canWrite} />

      <OnlinePaymentsTable rows={onlinePayments} canWrite={canWrite} />
    </div>
  );
}
