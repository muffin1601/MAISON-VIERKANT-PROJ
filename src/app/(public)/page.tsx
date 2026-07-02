import Link from "next/link";
import { getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { ProductCard } from "@/features/catalogue/ProductCard";
import { CatalogueButton } from "@/components/CatalogueButton";
import { AVI } from "../../../prisma/data/catalogue";

export const dynamic = "force-dynamic";

// Curated mosaic tiles. Balanced to fill a perfect 4×4 square (16 cells) with
// the 8 leftover tiles (grid: 4 cols · wide=span 2 cols · tall=span 2 rows):
//   Rows 1-2: [733 wide·tall] [696 tall] [701 tall]
//   Row 3:    [723 wide]      [702]      [725]
//   Row 4:    [697 wide]      [735 wide]
const GALLERY = [
  { i: 733, cls: "wide tall", cap: "Salone del Mobile · Milano 2025" },
  { i: 696, cls: "tall", cap: "Terrace installation" },
  { i: 701, cls: "tall", cap: "Architectural pairing" },
  { i: 723, cls: "wide", cap: "Hospitality project" },
  { i: 702, cls: "", cap: "Garden setting" },
  { i: 725, cls: "", cap: "Interior styling" },
  { i: 697, cls: "wide", cap: "Poolside vessels" },
  { i: 735, cls: "wide", cap: "IRIS · handcrafted clay" },
];

export default async function HomePage() {
  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);
  // Featured = products explicitly flagged `featured` in the admin Product editor.
  // Fallback: if none are flagged yet, surface the first active products so the
  // homepage section is never empty.
  const active = products.filter((p) => p.status === "ACTIVE");
  // Showcase a diverse range: at most one product per series. Flagged products
  // take priority, then active non-flagged fill any remaining slots — always
  // skipping series already represented. Original order is preserved within each
  // tier since filter() is stable. Stops at 8 tiles or when series run out.
  const flagged = active.filter((p) => p.featured);
  const rest = active.filter((p) => !p.featured);
  const usedSeries = new Set<string>();
  const featured: typeof active = [];
  for (const p of [...flagged, ...rest]) {
    if (featured.length >= 8) break;
    if (usedSeries.has(p.series)) continue;
    usedSeries.add(p.series);
    featured.push(p);
  }

  return (
    <div id="page-home" className="page active">
      {/* HERO */}
      <div className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="hero-img"
          src="https://wsrv.nl/?url=http%3A%2F%2Fvierkant.pixeo.be%2Fengine%2Fhandlers%2Fimage.asp%3Ft%3Dprojectslides%26i%3D733%26w%3D1680%26c%3Dfalse"
          alt="Atelier Vierkant"
        />
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-eyebrow">Belgium · India · Handcrafted Clay</div>
          <h1 className="hero-title">
            Each piece
            <br />
            <em>tells a story</em>
          </h1>
          <p className="hero-body">
            Willy and Annette Janssens shape 70 tonnes of Belgian clay every week in Ostend. Each
            vessel is unique — made by hand, slowly and meticulously.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/collection" className="btn-primary">
              Explore Collection
            </Link>
            <CatalogueButton className="btn-outline-w">Download Catalogue</CatalogueButton>
          </div>
        </div>
      </div>

      {/* FEATURE STRIP */}
      <div className="feature-strip">
        <div className="feature-strip-inner">
          <div className="fi">
            <div className="fi-label">Handcrafted in Belgium</div>
            <div className="fi-desc">70 tonnes of clay shaped weekly in Ostend</div>
          </div>
          <div className="fi">
            <div className="fi-label">Authorised Representative in India</div>
            <div className="fi-desc">Sole authorised representative for India</div>
          </div>
          <div className="fi">
            <div className="fi-label">38 Series · 200+ Models</div>
            <div className="fi-desc">8 clay bodies · 22 engobe colours</div>
          </div>
          <div className="fi" style={{ borderRight: "none" }}>
            <div className="fi-label">White Glove Delivery</div>
            <div className="fi-desc">Pan-India logistics for art objects</div>
          </div>
        </div>
      </div>

      {/* FEATURED VESSELS */}
      <div className="sw">
        <div className="sh">
          <div>
            <div className="ey">Current Collection</div>
            <h2 className="st">
              Featured <em>Vessels</em>
            </h2>
          </div>
          <Link href="/collection" className="va-btn">
            View All 38 Series →
          </Link>
        </div>
        <div className="pg" id="home-products">
          {featured.map((p) => (
            <ProductCard key={p.id} p={p} pricing={pricing} />
          ))}
        </div>
      </div>

      {/* PROJECT GALLERY */}
      <div className="sw" style={{ paddingTop: 0 }}>
        <div className="sh">
          <div>
            <div className="ey">In Situ</div>
            <h2 className="st">
              Projects &amp; <em>Inspiration</em>
            </h2>
          </div>
        </div>
        <div className="home-gallery" id="home-gallery">
          {GALLERY.map((t, idx) => (
            <Link key={idx} href="/gallery" className={`gi ${t.cls}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={AVI(t.i, 900)} alt={t.cap} loading="lazy" />
              <div className="gi-cap">{t.cap}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* QUOTE BAND */}
      <div className="qb">
        <p className="qb-text">
          &ldquo;The kilometres that separate us are inconsequential. We&apos;re always close by,
          whether our client lives in Dubai, Singapore or Mumbai.&rdquo;
        </p>
        <div className="qb-attr">Willy Janssens, Founder · Atelier Vierkant, Ostend</div>
      </div>

      {/* CATALOGUE CTA */}
      <div className="cat-cta">
        <div className="cat-cta-text">
          <h2>
            2025 Inspiration Book &amp; <em style={{ fontStyle: "italic" }}>Product Data Sheet</em>
          </h2>
          <p>
            Download our full 2025 catalogue featuring the complete Atelier Vierkant collection — all
            38 series, product dimensions, surface finishes, and project photography. Available to
            architects, designers, and homeowners.
          </p>
        </div>
        <CatalogueButton className="btn-primary" style={{ whiteSpace: "nowrap" }}>
          Request Catalogue →
        </CatalogueButton>
      </div>

      {/* TRADE BLOCKS */}
      <div className="sw">
        <div className="r-grid-2" style={{ gap: 28 }}>
          <div style={{ background: "var(--cream2)", padding: 40, borderRadius: 2 }}>
            <div className="ey">Trade</div>
            <h3
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                fontWeight: 300,
                color: "var(--ink)",
                marginBottom: 12,
              }}
            >
              For Architects &amp; Designers
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--ink3)",
                marginBottom: 24,
                lineHeight: 1.8,
              }}
            >
              Access our complete trade catalogue, material samples, and receive a dedicated account
              manager for your projects across India.
            </p>
            <Link href="/contact" className="btn-dark">
              Open Trade Account →
            </Link>
          </div>
          <div style={{ background: "var(--ink)", padding: 40, borderRadius: 2 }}>
            <div className="ey" style={{ color: "var(--gold2)" }}>
              Trade
            </div>
            <h3
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 28,
                fontWeight: 300,
                color: "var(--white)",
                marginBottom: 12,
              }}
            >
              For Hospitality
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "rgba(248,245,240,.55)",
                marginBottom: 24,
                lineHeight: 1.8,
              }}
            >
              Create distinctive outdoor environments at your property. Volume pricing,
              project-specific finishes, and white glove installation support.
            </p>
            <Link href="/contact" className="btn-primary">
              Discuss Your Project →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
