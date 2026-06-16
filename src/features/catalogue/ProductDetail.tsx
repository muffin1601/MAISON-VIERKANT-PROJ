"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProductView } from "@/services/catalogue/catalogue";
import { calcINR, type PricingConfig } from "@/services/pricing/PricingService";
import { fmt } from "@/lib/format";
import { useCart } from "@/store/cart";
import { showToast } from "@/lib/toast";
import { FileText, Download } from "@/components/ui/icons";

/** Faithful port of prototype renderPD/openProd/addToCt — exact markup & behaviour. */
export function ProductDetail({ p, pricing }: { p: ProductView; pricing: PricingConfig }) {
  const [selModelIdx, setSelModelIdx] = useState(0);
  const [selFin, setSelFin] = useState(p.finishes[0] ?? "");
  const [qty, setQty] = useState(1);
  const [thumbIdx, setThumbIdx] = useState(0);
  const add = useCart((s) => s.add);

  const imgs = p.imgs;
  const mods = p.models;
  const cm = mods[selModelIdx];
  // Catalogue/documents are served through the branded stamping route; technical
  // drawings (images) are linked directly.
  const catalogueUrl = p.documents[0]
    ? `/api/catalogue/${p.documents[0].id}`
    : (p.drawings[0] ?? "");

  function addToCart() {
    const modelCode = mods.length > 0 ? mods[selModelIdx].code : p.name;
    add({ id: p.code, slug: p.slug, name: p.name, finish: selFin, code: modelCode, img: imgs[0] }, qty);
    showToast(`${modelCode} (${selFin}) added to cart.`);
  }

  return (
    <div id="page-product" className="page active">
      <div className="sw">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <Link
            href="/collection"
            style={{
              display: "inline-block",
              background: "none",
              border: "none",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--ink3)",
              cursor: "pointer",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            ← Back to Collection
          </Link>
          {catalogueUrl && (
            <a
              href={catalogueUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                color: "var(--ink)",
                border: "1px solid var(--ink3)",
                padding: "10px 22px",
                fontSize: 11,
                letterSpacing: ".18em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
                whiteSpace: "nowrap",
                textDecoration: "none",
              }}
            >
              <FileText size={14} strokeWidth={1.5} style={{ color: "var(--gold)" }} />
              View Catalogue
            </a>
          )}
        </div>
        <div className="pd-grid">
          <div>
            <div className="pd-main-img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img id="pd-main-img" src={imgs[thumbIdx] || imgs[0] || ""} alt={p.name} />
            </div>
            <div className="pd-thumbs" id="pd-thumbs">
              {imgs.map((img, i) => (
                <div
                  key={i}
                  className={`pd-thumb${i === thumbIdx ? " active" : ""}`}
                  onClick={() => setThumbIdx(i)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={p.name} loading="lazy" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="pd-series" id="pd-series">
              {p.series}
            </div>
            <h1 className="pd-name" id="pd-name">
              {p.name}
            </h1>
            <p className="pd-desc" id="pd-desc">
              {p.desc}
            </p>

            <div className="model-sel-wrap">
              <div className="finish-l">Select Size &amp; Model</div>
              <div id="pd-model-table">
                {mods.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--ink4)", padding: "14px 0" }}>
                    Contact us for pricing on this series.
                  </div>
                ) : (
                  <table className="model-table">
                    <thead>
                      <tr>
                        <th>Model / Size</th>
                        <th>Dimensions &amp; Weight</th>
                        <th className="right">Price (INR, incl. all taxes)</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mods.map((m, i) => (
                        <tr
                          key={m.code}
                          className={`mrow${i === selModelIdx ? " mrow-active" : ""}`}
                          onClick={() => setSelModelIdx(i)}
                        >
                          <td>
                            <span className="mt-code">{m.code}</span>
                          </td>
                          <td>
                            <span className="mt-dims">{m.dims}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <span className="mt-price">
                              {m.eur > 0 ? fmt(calcINR(m.eur, pricing)) : "On Request"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="mt-sel-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelModelIdx(i);
                              }}
                            >
                              {i === selModelIdx ? "✓ Selected" : "Select"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="finish-l" style={{ marginTop: 20 }}>
              Select Finish
            </div>
            <div className="finish-btns" id="pd-finishes">
              {p.finishes.map((f) => (
                <button
                  key={f}
                  className={`fin-btn${selFin === f ? " active" : ""}`}
                  onClick={() => setSelFin(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="pd-price" id="pd-price">
              {mods.length === 0 ? "" : cm.eur > 0 ? fmt(calcINR(cm.eur, pricing)) : "On Request"}
            </div>
            <div className="pd-price-note" id="pd-price-note">
              {mods.length === 0
                ? ""
                : cm.eur > 0
                  ? `${cm.code} · Inclusive of import duty, GST & delivery`
                  : `${cm.code} — contact us for pricing`}
            </div>
            <div className="pd-del">
              Delivery: 10–14 weeks from order · Pan-India logistics included
              <br />
              Custom finishes, sizes &amp; engobe applications available on request
            </div>
            <div className="qty-row">
              <div className="qty-ctrl">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                <span className="qty-val" id="pd-qty">
                  {qty}
                </span>
                <button onClick={() => setQty((q) => q + 1)}>+</button>
              </div>
              <button className="add-btn" id="add-btn" onClick={addToCart}>
                Add to Cart
              </button>
            </div>
            <button
              className="bespoke-btn"
              onClick={() =>
                showToast(
                  "Our team will contact you to discuss your bespoke requirements within 24 hours.",
                )
              }
            >
              Request Bespoke Quote
            </button>
            <div className="pd-story">
              <div className="pd-story-l">Belgian Craft · Indian Home</div>
              <p className="pd-story-t">
                Each Atelier Vierkant piece is shaped by hand in Ostend, Belgium. No two pieces are
                exactly alike — the clay body carries the fingerprint of its maker. The Atelier
                offers 8 fully coloured clay bodies and 22 engobe surface colours. Custom sizes,
                finishes, and project-specific specifications available. Lead time: 10–14 weeks from
                confirmed order.
              </p>
            </div>

            {(p.documents.length > 0 || p.drawings.length > 0) && (
              <div className="pd-downloads" style={{ marginTop: 24, borderTop: "1px solid var(--cream3)", paddingTop: 18 }}>
                <div className="pd-story-l" style={{ marginBottom: 10 }}>Downloads &amp; Resources</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {p.documents.map((doc, i) => (
                    <a
                      key={`doc-${i}`}
                      href={`/api/catalogue/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 4, textDecoration: "none", color: "var(--ink)" }}
                    >
                      <FileText size={18} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{doc.filename}</span>
                      <Download size={16} strokeWidth={1.5} style={{ color: "var(--ink3)" }} />
                    </a>
                  ))}
                  {p.drawings.map((url, i) => (
                    <a
                      key={`dwg-${i}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--cream2)", border: "1px solid var(--cream3)", borderRadius: 4, textDecoration: "none", color: "var(--ink)" }}
                    >
                      <FileText size={18} strokeWidth={1.5} style={{ color: "var(--gold)", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13 }}>Technical drawing {i + 1}</span>
                      <Download size={16} strokeWidth={1.5} style={{ color: "var(--ink3)" }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky add-to-cart bar — mobile/tablet only (shown via CSS ≤860px). */}
      <div className="pd-sticky-bar">
        <div className="pd-sticky-price">
          {mods.length === 0
            ? "On Request"
            : cm.eur > 0
              ? fmt(calcINR(cm.eur, pricing))
              : "On Request"}
        </div>
        <button className="add-btn" onClick={addToCart}>
          Add to Cart
        </button>
      </div>
    </div>
  );
}
