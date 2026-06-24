"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductView } from "@/services/catalogue/catalogue";
import { calcINR, type PricingConfig } from "@/services/pricing/PricingService";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { saveQuote } from "./actions";

interface Line {
  pid: string;
  model: string;
  fin: string;
  qty: number;
}
interface Cust {
  name: string;
  company: string;
  email: string;
  phone: string;
  addr1: string;
  city: string;
  state: string;
  pin: string;
}

export function QuoteBuilder({
  products,
  pricing,
}: {
  products: ProductView[];
  pricing: PricingConfig;
}) {
  const router = useRouter();
  const [cust, setCust] = useState<Cust>({
    name: "",
    company: "",
    email: "",
    phone: "",
    addr1: "",
    city: "",
    state: "",
    pin: "",
  });
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([
    { pid: products[0]?.code ?? "", model: "", fin: products[0]?.finishes[0] ?? "", qty: 1 },
  ]);
  const [saving, setSaving] = useState(false);

  const prodOf = (code: string) => products.find((p) => p.code === code) ?? products[0];
  function unitFor(l: Line): number {
    const p = prodOf(l.pid);
    if (!p) return 0;
    const m = p.models.find((x) => x.code === l.model);
    return calcINR(m ? m.eur : p.eurPrice, pricing);
  }

  const subtotal = lines.reduce((s, l) => s + unitFor(l) * l.qty, 0);
  const discAmt = Math.round(subtotal * (discount / 100));
  const total = subtotal - discAmt;

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { pid: products[0]?.code ?? "", model: "", fin: products[0]?.finishes[0] ?? "", qty: 1 },
    ]);

  async function save() {
    if (!cust.name.trim()) {
      showToast("Enter the customer name.");
      return;
    }
    setSaving(true);
    try {
      const res = await saveQuote({
        customer: { ...cust, addr2: "", country: "India" },
        discountPct: discount,
        lines: lines.map((l) => {
          const p = prodOf(l.pid);
          return {
            productId: l.pid,
            productName: p?.name ?? "",
            variantCode: l.model,
            finish: l.fin,
            qty: l.qty,
            unitInr: unitFor(l),
          };
        }),
      });
      showToast(`Quote ${res.number} saved.`);
      router.push("/admin/saved-quotes");
      router.refresh();
    } catch {
      showToast("Could not save quote.");
    } finally {
      setSaving(false);
    }
  }

  function preview() {
    const rows = lines
      .map((l) => {
        const p = prodOf(l.pid);
        return `<tr><td>${p?.name ?? ""} ${l.model}</td><td>${l.fin}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${fmt(unitFor(l))}</td><td style="text-align:right">${fmt(unitFor(l) * l.qty)}</td></tr>`;
      })
      .join("");
    const html = `<html><head><title>Quotation</title><style>body{font-family:Arial;padding:30px;max-width:750px;margin:0 auto;font-size:12px;color:#1a1814}h1{font-size:24px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.tot{text-align:right;font-size:18px;margin-top:14px}</style></head><body>
      <h1>Maison Vierkant India</h1><div>Quotation for <strong>${cust.name}</strong>${cust.company ? " · " + cust.company : ""}</div>
      <div>${[cust.addr1, cust.city, cust.state, cust.pin].filter(Boolean).join(", ")}</div>
      <table><thead><tr><th>Item</th><th>Finish</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot">Subtotal: ${fmt(subtotal)}${discount > 0 ? `<br>Discount (${discount}%): −${fmt(discAmt)}` : ""}<br><strong>Total: ${fmt(total)}</strong></div>
      <p style="margin-top:20px;font-size:10px;color:#888">Inclusive of import duty &amp; GST. Transport outside Delhi as actual. Lead time 10–14 weeks.</p>
      </body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  }

  return (
    <div className="a-page active">
      <div className="a-title">Create Quote</div>
      <div className="a-sub">
        Generate professional client quotations with model selection, discounts and delivery terms
      </div>

      <div className="r-grid-aside" style={{ gap: 16, alignItems: "start" }}>
        <div>
          {/* Customer */}
          <div className="a-card" style={{ marginBottom: 14 }}>
            <div className="a-sec">Customer</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <F label="Name *" v={cust.name} on={(v) => setCust({ ...cust, name: v })} />
              <F label="Company" v={cust.company} on={(v) => setCust({ ...cust, company: v })} />
              <F label="Email" v={cust.email} on={(v) => setCust({ ...cust, email: v })} />
              <F label="Phone" v={cust.phone} on={(v) => setCust({ ...cust, phone: v })} />
              <div style={{ gridColumn: "1/-1" }}>
                <F label="Address" v={cust.addr1} on={(v) => setCust({ ...cust, addr1: v })} />
              </div>
              <F label="City" v={cust.city} on={(v) => setCust({ ...cust, city: v })} />
              <F label="State" v={cust.state} on={(v) => setCust({ ...cust, state: v })} />
              <F label="PIN" v={cust.pin} on={(v) => setCust({ ...cust, pin: v })} />
            </div>
          </div>

          {/* Lines */}
          <div className="a-card">
            <div className="a-sec">Line Items</div>
            {lines.map((l, i) => {
              const p = prodOf(l.pid);
              return (
                <div
                  key={i}
                  style={{ background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 2, padding: 12, marginBottom: 10 }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div>
                      <label className="a-label">Product</label>
                      <select
                        className="a-input"
                        style={{ fontSize: 11, margin: 0 }}
                        value={l.pid}
                        onChange={(e) => {
                          const np = prodOf(e.target.value);
                          setLine(i, { pid: e.target.value, model: "", fin: np?.finishes[0] ?? "" });
                        }}
                      >
                        {products.map((x) => (
                          <option key={x.code} value={x.code}>
                            {x.series} — {x.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="a-label">Model / Size</label>
                      <select className="a-input" style={{ fontSize: 11, margin: 0 }} value={l.model} onChange={(e) => setLine(i, { model: e.target.value })}>
                        <option value="">— Any / TBD —</option>
                        {p?.models.map((m) => (
                          <option key={m.code} value={m.code}>
                            {m.code}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="a-label">Finish</label>
                      <select className="a-input" style={{ fontSize: 11, margin: 0 }} value={l.fin} onChange={(e) => setLine(i, { fin: e.target.value })}>
                        {p?.finishes.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 8, alignItems: "end" }}>
                      <div>
                        <label className="a-label">Qty</label>
                        <input className="a-input" type="number" min={1} style={{ fontSize: 13, margin: 0 }} value={l.qty} onChange={(e) => setLine(i, { qty: parseInt(e.target.value) || 1 })} />
                      </div>
                      <div style={{ textAlign: "right", fontSize: 13, paddingBottom: 6 }}>
                        {fmt(unitFor(l) * l.qty)}
                        {lines.length > 1 && (
                          <button
                            onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                            style={{ marginLeft: 8, background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}
                          >
                            remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="a-btn-g" style={{ width: "auto", padding: "7px 16px", fontSize: 11 }} onClick={addLine}>
              + Add Line
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="a-card" style={{ position: "sticky", top: 16 }}>
          <div className="a-sec">Quote Total</div>
          <div style={{ marginBottom: 10 }}>
            <label className="a-label">Discount %</label>
            <input className="a-input" type="number" min={0} max={60} step={0.5} value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} style={{ margin: 0 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
            <span>Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#2d6a40", marginBottom: 4 }}>
              <span>Discount</span>
              <span>−{fmt(discAmt)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--cream3)", paddingTop: 8, marginTop: 8 }}>
            <span style={{ fontSize: 13 }}>Total</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700 }}>{fmt(total)}</span>
          </div>
          <button onClick={save} disabled={saving} className="a-btn-g" style={{ width: "100%", marginTop: 14, background: "var(--ink)", color: "var(--cream)" }}>
            {saving ? "Saving…" : "💾 Save Quote"}
          </button>
          <button onClick={preview} className="a-btn-g" style={{ width: "100%", marginTop: 8 }}>
            🖨 Preview / Print
          </button>
        </div>
      </div>
    </div>
  );
}

function F({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <label className="a-label">{label}</label>
      <input className="a-input" style={{ margin: 0 }} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
