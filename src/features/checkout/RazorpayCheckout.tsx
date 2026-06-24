"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { useRazorpay } from "@/hooks/useRazorpay";
import { createPaymentOrder, verifyPayment, PaymentError } from "@/services/payment/paymentClient";

type Phase = "idle" | "starting" | "verifying";

export interface PaidInfo {
  orderNumber: string;
  paymentId: string;
  amountPaid: number;
}

/**
 * Razorpay advance-payment button for the checkout payment step. Drives the full
 * flow: create-order (against the draft session) → checkout modal → server verify
 * (which CREATES the real order) → onPaid. No permanent order exists until this
 * succeeds. Failure/cancel is handled with an inline retry; the cart is preserved.
 */
export function RazorpayPayButton({
  sessionToken,
  advanceInr,
  onPaid,
  disabled,
}: {
  sessionToken: string;
  advanceInr: number;
  onPaid: (info: PaidInfo) => void;
  disabled?: boolean;
}) {
  const { open } = useRazorpay();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = phase !== "idle";

  async function pay() {
    if (busy || disabled) return; // guard double-clicks
    setError(null);
    setPhase("starting");
    try {
      const created = await createPaymentOrder(sessionToken);
      const success = await open({
        key: created.keyId,
        amount: created.amount,
        currency: created.currency,
        name: "Maison Vierkant India",
        description: `Advance for ${created.orderNumber}`,
        order_id: created.gatewayOrderId,
        ...(created.rzpCustomerId ? { customer_id: created.rzpCustomerId, save: 1 as const } : {}),
        prefill: created.customer,
        notes: { sessionToken, orderNumber: created.orderNumber },
        theme: { color: "#9a7a3a" },
      });

      setPhase("verifying");
      const verified = await verifyPayment(sessionToken, success);
      showToast("Payment received — thank you!");
      onPaid({
        orderNumber: verified.orderNumber,
        paymentId: verified.paymentId || success.razorpay_payment_id,
        amountPaid: verified.amountPaid || advanceInr,
      });
    } catch (e) {
      if (e instanceof PaymentError && e.code === "ALREADY_PAID") {
        onPaid({ orderNumber: "", paymentId: "", amountPaid: advanceInr });
        return;
      }
      const msg = e instanceof Error ? e.message : "Payment could not be completed. Please try again.";
      setError(msg);
      setPhase("idle");
    }
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          style={{
            background: "#fbeaea",
            border: "1px solid #e3b6b6",
            color: "var(--danger)",
            borderRadius: 2,
            padding: "10px 13px",
            fontSize: 12,
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          {error} {error && <span style={{ color: "var(--ink4)" }}>Your cart is safe — you can retry or choose another method.</span>}
        </div>
      )}
      <button
        type="button"
        className="btn-primary"
        onClick={pay}
        disabled={busy || disabled}
        style={{ padding: "14px 32px", width: "100%", opacity: busy || disabled ? 0.6 : 1 }}
      >
        {phase === "starting"
          ? "Opening secure checkout…"
          : phase === "verifying"
            ? "Confirming payment…"
            : error
              ? (
                <>
                  <RefreshCw size={14} aria-hidden style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  Retry payment
                </>
              )
              : `Pay ${fmt(advanceInr)} advance & place order →`}
      </button>
    </div>
  );
}
