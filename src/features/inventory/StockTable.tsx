"use client";

import { useState } from "react";
import { fmt, fmtE } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { adjustStock } from "./actions";

export interface StockRow {
  id: string;
  series: string;
  name: string;
  sizes: string;
  dims: string;
  eur: number;
  inr: number;
  stock: number;
}

/** Faithful port of prototype renderStockT + adjStock. */
export function StockTable({ rows, canEdit }: { rows: StockRow[]; canEdit: boolean }) {
  const [stock, setStock] = useState<Record<string, number>>(
    Object.fromEntries(rows.map((r) => [r.id, r.stock])),
  );

  async function adjust(id: string, d: number) {
    if (!canEdit) return;
    try {
      const next = await adjustStock(id, d);
      setStock((s) => ({ ...s, [id]: next }));
      showToast(`Stock updated: ${id} → ${next} units`);
    } catch {
      showToast("Could not update stock.");
    }
  }

  const color = (v: number) => (v === 0 ? "#8b2c2c" : v <= 2 ? "#6b4a1a" : "#2c5c2c");

  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--ink4)", padding: "24px 0" }}>No stock items to display.</div>;
  }

  return (
    <table className="a-table" id="stock-table">
      <thead>
        <tr>
          <th>Series</th>
          <th>Model</th>
          <th>Sizes</th>
          <th>Dims</th>
          <th>EUR</th>
          <th>INR (incl. GST)</th>
          <th>Stock</th>
          {canEdit && <th>Adjust</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => {
          const v = stock[p.id];
          return (
            <tr key={p.id}>
              <td>{p.series}</td>
              <td style={{ fontWeight: 400 }}>{p.name}</td>
              <td style={{ fontSize: 11, color: "var(--ink4)" }}>{p.sizes}</td>
              <td style={{ fontSize: 11, color: "var(--ink4)" }}>{p.dims}</td>
              <td style={{ color: "var(--ink3)" }}>{fmtE(p.eur)}</td>
              <td style={{ fontWeight: 400 }}>{fmt(p.inr)}</td>
              <td style={{ color: color(v), fontWeight: 400 }}>{v}</td>
              {canEdit && (
                <td>
                  <div className="stock-ctrl">
                    <button
                      type="button"
                      aria-label={`Decrease stock for ${p.name}`}
                      disabled={v <= 0}
                      onClick={() => adjust(p.id, -1)}
                    >
                      −
                    </button>
                    <span style={{ minWidth: 24, textAlign: "center", fontSize: 13 }}>{v}</span>
                    <button type="button" aria-label={`Increase stock for ${p.name}`} onClick={() => adjust(p.id, 1)}>
                      +
                    </button>
                  </div>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
