"use client";

import { useEffect } from "react";
import Link from "next/link";
import { X, ShoppingBag } from "lucide-react";
import { useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { fmt } from "@/lib/format";

/** Slide-in mini-cart drawer. Opens on add-to-cart; gives instant View Cart / Checkout. */
export function MiniCart() {
  const open = useUI((s) => s.miniCart);
  const close = useUI((s) => s.closeMiniCart);
  const items = useCart((s) => s.items);
  const remove = useCart((s) => s.remove);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!open) return null;

  const count = items.reduce((n, i) => n + i.qty, 0);
  // Subtotal from add-time price snapshots; lines without a snapshot are excluded.
  const subtotal = items.reduce((n, i) => n + (i.unitINR ?? 0) * i.qty, 0);
  const hasUnpriced = items.some((i) => !i.unitINR);

  return (
    <div className="mc-wrap" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button className="mc-overlay" aria-label="Close cart" onClick={close} />
      <aside className="mc">
        <div className="mc-head">
          <span>
            Cart {count > 0 && <span className="mc-count">({count})</span>}
          </span>
          <button type="button" aria-label="Close cart" onClick={close}>
            <X size={20} aria-hidden />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="mc-empty">
            <ShoppingBag size={32} strokeWidth={1} aria-hidden />
            <p>Your cart is empty.</p>
            <Link href="/collection" className="btn-dark" onClick={close}>
              Browse collection
            </Link>
          </div>
        ) : (
          <>
            <div className="mc-items">
              {items.map((i) => (
                <div className="mc-item" key={`${i.id}|${i.finish}|${i.code}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {i.img && <img src={i.img} alt="" aria-hidden />}
                  <div className="mc-item-info">
                    <Link href={`/products/${i.slug}`} className="mc-item-name" onClick={close}>
                      {i.name}
                    </Link>
                    <span className="mc-item-meta">
                      {i.code}
                      {i.finish ? ` · ${i.finish}` : ""} · Qty {i.qty}
                    </span>
                    <span className="mc-item-price">{i.unitINR ? fmt(i.unitINR * i.qty) : "On request"}</span>
                  </div>
                  <button
                    type="button"
                    className="mc-item-remove"
                    aria-label={`Remove ${i.name}`}
                    onClick={() => remove(i.id, i.finish, i.code)}
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <div className="mc-foot">
              <div className="mc-subtotal">
                <span>Subtotal</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {hasUnpriced && <p className="mc-note">Some items are priced on request.</p>}
              <p className="mc-note">Delivery quoted separately for orders outside Delhi NCR.</p>
              <Link href="/checkout" className="btn-dark mc-cta" onClick={close}>
                Checkout
              </Link>
              <Link href="/cart" className="btn-ghost mc-cta" onClick={close}>
                View full cart
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
