"use client";

/**
 * Toast notification — small pill centered at the top of the viewport.
 * Uses explicit inline styles (width:max-content) so it can never expand into a
 * full-screen box, and animates opacity directly so it always shows.
 */
let toastTimer: ReturnType<typeof setTimeout> | undefined;

const BASE =
  "position:fixed;top:22px;left:50%;right:auto;bottom:auto;transform:translateX(-50%);" +
  "background:var(--ink,#1a1814);color:var(--cream,#f8f5f0);" +
  "padding:11px 22px;font-size:13px;letter-spacing:.04em;border-radius:4px;" +
  "font-family:'Jost',sans-serif;width:max-content;max-width:90vw;text-align:center;" +
  "box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:99999;pointer-events:none;" +
  "opacity:0;transition:opacity .3s";

export function showToast(msg: string) {
  if (typeof document === "undefined") return;
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.style.cssText = BASE;
  t.textContent = msg;
  // Reflow, then fade in.
  void t.offsetWidth;
  t.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (t) t.style.opacity = "0";
  }, 3200);
}
