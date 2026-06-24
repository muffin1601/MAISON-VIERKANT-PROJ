"use client";

import { useState, useTransition } from "react";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { statusMeta } from "@/lib/orderStatus";
import { approvePayment, rejectPayment, requestClarification } from "./actions";
import type { PaymentRow } from "@/services/admin/paymentQueries";

const SUB_COLOR: Record<string, string> = {
  SUBMITTED: "#1565c0",
  VERIFIED: "#2e7d32",
  REJECTED: "#b71c1c",
};

function MethodLabel({ m }: { m: string }) {
  return <>{m.replace(/_/g, " ")}</>;
}

export function PaymentQueue({ rows, canWrite }: { rows: PaymentRow[]; canWrite: boolean }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function run(id: string, fn: () => Promise<{ ok: boolean; message?: string; notFound?: true }>, okMsg: string) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          showToast(res.notFound ? "Submission not found." : res.message || "Action failed.");
        } else {
          showToast(okMsg);
        }
      } catch {
        showToast("Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function onApprove(id: string) {
    if (!confirm("Approve this payment? The order will move to production.")) return;
    run(id, () => approvePayment({ id }), "Payment verified. Customer notified.");
  }
  function onReject(id: string) {
    const reason = prompt("Reason for rejecting this payment (the customer will see this):");
    if (reason == null) return;
    run(id, () => rejectPayment({ id, reason }), "Payment rejected. Customer notified.");
  }
  function onClarify(id: string) {
    const message = prompt("Message to the customer requesting clarification:");
    if (message == null) return;
    run(id, () => requestClarification({ id, message }), "Clarification sent to customer.");
  }

  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--ink4)", padding: "20px 0" }}>No payment submissions yet.</div>;
  }

  return (
    <div className="a-card" style={{ overflowX: "auto" }}>
      <table className="a-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Ref / Paid</th>
            <th>Submitted</th>
            <th>Proof</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isBusy = pending && busyId === r.id;
            const c = SUB_COLOR[r.status] ?? "#6b6b6b";
            return (
              <tr key={r.id} style={{ opacity: isBusy ? 0.5 : 1 }}>
                <td style={{ fontSize: 11 }}>
                  {r.orderNumber}
                  <br />
                  <span style={{ color: statusMeta(r.orderStatus).color, fontSize: 10 }}>
                    {statusMeta(r.orderStatus).label}
                  </span>
                </td>
                <td style={{ fontWeight: 400 }}>
                  {r.customer}
                  <br />
                  <span style={{ fontSize: 10, color: "var(--ink4)" }}>{r.email}</span>
                </td>
                <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>{fmt(r.amountInr)}</td>
                <td style={{ fontSize: 12 }}>
                  <MethodLabel m={r.method} />
                </td>
                <td style={{ fontSize: 11, color: "var(--ink3)" }}>
                  {r.transactionId}
                  <br />
                  {r.paidAt}
                </td>
                <td style={{ fontSize: 11, color: "var(--ink3)" }}>{r.submittedAt}</td>
                <td>
                  {r.hasProof ? (
                    <a
                      href={`/api/payment-proof/${r.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 11, color: "var(--gold)" }}
                    >
                      View
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--ink4)" }}>—</span>
                  )}
                </td>
                <td>
                  <span
                    style={{
                      fontSize: 10,
                      color: c,
                      border: `1px solid ${c}`,
                      borderRadius: 2,
                      padding: "2px 8px",
                      whiteSpace: "nowrap",
                    }}
                    title={r.rejectionReason ?? undefined}
                  >
                    {r.status}
                  </span>
                  {r.reviewedBy && (
                    <div style={{ fontSize: 9, color: "var(--ink4)", marginTop: 3 }}>
                      by {r.reviewedBy} · {r.reviewedAt}
                    </div>
                  )}
                </td>
                <td>
                  {canWrite && r.status === "SUBMITTED" ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => onApprove(r.id)} disabled={isBusy} style={btn("#2e7d32")}>
                        Approve
                      </button>
                      <button onClick={() => onReject(r.id)} disabled={isBusy} style={btn("#b71c1c")}>
                        Reject
                      </button>
                      <button onClick={() => onClarify(r.id)} disabled={isBusy} style={btn("#6b6b6b")}>
                        Clarify
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--ink4)" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    fontSize: 10,
    letterSpacing: ".04em",
    color: "#fff",
    background: color,
    border: "none",
    borderRadius: 2,
    padding: "5px 10px",
    cursor: "pointer",
  };
}
