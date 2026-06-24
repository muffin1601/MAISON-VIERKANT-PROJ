"use client";

import { useState, useTransition } from "react";
import { showToast } from "@/lib/toast";
import { updatePaymentSettings } from "./actions";
import type { PaymentSettings } from "@/services/settings/paymentSettings";

const FIELDS: { key: keyof PaymentSettings; label: string; placeholder?: string }[] = [
  { key: "bankName", label: "Bank Name", placeholder: "e.g. HDFC Bank" },
  { key: "accountHolder", label: "Account Holder", placeholder: "Maison Vierkant" },
  { key: "accountNumber", label: "Account Number" },
  { key: "ifsc", label: "IFSC Code" },
  { key: "swift", label: "SWIFT (for international wires)" },
  { key: "branch", label: "Branch" },
  { key: "upiId", label: "UPI ID", placeholder: "name@bank" },
];

export function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const [form, setForm] = useState<PaymentSettings>(initial);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof PaymentSettings, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function uploadQr(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("category", "payment-qr");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
      set("upiQrUrl", json.data.url);
      showToast("QR uploaded.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onSave() {
    startTransition(async () => {
      try {
        const res = await updatePaymentSettings(form);
        showToast(res.ok ? "Payment settings saved." : res.message || "Could not save.");
      } catch {
        showToast("Could not save settings.");
      }
    });
  }

  return (
    <div className="a-card" style={{ maxWidth: 640 }}>
      <div style={{ display: "grid", gap: 14 }}>
        {FIELDS.map((f) => (
          <label key={f.key} style={lbl}>
            {f.label}
            <input
              value={(form[f.key] as string) || ""}
              placeholder={f.placeholder}
              onChange={(e) => set(f.key, e.target.value)}
              style={inp}
            />
          </label>
        ))}

        <label style={lbl}>
          Customer Instructions
          <textarea
            value={form.instructions || ""}
            onChange={(e) => set("instructions", e.target.value)}
            rows={3}
            style={{ ...inp, resize: "vertical" }}
          />
        </label>

        <div style={lbl}>
          UPI QR Code
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
            {form.upiQrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={form.upiQrUrl}
                alt="UPI QR"
                style={{ width: 90, height: 90, objectFit: "contain", border: "1px solid var(--cream3)", borderRadius: 2 }}
              />
            ) : (
              <div style={{ fontSize: 11, color: "var(--ink4)" }}>No QR uploaded</div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadQr(file);
              }}
              style={{ fontSize: 12 }}
            />
            {form.upiQrUrl && (
              <button type="button" onClick={() => set("upiQrUrl", "")} style={{ fontSize: 11, color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div>
          <button onClick={onSave} disabled={pending || uploading} className="btn-primary" style={{ padding: "11px 28px", fontSize: 13 }}>
            {pending ? "Saving…" : "Save Payment Settings"}
          </button>
        </div>
      </div>
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
