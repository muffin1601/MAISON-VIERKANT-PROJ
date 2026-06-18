"use client";

import { useEffect, useState } from "react";
import type { CardData } from "@/features/catalogue/cardData";
import { ProductCardLite } from "@/features/catalogue/ProductCardLite";

const KEY = "mvi_recently_viewed";
const MAX = 8;

/**
 * Records the current product into a localStorage recently-viewed list on mount,
 * then renders previously-viewed pieces (excluding the current one).
 */
export function RecentlyViewed({ all, currentSlug }: { all: CardData[]; currentSlug: string }) {
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    const prev: string[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    setSlugs(prev.filter((s) => s !== currentSlug)); // show what was there before this visit
    const next = [currentSlug, ...prev.filter((s) => s !== currentSlug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  }, [currentSlug]);

  const items = slugs.map((s) => all.find((p) => p.slug === s)).filter(Boolean) as CardData[];
  if (items.length === 0) return null;

  return (
    <section className="pd-rail-section">
      <h2 className="pd-rail-title">Recently viewed</h2>
      <div className="pg pg-rail">
        {items.slice(0, 4).map((p) => (
          <ProductCardLite key={p.slug} p={p} />
        ))}
      </div>
    </section>
  );
}
