"use client";

import { useEffect, useState } from "react";
import { useAddressBook, type Address } from "@/store/address";
import { showToast } from "@/lib/toast";

type Draft = Omit<Address, "id">;
const EMPTY: Draft = {
  label: "",
  name: "",
  company: "",
  phone: "",
  addr1: "",
  addr2: "",
  city: "",
  state: "",
  pin: "",
  gst: "",
};

export function AddressBookView() {
  const { addresses, defaultId, add, update, remove, setDefault } = useAddressBook();
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const startNew = () => {
    setDraft(EMPTY);
    setEditing(null);
    setOpen(true);
  };
  const startEdit = (a: Address) => {
    setDraft({ ...a });
    setEditing(a.id);
    setOpen(true);
  };
  const save = () => {
    if (!draft.name || !draft.addr1 || !draft.city || !draft.state || !draft.pin || !draft.phone) {
      showToast("Please complete name, phone, address, city, state and PIN.");
      return;
    }
    if (editing) {
      update(editing, draft);
      showToast("Address updated.");
    } else {
      add(draft);
      showToast("Address added.");
    }
    setOpen(false);
  };

  return (
    <div className="addr-book">
      {addresses.length === 0 && !open && (
        <p className="addr-empty">You have no saved addresses yet.</p>
      )}

      <div className="addr-grid">
        {addresses.map((a) => (
          <div key={a.id} className={`addr-card${a.id === defaultId ? " is-default" : ""}`}>
            {a.id === defaultId && <span className="addr-badge">Default</span>}
            <div className="addr-label">{a.label || a.city}</div>
            <div className="addr-lines">
              <strong>{a.name}</strong>
              {a.company ? ` · ${a.company}` : ""}
              <br />
              +91 {a.phone}
              <br />
              {a.addr1}
              {a.addr2 ? `, ${a.addr2}` : ""}
              <br />
              {a.city}, {a.state} {a.pin}
              {a.gst ? (
                <>
                  <br />
                  GSTIN: {a.gst}
                </>
              ) : null}
            </div>
            <div className="addr-actions">
              <button className="ci-link" onClick={() => startEdit(a)}>
                Edit
              </button>
              {a.id !== defaultId && (
                <button className="ci-link" onClick={() => setDefault(a.id)}>
                  Set default
                </button>
              )}
              <button className="ci-link" onClick={() => remove(a.id)}>
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
              <input value={draft.phone} inputMode="numeric" maxLength={10} autoComplete="tel-national" onChange={(e) => set({ phone: e.target.value.replace(/\D/g, "") })} />
            </L>
          </div>
          <L label="Address line 1 *">
            <input value={draft.addr1} autoComplete="address-line1" onChange={(e) => set({ addr1: e.target.value })} />
          </L>
          <L label="Address line 2">
            <input value={draft.addr2} autoComplete="address-line2" onChange={(e) => set({ addr2: e.target.value })} />
          </L>
          <div className="co-3col">
            <L label="City *">
              <input value={draft.city} autoComplete="address-level2" onChange={(e) => set({ city: e.target.value })} />
            </L>
            <L label="State *">
              <input value={draft.state} autoComplete="address-level1" onChange={(e) => set({ state: e.target.value })} />
            </L>
            <L label="PIN *">
              <input value={draft.pin} inputMode="numeric" maxLength={6} autoComplete="postal-code" onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "") })} />
            </L>
          </div>
          <L label="GST (optional)">
            <input value={draft.gst} onChange={(e) => set({ gst: e.target.value })} />
          </L>
          <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={save} style={{ padding: "12px 28px" }}>
              {editing ? "Save changes" : "Add address"}
            </button>
            <button className="btn-ghost" onClick={() => setOpen(false)} style={{ padding: "11px 20px" }}>
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
