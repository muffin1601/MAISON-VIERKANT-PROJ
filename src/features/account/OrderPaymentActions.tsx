"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { BankDetailsCard } from "@/features/checkout/BankDetailsCard";
import type { PaymentSettings } from "@/services/settings/paymentSettings";

interface SubmissionInfo {
  status: string;
  rejectionReason: string | null;
  amountInr: number;
  method: string;
  transactionId: string;
}

const METHODS = [
  { v: "BANK_TRANSFER", label: "Bank Transfer" },
  { v: "UPI", label: "UPI" },
  { v: "NEFT", label: "NEFT" },
  { v: "RTGS", label: "RTGS" },
  { v: "WIRE", label: "Wire Transfer" },
];

/**
 * Per-order payment block on the customer dashboard:
 *  - PENDING_PAYMENT / PAYMENT_REJECTED → show bank details + a proof submission form
 *  - PAYMENT_SUBMITTED → "under review"
 *  - verified / later stages → nothing (status badge covers it)
 */
export function OrderPaymentActions({
  orderNumber,
  orderStatus,
  amountDue,
  customerEmail,
  settings,
  submission,
}: {
  orderNumber: string;
  orderStatus: string;
  amountDue: number;
  totalInr: number;
  customerEmail: string;
  settings: PaymentSettings;
  submission: SubmissionInfo | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const status = orderStatus.toUpperCase();
  const canSubmit = status === "PENDING_PAYMENT" || status === "PAYMENT_REJECTED";
  const underReview = status === "PAYMENT_SUBMITTED";

  if (underReview) {
    return (
      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "#eef4fb",
          border: "1px solid #c9ddf2",
          borderRadius: 2,
          fontSize: 12.5,
          color: "#1565c0",
        }}
      >
        ⏳ Payment submitted{submission ? ` (${fmt(submission.amountInr)} · ${submission.method})` : ""} — under
        review. We&apos;ll email you once it&apos;s verified.
      </div>
    );
  }

  if (!canSubmit) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    fd.set("orderNumber", orderNumber);
    if (customerEmail) fd.set("email", customerEmail);
    try {
      const res = await fetch("/api/account/payments", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Could not submit your payment.");
      showToast("Payment proof submitted — we'll verify it shortly.");
      setOpen(false);
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      {submission?.status === "REJECTED" && submission.rejectionReason && (
        <div
          style={{
            padding: "10px 12px",
            background: "#fbeaea",
            border: "1px solid #e3b6b6",
            borderRadius: 2,
            fontSize: 12.5,
            color: "#8b2c2c",
            marginBottom: 10,
          }}
        >
          ✗ Previous payment was rejected: {submission.rejectionReason} — please re-submit below.
        </div>
      )}

      {!open ? (
        <button
          type="button"
          className="btn-primary"
          onClick={() => setOpen(true)}
          style={{ padding: "9px 18px", fontSize: 12 }}
        >
          Submit Payment Proof ({fmt(amountDue)})
        </button>
      ) : (
        <div style={{ border: "1px solid var(--cream3)", borderRadius: 2, padding: 16, marginTop: 8 }}>
          <BankDetailsCard settings={settings} amount={amountDue} reference={orderNumber} />

          <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <div className="co-2col">
              <label style={lbl}>
                Payment Method *
                <select name="method" required defaultValue="BANK_TRANSFER" style={inp}>
                  {METHODS.map((m) => (
                    <option key={m.v} value={m.v}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={lbl}>
                Amount Paid (₹) *
                <input
                  name="amountPaid"
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  defaultValue={amountDue}
                  style={inp}
                />
              </label>
            </div>
            <div className="co-2col">
              <label style={lbl}>
                Transaction / Reference ID *
                <input name="transactionId" required maxLength={120} placeholder="UTR / UPI ref" style={inp} />
              </label>
              <label style={lbl}>
                Payment Date *
                <input name="paymentDate" type="date" required style={inp} />
              </label>
            </div>
            <label style={lbl}>
              Notes
              <input name="notes" maxLength={1000} placeholder="Anything we should know" style={inp} />
            </label>
            <label style={lbl}>
              Payment Proof (JPG, PNG or PDF, max 10 MB) *
              <input name="proof" type="file" accept="image/jpeg,image/png,application/pdf" required style={{ ...inp, padding: 8 }} />
            </label>

            {err && (
              <div role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>
                {err}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn-primary" disabled={busy} style={{ padding: "10px 22px", fontSize: 12 }}>
                {busy ? "Submitting…" : "Submit for Verification"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{ padding: "10px 18px", fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 11.5,
  color: "var(--ink4)",
  letterSpacing: ".04em",
};
const inp: React.CSSProperties = {
  border: "1px solid var(--cream3)",
  borderRadius: 2,
  padding: "9px 11px",
  fontSize: 13,
  fontFamily: "'Jost', sans-serif",
  color: "var(--ink)",
};
