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

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    // Loose form: ignore spaces / . _ - so "ah 130", "ah-130" all find model AH130.
    const loose = needle.replace(/[\s._-]/g, "");
    const looseOf = (s: string) => s.toLowerCase().replace(/[\s._-]/g, "");
    return products.filter((p) => {
      if (cat && p.series !== cat) return false;
      if (!needle) return true;
      if (
        p.name.toLowerCase().includes(needle) ||
        p.series.toLowerCase().includes(needle) ||
        looseOf(p.name).includes(loose) ||
        looseOf(p.series).includes(loose)
      ) {
        return true;
      }
      // Match any model/variant code or its dimensions within the product.
      return p.models.some(
        (m) =>
          m.code.toLowerCase().includes(needle) ||
          looseOf(m.code).includes(loose) ||
          (m.dims ? m.dims.toLowerCase().includes(needle) : false),
      );
    });
  }, [products, q, cat]);

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

      {q.trim() && (
        <div style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 10 }}>
          {list.length} product{list.length === 1 ? "" : "s"} match “{q.trim()}”
        </div>
      )}

      {list.length === 0 ? (
        <div
          className="a-card"
          style={{ textAlign: "center", padding: 40, color: "var(--ink4)", fontSize: 13 }}
        >
          No products or models match “{q.trim()}”. Try a series (e.g. AH), a model code (e.g.
          AH130), or clear the filter.
        </div>
      ) : (
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
      )}

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
