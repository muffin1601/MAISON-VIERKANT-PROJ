"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { GalleryImage } from "@/lib/gallery";
import { GalleryGrid } from "./GalleryGrid";
import { GalleryFilters } from "./GalleryFilters";
import { GalleryLoader } from "./GalleryLoader";
import { GalleryInfiniteScroll } from "./GalleryInfiniteScroll";

// Code-split: the lightbox (and its lucide icons / event wiring) is fetched only
// when a visitor first opens an image, keeping the initial gallery bundle lean.
const GalleryLightbox = dynamic(
  () => import("./GalleryLightbox").then((m) => m.GalleryLightbox),
  { ssr: false },
);

interface Props {
  images: GalleryImage[];
  categories: string[];
}

const BATCH = 24; // images per "load more" / infinite-scroll batch
const INITIAL_MOBILE = 12;
const INITIAL_DESKTOP = 24;

/**
 * Orchestrates the gallery: filtering, batched/infinite loading and the
 * lightbox. SSRs the first 12 tiles (safe minimum → no hydration mismatch),
 * then expands to 24 on desktop after mount.
 */
export function GalleryClient({ images, categories }: Props) {
  const [active, setActive] = useState(categories[0] ?? "All");
  const [visible, setVisible] = useState(INITIAL_MOBILE);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Flat folder → single "All" category, so this is a pass-through today, but it
  // keeps the page correct the moment categorised subfolders are introduced.
  const filtered = useMemo(
    () => (active === "All" ? images : images.filter((i) => i.alt.includes(active))),
    [images, active],
  );

  // Bump the initial batch to 24 on larger screens once we can read the viewport.
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) {
      setVisible((v) => Math.max(v, INITIAL_DESKTOP));
    }
  }, []);

  const shown = filtered.slice(0, visible);
  const remaining = filtered.length - shown.length;
  const loadMore = () => setVisible((v) => Math.min(v + BATCH, filtered.length));

  const onFilter = (cat: string) => {
    setActive(cat);
    setVisible(INITIAL_DESKTOP);
  };

  return (
    <>
      <GalleryFilters
        categories={categories}
        active={active}
        count={filtered.length}
        onChange={onFilter}
      />

      <GalleryGrid images={shown} eagerCount={8} onOpen={setLightbox} />

      <GalleryInfiniteScroll enabled={remaining > 0} onReach={loadMore} />
      <GalleryLoader remaining={remaining} onLoadMore={loadMore} />

      {lightbox !== null && (
        <GalleryLightbox
          images={filtered}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNavigate={setLightbox}
        />
      )}
    </>
  );
}
