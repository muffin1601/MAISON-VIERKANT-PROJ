import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CatalogueModal } from "@/components/CatalogueModal";
import { MiniCart } from "@/features/cart/MiniCart";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    // Mirrors prototype #public-site wrapper.
    <div id="public-site">
      {/* WCAG 2.4.1 — keyboard users bypass the header nav. */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <PublicHeader />
      {/* WCAG 1.3.1 / 2.4.1 — primary content landmark (was a plain div). */}
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter />
      <CatalogueModal />
      <MiniCart />
    </div>
  );
}
