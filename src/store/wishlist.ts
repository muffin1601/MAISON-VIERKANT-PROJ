"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Saved product slugs. Persisted to localStorage so the wishlist survives reloads,
 * AND mirrored to the server for signed-in users (cross-device sync). When `authed`
 * is true, toggles write through to /api/account/wishlist best-effort; a failed
 * network call never blocks the optimistic local update.
 */
interface WishlistState {
  slugs: string[];
  authed: boolean;
  toggle: (slug: string) => void;
  has: (slug: string) => boolean;
  clear: () => void;
  setAuthed: (v: boolean) => void;
  /** Replace local slugs with the authoritative server union (used after login merge). */
  setAll: (slugs: string[]) => void;
}

function pushAdd(slug: string) {
  void fetch("/api/account/wishlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  }).catch(() => {});
}
function pushRemove(slug: string) {
  void fetch(`/api/account/wishlist/${encodeURIComponent(slug)}`, { method: "DELETE" }).catch(() => {});
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      slugs: [],
      authed: false,
      toggle: (slug) => {
        const had = get().slugs.includes(slug);
        set((s) => ({
          slugs: had ? s.slugs.filter((x) => x !== slug) : [...s.slugs, slug],
        }));
        if (get().authed) {
          if (had) pushRemove(slug);
          else pushAdd(slug);
        }
      },
      has: (slug) => get().slugs.includes(slug),
      clear: () => set({ slugs: [] }),
      setAuthed: (v) => set({ authed: v }),
      setAll: (slugs) => set({ slugs: Array.from(new Set(slugs)) }),
    }),
    { name: "mvi_wishlist", partialize: (s) => ({ slugs: s.slugs }) },
  ),
);
