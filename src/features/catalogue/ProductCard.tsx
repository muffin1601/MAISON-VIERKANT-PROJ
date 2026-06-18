import Link from "next/link";
import type { ProductView } from "@/services/catalogue/catalogue";
import { cardPrice } from "@/services/catalogue/catalogue";
import type { PricingConfig } from "@/services/pricing/PricingService";
import { WishlistButton } from "@/features/catalogue/WishlistButton";

/** Product card — prototype `mkCard` upgraded with hover second image + wishlist. */
export function ProductCard({ p, pricing }: { p: ProductView; pricing: PricingConfig }) {
  const priceStr = cardPrice(p, pricing);
  const hoverImg = p.imgs[1]; // reveal-on-hover secondary shot when available
  const soldOut = p.status?.toLowerCase() === "sold_out" || p.status?.toLowerCase() === "out";

  return (
    <Link href={`/products/${p.slug}`} className="pc" style={{ display: "block" }}>
      <div className="pc-img">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="pc-img-base" src={p.imgs[0]} alt={p.name} loading="lazy" />
        {hoverImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pc-img-hover" src={hoverImg} alt="" aria-hidden loading="lazy" />
        )}
        {soldOut && <span className="pc-badge">Sold out</span>}
        <WishlistButton slug={p.slug} name={p.name} className="pc-wish" />
      </div>
      <div className="pc-info">
        <div className="pc-series">{p.series}</div>
        <div className="pc-name">
          {p.name}
          {p.models.length > 1 && (
            <span
              style={{
                fontSize: 9,
                color: "var(--gold)",
                marginLeft: 6,
                letterSpacing: ".1em",
              }}
            >
              {p.models.length} sizes
            </span>
          )}
        </div>
        <div className="pc-pr">
          <span className="pc-inr">{priceStr}</span>
          <span className="pc-eur"></span>
        </div>
      </div>
    </Link>
  );
}
