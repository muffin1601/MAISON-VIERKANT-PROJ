"use client";

import { useCallback, useRef, useState } from "react";

/** Minimal shape of the Razorpay checkout we rely on. */
interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (resp: unknown) => void) => void;
}
interface RazorpayOptions {
  key: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (resp: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}
export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SDK_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * Loads the Razorpay Checkout SDK on demand (never bundled / never on first paint)
 * and exposes a single `open()` that resolves with the success payload or rejects
 * on dismissal/failure. Tracks loading + error state for the UI.
 */
export function useRazorpay() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const loadSdk = useCallback(() => {
    if (loaded.current && window.Razorpay) return Promise.resolve(true);
    return new Promise<boolean>((resolve, reject) => {
      // Reuse an existing tag if one is already in the document.
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
      if (existing && window.Razorpay) {
        loaded.current = true;
        return resolve(true);
      }
      const script = existing ?? document.createElement("script");
      script.src = SDK_SRC;
      script.async = true;
      script.onload = () => {
        loaded.current = true;
        resolve(true);
      };
      script.onerror = () => reject(new Error("Could not load the secure payment module."));
      if (!existing) document.body.appendChild(script);
    });
  }, []);

  const open = useCallback(
    (
      options: Omit<RazorpayOptions, "handler" | "modal">,
    ): Promise<RazorpaySuccess> => {
      setError(null);
      setLoading(true);
      return new Promise<RazorpaySuccess>((resolve, reject) => {
        loadSdk()
          .then(() => {
            if (!window.Razorpay) throw new Error("Payment module unavailable.");
            const rzp = new window.Razorpay({
              ...options,
              handler: (resp) => {
                setLoading(false);
                resolve(resp);
              },
              modal: {
                ondismiss: () => {
                  setLoading(false);
                  reject(new Error("Payment was cancelled."));
                },
              },
            });
            rzp.on("payment.failed", (resp: unknown) => {
              setLoading(false);
              const desc =
                (resp as { error?: { description?: string } })?.error?.description ??
                "Your payment could not be completed.";
              setError(desc);
              reject(new Error(desc));
            });
            rzp.open();
          })
          .catch((e: unknown) => {
            setLoading(false);
            const msg = e instanceof Error ? e.message : "Payment could not be started.";
            setError(msg);
            reject(e instanceof Error ? e : new Error(msg));
          });
      });
    },
    [loadSdk],
  );

  return { open, loading, error, setError };
}
