"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { Package, Heart, Ticket, MapPin, CreditCard, Headphones, UserCog, LogOut } from "lucide-react";

const ITEMS = [
  { href: "/account/orders", label: "Orders", desc: "Track & reorder", Icon: Package },
  { href: "/wishlist", label: "Wishlist", desc: "Your saved pieces", Icon: Heart },
  { href: "/account/coupons", label: "Coupons", desc: "Offers & savings", Icon: Ticket },
  { href: "/account/addresses", label: "Saved Addresses", desc: "Delivery locations", Icon: MapPin },
  { href: "/account/cards", label: "Saved Cards", desc: "Faster checkout", Icon: CreditCard },
  { href: "/contact", label: "Contact Us", desc: "We're here to help", Icon: Headphones },
  { href: "/account/profile", label: "Edit Profile", desc: "Name, phone, photo", Icon: UserCog },
] as const;

/** Myntra-style account menu cards + logout. */
export function AccountMenuGrid() {
  return (
    <div className="acct-grid">
      {ITEMS.map(({ href, label, desc, Icon }) => (
        <Link key={href} href={href} className="acct-card">
          <span className="acct-card-icon">
            <Icon size={20} aria-hidden />
          </span>
          <span className="acct-card-label">{label}</span>
          <span className="acct-card-desc">{desc}</span>
        </Link>
      ))}
      <button type="button" className="acct-card acct-card-btn" onClick={() => signOut({ callbackUrl: "/" })}>
        <span className="acct-card-icon">
          <LogOut size={20} aria-hidden />
        </span>
        <span className="acct-card-label">Logout</span>
        <span className="acct-card-desc">Sign out securely</span>
      </button>
    </div>
  );
}
