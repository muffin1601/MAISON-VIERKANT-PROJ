"use client";

import { create } from "zustand";

interface UIState {
  catOpen: boolean;
  openCat: () => void;
  closeCat: () => void;
  miniCart: boolean;
  openMiniCart: () => void;
  closeMiniCart: () => void;
}

/** Global UI flags — catalogue modal + mini-cart drawer. */
export const useUI = create<UIState>((set) => ({
  catOpen: false,
  openCat: () => set({ catOpen: true }),
  closeCat: () => set({ catOpen: false }),
  miniCart: false,
  openMiniCart: () => set({ miniCart: true }),
  closeMiniCart: () => set({ miniCart: false }),
}));
