'use client';

/**
 * Toast Store
 *
 * Centralized notification system using Zustand.
 * Provides success, error, warning, and info notifications.
 */

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  /** Optional action text (e.g., "Retry", "View Raw Data") */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Auto-dismiss after this many ms (default: 5000, 0 = no auto-dismiss) */
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => string;
  remove: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  add: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-dismiss (default 5s, 0 = never)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        get().remove(id);
      }, duration);
    }

    return id;
  },

  remove: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clear: () => {
    set({ toasts: [] });
  },
}));

/** Helper functions for common toast patterns */
export const toast = {
  success: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
    useToastStore.getState().add({ type: 'success', message, ...options }),

  error: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
    useToastStore.getState().add({ type: 'error', message, duration: 8000, ...options }),

  warning: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
    useToastStore.getState().add({ type: 'warning', message, ...options }),

  info: (message: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'message'>>) =>
    useToastStore.getState().add({ type: 'info', message, ...options }),
};
