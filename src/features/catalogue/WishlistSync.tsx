"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useWishlist } from "@/store/wishlist";

/**
 * Bridges the localStorage wishlist with the server for signed-in users:
 *  - on auth, merges local + server slugs (union) and writes the union back,
 *  - flips the store into write-through mode so later toggles persist server-side.
 * Renders nothing. Mount once in the public layout.
 */
export function WishlistSync() {
  const { status } = useSession();
  const setAuthed = useWishlist((s) => s.setAuthed);
  const setAll = useWishlist((s) => s.setAll);
  const mergedFor = useRef<string | null>(null);

  useEffect(() => {
    const authed = status === "authenticated";
    setAuthed(authed);
    if (!authed) {
      mergedFor.current = null;
      return;
    }
    if (mergedFor.current === "done") return;
    mergedFor.current = "done";

    const local = useWishlist.getState().slugs;
    (async () => {
      try {
        const res = await fetch("/api/account/wishlist", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slugs: local }),
        });
        const json = await res.json().catch(() => ({}));
        const slugs: string[] | undefined = json?.data?.slugs;
        if (res.ok && Array.isArray(slugs)) setAll(slugs);
      } catch {
        /* offline — local store remains the source of truth until next load */
      }
    })();
  }, [status, setAuthed, setAll]);

  return null;
}
