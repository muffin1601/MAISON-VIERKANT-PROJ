"use client";

import { create } from "zustand";

interface UIState {
  catOpen: boolean;
  openCat: () => void;
  closeCat: () => void;
}

/** Global UI flags — mirrors prototype openModal()/closeModal() for the catalogue modal. */
export const useUI = create<UIState>((set) => ({
  catOpen: false,
  openCat: () => set({ catOpen: true }),
  closeCat: () => set({ catOpen: false }),
}));
