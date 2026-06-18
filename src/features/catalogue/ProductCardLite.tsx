"use client";

import Link from "next/link";
import type { CardData } from "@/features/catalogue/cardData";
import { WishlistButton } from "@/features/catalogue/WishlistButton";

/** Presentational product card driven by precomputed CardData. Shared across
    PLP, related products, recently-viewed and wishlist grids. */
export function ProductCardLite({ p }: { p: CardData }) {
  return (
    <Link href={`/products/${p.slug}`} className="pc" style={{ display: "block" }}>
      <div className="pc-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pc-img-base" src={p.img} alt={p.name} loading="lazy" />
        {p.soldOut && <span className="pc-badge">Sold out</span>}
        <WishlistButton slug={p.slug} name={p.name} className="pc-wish" />
      </div>
      <div className="pc-info">
        <div className="pc-series">{p.series}</div>
        <div className="pc-name">
          {p.name}
          {p.sizes > 1 && (
            <span style={{ fontSize: 9, color: "var(--gold)", marginLeft: 6, letterSpacing: ".1em" }}>
              {p.sizes} sizes
            </span>
          )}
        </div>
        <div className="pc-pr">
          <span className="pc-inr">{p.priceStr}</span>
        </div>
      </div>
    </Link>
  );
}
