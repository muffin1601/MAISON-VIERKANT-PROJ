import Link from "next/link";
import { fmt } from "@/lib/format";
import type { CustomerWithOrders } from "@/services/account/queries";
import { statusMeta } from "@/lib/orderStatus";
import { OrderPaymentActions } from "@/features/account/OrderPaymentActions";
import type { PaymentSettings } from "@/services/settings/paymentSettings";

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      style={{
        fontSize: 10,
        letterSpacing: ".08em",
        color: meta.color,
        border: `1px solid ${meta.color}`,
        borderRadius: 2,
        padding: "3px 10px",
        background: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      {meta.label}
    </span>
  );
}

export function OrderList({
  orders,
  settings,
  customerEmail,
}: {
  orders: CustomerWithOrders["orders"];
  settings: PaymentSettings;
  customerEmail: string;
}) {
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
        // Latest payment submission (the query orders them desc).
        const submission = o.paymentSubmissions?.[0] ?? null;
        return (
          <div
            key={o.id}
            style={{
              border: "1px solid var(--cream3)",
              borderRadius: 2,
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
                <Link href={`/account/orders/${o.number}`} style={{ fontSize: 14, fontWeight: 600, color: "var(--gold)" }}>
                  {o.number}
                </Link>
                <div style={{ fontSize: 11, color: "var(--ink4)" }}>
                  {new Date(o.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <StatusBadge status={o.status} />
                <Link href={`/account/orders/${o.number}`} style={{ fontSize: 11, color: "var(--gold)" }}>
                  View →
                </Link>
              </div>
            </div>
            <div style={{ borderTop: "1px solid var(--cream2)", paddingTop: 10 }}>
              {o.items.map((it) => (
                <div key={it.id} style={{ fontSize: 12, color: "var(--ink3)", padding: "2px 0" }}>
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
                Advance due: {fmt(Number(o.advanceInr))}
                {o.trackingNumber ? ` · Tracking ${o.trackingNumber}` : ""}
              </span>
              <span style={{ fontWeight: 600 }}>{fmt(Number(o.totalInr))}</span>
            </div>

            {["PAYMENT_VERIFIED", "IN_PRODUCTION", "READY_TO_DISPATCH", "DISPATCHED", "DELIVERED"].includes(
              o.status,
            ) && (
              <div style={{ marginTop: 8 }}>
                <a
                  href={`/api/account/invoice/${o.id}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "var(--gold)", textDecoration: "underline" }}
                >
                  Download invoice (PDF) →
                </a>
              </div>
            )}

            <OrderPaymentActions
              orderNumber={o.number}
              orderStatus={o.status}
              amountDue={Number(o.advanceInr)}
              totalInr={Number(o.totalInr)}
              customerEmail={customerEmail}
              settings={settings}
              submission={
                submission
                  ? {
                      status: submission.status,
                      rejectionReason: submission.rejectionReason,
                      amountInr: Number(submission.amountInr),
                      method: submission.method,
                      transactionId: submission.transactionId,
                    }
                  : null
              }
            />
          </div>
        );
      })}
    </div>
  );
}
