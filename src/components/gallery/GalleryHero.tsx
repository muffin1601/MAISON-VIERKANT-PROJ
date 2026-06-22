import type { GalleryImage } from "@/lib/gallery";

/**
 * Editorial hero, styled to match the existing `.coll-hero` (dark ink panel with
 * a softened background image). Server component — no client JS.
 */
export function GalleryHero({ backdrop }: { backdrop?: GalleryImage }) {
  return (
    <section className="coll-hero gal-hero" aria-labelledby="gal-hero-title">
      {backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={backdrop.src} alt="" aria-hidden="true" fetchPriority="high" />
      )}
      <div className="coll-hero-c">
        <div className="ey gal-hero-ey">Maison Vierkant · Portfolio</div>
        <h1 id="gal-hero-title" className="st gal-hero-title">
          Crafted <em>Spaces</em>
        </h1>
        <p className="gal-hero-sub">
          A collection of completed projects, details, and spaces that reflect the Maison Vierkant
          approach to design and construction.
        </p>
      </div>
    </section>
  );
}
