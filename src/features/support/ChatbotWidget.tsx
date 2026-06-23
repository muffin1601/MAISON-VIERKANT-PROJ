"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, X, Send } from "lucide-react";

interface ProductCard {
  name: string;
  price: string;
  image: string;
  href: string;
}
interface Msg {
  role: "bot" | "user";
  text: string;
  products?: ProductCard[];
  links?: { label: string; href: string }[];
  suggestions?: string[];
}

const DEFAULT_CHIPS = ["Track Order", "Shipping", "Returns", "Coupons", "Contact Support"];

const GREETING: Msg = {
  role: "bot",
  text: "Hi! I'm the Maison Vierkant assistant. I can track orders, find products, explain shipping, returns & refunds, or share coupons.",
  suggestions: DEFAULT_CHIPS,
};

/** Modern, mobile-responsive rule-based assistant widget (bottom-left). No AI provider. */
export function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const json = await res.json().catch(() => ({}));
      const data = json?.data;
      setMsgs((m) => [
        ...m,
        {
          role: "bot",
          text: data?.reply ?? "Sorry, I couldn't process that. Please try again.",
          products: data?.products,
          links: data?.links,
          suggestions: data?.suggestions ?? DEFAULT_CHIPS,
        },
      ]);
    } catch {
      setMsgs((m) => [
        ...m,
        { role: "bot", text: "I'm having trouble right now. Please try again, or reach us on WhatsApp.", suggestions: DEFAULT_CHIPS },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="cb-fab"
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={24} /> : <Bot size={26} />}
      </button>

      {open && (
        <div className="cb-panel" role="dialog" aria-label="Shopping assistant">
          <div className="cb-head">
            <span className="cb-head-title">
              <Bot size={18} aria-hidden /> Shopping Assistant
            </span>
            <button className="cb-head-close" aria-label="Close" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="cb-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`cb-msg ${m.role}`}>
                <div className="cb-bubble">
                  {m.text.split("\n").map((line, j) => (
                    <div key={j}>{line}</div>
                  ))}

                  {/* Product cards */}
                  {m.products && m.products.length > 0 && (
                    <div className="cb-products">
                      {m.products.map((p) => (
                        <div key={p.href} className="cb-product">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.image ? <img src={p.image} alt={p.name} className="cb-product-img" loading="lazy" /> : <div className="cb-product-img" />}
                          <div className="cb-product-info">
                            <div className="cb-product-name">{p.name}</div>
                            <div className="cb-product-price">{p.price}</div>
                          </div>
                          <Link href={p.href} className="cb-product-btn" onClick={() => setOpen(false)}>
                            View
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}

                  {m.links && m.links.length > 0 && (
                    <div className="cb-links">
                      {m.links.map((l) => (
                        <Link key={l.href + l.label} href={l.href} className="cb-link" onClick={() => setOpen(false)}>
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {m.role === "bot" && m.suggestions && (
                  <div className="cb-chips">
                    {m.suggestions.map((s) => (
                      <button key={s} className="cb-chip" onClick={() => send(s)} disabled={busy}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="cb-msg bot">
                <div className="cb-bubble cb-typing" aria-label="Assistant is typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>

          <form
            className="cb-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, products, coupons…"
              aria-label="Message"
              maxLength={500}
            />
            <button type="submit" aria-label="Send" disabled={busy || !input.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
