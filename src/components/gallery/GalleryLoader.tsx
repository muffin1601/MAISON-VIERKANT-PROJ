"use client";

interface Props {
  remaining: number;
  onLoadMore: () => void;
}

/**
 * "Load more" affordance + skeleton placeholders. Doubles as the progressive-
 * enhancement fallback for the IntersectionObserver auto-loader: if observers
 * are unavailable (or JS scroll fails), the button still advances batches.
 */
export function GalleryLoader({ remaining, onLoadMore }: Props) {
  if (remaining <= 0) {
    return (
      <p className="gal-end" role="status">
        You&apos;ve reached the end of the collection.
      </p>
    );
  }

  return (
    <div className="gal-loadmore">
      <button type="button" className="va-btn gal-loadmore-btn" onClick={onLoadMore}>
        Load more · {remaining} remaining
      </button>
    </div>
  );
}

/** Lightweight shimmer tiles shown while a new batch decodes. */
export function GallerySkeleton({ count }: { count: number }) {
  return (
    <div className="gal-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="gal-skel" />
      ))}
    </div>
  );
}
