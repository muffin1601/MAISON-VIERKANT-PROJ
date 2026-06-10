"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtE } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { savePO } from "./actions";

export interface VariantOpt {
  code: string;
  eur: number;
  series: string;
}

interface Line {
  code: string;
  qty: number;
  unitEur: number;
}

export function PurchaseOrderBuilder({ variants }: { variants: VariantOpt[] }) {
  const router = useRouter();
  const byCode = new Map(variants.map((v) => [v.code, v]));
  const [lines, setLines] = useState<Line[]>([
    { code: variants[0]?.code ?? "", qty: 1, unitEur: variants[0]?.eur ?? 0 },
  ]);
  const [saving, setSaving] = useState(false);

  const total = lines.reduce((s, l) => s + l.unitEur * l.qty, 0);
  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  async function save() {
    setSaving(true);
    try {
      const res = await savePO({
        lines: lines.map((l) => ({ variantCode: l.code, qty: l.qty, unitEur: l.unitEur })),
      });
      showToast(`Purchase order ${res.number} saved.`);
      router.refresh();
    } catch {
      showToast("Could not save purchase order.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="a-page active">
      <div className="a-title">Purchase Order</div>
      <div className="a-sub">
        Create a PO to Atelier Vierkant, Belgium · save, edit and re-issue orders
      </div>

      <div className="a-card" style={{ maxWidth: 720 }}>
        <div className="a-sec">Order Lines (EUR)</div>
        <table className="a-table" style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Model</th>
              <th>Series</th>
              <th>Unit (EUR)</th>
              <th>Qty</th>
              <th style={{ textAlign: "right" }}>Line Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <select
                    className="a-input"
                    style={{ margin: 0, fontSize: 11 }}
                    value={l.code}
                    onChange={(e) => {
                      const v = byCode.get(e.target.value);
                      setLine(i, { code: e.target.value, unitEur: v?.eur ?? l.unitEur });
                    }}
                  >
                    {variants.map((v) => (
                      <option key={v.code} value={v.code}>
                        {v.code}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ fontSize: 11, color: "var(--ink4)" }}>{byCode.get(l.code)?.series}</td>
                <td>
                  <input
                    className="a-input"
                    type="number"
                    style={{ margin: 0, fontSize: 11, width: 100 }}
                    value={l.unitEur}
                    onChange={(e) => setLine(i, { unitEur: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    className="a-input"
                    type="number"
                    min={1}
                    style={{ margin: 0, fontSize: 11, width: 70 }}
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: parseInt(e.target.value) || 1 })}
                  />
                </td>
                <td style={{ textAlign: "right" }}>{fmtE(l.unitEur * l.qty)}</td>
                <td>
                  {lines.length > 1 && (
                    <button
                      onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer" }}
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="a-btn-g"
          style={{ width: "auto", padding: "7px 16px", fontSize: 11 }}
          onClick={() => setLines((ls) => [...ls, { code: variants[0]?.code ?? "", qty: 1, unitEur: variants[0]?.eur ?? 0 }])}
        >
          + Add Line
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid var(--cream3)",
            marginTop: 14,
            paddingTop: 12,
          }}
        >
          <span style={{ fontSize: 13 }}>Total (EUR)</span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700 }}>
            {fmtE(total)}
          </span>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="a-btn-g"
          style={{ width: "auto", padding: "10px 22px", marginTop: 12, background: "var(--ink)", color: "var(--cream)" }}
        >
          {saving ? "Saving…" : "💾 Save Purchase Order"}
        </button>
      </div>
    </div>
  );
}
