"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Portal } from "@/components/ui/Portal";

interface Hit {
  slug: string;
  name: string;
  series: string;
  img: string;
}
interface Index {
  products: Hit[];
  series: string[];
}

const RECENT_KEY = "mvi_recent_searches";
const MAX_RECENT = 5;

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState<Index | null>(null);
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  // Lazy-load the index the first time the overlay opens.
  useEffect(() => {
    if (!open || index) return;
    fetch("/api/search")
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setIndex({ products: [], series: [] }));
  }, [open, index]);

  // Focus the input, lock scroll, and wire Escape + a basic focus trap while open.
  useEffect(() => {
    if (!open) return;
    setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const term = q.trim().toLowerCase();
  const productHits = useMemo(() => {
    if (!index || term.length < 1) return [];
    return index.products
      .filter((p) => p.name.toLowerCase().includes(term) || p.series.toLowerCase().includes(term))
      .slice(0, 6);
  }, [index, term]);
  const seriesHits = useMemo(() => {
    if (!index || term.length < 1) return [];
    return index.series.filter((s) => s.toLowerCase().includes(term)).slice(0, 4);
  }, [index, term]);

  const remember = (value: string) => {
    const next = [value, ...recent.filter((r) => r !== value)].slice(0, MAX_RECENT);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };
  const go = (href: string, remembered: string) => {
    remember(remembered);
    onClose();
    router.push(href);
  };

  if (!open) return null;

  return (
    <Portal>
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search">
      <button className="search-overlay-bg" aria-label="Close search" onClick={onClose} />
      <div className="search-panel" ref={dialogRef}>
        <div className="search-bar">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vessels, series…"
            aria-label="Search the collection"
            onKeyDown={(e) => {
              if (e.key === "Enter" && productHits[0]) {
                go(`/products/${productHits[0].slug}`, q.trim());
              }
            }}
          />
          <button type="button" className="search-close" aria-label="Close search" onClick={onClose}>
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="search-results">
          {term.length < 1 && recent.length > 0 && (
            <div className="search-group">
              <p className="search-group-title">Recent searches</p>
              {recent.map((r) => (
                <button key={r} type="button" className="search-recent" onClick={() => setQ(r)}>
                  <Search size={14} aria-hidden /> {r}
                </button>
              ))}
            </div>
          )}

          {term.length >= 1 && productHits.length === 0 && seriesHits.length === 0 && (
            <div className="search-empty">
              <p>
                No matches for “<strong>{q.trim()}</strong>”.
              </p>
              <p className="search-empty-sub">Try a series name like “A Series”, or browse the full collection.</p>
              <button type="button" className="btn-dark" onClick={() => go("/collection", q.trim())}>
                Browse collection
              </button>
            </div>
          )}

          {seriesHits.length > 0 && (
            <div className="search-group">
              <p className="search-group-title">Collections</p>
              {seriesHits.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="search-series"
                  onClick={() => go(`/collection?series=${encodeURIComponent(s)}`, s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {productHits.length > 0 && (
            <div className="search-group">
              <p className="search-group-title">Products</p>
              {productHits.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  className="search-hit"
                  onClick={() => go(`/products/${p.slug}`, q.trim())}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.img && <img src={p.img} alt="" aria-hidden />}
                  <span>
                    <span className="search-hit-name">{p.name}</span>
                    <span className="search-hit-series">{p.series}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </Portal>
  );
}
