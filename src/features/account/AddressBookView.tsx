"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showToast } from "@/lib/toast";
import type { AddressDto } from "@/services/account/addresses";

type Draft = {
  label: string;
  name: string;
  company: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
};

const EMPTY: Draft = {
  label: "",
  name: "",
  company: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
  gstin: "",
};

const QK = ["account", "addresses"] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? "Something went wrong.");
  return json.data as T;
}

export function AddressBookView() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState(false);

  const { data: addresses = [], isLoading, isError, refetch } = useQuery({
    queryKey: QK,
    queryFn: () => api<AddressDto[]>("/api/account/addresses"),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const createMut = useMutation({
    mutationFn: (d: Draft) => api<AddressDto>("/api/account/addresses", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      showToast("Address added.");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => showToast(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<Draft> & { isDefault?: boolean } }) =>
      api<AddressDto>(`/api/account/addresses/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => {
      showToast("Address updated.");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => showToast(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api<{ id: string }>(`/api/account/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      showToast("Address removed.");
      invalidate();
    },
    onError: (e: Error) => showToast(e.message),
  });

  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const startNew = () => {
    setDraft(EMPTY);
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (a: AddressDto) => {
    setDraft({
      label: a.label,
      name: a.name,
      company: a.company,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      gstin: a.gstin,
    });
    setEditing(a.id);
    setOpen(true);
  };
  const save = () => {
    if (!draft.name || !draft.line1 || !draft.city || !draft.state || !draft.pincode || !draft.phone) {
      showToast("Please complete name, phone, address, city, state and PIN.");
      return;
    }
    if (editing) updateMut.mutate({ id: editing, d: draft });
    else createMut.mutate(draft);
  };

  const saving = createMut.isPending || updateMut.isPending;

  if (isLoading) {
    return (
      <div className="addr-grid" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="addr-card skeleton-card" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="addr-empty">
        <p>We couldn&apos;t load your addresses.</p>
        <button className="btn-ghost" onClick={() => refetch()} style={{ marginTop: 8 }}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="addr-book">
      {addresses.length === 0 && !open && <p className="addr-empty">You have no saved addresses yet.</p>}

      <div className="addr-grid">
        {addresses.map((a) => (
          <div key={a.id} className={`addr-card${a.isDefault ? " is-default" : ""}`}>
            {a.isDefault && <span className="addr-badge">Default</span>}
            <div className="addr-label">{a.label || a.city}</div>
            <div className="addr-lines">
              <strong>{a.name}</strong>
              {a.company ? ` · ${a.company}` : ""}
              <br />
              +91 {a.phone}
              <br />
              {a.line1}
              {a.line2 ? `, ${a.line2}` : ""}
              <br />
              {a.city}, {a.state} {a.pincode}
              {a.gstin ? (
                <>
                  <br />
                  GSTIN: {a.gstin}
                </>
              ) : null}
            </div>
            <div className="addr-actions">
              <button className="ci-link" onClick={() => startEdit(a)} disabled={deleteMut.isPending}>
                Edit
              </button>
              {!a.isDefault && (
                <button
                  className="ci-link"
                  onClick={() => updateMut.mutate({ id: a.id, d: { isDefault: true } })}
                  disabled={updateMut.isPending}
                >
                  Set default
                </button>
              )}
              <button className="ci-link" onClick={() => deleteMut.mutate(a.id)} disabled={deleteMut.isPending}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <div className="addr-form">
          <div className="co-section-title">{editing ? "Edit address" : "New address"}</div>
          <div className="co-2col">
            <L label="Label">
              <input value={draft.label} placeholder="Home, Studio…" onChange={(e) => set({ label: e.target.value })} />
            </L>
            <L label="Full name *">
              <input value={draft.name} autoComplete="name" onChange={(e) => set({ name: e.target.value })} />
            </L>
          </div>
          <div className="co-2col">
            <L label="Company">
              <input value={draft.company} autoComplete="organization" onChange={(e) => set({ company: e.target.value })} />
            </L>
            <L label="Phone *">
              <input
                value={draft.phone}
                inputMode="numeric"
                maxLength={10}
                autoComplete="tel-national"
                onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "") })}
              />
            </L>
          </div>
          <L label="Address line 1 *">
            <input value={draft.line1} autoComplete="address-line1" onChange={(e) => set({ line1: e.target.value })} />
          </L>
          <L label="Address line 2">
            <input value={draft.line2} autoComplete="address-line2" onChange={(e) => set({ line2: e.target.value })} />
          </L>
          <div className="co-3col">
            <L label="City *">
              <input value={draft.city} autoComplete="address-level2" onChange={(e) => set({ city: e.target.value })} />
            </L>
            <L label="State *">
              <input value={draft.state} autoComplete="address-level1" onChange={(e) => set({ state: e.target.value })} />
            </L>
            <L label="PIN *">
              <input
                value={draft.pincode}
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, "") })}
              />
            </L>
          </div>
          <L label="GST (optional)">
            <input value={draft.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
          </L>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={save} disabled={saving} style={{ padding: "12px 28px" }}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add address"}
            </button>
            <button className="btn-ghost" onClick={() => setOpen(false)} disabled={saving} style={{ padding: "11px 20px" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-dark" onClick={startNew} style={{ marginTop: 16 }}>
          + Add new address
        </button>
      )}
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="co-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
