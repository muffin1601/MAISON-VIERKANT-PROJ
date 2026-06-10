import Link from "next/link";
import { getProducts, getActivePricing } from "@/services/catalogue/catalogue";
import { ProductCard } from "@/features/catalogue/ProductCard";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ series?: string }>;
}) {
  const { series } = await searchParams;
  const [products, pricing] = await Promise.all([getProducts(), getActivePricing()]);

  const cats = [...new Set(products.map((p) => p.series))].sort();
  const active = series && cats.includes(series) ? series : null;
  const shown = active ? products.filter((p) => p.series === active) : products;

  return (
    <div id="page-shop" className="page active">
      <div className="coll-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://wsrv.nl/?url=http%3A%2F%2Fvierkant.pixeo.be%2Fengine%2Fhandlers%2Fimage.asp%3Ft%3Dprojectslides%26i%3D723%26w%3D1680%26c%3Dfalse"
          alt=""
        />
        <div className="coll-hero-c">
          <div className="ey" style={{ color: "var(--gold2)" }}>
            Atelier Vierkant · Belgium · {products.length} Series ·{" "}
            {products.reduce((n, p) => n + p.models.length, 0)} Models
          </div>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(38px,5vw,68px)",
              fontWeight: 300,
              color: "white",
              lineHeight: 1.1,
            }}
          >
            The Complete <em style={{ color: "var(--gold2)" }}>Collection</em>
          </h1>
        </div>
      </div>
      <div className="sw" style={{ paddingTop: 44 }}>
        <div className="filter-row" id="filter-row">
          <Link href="/collection" className={`fb${active ? "" : " active"}`}>
            All <span style={{ fontSize: 9, opacity: 0.6 }}>({products.length})</span>
          </Link>
          {cats.map((c) => {
            const n = products.filter((p) => p.series === c).length;
            return (
              <Link
                key={c}
                href={`/collection?series=${encodeURIComponent(c)}`}
                className={`fb${active === c ? " active" : ""}`}
              >
                {c} <span style={{ fontSize: 9, opacity: 0.6 }}>({n})</span>
              </Link>
            );
          })}
        </div>
        <div className="pg" id="shop-products">
          {shown.map((p) => (
            <ProductCard key={p.id} p={p} pricing={pricing} />
          ))}
        </div>
      </div>
    </div>
  );
}
