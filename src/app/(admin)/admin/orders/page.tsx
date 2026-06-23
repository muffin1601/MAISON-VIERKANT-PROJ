import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/rbac";
import { getOrders } from "@/services/admin/queries";
import { fmt } from "@/lib/format";
import { OrderFulfilment } from "@/features/orders/OrderFulfilment";

export const dynamic = "force-dynamic";

/** Faithful port of prototype renderOrdersT. */
export default async function OrdersPage() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.permissions, "orders.read")) {
    return (
      <div className="a-page active">
        <div className="a-title">Orders</div>
        <div className="a-sub">You do not have access to orders.</div>
      </div>
    );
  }

  const orders = await getOrders();
  const canWrite = hasPermission(user.permissions, "orders.write");

  return (
    <div className="a-page active">
      <div className="a-title">Orders</div>
      <div className="a-sub">All customer orders and their current status</div>
      <div className="a-card" style={{ overflowX: "auto" }}>
        <table className="a-table" id="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Client</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={{ fontSize: 11, color: "var(--ink4)" }}>{o.id}</td>
                <td style={{ color: "var(--ink3)" }}>{o.date}</td>
                <td style={{ fontWeight: 400 }}>{o.client}</td>
                <td style={{ color: "var(--ink3)", fontSize: 12 }}>{o.items}</td>
                <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>
                  {fmt(o.total)}
                </td>
                <td>
                  <OrderFulfilment
                    number={o.id}
                    status={o.status}
                    trackingNumber={o.trackingNumber}
                    courier={o.courier}
                    trackingUrl={o.trackingUrl}
                    canWrite={canWrite}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
