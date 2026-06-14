'use client';

/**
 * Import modal store
 *
 * Tiny UI store driving the combined Import-a-recipe modal's visibility. Lives
 * at module scope so any surface can open it: the global header dropdown
 * (HSHeader "New › Import") and the /recipes page's "Import" button both call
 * `open()`. The actual flow (modal + review sheet + commit) is owned by the
 * globally-mounted <ImportRecipeFlow />.
 */

import { create } from 'zustand';

interface ImportStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useImportStore = create<ImportStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
