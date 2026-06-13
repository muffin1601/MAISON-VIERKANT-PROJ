"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import { showToast } from "@/lib/toast";
import { Eye, Download, X } from "@/components/ui/icons";
import { setQuoteStatus } from "./actions";

export interface SavedQuoteItem {
  name: string;
  code: string;
  variantCode: string;
  finish: string;
  qty: number;
  unit: number;
}
export interface SavedQuote {
  id: string;
  number: string;
  date: string;
  customer: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  subtotal: number;
  total: number;
  items: SavedQuoteItem[];
}

const STATUSES = ["DRAFT", "SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"];

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#6b6660",
  SENT: "#1a4a6b",
  APPROVED: "#2c5c2c",
  REJECTED: "#8b2c2c",
  EXPIRED: "#6b4a1a",
  CONVERTED: "#4a2c6b",
};

type SortKey = "recent" | "oldest" | "value" | "customer" | "status";

export function SavedQuotesView({ quotes, canApprove }: { quotes: SavedQuote[]; canApprove: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [statusFilter, setStatusFilter] = useState("");
  const [preview, setPreview] = useState<SavedQuote | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    const filtered = quotes.filter(
      (x) =>
        (!statusFilter || x.status === statusFilter) &&
        (!ql ||
          x.number.toLowerCase().includes(ql) ||
          x.customer.toLowerCase().includes(ql) ||
          x.company.toLowerCase().includes(ql)),
    );
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.date.localeCompare(b.date);
        case "value":
          return b.total - a.total;
        case "customer":
          return a.customer.localeCompare(b.customer);
        case "status":
          return a.status.localeCompare(b.status);
        default:
          return b.date.localeCompare(a.date);
      }
    });
    return sorted;
  }, [quotes, q, sort, statusFilter]);

  async function changeStatus(quote: SavedQuote, status: string) {
    if (status === quote.status) return;
    setBusyId(quote.id);
    try {
      await setQuoteStatus(quote.id, status);
      showToast(`Quote ${quote.number} → ${status}`);
      router.refresh();
    } catch {
      showToast("Could not update status.");
    } finally {
      setBusyId(null);
    }
  }

  function downloadPdf(quote: SavedQuote) {
    // Branded A4 PDF generated server-side; auth via session cookie.
    window.open(`/api/admin/quotes/${quote.id}/pdf`, "_blank");
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <input
          className="a-input"
          style={{ flex: 1, minWidth: 200, margin: 0 }}
          placeholder="Search quote no., customer, company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="a-input" style={{ width: 150, margin: 0, fontSize: 12 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="a-input" style={{ width: 160, margin: 0, fontSize: 12 }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="recent">Most recent</option>
          <option value="oldest">Oldest first</option>
          <option value="value">Highest value</option>
          <option value="customer">Customer A–Z</option>
          <option value="status">Status</option>
        </select>
      </div>

      <div className="a-card" style={{ overflowX: "auto" }}>
        <table className="a-table">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Lines</th>
              <th>Total</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "var(--ink4)", fontSize: 12, padding: "14px 12px" }}>
                  {quotes.length === 0 ? "No saved quotes yet. Create one from “Create Quote”." : "No quotes match your search."}
                </td>
              </tr>
            ) : (
              list.map((quote) => (
                <tr key={quote.id}>
                  <td style={{ fontSize: 11, color: "var(--ink4)" }}>{quote.number}</td>
                  <td style={{ color: "var(--ink3)" }}>{quote.date}</td>
                  <td style={{ fontWeight: 400 }}>
                    {quote.customer}
                    {quote.company ? <div style={{ fontSize: 10, color: "var(--ink4)" }}>{quote.company}</div> : null}
                  </td>
                  <td>{quote.items.length}</td>
                  <td style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17 }}>{fmt(quote.total)}</td>
                  <td>
                    {canApprove ? (
                      <select
                        value={quote.status}
                        disabled={busyId === quote.id}
                        onChange={(e) => changeStatus(quote, e.target.value)}
                        className="a-input"
                        style={{ margin: 0, fontSize: 10, padding: "3px 6px", width: 120, color: STATUS_COLOR[quote.status], fontWeight: 600 }}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="sbadge" style={{ background: STATUS_COLOR[quote.status] ?? "#6b6660" }}>{quote.status}</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <IconAction title="Preview" onClick={() => setPreview(quote)}><Eye size={15} strokeWidth={1.5} /></IconAction>
                      <IconAction title="Download PDF" onClick={() => downloadPdf(quote)}><Download size={15} strokeWidth={1.5} /></IconAction>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {preview && <PreviewModal quote={preview} onClose={() => setPreview(null)} onDownload={() => downloadPdf(preview)} canApprove={canApprove} onStatus={(s) => changeStatus(preview, s)} />}
    </>
  );
}

function IconAction({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{ background: "none", border: "1px solid var(--cream3)", borderRadius: 4, width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--ink3)", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

function PreviewModal({
  quote, onClose, onDownload, canApprove, onStatus,
}: {
  quote: SavedQuote;
  onClose: () => void;
  onDownload: () => void;
  canApprove: boolean;
  onStatus: (s: string) => void;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,24,20,.8)", zIndex: 900, overflowY: "auto", padding: "24px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, margin: "0 auto", background: "var(--white)", borderRadius: 6, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.5)" }}>
        <div style={{ background: "var(--ink)", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "var(--cream)", fontSize: 13, fontWeight: 600, letterSpacing: ".06em" }}>Quote {quote.number}</div>
            <div style={{ color: "var(--gold2)", fontSize: 10, letterSpacing: ".12em", marginTop: 2 }}>{quote.date} · {quote.status}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--cream3)", cursor: "pointer", display: "flex" }}><X size={20} strokeWidth={1.5} /></button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
            <Info label="Customer" value={quote.customer} />
            <Info label="Company" value={quote.company || "—"} />
            <Info label="Email" value={quote.email || "—"} />
            <Info label="Phone" value={quote.phone || "—"} />
          </div>

          <table className="a-table" style={{ fontSize: 12 }}>
            <thead>
              <tr><th>Product</th><th>Finish</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Unit</th><th style={{ textAlign: "right" }}>Line</th></tr>
            </thead>
            <tbody>
              {quote.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.name}{it.variantCode ? <span style={{ color: "var(--ink4)" }}> · {it.variantCode}</span> : null}</td>
                  <td>{it.finish}</td>
                  <td style={{ textAlign: "right" }}>{it.qty}</td>
                  <td style={{ textAlign: "right" }}>{fmt(it.unit)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(it.unit * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 28, fontSize: 13 }}>
            <span style={{ color: "var(--ink4)" }}>Subtotal: {fmt(quote.subtotal)}</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>Total: {fmt(quote.total)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--cream3)", paddingTop: 14, gap: 10, flexWrap: "wrap" }}>
            {canApprove ? (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink3)" }}>
                Status
                <select className="a-input" style={{ margin: 0, fontSize: 11, padding: "5px 8px", width: 140 }} value={quote.status} onChange={(e) => onStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            ) : <span />}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onDownload} style={{ background: "var(--gold)", border: "none", color: "#fff", padding: "9px 18px", fontSize: 11, cursor: "pointer", fontFamily: "'Jost', sans-serif", borderRadius: 3, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 7 }}>
                <Download size={14} strokeWidth={1.5} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--ink4)" }}>{label}</div>
      <div style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  );
}
