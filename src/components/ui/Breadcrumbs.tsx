import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Accessible breadcrumb trail. The last crumb is the current page (no link,
 * marked aria-current). Mirrors the prototype's small uppercase Jost lettering.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`}>
              {c.href && !last ? (
                <Link href={c.href}>{c.label}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined}>{c.label}</span>
              )}
              {!last && (
                <span className="crumbs-sep" aria-hidden>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
