"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { GalleryImage } from "@/lib/gallery";

interface Props {
  images: GalleryImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * Fullscreen project viewer: keyboard + swipe navigation, click-to-zoom, a live
 * counter and a project-story caption. Neighbouring images are preloaded so
 * prev/next is instant. Code-split via next/dynamic — zero cost until first open.
 */
export function GalleryLightbox({ images, index, onClose, onNavigate }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const total = images.length;
  const image = images[index];
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) => {
      setZoomed(false);
      onNavigate((index + delta + total) % total);
    },
    [index, total, onNavigate],
  );

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Scroll-lock the page + focus the dialog for screen readers / keyboard.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Preload the immediate neighbours so prev/next renders instantly.
  useEffect(() => {
    [(index + 1) % total, (index - 1 + total) % total].forEach((i) => {
      const img = new window.Image();
      img.src = images[i].src;
    });
  }, [index, total, images]);

  if (!image) return null;

  return (
    <div
      className="gal-lb"
      role="dialog"
      aria-modal="true"
      aria-label={`Project ${String(image.n).padStart(3, "0")}, image ${index + 1} of ${total}`}
      ref={dialogRef}
      tabIndex={-1}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchStartX.current = null;
      }}
    >
      <button type="button" className="gal-lb-overlay" aria-label="Close viewer" onClick={onClose} />

      <div className="gal-lb-counter" aria-hidden="true">
        {index + 1} / {total}
      </div>

      <button type="button" className="gal-lb-close" aria-label="Close viewer" onClick={onClose}>
        <X size={26} aria-hidden />
      </button>

      <button
        type="button"
        className="gal-lb-nav gal-lb-prev"
        aria-label="Previous project"
        onClick={() => go(-1)}
      >
        <ChevronLeft size={32} aria-hidden />
      </button>

      <figure className="gal-lb-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.src}
          alt={image.alt}
          className={`gal-lb-img${zoomed ? " is-zoomed" : ""}`}
          onClick={() => setZoomed((z) => !z)}
          decoding="async"
        />
        <figcaption className="gal-lb-caption">
          <span className="gal-lb-no">Project {String(image.n).padStart(3, "0")}</span>
          <span className="gal-lb-zoomhint">{zoomed ? "Click to fit" : "Click to zoom"}</span>
        </figcaption>
      </figure>

      <button
        type="button"
        className="gal-lb-nav gal-lb-next"
        aria-label="Next project"
        onClick={() => go(1)}
      >
        <ChevronRight size={32} aria-hidden />
      </button>
    </div>
  );
}

export default GalleryLightbox;
