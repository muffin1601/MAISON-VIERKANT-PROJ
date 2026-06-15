"use client";

import { useMemo, useState } from "react";
import type { ProductView } from "@/services/catalogue/catalogue";
import { calcBreakdown, calcINR, type PricingConfig } from "@/services/pricing/PricingService";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { savePricing, applyPriceEntries } from "./actions";
import { FileUp } from "@/components/ui/icons";

const SAMPLES: [string, number][] = [
  ["U40", 117],
  ["U80", 776],
  ["LEDA90", 1520],
  ["ARON80", 2983],
];

/** Faithful port of prototype Pricing Engine (applyPricing + renderPriceTable). */
export function PricingEngine({
  products,
  initial,
  canManage,
}: {
  products: ProductView[];
  initial: PricingConfig;
  canManage: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState<PricingConfig>(initial);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("No file uploaded yet");

  /** Parse a CSV of `code,eur` rows (header optional) and bulk-apply prices. */
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("Reading CSV…");
    try {
      const text = await file.text();
      const entries: { code: string; eur: number }[] = [];
      for (const line of text.split(/\r?\n/)) {
        const cols = line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
        if (cols.length < 2) continue;
        const code = cols[0];
        const eur = parseFloat(cols[1].replace(/[^0-9.]/g, ""));
        if (!code || code.toLowerCase() === "code" || !(eur > 0)) continue; // skip header/blank
        entries.push({ code, eur });
      }
      if (entries.length === 0) {
        setUploadStatus("No valid rows found");
        showToast("CSV must have rows of: code,eur");
        return;
      }
      setUploadStatus(`Parsed ${entries.length} prices — applying…`);
      const applied = await applyPriceEntries(entries);
      setUploadStatus(`Updated ${applied.updated} of ${entries.length} models from ${file.name}`);
      showToast(`Price list applied — ${applied.updated} models updated.`);
      router.refresh();
    } catch {
      setUploadStatus("Upload failed");
      showToast("Could not read the CSV file.");
    } finally {
      e.target.value = "";
    }
  }

  const set = (k: keyof PricingConfig, v: number) => setC((p) => ({ ...p, [k]: v }));
  const s = useMemo(() => calcBreakdown(1000, c), [c]);

  const rows = useMemo(() => {
    const out: { series: string; model: string; dims: string; eur: number; bd: ReturnType<typeof calcBreakdown> | null }[] = [];
    const ql = q.toLowerCase();
    for (const p of products) {
      if (p.models.length === 0) {
        if (ql && !p.name.toLowerCase().includes(ql) && !p.series.toLowerCase().includes(ql)) continue;
        out.push({
          series: p.series,
          model: p.name,
          dims: p.dims,
          eur: p.eurPrice,
          bd: p.eurPrice > 0 ? calcBreakdown(p.eurPrice, c) : null,
        });
      } else {
        for (const m of p.models) {
          if (
            ql &&
            !m.code.toLowerCase().includes(ql) &&
            !p.series.toLowerCase().includes(ql) &&
            !p.name.toLowerCase().includes(ql)
          )
            continue;
          out.push({
            series: p.series,
            model: m.code,
            dims: m.dims,
            eur: m.eur,
            bd: m.eur > 0 ? calcBreakdown(m.eur, c) : null,
          });
        }
      }
    }
    return out;
  }, [products, c, q]);

  async function save() {
    setSaving(true);
    try {
      await savePricing(c);
      showToast("Pricing saved — all prices updated across the site.");
    } catch {
      showToast("Could not save pricing.");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const header = "Series,Model,Dimensions,EUR,Landed Cost,Selling (excl GST),Output GST,Selling Price (incl GST)\n";
    const body = rows
      .map((r) =>
        [
          r.series,
          r.model,
          `"${r.dims}"`,
          r.eur || "",
          r.bd ? Math.round(r.bd.landed) : "",
          r.bd ? Math.round(r.bd.sellingExGst) : "",
          r.bd ? Math.round(r.bd.outputGst) : "",
          r.bd ? r.bd.selling : "On Request",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "maison-vierkant-price-list.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="a-page active">
      <div className="a-title">Pricing Engine</div>
      <div className="a-sub">
        All parameters update every price on the website, product detail pages, and cart — instantly
      </div>

      {/* Upload price list */}
      <div className="a-card" style={{ marginBottom: 18, borderLeft: "3px solid var(--gold)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="a-sec" style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
              <FileUp size={15} strokeWidth={1.5} style={{ color: "var(--gold)" }} /> Bulk Update EUR Prices (CSV)
            </div>
            <div style={{ fontSize: 11, color: "var(--ink4)", lineHeight: 1.7, marginBottom: 12 }}>
              Upload a CSV with one row per model: <code style={{ fontSize: 11 }}>code,eur</code> (e.g.{" "}
              <code style={{ fontSize: 11 }}>ARON80,2983</code>). Matching products/variants update
              instantly across the whole site. A header row is optional.
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label
                className="a-btn-g"
                style={{ width: "auto", padding: "9px 18px", margin: 0, cursor: canManage ? "pointer" : "not-allowed" }}
              >
                Upload Price CSV
                <input type="file" accept=".csv,text/csv" style={{ display: "none" }} disabled={!canManage} onChange={onUpload} />
              </label>
              <div style={{ fontSize: 11, color: "var(--ink4)" }}>{uploadStatus}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Parameter grid */}
      <div className="pe-grid">
        <ParamBig
          label="EUR → INR Rate"
          value={c.rate}
          onChange={(v) => set("rate", v)}
          hint="Update daily — check RBI / XE.com"
        />
        <Param label="Supplier Discount" value={c.discountPct} unit="%" onChange={(v) => set("discountPct", v)} hint="Trade discount on the EUR price (reduces your cost)" />
        <Param label="Transport & Insurance" value={c.transportPct} unit="%" onChange={(v) => set("transportPct", v)} hint="Freight + insurance → gives the CIF / assessable value" />
        <Param label="Custom Duty" value={c.dutyPct} unit="%" onChange={(v) => set("dutyPct", v)} hint="Charged on CIF — verify HS code with your CHA" />
        <Param label="Social Welfare Surcharge" value={c.swsPct ?? 0} unit="%" onChange={(v) => set("swsPct", v)} hint="% of customs duty (commonly 10%). Set 0 if not applicable" />
        <Param label="Packing & Handling" value={c.packingFlat} symbol="₹" onChange={(v) => set("packingFlat", v)} hint="Fixed charge added to landed cost (after duty — not duty/GST-marked)" />
        <Param label="Your Profit Margin" value={c.profitPct} unit="%" highlight onChange={(v) => set("profitPct", v)} hint="Applied on landed cost (before GST)" />
        <Param label="Output GST" value={c.gstPct} unit="%" onChange={(v) => set("gstPct", v)} hint="Charged to the customer — applied LAST on the selling price" />

        <div className="pe-card pe-formula-card">
          <div className="pe-card-label">Pricing Steps (landed cost → margin → GST)</div>
          <div className="pe-formula-steps" id="pe-formula-steps">
            <span className="step">EUR €1000</span>
            {c.discountPct > 0 && (
              <>
                <span className="arrow">→</span>
                <span className="step">
                  −{c.discountPct}% = €{(1000 * (1 - c.discountPct / 100)).toFixed(0)}
                </span>
              </>
            )}
            <span className="arrow">→</span>
            <span className="step">×₹{c.rate} = {fmt(s.inrBase)}</span>
            <span className="arrow">→</span>
            <span className="step">+{c.transportPct}% freight → CIF {fmt(s.cif)}</span>
            <span className="arrow">→</span>
            <span className="step">+{c.dutyPct}% duty{(c.swsPct ?? 0) > 0 ? ` +${c.swsPct}% SWS` : ""} = {fmt(s.duty + s.sws)}</span>
            <span className="arrow">→</span>
            <span className="step">+₹{c.packingFlat} packing → landed {fmt(s.landed)}</span>
            <span className="arrow">→</span>
            <span className="step">+{c.profitPct}% margin = {fmt(s.sellingExGst)}</span>
            <span className="arrow">→</span>
            <span className="step">+{c.gstPct}% GST = {fmt(s.outputGst)}</span>
            <span className="arrow">→</span>
            <span className="result">{fmt(s.selling)}</span>
          </div>
          <div style={{ fontSize: 9, color: "var(--ink4)", marginTop: 8, lineHeight: 1.6 }}>
            GST is the customer&apos;s tax (you collect &amp; remit it) — it is applied last and never
            marked up by profit. Import IGST paid at customs is recoverable (ITC) and is not part of cost.
          </div>
        </div>
      </div>

      {/* Sample bar */}
      <div className="pe-sample-bar" id="pe-sample-bar">
        <div
          style={{
            fontSize: 9,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "rgba(248,245,240,.4)",
            marginRight: 4,
          }}
        >
          Live Prices →
        </div>
        {SAMPLES.map(([code, eur], i) => (
          <span key={code} style={{ display: "inline-flex", alignItems: "center" }}>
            <span style={{ display: "inline-flex", flexDirection: "column" }}>
              <span className="psb-label">{code}</span>
              <span className="psb-val">{fmt(calcINR(eur, c))}</span>
            </span>
            {i < SAMPLES.length - 1 && <span className="psb-arrow">·</span>}
          </span>
        ))}
      </div>

      {/* Save */}
      {canManage && (
        <div style={{ marginTop: 14 }}>
          <button
            className="a-btn-g"
            style={{ width: "auto", padding: "10px 22px" }}
            onClick={save}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Pricing"}
          </button>
        </div>
      )}

      {/* Live price table */}
      <div className="a-card" style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div className="a-sec" style={{ marginBottom: 0 }}>
            Full Price List — Live
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Filter model… e.g. U80, LEDA, K Series"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                border: "1px solid var(--cream3)",
                padding: "6px 12px",
                fontSize: 11,
                fontFamily: "'Jost', sans-serif",
                background: "var(--cream2)",
                color: "var(--ink)",
                borderRadius: 2,
                width: 220,
              }}
            />
            <button className="a-btn-g" onClick={exportCsv}>
              ↓ Export CSV
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 540, overflowY: "auto" }}>
          <table className="a-table" id="pe-price-table" style={{ minWidth: 700 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr>
                <th>Series</th>
                <th>Model</th>
                <th>Dimensions</th>
                <th style={{ textAlign: "right" }}>EUR</th>
                <th style={{ textAlign: "right" }}>Landed Cost</th>
                <th style={{ textAlign: "right" }}>Excl. GST</th>
                <th style={{ textAlign: "right", background: "rgba(154,122,58,.12)" }}>
                  Selling (incl. GST)
                </th>
              </tr>
            </thead>
            <tbody id="pe-price-tbody">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 20, color: "var(--ink4)" }}>
                    No products match.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--ink4)" }}>{r.series}</td>
                    <td>
                      <strong>{r.model}</strong>
                    </td>
                    <td style={{ fontSize: 10, color: "var(--ink4)" }}>{r.dims}</td>
                    <td style={{ textAlign: "right" }}>€{r.eur || "—"}</td>
                    <td style={{ textAlign: "right" }}>{r.bd ? fmt(r.bd.landed) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{r.bd ? fmt(r.bd.sellingExGst) : "—"}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--ink)",
                        background: "rgba(154,122,58,.06)",
                      }}
                    >
                      {r.bd ? fmt(r.bd.selling) : "On Request"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Param({
  label,
  value,
  unit,
  symbol,
  hint,
  highlight,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  symbol?: string;
  hint: string;
  highlight?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className={`pe-card${highlight ? " pe-highlight" : ""}`}>
      <div className="pe-card-label">{label}</div>
      <div className="pe-input-wrap">
        {symbol && <span className="pe-symbol">{symbol}</span>}
        <input
          type="number"
          className="pe-input"
          value={value}
          step="0.5"
          min="0"
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        {unit && <span className="pe-unit">{unit}</span>}
      </div>
      <div className="pe-hint">{hint}</div>
    </div>
  );
}

function ParamBig({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="pe-card pe-highlight">
      <div className="pe-card-label">{label}</div>
      <div className="pe-input-big-wrap">
        <span className="pe-symbol">₹</span>
        <input
          type="number"
          className="pe-input-big"
          value={value}
          step="0.01"
          min="1"
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
        <span className="pe-per">per €1</span>
      </div>
      <div className="pe-hint">{hint}</div>
    </div>
  );
}
