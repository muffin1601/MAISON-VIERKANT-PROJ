"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, X, Send } from "lucide-react";

interface Msg {
  role: "bot" | "user";
  text: string;
  links?: { label: string; href: string }[];
  suggestions?: string[];
}

const GREETING: Msg = {
  role: "bot",
  text: "Hi! I'm the Maison Vierkant assistant. I can track orders, explain shipping & returns, share coupons, or recommend a piece.",
  suggestions: ["Track my order", "Shipping info", "Return policy", "Available coupons"],
};

/** Myntra/Amazon-style assistant widget (bottom-left). Talks to /api/assistant. */
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
          links: data?.links,
          suggestions: data?.suggestions,
        },
      ]);
    } catch {
      setMsgs((m) => [...m, { role: "bot", text: "I'm having trouble right now. Please try again, or reach us on WhatsApp." }]);
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
                  {m.links && m.links.length > 0 && (
                    <div className="cb-links">
                      {m.links.map((l) => (
                        <Link key={l.href} href={l.href} className="cb-link" onClick={() => setOpen(false)}>
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
            {busy && <div className="cb-msg bot"><div className="cb-bubble cb-typing">…</div></div>}
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
              placeholder="Ask about orders, shipping, coupons…"
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
