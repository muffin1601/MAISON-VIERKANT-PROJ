"use client";

import { useEffect, useRef, useState } from "react";
import { ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Luxury PDP gallery: click-to-zoom (hover-pan on desktop), fullscreen lightbox,
 * touch swipe, keyboard arrows, and accessible thumbnail buttons.
 */
export function ProductGallery({ imgs, name }: { imgs: string[]; name: string }) {
  const images = imgs.length ? imgs : [""];
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false); // hover-pan on the inline image
  const [origin, setOrigin] = useState("50% 50%");
  const [light, setLight] = useState(false); // fullscreen lightbox
  const touchX = useRef<number | null>(null);

  const go = (n: number) => setIdx((n + images.length) % images.length);
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  // Lightbox: lock scroll + keyboard navigation.
  useEffect(() => {
    if (!light) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLight(false);
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light, idx]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const onTouchStart = (e: React.TouchEvent) => (touchX.current = e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchX.current = null;
  };

  return (
    <div className="pd-gallery">
      <div
        className={`pd-main-img${zoom ? " is-zoom" : ""}`}
        onMouseEnter={() => setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMove}
        onClick={() => setLight(true)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="button"
        tabIndex={0}
        aria-label="Open image in fullscreen"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setLight(true);
          }
          if (e.key === "ArrowRight") next();
          if (e.key === "ArrowLeft") prev();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[idx]}
          alt={`${name} — view ${idx + 1} of ${images.length}`}
          style={zoom ? { transformOrigin: origin, transform: "scale(1.9)" } : undefined}
        />
        <span className="pd-zoom-hint" aria-hidden>
          <ZoomIn size={16} /> Click to enlarge
        </span>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="pd-gnav prev"
              aria-label="Previous image"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
            >
              <ChevronLeft size={20} aria-hidden />
            </button>
            <button
              type="button"
              className="pd-gnav next"
              aria-label="Next image"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="pd-thumbs" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`View image ${i + 1}`}
              className={`pd-thumb${i === idx ? " active" : ""}`}
              onClick={() => setIdx(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" aria-hidden loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {light && (
        <div className="pd-lightbox" role="dialog" aria-modal="true" aria-label={`${name} gallery`}>
          <button className="pd-lb-close" aria-label="Close fullscreen" onClick={() => setLight(false)}>
            <X size={26} aria-hidden />
          </button>
          {images.length > 1 && (
            <button className="pd-lb-nav prev" aria-label="Previous image" onClick={prev}>
              <ChevronLeft size={32} aria-hidden />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="pd-lb-img"
            src={images[idx]}
            alt={`${name} — view ${idx + 1} of ${images.length}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          />
          {images.length > 1 && (
            <button className="pd-lb-nav next" aria-label="Next image" onClick={next}>
              <ChevronRight size={32} aria-hidden />
            </button>
          )}
          <div className="pd-lb-count" aria-hidden>
            {idx + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}
