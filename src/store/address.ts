"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Address {
  id: string;
  label: string; // e.g. "Home", "Studio"
  name: string;
  company?: string;
  phone: string;
  addr1: string;
  addr2?: string;
  city: string;
  state: string;
  pin: string;
  gst?: string;
}

interface AddressState {
  addresses: Address[];
  defaultId: string | null;
  add: (a: Omit<Address, "id">) => string;
  update: (id: string, patch: Partial<Omit<Address, "id">>) => void;
  remove: (id: string) => void;
  setDefault: (id: string) => void;
}

// Stable-ish id without Date.now()/Math.random at module scope (SSR-safe enough here).
let seq = 0;
const newId = () => `addr_${Date.now().toString(36)}_${seq++}`;

export const useAddressBook = create<AddressState>()(
  persist(
    (set) => ({
      addresses: [],
      defaultId: null,
      add: (a) => {
        const id = newId();
        set((s) => ({
          addresses: [...s.addresses, { ...a, id }],
          defaultId: s.defaultId ?? id,
        }));
        return id;
      },
      update: (id, patch) =>
        set((s) => ({
          addresses: s.addresses.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      remove: (id) =>
        set((s) => {
          const addresses = s.addresses.filter((x) => x.id !== id);
          return {
            addresses,
            defaultId: s.defaultId === id ? (addresses[0]?.id ?? null) : s.defaultId,
          };
        }),
      setDefault: (id) => set({ defaultId: id }),
    }),
    { name: "mvi_addresses" },
  ),
);
