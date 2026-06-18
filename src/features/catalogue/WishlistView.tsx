"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWishlist } from "@/store/wishlist";
import { CollectionBrowser, type CardData } from "@/features/catalogue/CollectionBrowser";

/** Renders the saved subset of the catalogue. Reads the persisted store after mount. */
export function WishlistView({ all }: { all: CardData[] }) {
  const slugs = useWishlist((s) => s.slugs);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const saved = all.filter((p) => slugs.includes(p.slug));

  if (saved.length === 0) {
    return (
      <div className="plp-empty" style={{ padding: "64px 0" }}>
        <h2>Your wishlist is empty</h2>
        <p>Tap the heart on any piece to save it here for later.</p>
        <Link href="/collection" className="btn-dark" style={{ display: "inline-block" }}>
          Browse the collection
        </Link>
      </div>
    );
  }

  return <CollectionBrowser items={saved} />;
}
