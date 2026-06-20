import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getDashboard } from "@/services/admin/queries";
import { fmt } from "@/lib/format";
import { statusMeta } from "@/lib/orderStatus";

export const dynamic = "force-dynamic";

/** Faithful port of prototype renderDash. */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!hasPermission(user.permissions, "dashboard.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Dashboard</div>
        <div className="a-sub">Your role does not include dashboard access.</div>
      </div>
    );
  }

  const { stats, recent, lowStock } = await getDashboard();

  return (
    <div className="a-page active">
      <div className="a-title">Dashboard</div>
      <div className="a-sub">Overview of Maison Vierkant India operations</div>

      <div className="stat-grid" id="dash-stats">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className="stat-l">{s.label}</div>
            <div className="stat-v">{s.value}</div>
            <div className="stat-s">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="a-2col">
        <div className="a-card">
          <div className="a-sec">Recent Orders</div>
          <table className="a-table" id="dash-orders">
            <thead>
              <tr>
                <th>Order</th>
                <th>Client</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontSize: 11, color: "var(--ink4)" }}>
                    {o.id}
                    <br />
                    {o.date}
                  </td>
                  <td style={{ fontWeight: 400 }}>{o.client}</td>
                  <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>
                    {fmt(o.total)}
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 10,
                        color: statusMeta(o.status).color,
                        border: `1px solid ${statusMeta(o.status).color}`,
                        borderRadius: 20,
                        padding: "2px 9px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusMeta(o.status).label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="a-card">
          <div className="a-sec">Low Stock Alert</div>
          <div id="dash-stock">
            {lowStock.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--ink4)" }}>All series well stocked.</div>
            ) : (
              lowStock.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "7px 0",
                    borderBottom: "1px solid var(--cream3)",
                    fontSize: 12,
                  }}
                >
                  <span>{s.name}</span>
                  <span
                    style={{ color: s.qty === 0 ? "#8b2c2c" : "#6b4a1a", fontWeight: 400 }}
                  >
                    {s.qty} units
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
