import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrderForUser } from "@/services/account/queries";
import { fmt } from "@/lib/format";
import { packagingInr } from "@/services/pricing/charges";
import { statusMeta } from "@/lib/orderStatus";
import { OrderTimeline, OrderHistory } from "@/features/account/OrderTimeline";
import { ReorderButton } from "@/features/account/ReorderButton";
import type { CartItem } from "@/store/cart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetailPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/account/login?callbackUrl=/account/orders/${number}`);

  const order = await getOrderForUser(user.id, number);
  if (!order) notFound();

  const meta = statusMeta(order.status);
  const invoiceReady = ["PAYMENT_VERIFIED", "IN_PRODUCTION", "READY_TO_DISPATCH", "DISPATCHED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(
    order.status,
  );

  const reorderLines: { item: Omit<CartItem, "qty">; qty: number }[] = order.items.map((it) => ({
    qty: it.qty,
    item: {
      id: it.product.code,
      slug: it.product.slug,
      name: it.product.name,
      finish: it.finish,
      code: it.variant?.code ?? "",
      unitINR: Number(it.unitPriceInr),
    },
  }));

  return (
    <div className="page active">
      <div className="sw" style={{ maxWidth: 820, paddingTop: 32, paddingBottom: 56 }}>
        <Link href="/account/orders" style={{ fontSize: 12, color: "var(--gold)" }}>
          ← Back to orders
        </Link>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          <div>
            <h1 className="st" style={{ marginBottom: 2 }}>
              Order <em>{order.number}</em>
            </h1>
            <div style={{ fontSize: 12, color: "var(--ink4)" }}>
              Placed{" "}
              {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <span className="addr-badge" style={{ color: meta.color, borderColor: meta.color, position: "static" }}>
            {meta.label}
          </span>
        </div>

        {/* Timeline */}
        <section className="prof-card" style={{ marginTop: 20 }}>
          <OrderTimeline status={order.status} />
        </section>

        {/* Tracking */}
        {(order.trackingNumber || order.courier) && (
          <section className="prof-card" style={{ marginTop: 16 }}>
            <div className="co-section-title">Shipment</div>
            <div style={{ fontSize: 13, color: "var(--ink3)" }}>
              {order.courier && <div>Courier: {order.courier}</div>}
              {order.trackingNumber && <div>Tracking #: {order.trackingNumber}</div>}
            </div>
            {order.trackingUrl && (
              <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="btn-ghost" style={{ marginTop: 10, display: "inline-block", padding: "9px 18px" }}>
                Track shipment →
              </a>
            )}
          </section>
        )}

        {/* Items */}
        <section className="prof-card" style={{ marginTop: 16 }}>
          <div className="co-section-title">Items</div>
          {order.items.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--cream2)" }}>
              <span>
                {it.product.name}
                {it.variant ? ` · ${it.variant.code}` : ""} · {it.finish} · ×{it.qty}
              </span>
              <span style={{ fontWeight: 600 }}>{fmt(Number(it.unitPriceInr) * it.qty)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13 }}>
            <span style={{ color: "var(--ink4)" }}>Subtotal</span>
            <span>{fmt(Number(order.subtotalInr))}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--ink4)" }}>Packaging Charges</span>
            <span>{fmt(packagingInr(order.items.reduce((n, it) => n + it.qty, 0)))}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--ink4)" }}>GST (18%)</span>
            <span>{fmt(Number(order.gstInr))}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: "var(--ink4)" }}>Transport</span>
            <span>{fmt(Number(order.transportInr))}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontWeight: 700, fontSize: 15 }}>
            <span>Total</span>
            <span>{fmt(Number(order.totalInr))}</span>
          </div>
        </section>

        {/* Shipping address */}
        {order.shipAddress && (
          <section className="prof-card" style={{ marginTop: 16 }}>
            <div className="co-section-title">Delivery address</div>
            <div style={{ fontSize: 13, color: "var(--ink3)", lineHeight: 1.6 }}>
              {order.shipAddress.name && <strong>{order.shipAddress.name}<br /></strong>}
              {order.shipAddress.line1}
              {order.shipAddress.line2 ? `, ${order.shipAddress.line2}` : ""}
              <br />
              {order.shipAddress.city}, {order.shipAddress.state} {order.shipAddress.pincode}
              <br />
              {order.shipAddress.country}
            </div>
          </section>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <ReorderButton lines={reorderLines} />
          {invoiceReady && (
            <a href={`/api/account/invoice/${order.id}`} target="_blank" rel="noreferrer" className="btn-ghost" style={{ padding: "11px 20px" }}>
              Download invoice (PDF)
            </a>
          )}
          <Link href={`/account/support?type=ORDER&order=${order.number}`} className="btn-ghost" style={{ padding: "11px 20px" }}>
            Need help?
          </Link>
          {order.status === "DELIVERED" && (
            <>
              <Link href={`/account/support?type=RETURN&order=${order.number}`} className="btn-ghost" style={{ padding: "11px 20px" }}>
                Request return
              </Link>
              <Link href={`/account/support?type=REFUND&order=${order.number}`} className="btn-ghost" style={{ padding: "11px 20px" }}>
                Request refund
              </Link>
            </>
          )}
        </div>

        {/* History */}
        <section className="prof-card" style={{ marginTop: 20 }}>
          <div className="co-section-title">Order history</div>
          <OrderHistory events={order.statusHistory} />
        </section>
      </div>
    </div>
  );
}
