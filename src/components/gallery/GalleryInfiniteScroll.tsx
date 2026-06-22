"use client";

import { useEffect, useRef } from "react";

interface Props {
  /** Fired when the sentinel scrolls into view. */
  onReach: () => void;
  /** Disable the observer once everything is loaded. */
  enabled: boolean;
}

/**
 * Invisible sentinel that triggers the next batch via IntersectionObserver,
 * pre-fetching 400px before it enters the viewport so loading feels seamless.
 * Renders nothing visible; the visible "Load more" button is the fallback.
 */
export function GalleryInfiniteScroll({ onReach, enabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-creating the observer each render.
  const cb = useRef(onReach);
  cb.current = onReach;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) cb.current();
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  return <div ref={ref} aria-hidden="true" className="gal-sentinel" />;
}
