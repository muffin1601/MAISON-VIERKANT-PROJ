"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into document.body, escaping any ancestor that creates a
 * containing block for fixed positioning (e.g. the header's `backdrop-filter`).
 * Without this, `position:fixed` overlays are clipped to the transformed/filtered
 * ancestor instead of the viewport.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
