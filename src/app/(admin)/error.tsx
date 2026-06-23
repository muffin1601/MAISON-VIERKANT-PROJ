"use client";

import { useEffect } from "react";

/**
 * Admin route error boundary. Any client/server exception thrown while rendering an
 * admin page is caught here — the admin never sees a white screen. Shows a friendly
 * fallback, logs the error (with its digest), and offers a retry / back-to-dashboard.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface for debugging; server-side errors are also logged by the platform.
    console.error("[admin] render error:", error);
  }, [error]);

  return (
    <div className="a-page active" role="alert">
      <div className="a-title">Something went wrong</div>
      <div className="a-sub">
        This page hit an unexpected error and couldn&apos;t finish loading. Your data is safe.
      </div>
      <div className="a-card" style={{ maxWidth: 560 }}>
        <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 14 }}>
          You can retry, or head back to the dashboard. If it keeps happening, note the reference below.
        </p>
        {error?.digest && (
          <p style={{ fontSize: 11, color: "var(--ink4)", marginBottom: 14 }}>Reference: {error.digest}</p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="btn-primary" style={{ padding: "10px 22px" }} onClick={() => reset()}>
            Try again
          </button>
          <a href="/admin/dashboard" className="btn-ghost" style={{ padding: "10px 22px" }}>
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
