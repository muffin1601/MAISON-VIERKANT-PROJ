"use client";

import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import type { PaymentSettings } from "@/services/settings/paymentSettings";

/** Read-only display of bank/UPI details for offline payment, with copy buttons. */
export function BankDetailsCard({
  settings,
  amount,
  reference,
}: {
  settings: PaymentSettings;
  amount: number;
  reference: string;
}) {
  const rows: { label: string; value?: string }[] = [
    { label: "Bank", value: settings.bankName },
    { label: "Account Holder", value: settings.accountHolder },
    { label: "Account Number", value: settings.accountNumber },
    { label: "IFSC", value: settings.ifsc },
    { label: "SWIFT", value: settings.swift },
    { label: "Branch", value: settings.branch },
    { label: "UPI ID", value: settings.upiId },
  ].filter((r) => r.value);

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(
      () => showToast("Copied"),
      () => showToast("Could not copy"),
    );
  };

  const configured = rows.length > 0;

  return (
    <div
      style={{
        background: "var(--cream2)",
        border: "1px solid var(--cream3)",
        borderRadius: 6,
        padding: "16px 18px",
        marginTop: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: ".16em", color: "var(--gold2)" }}>
          PAYMENT DETAILS
        </span>
        <span style={{ fontSize: 13 }}>
          Amount: <strong style={{ color: "var(--gold)" }}>{fmt(amount)}</strong>
        </span>
      </div>

      {!configured ? (
        <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.8 }}>
          Bank details are being finalised. Our team will email you payment instructions for order{" "}
          <strong>{reference}</strong> shortly.
        </div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} style={{ borderBottom: "1px solid var(--cream3)" }}>
                  <td style={{ padding: "7px 0", fontSize: 11.5, color: "var(--ink4)", whiteSpace: "nowrap" }}>
                    {r.label}
                  </td>
                  <td style={{ padding: "7px 8px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {r.value}
                  </td>
                  <td style={{ padding: "7px 0", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => copy(r.value!)}
                      style={{
                        fontSize: 10,
                        letterSpacing: ".06em",
                        color: "var(--gold)",
                        background: "none",
                        border: "1px solid var(--cream3)",
                        borderRadius: 4,
                        padding: "3px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Copy
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "7px 0", fontSize: 11.5, color: "var(--ink4)" }}>Reference</td>
                <td style={{ padding: "7px 8px", fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>
                  {reference}
                </td>
                <td style={{ padding: "7px 0", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => copy(reference)}
                    style={{
                      fontSize: 10,
                      letterSpacing: ".06em",
                      color: "var(--gold)",
                      background: "none",
                      border: "1px solid var(--cream3)",
                      borderRadius: 4,
                      padding: "3px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Copy
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {settings.upiQrUrl && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 6 }}>Scan to pay via UPI</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings.upiQrUrl}
                alt="UPI QR code"
                style={{ width: 160, height: 160, objectFit: "contain", border: "1px solid var(--cream3)", borderRadius: 6, background: "#fff" }}
              />
            </div>
          )}
          {settings.instructions && (
            <p style={{ fontSize: 11.5, color: "var(--ink3)", lineHeight: 1.7, marginTop: 12 }}>
              {settings.instructions}
            </p>
          )}
        </>
      )}
    </div>
  );
}
