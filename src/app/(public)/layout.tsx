import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CatalogueModal } from "@/components/CatalogueModal";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    // Mirrors prototype #public-site wrapper.
    <div id="public-site">
      <PublicHeader />
      {children}
      <PublicFooter />
      <CatalogueModal />
    </div>
  );
}
