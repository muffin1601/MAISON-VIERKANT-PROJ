"use client";

import type { GalleryImage } from "@/lib/gallery";
import { GalleryCard } from "./GalleryCard";

interface Props {
  images: GalleryImage[];
  /** Number of leading cards that load eagerly (initial viewport / LCP). */
  eagerCount: number;
  onOpen: (index: number) => void;
}

/**
 * Structured, Pinterest-inspired column grid (4 / 3 / 2). Uniform 2px-radius
 * tiles with consistent spacing — no masonry, so there is zero layout shift as
 * batches stream in.
 */
export function GalleryGrid({ images, eagerCount, onOpen }: Props) {
  return (
    <div className="gal-grid" role="list">
      {images.map((image, i) => (
        <div role="listitem" key={image.n}>
          <GalleryCard image={image} index={i} priority={i < eagerCount} onOpen={onOpen} />
        </div>
      ))}
    </div>
  );
}
