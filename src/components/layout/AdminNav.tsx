"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminNavItem } from "@/lib/auth/rbac";
import { NAV_ICONS } from "@/components/ui/icons";

/** Sidebar nav using the prototype's exact .a-nav / .a-nav-btn classes, with premium icons. */
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="a-nav">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = NAV_ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`a-nav-btn${active ? " active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 11 }}
          >
            {Icon && (
              <Icon
                size={16}
                strokeWidth={1.5}
                style={{ flexShrink: 0, color: active ? "var(--gold2)" : "currentColor", opacity: active ? 1 : 0.75 }}
              />
            )}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
