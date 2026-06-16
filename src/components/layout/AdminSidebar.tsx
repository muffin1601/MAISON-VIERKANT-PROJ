"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AdminNavItem } from "@/lib/auth/rbac";
import { AdminNav } from "@/components/layout/AdminNav";
import { SignOutButton } from "@/components/layout/SignOutButton";

/**
 * Wraps the prototype's .a-sidebar so it behaves as a fixed off-canvas drawer
 * on tablet/phone (<=900px) while remaining the static sidebar on desktop.
 * Adds a mobile top bar with a hamburger toggle. No visual change >=901px.
 */
export function AdminSidebar({
  items,
  roleLabel,
}: {
  items: AdminNavItem[];
  roleLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <div className="a-mobile-bar">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>&#9776;</span>
        </button>
        <span className="a-mobile-title">Maison Vierkant</span>
      </div>

      <div
        className={`a-drawer-overlay${open ? " open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className={`a-sidebar${open ? " open" : ""}`}>
        <div className="a-sb-logo">
          <div className="a-sb-name">Maison Vierkant</div>
          <div className="a-sb-sub">{roleLabel}</div>
        </div>
        <AdminNav items={items} />
        <div className="a-exit">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
