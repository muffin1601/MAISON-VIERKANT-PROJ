"use client";

import { useState } from "react";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { showToast } from "@/lib/toast";

type TicketType = "SUPPORT" | "ORDER" | "RETURN" | "REFUND";

const TABS: { key: TicketType; label: string }[] = [
  { key: "SUPPORT", label: "General" },
  { key: "ORDER", label: "Order help" },
  { key: "RETURN", label: "Return" },
  { key: "REFUND", label: "Refund" },
];

const WA = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "917669469620").replace(/\D/g, "");
const PHONE = "+91 7669469620";
const EMAIL = "hello@maisonvierkant.in";

/**
 * Self-service support center: pick a request type, fill a short form (posts to
 * /api/support), or reach out via Email / Phone / WhatsApp. Order number is shown
 * for order/return/refund types.
 */
export function SupportCenter({
  defaultType = "SUPPORT",
  defaultOrder = "",
  name = "",
  email = "",
}: {
  defaultType?: TicketType;
  defaultOrder?: string;
  name?: string;
  email?: string;
}) {
  const [type, setType] = useState<TicketType>(defaultType);
  const [form, setForm] = useState({ name, email, phone: "", subject: "", message: "", orderNumber: defaultOrder });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const needsOrder = type !== "SUPPORT";
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function submit() {
    if (!form.name || !form.email || !form.subject || form.message.length < 5) {
      showToast("Please complete name, email, subject and a short message.");
      return;
    }
    if (needsOrder && !form.orderNumber) {
      showToast("Please enter your order number.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed");
      setDone(true);
      showToast("Request submitted. We'll reply within 24 hours.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="addr-empty" style={{ textAlign: "center" }}>
        <p style={{ fontWeight: 600 }}>Thank you — your request is in.</p>
        <p style={{ fontSize: 13, color: "var(--ink4)" }}>Our team will reply to {form.email} within 24 hours.</p>
        <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setDone(false)}>
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div className="sc-wrap">
      {/* Quick contact options */}
      <div className="sc-options">
        <a className="sc-opt" href={`mailto:${EMAIL}`}>
          <Mail size={18} aria-hidden /> <span>{EMAIL}</span>
        </a>
        <a className="sc-opt" href={`tel:${PHONE.replace(/\s/g, "")}`}>
          <Phone size={18} aria-hidden /> <span>{PHONE}</span>
        </a>
        <a className="sc-opt" href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer">
          <MessageCircle size={18} aria-hidden /> <span>WhatsApp</span>
        </a>
      </div>

      {/* Type tabs */}
      <div className="sc-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={type === t.key}
            className={`sc-tab${type === t.key ? " active" : ""}`}
            onClick={() => setType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <div className="sc-form">
        <div className="co-2col">
          <div className="co-field">
            <label>Name *</label>
            <input value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
          </div>
          <div className="co-field">
            <label>Email *</label>
            <input value={form.email} onChange={(e) => set({ email: e.target.value })} autoComplete="email" />
          </div>
        </div>
        <div className="co-2col">
          <div className="co-field">
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" autoComplete="tel" />
          </div>
          {needsOrder && (
            <div className="co-field">
              <label>Order number *</label>
              <input value={form.orderNumber} onChange={(e) => set({ orderNumber: e.target.value })} placeholder="MVI-ORD-…" />
            </div>
          )}
        </div>
        <div className="co-field">
          <label>Subject *</label>
          <input value={form.subject} onChange={(e) => set({ subject: e.target.value })} />
        </div>
        <div className="co-field">
          <label>How can we help? *</label>
          <textarea rows={5} value={form.message} onChange={(e) => set({ message: e.target.value })} />
        </div>
        <button className="btn-primary" style={{ padding: "12px 28px" }} disabled={busy} onClick={submit}>
          {busy ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </div>
  );
}
