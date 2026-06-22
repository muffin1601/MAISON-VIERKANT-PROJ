import type { Metadata } from "next";
import { getGalleryImages } from "@/lib/gallery";
import { GalleryHero } from "@/components/gallery/GalleryHero";
import { GalleryClient } from "@/components/gallery/GalleryClient";

export const metadata: Metadata = {
  title: "Project Gallery",
  description:
    "Explore completed projects, architectural details, interiors, exteriors, and craftsmanship from Maison Vierkant.",
  alternates: { canonical: "/gallery" },
  openGraph: {
    title: "Project Gallery | Maison Vierkant",
    description:
      "Explore completed projects, architectural details, interiors, exteriors, and craftsmanship from Maison Vierkant.",
    type: "website",
  },
};

// Image list is read from disk once at build/start — fully static, no per-request work.
export const dynamic = "force-static";

export default function GalleryPage() {
  const images = getGalleryImages();
  // Flat folder = one honest category. (Add subfolders later → derive more here.)
  const categories = ["All"];

  // ImageGallery structured data (capped to keep the JSON-LD payload reasonable).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageGallery",
    name: "Project Gallery | Maison Vierkant",
    description:
      "Completed projects, architectural details, interiors, exteriors, and craftsmanship from Maison Vierkant.",
    image: images.slice(0, 30).map((img) => ({
      "@type": "ImageObject",
      contentUrl: img.src,
      name: `Maison Vierkant Project ${String(img.n).padStart(3, "0")}`,
    })),
  };

  return (
    <div id="page-gallery" className="page active">
      <script
        type="application/ld+json"
        // Server-rendered static JSON — safe.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <GalleryHero backdrop={images[0]} />

      <div className="sw gal-sw">
        <GalleryClient images={images} categories={categories} />
      </div>
    </div>
  );
}
