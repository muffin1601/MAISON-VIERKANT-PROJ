"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { OnlinePaymentRow } from "@/services/admin/paymentQueries";

/** Map a Payment.status (+ order status) to one of the admin filter buckets. */
function bucketOf(row: OnlinePaymentRow): "paid" | "pending" | "failed" | "refunded" | "cancelled" {
  if (row.orderStatus === "CANCELLED") return "cancelled";
  switch (row.status) {
    case "CAPTURED":
      return "paid";
    case "FAILED":
      return "failed";
    case "REFUNDED":
      return "refunded";
    default:
      return "pending"; // PENDING | PROCESSING
  }
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const STATUS_COLOR: Record<string, string> = {
  paid: "#2e7d32",
  pending: "#a07a2a",
  failed: "#b71c1c",
  refunded: "#6a1b9a",
  cancelled: "#6b6b6b",
};

/**
 * Razorpay payment ledger for admins: filter by Paid/Pending/Failed/Refunded/
 * Cancelled, search by payment id / order id / customer / email, and issue
 * full/partial refunds (requires payments.write).
 */
export function OnlinePaymentsTable({
  rows,
  canWrite,
}: {
  rows: OnlinePaymentRow[];
  canWrite: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const [refunding, setRefunding] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && bucketOf(r) !== filter) return false;
      if (!needle) return true;
      return [
        r.gatewayPaymentId,
        r.gatewayOrderId,
        r.orderNumber,
        r.customer,
        r.email,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle));
    });
  }, [rows, filter, q]);

  async function refund(row: OnlinePaymentRow) {
    const remaining = row.amountInr - row.amountRefundedInr;
    const input = window.prompt(
      `Refund for ${row.orderNumber}\nCaptured: ${fmt(row.amountInr)} · Already refunded: ${fmt(
        row.amountRefundedInr,
      )}\n\nEnter amount to refund in ₹ (blank = full remaining ${fmt(remaining)}):`,
      "",
    );
    if (input === null) return; // cancelled
    const amountInr = input.trim() === "" ? undefined : Number(input.trim());
    if (amountInr !== undefined && (!Number.isFinite(amountInr) || amountInr <= 0)) {
      showToast("Enter a valid amount.");
      return;
    }
    setRefunding(row.id);
    try {
      const res = await fetch(`/api/payments/refund/${row.orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountInr, reason: "admin_dashboard" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Refund failed.");
      showToast(`Refund initiated: ${fmt(json.data.amountInr)}`);
      // Reflect immediately; a full reload picks up the persisted state.
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Refund failed.");
    } finally {
      setRefunding(null);
    }
  }

  return (
    <div style={{ marginTop: 36 }}>
      <div className="a-title" style={{ fontSize: 18 }}>
        Online Payments (Razorpay)
      </div>
      <div className="a-sub">Gateway transactions — captures, failures and refunds.</div>

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          margin: "16px 0",
          justifyContent: "space-between",
        }}
      >
        <div className="filter-row" style={{ marginBottom: 0 }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`fb${filter === f.key ? " active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search payment / order id, name, email…"
          aria-label="Search online payments"
          style={{
            border: "1px solid var(--cream3)",
            borderRadius: 3,
            padding: "9px 12px",
            fontSize: 12,
            minWidth: 260,
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="a-sub" style={{ padding: "24px 0" }}>
          No online payments match this view.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="a-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink4)" }}>
                <th style={{ padding: "8px 10px" }}>Order</th>
                <th style={{ padding: "8px 10px" }}>Customer</th>
                <th style={{ padding: "8px 10px" }}>Amount</th>
                <th style={{ padding: "8px 10px" }}>Status</th>
                <th style={{ padding: "8px 10px" }}>Razorpay IDs</th>
                <th style={{ padding: "8px 10px" }}>Paid</th>
                <th style={{ padding: "8px 10px" }}>Verified</th>
                {canWrite && <th style={{ padding: "8px 10px" }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const bucket = bucketOf(r);
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--cream3)" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600 }}>{r.orderNumber}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {r.customer}
                      <div style={{ color: "var(--ink4)", fontSize: 11 }}>{r.email}</div>
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {fmt(r.amountInr)}
                      {r.amountRefundedInr > 0 && (
                        <div style={{ color: "#6a1b9a", fontSize: 11 }}>
                          − {fmt(r.amountRefundedInr)} refunded
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 9px",
                          borderRadius: 2,
                          fontSize: 10,
                          letterSpacing: ".08em",
                          textTransform: "uppercase",
                          color: "#fff",
                          background: STATUS_COLOR[bucket],
                        }}
                      >
                        {bucket}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 10.5 }}>
                      <div>{r.gatewayPaymentId ?? "—"}</div>
                      <div style={{ color: "var(--ink4)" }}>{r.gatewayOrderId ?? "—"}</div>
                    </td>
                    <td style={{ padding: "8px 10px" }}>{r.paidAt ?? "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      {r.status === "CAPTURED" ? (r.webhookVerified ? "✓ Webhook" : "✓ Signature") : "—"}
                    </td>
                    {canWrite && (
                      <td style={{ padding: "8px 10px" }}>
                        {r.status === "CAPTURED" && r.amountRefundedInr < r.amountInr ? (
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={refunding === r.id}
                            onClick={() => refund(r)}
                            style={{ padding: "5px 12px", fontSize: 11 }}
                          >
                            {refunding === r.id ? "…" : "Refund"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
