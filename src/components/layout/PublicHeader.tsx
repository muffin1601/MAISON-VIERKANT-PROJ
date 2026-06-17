"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/store/cart";

const LINKS = [
  { href: "/", label: "Home", key: "home" },
  { href: "/collection", label: "Collection", key: "shop" },
  { href: "/projects", label: "Projects", key: "projects" },
  { href: "/about", label: "Atelier", key: "about" },
  { href: "/contact", label: "Contact", key: "contact" },
];

/** Faithful port of the prototype #header. SPA nav -> Next routes (visually identical). */
export function PublicHeader() {
  const pathname = usePathname();
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.qty, 0));
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header id="header">
      <div className="header-inner">
        <Link href="/" className="logo" style={{ display: "block" }}>
          <div className="logo-main">
            Maison Vierkant<em> India</em>
          </div>
          <div className="logo-sub">Curated by Watcon</div>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
        </button>
        <nav id="primary-nav" className={`nav-links${open ? " open" : ""}`}>
          {LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className={`nav-btn${isActive(l.href) ? " active" : ""}`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/cart"
            className="cart-btn"
            aria-label={`Cart${count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ", empty"}`}
          >
            <span aria-hidden>&#9679;</span>
            <span className={`cart-count${count > 0 ? "" : " hidden"}`}>{count}</span>
          </Link>
          <Link
            href="/account"
            className={`nav-btn${pathname.startsWith("/account") ? " active" : ""}`}
          >
            Account
          </Link>
          <Link href="/login" className="admin-toggle">
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
