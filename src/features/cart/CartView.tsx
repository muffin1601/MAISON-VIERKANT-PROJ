"use client";

import Link from "next/link";
import { useCart } from "@/store/cart";
import { fmt } from "@/lib/format";

export interface LineInfo {
  unit: number;
  dims: string;
  series: string;
  img: string;
}
/** key = `${productCode}|${modelCode}` */
export type PriceMap = Record<string, LineInfo>;

/** Faithful port of prototype renderCart. */
export function CartView({ priceMap }: { priceMap: PriceMap }) {
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);

  if (!items.length) {
    return (
      <div className="sw" id="cart-content">
        <div className="cart-empty">
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 40,
              fontWeight: 300,
              marginBottom: 14,
            }}
          >
            Your cart is <em>empty</em>
          </div>
          <p style={{ color: "var(--ink3)", marginBottom: 26, fontSize: 13 }}>
            Explore our collection of handcrafted Belgian planters.
          </p>
          <Link className="btn-dark" href="/collection">
            Browse Collection
          </Link>
        </div>
      </div>
    );
  }

  const lineOf = (id: string, code: string): LineInfo =>
    priceMap[`${id}|${code}`] ?? { unit: 0, dims: "", series: "", img: "" };
  const total = items.reduce((s, i) => s + lineOf(i.id, i.code).unit * i.qty, 0);

  return (
    <div className="sw" id="cart-content">
      <h1 className="st" style={{ marginBottom: 36 }}>
        Your <em>Selection</em>
      </h1>
      <div className="cart-grid">
        <div>
          {items.map((i) => {
            const info = lineOf(i.id, i.code);
            const label = i.code || i.name;
            return (
              <div className="cart-item" key={`${i.id}|${i.finish}|${i.code}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={info.img || i.img} alt={i.name} />
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: ".2em",
                      textTransform: "uppercase",
                      color: "var(--gold)",
                      marginBottom: 2,
                    }}
                  >
                    {info.series}
                  </div>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 1 }}>{i.finish}</div>
                  {info.dims && (
                    <div style={{ fontSize: 10, color: "var(--ink4)", marginTop: 2 }}>
                      {info.dims}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--ink4)", marginTop: 4 }}>
                    {fmt(info.unit)} each
                  </div>
                </div>
                <div className="ci-right">
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22 }}>
                    {fmt(info.unit * i.qty)}
                  </div>
                  <div className="qty-ctrl">
                    <button
                      aria-label={`Decrease quantity of ${label}`}
                      onClick={() => setQty(i.id, i.finish, i.code, i.qty - 1)}
                    >
                      &#8722;
                    </button>
                    <span className="qty-val" aria-live="polite">
                      {i.qty}
                    </span>
                    <button
                      aria-label={`Increase quantity of ${label}`}
                      onClick={() => setQty(i.id, i.finish, i.code, Math.min(999, i.qty + 1))}
                    >
                      +
                    </button>
                  </div>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: 10,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                      color: "var(--ink4)",
                      cursor: "pointer",
                      fontFamily: "'Jost', sans-serif",
                      marginTop: 4,
                    }}
                    onClick={() => remove(i.id, i.finish, i.code)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="sum-box">
          <div className="sum-title">Order Summary</div>
          {items.map((i) => {
            const info = lineOf(i.id, i.code);
            const label = i.code || i.name;
            return (
              <div className="sum-line" key={`s-${i.id}|${i.finish}|${i.code}`}>
                <span>
                  {label} &#215; {i.qty}
                  <br />
                  <span style={{ fontSize: 10, color: "var(--ink4)" }}>{i.finish}</span>
                </span>
                <span>{fmt(info.unit * i.qty)}</span>
              </div>
            );
          })}
          <div className="sum-total">
            <span style={{ fontSize: 13, fontWeight: 400 }}>Total</span>
            <span
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400 }}
            >
              {fmt(total)}
            </span>
          </div>
          <div className="sum-note">Inclusive of all taxes · Delivery quoted separately</div>
          <Link
            className="btn-dark"
            href="/checkout"
            style={{ display: "block", textAlign: "center", width: "100%", padding: 13, marginBottom: 7 }}
          >
            Proceed to Checkout
          </Link>
          <Link
            className="btn-ghost"
            href="/collection"
            style={{ display: "block", textAlign: "center", width: "100%", padding: 11 }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
