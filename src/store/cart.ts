"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Cart line — identical key to prototype: (id, finish, code). */
export interface CartItem {
  id: string; // product code
  slug: string;
  name: string;
  finish: string;
  code: string; // model/variant code ('' if none)
  qty: number;
  img?: string;
  unitINR?: number; // unit price snapshot at add-time (for mini-cart / instant subtotal)
}

interface CartState {
  items: CartItem[];
  saved: CartItem[];
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (id: string, finish: string, code: string, qty: number) => void;
  remove: (id: string, finish: string, code: string) => void;
  saveForLater: (id: string, finish: string, code: string) => void;
  moveToCart: (id: string, finish: string, code: string) => void;
  removeSaved: (id: string, finish: string, code: string) => void;
  clear: () => void;
}

const sameLine = (a: CartItem, id: string, finish: string, code: string) =>
  a.id === id && a.finish === finish && a.code === code;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      saved: [],
      add: (item, qty = 1) =>
        set((state) => {
          const existing = state.items.find((i) =>
            sameLine(i, item.id, item.finish, item.code),
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                sameLine(i, item.id, item.finish, item.code) ? { ...i, qty: i.qty + qty } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, qty }] };
        }),
      setQty: (id, finish, code, qty) =>
        set((state) => ({
          items:
            qty < 1
              ? state.items.filter((i) => !sameLine(i, id, finish, code))
              : state.items.map((i) => (sameLine(i, id, finish, code) ? { ...i, qty } : i)),
        })),
      remove: (id, finish, code) =>
        set((state) => ({
          items: state.items.filter((i) => !sameLine(i, id, finish, code)),
        })),
      saveForLater: (id, finish, code) =>
        set((state) => {
          const item = state.items.find((i) => sameLine(i, id, finish, code));
          if (!item) return state;
          const already = state.saved.some((i) => sameLine(i, id, finish, code));
          return {
            items: state.items.filter((i) => !sameLine(i, id, finish, code)),
            saved: already ? state.saved : [...state.saved, item],
          };
        }),
      moveToCart: (id, finish, code) =>
        set((state) => {
          const item = state.saved.find((i) => sameLine(i, id, finish, code));
          if (!item) return state;
          const existing = state.items.find((i) => sameLine(i, id, finish, code));
          return {
            saved: state.saved.filter((i) => !sameLine(i, id, finish, code)),
            items: existing
              ? state.items.map((i) =>
                  sameLine(i, id, finish, code) ? { ...i, qty: i.qty + item.qty } : i,
                )
              : [...state.items, item],
          };
        }),
      removeSaved: (id, finish, code) =>
        set((state) => ({
          saved: state.saved.filter((i) => !sameLine(i, id, finish, code)),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "mvi_cart" },
  ),
);
