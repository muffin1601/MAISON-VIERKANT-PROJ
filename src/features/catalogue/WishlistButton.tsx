"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useWishlist } from "@/store/wishlist";

/**
 * Toggle a product in/out of the wishlist. Hydration-safe: the persisted value is
 * only read after mount so SSR markup matches the first client render.
 */
export function WishlistButton({
  slug,
  name,
  className = "",
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const toggle = useWishlist((s) => s.toggle);
  const slugs = useWishlist((s) => s.slugs);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const saved = mounted && slugs.includes(slug);

  return (
    <button
      type="button"
      className={`wish-btn${saved ? " is-saved" : ""} ${className}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={(e) => {
        // Card is wrapped in a <Link>; don't navigate when toggling.
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
    >
      <Heart size={16} fill={saved ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}
