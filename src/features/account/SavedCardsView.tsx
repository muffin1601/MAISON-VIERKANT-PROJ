"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { showToast } from "@/lib/toast";
import type { SavedCardDto } from "@/services/payment/savedCards";

const QK = ["account", "cards"] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
  return json.data as T;
}

export function SavedCardsView() {
  const qc = useQueryClient();
  const { data: cards = [], isLoading, isError, refetch } = useQuery({
    queryKey: QK,
    queryFn: () => api<SavedCardDto[]>("/api/account/cards"),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/account/cards/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      showToast("Card removed.");
      invalidate();
    },
    onError: (e: Error) => showToast(e.message),
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => api(`/api/account/cards/${id}`, { method: "PATCH", body: JSON.stringify({ isDefault: true }) }),
    onSuccess: () => {
      showToast("Default card updated.");
      invalidate();
    },
    onError: (e: Error) => showToast(e.message),
  });

  if (isLoading)
    return (
      <div className="addr-grid" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="addr-card skeleton-card" />
        ))}
      </div>
    );
  if (isError)
    return (
      <div className="addr-empty">
        <p>Couldn&apos;t load your cards.</p>
        <button className="btn-ghost" onClick={() => refetch()} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    );

  if (cards.length === 0)
    return (
      <div className="addr-empty" style={{ textAlign: "center" }}>
        <CreditCard size={28} style={{ color: "var(--gold)" }} aria-hidden />
        <p style={{ marginTop: 8 }}>No saved cards yet.</p>
        <p style={{ fontSize: 12, color: "var(--ink4)" }}>
          Tick &ldquo;save card&rdquo; during a secure Razorpay payment and it&apos;ll appear here for faster checkout.
          We never store your card number — only a secure token held by Razorpay.
        </p>
      </div>
    );

  return (
    <div className="card-grid">
      {cards.map((c) => (
        <div key={c.id} className={`saved-card${c.isDefault ? " is-default" : ""}`}>
          {c.isDefault && <span className="saved-card-badge">Default</span>}
          <CreditCard size={22} aria-hidden />
          <div className="saved-card-no">
            {c.network} •••• {c.last4}
          </div>
          {(c.issuer || c.expiry) && (
            <div className="saved-card-meta">
              {c.issuer}
              {c.issuer && c.expiry ? " · " : ""}
              {c.expiry ? `Exp ${c.expiry}` : ""}
            </div>
          )}
          <div className="saved-card-actions">
            {!c.isDefault && (
              <button className="ci-link" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate(c.id)}>
                Set default
              </button>
            )}
            <button className="ci-link" disabled={remove.isPending} onClick={() => remove.mutate(c.id)}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
