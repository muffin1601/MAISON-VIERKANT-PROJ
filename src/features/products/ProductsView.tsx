"use client";

import { useMemo, useState } from "react";
import type { ProductView } from "@/services/catalogue/catalogue";
import { cardPrice } from "@/services/catalogue/catalogue";
import type { PricingConfig } from "@/services/pricing/PricingService";
import { ProductEditor } from "./ProductEditor";
import { Plus } from "@/components/ui/icons";

/** Faithful port of prototype pmRender grid (read view; full editor lands next). */
export function ProductsView({
  products,
  pricing,
  categories,
}: {
  products: ProductView[];
  pricing: PricingConfig;
  categories: string[];
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<ProductView | null>(null);
  const [creating, setCreating] = useState(false);
  const editorOpen = creating || editing !== null;

  const list = useMemo(
    () =>
      products.filter(
        (p) =>
          (!q ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            p.series.toLowerCase().includes(q.toLowerCase())) &&
          (!cat || p.series === cat),
      ),
    [products, q, cat],
  );

  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <input
          className="a-input"
          style={{ flex: 1, minWidth: 180, margin: 0 }}
          placeholder="Search series, model, name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="a-input"
          style={{ width: 160, margin: 0 }}
          value={cat}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          className="a-btn-g"
          style={{ width: "auto", padding: "9px 18px", margin: 0, display: "inline-flex", alignItems: "center", gap: 7 }}
          onClick={() => setCreating(true)}
        >
          <Plus size={14} strokeWidth={1.75} /> Add Product
        </button>
      </div>

      <div
        id="pm-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}
      >
        {list.map((p) => (
          <div
            key={p.id}
            className="a-card"
            style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}
            onClick={() => setEditing(p)}
          >
            <div style={{ height: 150, background: "var(--cream2)", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imgs[0]}
                alt={p.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                loading="lazy"
              />
            </div>
            <div style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: ".18em",
                  textTransform: "uppercase",
                  color: "var(--gold)",
                  marginBottom: 3,
                }}
              >
                {p.series}
              </div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19 }}>{p.name}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                  fontSize: 11,
                  color: "var(--ink4)",
                }}
              >
                <span>{p.models.length} models</span>
                <span style={{ color: "var(--ink)" }}>{cardPrice(p, pricing)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editorOpen && (
        <ProductEditor
          product={editing}
          pricing={pricing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}
