'use client';

/**
 * Unsaved Changes Guard Store
 *
 * Global Zustand store that coordinates the "are you sure you want to leave?"
 * flow across the app. Lives outside the recipe domain because:
 *
 *  1. The top NavBar (rendered as a sibling of the editor in ClientShell) needs
 *     to consult dirty state from outside the editor's React tree. A Zustand
 *     store gives both the editor and NavBar a single source of truth without
 *     wrapping the whole layout in a context provider.
 *  2. The lifecycle is editor-mounted-only — the editor registers itself on
 *     mount and unregisters on unmount via `registerEditor`/`unregisterEditor`,
 *     so unrelated pages never trigger the guard.
 *
 * Usage:
 *   - Editor: call `registerEditor(onSave)` on mount, `unregisterEditor()` on
 *     unmount; keep `setDirty(...)` in sync with the recipe's dirty state.
 *   - Any navigation caller (Cancel button, NavBar link, sidebar back button,
 *     popstate handler, etc.): call `guardNavigation(() => doTheNavigation())`.
 *     Runs immediately when not dirty / no editor active; otherwise opens the
 *     modal and stores the action for after the user picks Save/Discard/Cancel.
 */

import { create } from 'zustand';
import { isRecipeDirty, useRecipeStore } from './recipeStore';

type UnsavedChangesStore = {
  /** True when an editor that opts into the guard is currently mounted. */
  isActive: boolean;
  /**
   * True when the active editor has unsaved changes. Mirrors
   * `isRecipeDirty(currentRecipe, savedSnapshot)` from the recipe store, kept
   * here so consumers (like NavBar) can read it cheaply without subscribing
   * to the recipe store. Decision-critical paths (`guardNavigation`,
   * `beforeunload`, `popstate`) still re-check the recipe store directly
   * so a stale value here can never cause a missed prompt.
   */
  isDirty: boolean;
  /**
   * Editor-supplied async save handler. Returns true on success, false on
   * failure (e.g., auth blocked, tier limit, network error). The store awaits
   * this when the user clicks "Save" in the modal.
   */
  onSaveHandler: (() => Promise<boolean>) | null;

  /** Modal open state — when true, render the confirmation dialog. */
  isModalOpen: boolean;
  /** The action to run after the user picks Save or Discard. */
  pendingAction: (() => void) | null;
  /** True while the editor's onSave handler is in flight. */
  isSaving: boolean;
  /** Inline error message shown in the modal if the save fails. */
  saveError: string | null;

  // ─── Editor lifecycle ───
  registerEditor: (onSave: () => Promise<boolean>) => void;
  unregisterEditor: () => void;
  setDirty: (dirty: boolean) => void;

  // ─── Navigation requests ───
  /**
   * Run `action` if the editor is clean or inactive. Otherwise, open the modal
   * and stash the action so it runs after Save/Discard.
   */
  guardNavigation: (action: () => void) => void;

  // ─── Modal actions ───
  /** Await the registered save handler. On success, run the pending action. */
  handleSave: () => Promise<void>;
  /** Run the pending action without saving. */
  handleDiscard: () => void;
  /** Close the modal and keep the user on the page. */
  handleCancel: () => void;
};

export const useUnsavedChangesStore = create<UnsavedChangesStore>((set, get) => ({
  // ─── Initial state ───
  isActive: false,
  isDirty: false,
  onSaveHandler: null,
  isModalOpen: false,
  pendingAction: null,
  isSaving: false,
  saveError: null,

  // ─── Editor lifecycle ───
  registerEditor: (onSave) => {
    set({ isActive: true, onSaveHandler: onSave });
  },

  unregisterEditor: () => {
    // Clear everything — including any in-flight modal — to prevent the dialog
    // from outliving the editor that owns its save handler.
    set({
      isActive: false,
      isDirty: false,
      onSaveHandler: null,
      isModalOpen: false,
      pendingAction: null,
      isSaving: false,
      saveError: null,
    });
  },

  setDirty: (dirty) => {
    if (get().isDirty === dirty) return; // skip no-op updates
    set({ isDirty: dirty });
  },

  // ─── Navigation requests ───
  guardNavigation: (action) => {
    // No editor mounted → navigate immediately.
    if (!get().isActive) {
      action();
      return;
    }
    // Re-check dirty state directly from the recipe store rather than trusting
    // the cached `isDirty` field. This makes us robust to any subscription
    // gap or timing race where the cached value hasn't caught up yet.
    const { currentRecipe, savedSnapshot } = useRecipeStore.getState();
    if (!isRecipeDirty(currentRecipe, savedSnapshot)) {
      action();
      return;
    }
    // Stash the action and open the modal.
    set({
      isModalOpen: true,
      pendingAction: action,
      saveError: null,
    });
  },

  // ─── Modal actions ───
  handleSave: async () => {
    const { onSaveHandler, pendingAction } = get();
    if (!onSaveHandler) {
      // Shouldn't happen — modal can only open when editor is registered. Be
      // defensive: just bail to the discard path.
      get().handleDiscard();
      return;
    }
    set({ isSaving: true, saveError: null });
    let ok = false;
    try {
      ok = await onSaveHandler();
    } catch (err) {
      console.error('[UnsavedChangesGuard] Save handler threw:', err);
      ok = false;
    }
    if (!ok) {
      // Keep the modal open with an error so the user can retry or discard.
      set({ isSaving: false, saveError: 'Save failed. Try again, or discard your changes.' });
      return;
    }
    // Success — run the pending action and close the modal.
    set({
      isSaving: false,
      isModalOpen: false,
      pendingAction: null,
      saveError: null,
    });
    pendingAction?.();
  },

  handleDiscard: () => {
    const { pendingAction } = get();
    set({
      isModalOpen: false,
      pendingAction: null,
      isSaving: false,
      saveError: null,
    });
    pendingAction?.();
  },

  handleCancel: () => {
    set({
      isModalOpen: false,
      pendingAction: null,
      isSaving: false,
      saveError: null,
    });
  },
}));
