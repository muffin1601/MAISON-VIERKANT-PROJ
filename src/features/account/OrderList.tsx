import { fmt } from "@/lib/format";
import type { CustomerWithOrders } from "@/services/account/queries";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#a07a2a",
  CONFIRMED: "#2e7d32",
  PROCESSING: "#1565c0",
  SHIPPED: "#1565c0",
  DELIVERED: "#2e7d32",
  CANCELLED: "#b71c1c",
  REFUNDED: "#6a1b9a",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#6b6b6b";
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: ".08em",
        color,
        border: `1px solid ${color}`,
        borderRadius: 20,
        padding: "3px 10px",
        background: "#fff",
      }}
    >
      {status}
    </span>
  );
}

export function OrderList({ orders }: { orders: CustomerWithOrders["orders"] }) {
  if (orders.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--ink4)", padding: "24px 0" }}>
        You have no orders yet.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {orders.map((o) => {
        const captured = o.payments.some((p) => p.status === "CAPTURED");
        return (
          <div
            key={o.id}
            style={{
              border: "1px solid var(--cream3)",
              borderRadius: 6,
              padding: "16px 18px",
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)" }}>{o.number}</div>
                <div style={{ fontSize: 11, color: "var(--ink4)" }}>
                  {new Date(o.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <StatusBadge status={o.status} />
            </div>
            <div style={{ borderTop: "1px solid var(--cream2)", paddingTop: 10 }}>
              {o.items.map((it) => (
                <div
                  key={it.id}
                  style={{ fontSize: 12, color: "var(--ink3)", padding: "2px 0" }}
                >
                  {it.product.name}
                  {it.variant ? ` · ${it.variant.code}` : ""} · {it.finish} · ×{it.qty} —{" "}
                  {fmt(Number(it.unitPriceInr) * it.qty)}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 10,
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--ink4)" }}>
                {captured ? "Advance paid" : "Advance pending"}
                {o.trackingNumber ? ` · Tracking ${o.trackingNumber}` : ""}
              </span>
              <span style={{ fontWeight: 600 }}>{fmt(Number(o.totalInr))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
