"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Heart, ShoppingBag, Menu, X } from "lucide-react";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { useUI } from "@/store/ui";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { Portal } from "@/components/ui/Portal";

const LINKS = [
  { href: "/", label: "Home", key: "home" },
  { href: "/collection", label: "Collection", key: "shop", mega: true },
  { href: "/projects", label: "Projects", key: "projects" },
  { href: "/about", label: "Atelier", key: "about" },
  { href: "/contact", label: "Contact", key: "contact" },
];

export function PublicHeader() {
  const pathname = usePathname();
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.qty, 0));
  const wishCount = useWishlist((s) => s.slugs.length);
  const openMiniCart = useUI((s) => s.openMiniCart);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const [mega, setMega] = useState(false);
  const [series, setSeries] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => setMounted(true), []);

  // Close menus on route change.
  useEffect(() => {
    setOpen(false);
    setMega(false);
  }, [pathname]);

  // Mobile drawer: scroll-lock, Escape, focus trap, focus restoration.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const restoreTo = triggerRef.current; // refocus the hamburger on close
    document.body.style.overflow = "hidden";
    const t = setTimeout(
      () => drawerRef.current?.querySelector<HTMLElement>("a,button")?.focus(),
      30,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        const f = drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      restoreTo?.focus();
    };
  }, [open]);

  // Lazily load series for the mega menu the first time it opens.
  useEffect(() => {
    if (!mega || series.length) return;
    fetch("/api/search")
      .then((r) => r.json())
      .then((d) => setSeries(d.series ?? []))
      .catch(() => {});
  }, [mega, series.length]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header id="header">
      <div className="header-inner">
        <Link href="/" className="logo">
          <div className="logo-main">
            Maison Vierkant<em> India</em>
          </div>
          <div className="logo-sub">Curated by Watcon</div>
        </Link>

        {/* Desktop primary nav with mega menu */}
        <nav className="nav-primary" aria-label="Primary">
          {LINKS.map((l) =>
            l.mega ? (
              <div
                key={l.key}
                className="nav-mega-wrap"
                onMouseEnter={() => setMega(true)}
                onMouseLeave={() => setMega(false)}
              >
                <Link
                  href={l.href}
                  className={`nav-btn${isActive(l.href) ? " active" : ""}`}
                  aria-haspopup="true"
                  aria-expanded={mega}
                  onFocus={() => setMega(true)}
                >
                  {l.label}
                </Link>
                {mega && (
                  <div className="nav-mega" onMouseLeave={() => setMega(false)}>
                    <div className="nav-mega-col">
                      <p className="nav-mega-title">Series</p>
                      <div className="nav-mega-grid">
                        {(series.length ? series : ["A Series", "U Series", "K Series"]).map((s) => (
                          <Link key={s} href={`/collection?series=${encodeURIComponent(s)}`} className="nav-mega-link">
                            {s}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="nav-mega-col nav-mega-feature">
                      <Link href="/collection" className="nav-mega-link strong">
                        View all 38 series →
                      </Link>
                      <Link href="/wishlist" className="nav-mega-link">
                        Your wishlist
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link key={l.key} href={l.href} className={`nav-btn${isActive(l.href) ? " active" : ""}`}>
                {l.label}
              </Link>
            ),
          )}
        </nav>

        {/* Utility actions */}
        <div className="header-actions">
          <button type="button" className="hdr-icon" aria-label="Search" onClick={() => setSearch(true)}>
            <Search size={19} aria-hidden />
          </button>
          <Link href="/wishlist" className="hdr-icon" aria-label={`Wishlist${mounted && wishCount ? `, ${wishCount} saved` : ""}`}>
            <Heart size={19} aria-hidden />
            {mounted && wishCount > 0 && <span className="hdr-badge">{wishCount}</span>}
          </Link>
          <Link href="/account" className="hdr-icon hide-mobile" aria-label="Account">
            <span className="hdr-account">Account</span>
          </Link>
          <Link href="/login" className="hdr-icon hide-mobile" aria-label="Admin">
            <span className="hdr-account">Admin</span>
          </Link>
          <button
            type="button"
            className="hdr-icon"
            aria-label={`Cart${count > 0 ? `, ${count} item${count === 1 ? "" : "s"}` : ", empty"}`}
            onClick={openMiniCart}
          >
            <ShoppingBag size={19} aria-hidden />
            {mounted && count > 0 && <span className="hdr-badge">{count}</span>}
          </button>
          <button
            ref={triggerRef}
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="primary-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile off-canvas drawer — portaled to <body> so it escapes the header's
          backdrop-filter containing block and fills the full viewport. */}
      {open && (
        <Portal>
        <div className="mob-nav-wrap" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="mob-nav-overlay" aria-label="Close menu" onClick={() => setOpen(false)} />
          <nav
            id="primary-nav"
            className="mob-nav"
            aria-label="Mobile"
            ref={drawerRef}
            onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchStartX.current === null) return;
              // Swipe right (drawer is on the right edge) → close.
              if (e.changedTouches[0].clientX - touchStartX.current > 60) setOpen(false);
              touchStartX.current = null;
            }}
          >
            <button
              type="button"
              className="mob-search"
              onClick={() => {
                setOpen(false);
                setSearch(true);
              }}
            >
              <Search size={16} aria-hidden /> Search the collection
            </button>
            {LINKS.map((l) => (
              <Link key={l.key} href={l.href} className={`mob-link${isActive(l.href) ? " active" : ""}`}>
                {l.label}
              </Link>
            ))}
            <Link href="/wishlist" className="mob-link">
              Wishlist{mounted && wishCount > 0 ? ` (${wishCount})` : ""}
            </Link>
            <Link href="/account" className="mob-link">
              Account
            </Link>
            <Link href="/cart" className="mob-link">
              Cart{mounted && count > 0 ? ` (${count})` : ""}
            </Link>
            <Link href="/login" className="mob-link mob-admin">
              Admin
            </Link>
          </nav>
        </div>
        </Portal>
      )}

      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </header>
  );
}
