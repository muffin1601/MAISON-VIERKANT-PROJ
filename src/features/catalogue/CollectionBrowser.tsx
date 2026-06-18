"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { CardData } from "@/features/catalogue/cardData";
import { ProductCardLite } from "@/features/catalogue/ProductCardLite";

export type { CardData };

type Sort = "featured" | "newest" | "price-asc" | "price-desc" | "alpha";

const SORTS: { value: Sort; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "alpha", label: "Alphabetical" },
];

const PRICE_BANDS: { key: string; label: string; test: (n: number | null) => boolean }[] = [
  { key: "u50", label: "Under ₹50,000", test: (n) => n !== null && n < 50000 },
  { key: "50-100", label: "₹50,000 – ₹1,00,000", test: (n) => n !== null && n >= 50000 && n < 100000 },
  { key: "100-200", label: "₹1,00,000 – ₹2,00,000", test: (n) => n !== null && n >= 100000 && n < 200000 },
  { key: "200+", label: "₹2,00,000 +", test: (n) => n !== null && n >= 200000 },
  { key: "request", label: "Price on request", test: (n) => n === null },
];

const PAGE = 12;

export function CollectionBrowser({
  items,
  initialSeries,
}: {
  items: CardData[];
  initialSeries?: string;
}) {
  const seriesList = useMemo(() => [...new Set(items.map((i) => i.series))].sort(), [items]);
  const finishList = useMemo(
    () => [...new Set(items.flatMap((i) => i.finishes))].filter(Boolean).sort(),
    [items],
  );

  const [series, setSeries] = useState<string[]>(
    initialSeries && items.some((i) => i.series === initialSeries) ? [initialSeries] : [],
  );
  const [finishes, setFinishes] = useState<string[]>([]);
  const [bands, setBands] = useState<string[]>([]);
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState<Sort>("featured");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(false);

  // Lock body scroll while the mobile filter drawer is open.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const filtered = useMemo(() => {
    const out = items.filter((p) => {
      if (series.length && !series.includes(p.series)) return false;
      if (finishes.length && !p.finishes.some((f) => finishes.includes(f))) return false;
      if (inStock && p.soldOut) return false;
      if (bands.length) {
        const ok = PRICE_BANDS.filter((b) => bands.includes(b.key)).some((b) => b.test(p.minINR));
        if (!ok) return false;
      }
      return true;
    });
    const num = (n: number | null) => (n === null ? Infinity : n);
    // Trim + natural, case-insensitive compare so leading whitespace / mixed case
    // can't push entries (e.g. "GR Series") out of their true alphabetical slot.
    const byName = (a: CardData, b: CardData) =>
      (a.name || "").trim().localeCompare((b.name || "").trim(), "en", {
        numeric: true,
        sensitivity: "base",
      });
    switch (sort) {
      case "alpha":
        out.sort(byName);
        break;
      case "price-asc":
        out.sort((a, b) => num(a.minINR) - num(b.minINR));
        break;
      case "price-desc":
        out.sort((a, b) => num(b.minINR) - num(a.minINR));
        break;
      case "newest":
        out.reverse();
        break;
      case "featured":
      default:
        out.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return out;
  }, [items, series, finishes, bands, inStock, sort]);

  // Reset paging when the result set changes.
  useEffect(() => setPage(1), [series, finishes, bands, inStock, sort]);

  const visible = filtered.slice(0, page * PAGE);
  const activeCount = series.length + finishes.length + bands.length + (inStock ? 1 : 0);

  const clearAll = () => {
    setSeries([]);
    setFinishes([]);
    setBands([]);
    setInStock(false);
  };

  const facets = (
    <div className="plp-facets">
      <fieldset className="facet">
        <legend>Series</legend>
        {seriesList.map((s) => (
          <label key={s} className="facet-opt">
            <input type="checkbox" checked={series.includes(s)} onChange={() => toggle(series, setSeries, s)} />
            <span>{s}</span>
          </label>
        ))}
      </fieldset>
      {finishList.length > 0 && (
        <fieldset className="facet">
          <legend>Finish</legend>
          {finishList.map((f) => (
            <label key={f} className="facet-opt">
              <input type="checkbox" checked={finishes.includes(f)} onChange={() => toggle(finishes, setFinishes, f)} />
              <span>{f}</span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="facet">
        <legend>Price</legend>
        {PRICE_BANDS.map((b) => (
          <label key={b.key} className="facet-opt">
            <input type="checkbox" checked={bands.includes(b.key)} onChange={() => toggle(bands, setBands, b.key)} />
            <span>{b.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="facet">
        <legend>Availability</legend>
        <label className="facet-opt">
          <input type="checkbox" checked={inStock} onChange={() => setInStock((v) => !v)} />
          <span>In stock only</span>
        </label>
      </fieldset>
      {activeCount > 0 && (
        <button type="button" className="btn-ghost facet-clear" onClick={clearAll}>
          Clear all ({activeCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="plp">
      {/* Toolbar: result count, mobile filter trigger, sort */}
      <div className="plp-toolbar">
        <button type="button" className="plp-filter-toggle" onClick={() => setDrawer(true)}>
          <SlidersHorizontal size={15} aria-hidden /> Filters
          {activeCount > 0 && <span className="plp-fcount">{activeCount}</span>}
        </button>
        <span className="plp-count" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
        </span>
        <label className="plp-sort">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="plp-body">
        <aside className="plp-rail" aria-label="Filters">
          {facets}
        </aside>

        <div className="plp-main">
          {visible.length === 0 ? (
            <div className="plp-empty">
              <h2>No pieces match these filters</h2>
              <p>Try removing a filter to see more of the collection.</p>
              <button type="button" className="btn-dark" onClick={clearAll}>
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="pg">
                {visible.map((p) => (
                  <ProductCardLite key={p.slug} p={p} />
                ))}
              </div>
              {visible.length < filtered.length && (
                <div className="plp-more">
                  <button type="button" className="btn-dark" onClick={() => setPage((n) => n + 1)}>
                    Load more ({filtered.length - visible.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {drawer && (
        <div className="plp-drawer-wrap" role="dialog" aria-modal="true" aria-label="Filters">
          <button className="plp-drawer-overlay" aria-label="Close filters" onClick={() => setDrawer(false)} />
          <div className="plp-drawer">
            <div className="plp-drawer-head">
              <span>Filters</span>
              <button type="button" aria-label="Close filters" onClick={() => setDrawer(false)}>
                <X size={20} aria-hidden />
              </button>
            </div>
            <div className="plp-drawer-body">{facets}</div>
            <div className="plp-drawer-foot">
              <button type="button" className="btn-dark" onClick={() => setDrawer(false)}>
                Show {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
