"use client";

import { memo, useCallback } from "react";
import type { GalleryImage } from "@/lib/gallery";

interface Props {
  image: GalleryImage;
  index: number;
  /** First batch is eager-loaded for LCP; the rest lazy-load natively. */
  priority: boolean;
  onOpen: (index: number) => void;
}

/**
 * A single gallery tile. Fixed aspect-ratio box prevents CLS, the skeleton tint
 * sits behind the image until it decodes, and native lazy-loading keeps the
 * initial payload tiny. Pure/memoised so re-renders on "load more" stay cheap.
 */
function GalleryCardBase({ image, index, priority, onOpen }: Props) {
  // Ref callback: if the image is already complete (loaded from cache before
  // hydration), reveal it immediately — onLoad won't fire in that case.
  const revealIfReady = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) img.classList.add("is-loaded");
  }, []);

  return (
    <button
      type="button"
      className="gal-card"
      onClick={() => onOpen(index)}
      aria-label={`Open project ${String(image.n).padStart(3, "0")} in fullscreen viewer`}
    >
      <span className="gal-card-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          loading={priority ? "eager" : "lazy"}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fetchPriority={priority ? "high" : "low" as any}
          decoding="async"
          width={800}
          height={1000}
          ref={revealIfReady}
          onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
        />
        <span className="gal-card-no" aria-hidden="true">
          {String(image.n).padStart(3, "0")}
        </span>
      </span>
    </button>
  );
}

export const GalleryCard = memo(GalleryCardBase);
