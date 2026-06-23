"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Public route error boundary — friendly fallback with a retry. */
export default function PublicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface to the console for debugging; real logging happens server-side.
    console.error(error);
  }, [error]);

  return (
    <div className="route-loading" style={{ textAlign: "center", alignItems: "center" }} role="alert">
      <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
      <p style={{ color: "var(--ink4)", maxWidth: 420 }}>
        We hit an unexpected error. You can try again, or head back to the collection.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button className="btn-primary" style={{ padding: "11px 24px" }} onClick={() => reset()}>
          Try again
        </button>
        <Link href="/collection" className="btn-ghost" style={{ padding: "11px 24px" }}>
          Browse collection
        </Link>
      </div>
    </div>
  );
}
