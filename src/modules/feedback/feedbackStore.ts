'use client';

/**
 * Feedback modal store
 *
 * Tiny UI store driving the global feedback modal's visibility. Lives at module
 * scope so any surface can open it — the footer's "Feedback" button calls
 * `open()`. The modal itself is owned by the globally-mounted <FeedbackModal />
 * (mounted once in ClientShell, mirroring the import flow).
 */

import { create } from 'zustand';

interface FeedbackStore {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useFeedbackStore = create<FeedbackStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
