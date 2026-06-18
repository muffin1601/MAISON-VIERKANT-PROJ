import Link from "next/link";
import { CatalogueButton } from "@/components/CatalogueButton";

/** Faithful port of the prototype <footer>. */
export function PublicFooter() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="fg-grid">
          <div>
            <div className="f-brand-name">
              Maison Vierkant<em> India</em>
            </div>
            <div className="f-brand-sub">Curated by Watcon</div>
            <p className="f-brand-body">
              Authorised Representative of Atelier Vierkant, Belgium — handcrafted ceramic planters
              for India&apos;s most distinguished spaces.
            </p>
          </div>
          <div>
            <div className="f-col-title">Collection</div>
            <Link className="f-link" href="/collection?series=2025%20Collection">
              2025 Collection
            </Link>
            <Link className="f-link" href="/collection?series=A%20Series">
              A Series
            </Link>
            <Link className="f-link" href="/collection?series=U%20Series">
              U Series
            </Link>
            <Link className="f-link" href="/collection?series=K%20Series">
              K Series
            </Link>
            <Link className="f-link" href="/collection">
              All 38 Series
            </Link>
          </div>
          <div>
            <div className="f-col-title">Company</div>
            <Link className="f-link" href="/about">
              About Atelier
            </Link>
            <Link className="f-link" href="/projects">
              Projects
            </Link>
            <CatalogueButton
              className="f-link"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                font: "inherit",
                textAlign: "left",
              }}
            >
              Download Catalogue
            </CatalogueButton>
            <Link className="f-link" href="/contact">
              Contact
            </Link>
          </div>
          <div>
            <div className="f-col-title">Trade</div>
            <Link className="f-link" href="/contact">
              For Architects
            </Link>
            <Link className="f-link" href="/contact">
              For Hospitality
            </Link>
            <Link className="f-link" href="/contact">
              Request Quote
            </Link>
            <Link className="f-link" href="/shipping">
              Shipping to India
            </Link>
          </div>
        </div>
        <nav className="f-legal" aria-label="Legal">
          <Link className="f-link" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="f-link" href="/terms">
            Terms &amp; Conditions
          </Link>
          <Link className="f-link" href="/returns">
            Returns &amp; Cancellations
          </Link>
          <Link className="f-link" href="/shipping">
            Shipping &amp; Delivery
          </Link>
        </nav>
        <div className="f-bottom">
          <span>
            © 2026 Maison Vierkant India — Watcon International · 343, Sultanpur, MG Road,
            Pin-110030 · Next to Pillar No. 28B · Landmark: beside CJ Living showroom ·{" "}
            <a
              className="f-map-link"
              href="https://www.google.com/maps/search/?api=1&query=Watcon+International%2C+343+Sultanpur%2C+MG+Road%2C+110030"
              target="_blank"
              rel="noreferrer"
            >
              View on Google Maps →
            </a>
          </span>
          {/* TODO: replace with the registered GSTIN before launch. */}
          <span>GST registration available on invoice</span>
        </div>
      </div>
    </footer>
  );
}
