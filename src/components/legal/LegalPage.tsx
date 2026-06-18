import type { ReactNode } from "react";

/**
 * Shared layout for policy / legal pages (Privacy, Terms, Returns, Shipping).
 * Uses the prototype's existing type classes so it inherits the luxury aesthetic.
 * Content is intentionally placeholder copy marked with TODO — replace with the
 * brand's reviewed legal text before launch.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <section className="legal-page">
      <div className="legal-inner">
        <p className="legal-eyebrow">Maison Vierkant India</p>
        <h1 className="ab-h">{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        <div className="legal-body">{children}</div>
      </div>
    </section>
  );
}
