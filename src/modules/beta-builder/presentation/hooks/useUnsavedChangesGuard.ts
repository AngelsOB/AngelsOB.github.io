'use client';

/**
 * Unsaved-changes guard hook for the recipe editor.
 *
 * Wires the recipe editor into the global `unsavedChangesStore`:
 *   1. Subscribes to recipeStore (currentRecipe + savedSnapshot) and pushes a
 *      computed `isDirty` into the guard store on every change.
 *   2. Registers an editor save handler (called when the user hits "Save" in
 *      the modal). The handler runs the editor's existing auth/tier checks.
 *   3. Attaches `beforeunload` (browser refresh / tab close / external nav)
 *      with the native "unsaved changes" prompt.
 *   4. Attaches `popstate` (browser back/forward inside the SPA) using the
 *      `history.pushState` re-push trick — push a sentinel state on mount,
 *      re-push it whenever popstate fires, and surface the modal instead.
 *   5. Returns `guardedPush(path)` for in-editor controls (Cancel, sticky bar,
 *      etc.) to call instead of `router.push` directly.
 *
 * When `enabled` is false (read-only mode: shared recipe view, version
 * history), no listeners are attached and the guard remains inert.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isRecipeDirty, useRecipeStore } from '../stores/recipeStore';
import { useUnsavedChangesStore } from '../stores/unsavedChangesStore';

interface UseUnsavedChangesGuardOptions {
  /**
   * When false (read-only views), no listeners are attached and the guard
   * is completely inert.
   */
  enabled: boolean;
  /**
   * Editor-provided save handler called when the user clicks "Save" in the
   * modal. Should run any auth/tier guards the editor would normally run,
   * then await the actual save. Return true on success, false on failure.
   */
  onSave: () => Promise<boolean>;
}

interface UseUnsavedChangesGuardReturn {
  /**
   * Wrap `router.push` so it routes through the guard. If clean (or guard
   * disabled), navigates immediately; otherwise opens the modal.
   */
  guardedPush: (href: string) => void;
}

/** Marker we set on history.state when pushing the popstate sentinel. */
const SENTINEL_KEY = '__unsavedGuardSentinel';

export function useUnsavedChangesGuard({
  enabled,
  onSave,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardReturn {
  const router = useRouter();

  // Keep the latest onSave in a ref so the registered handler always sees the
  // current closure (auth state, tier, etc.) without re-registering on every
  // render.
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // ─── Editor registration ───
  useEffect(() => {
    if (!enabled) return;
    const store = useUnsavedChangesStore.getState();
    store.registerEditor(() => onSaveRef.current());
    return () => {
      useUnsavedChangesStore.getState().unregisterEditor();
    };
  }, [enabled]);

  // ─── Dirty mirroring: recipeStore → unsavedChangesStore ───
  // Use selector hooks instead of `subscribe()` — more idiomatic and avoids
  // any Zustand subscribe API quirks. React re-runs this when either slice
  // changes (which happens on every recipe mutation: addFermentable, updateHop,
  // etc. all replace `currentRecipe`).
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const savedSnapshot = useRecipeStore((s) => s.savedSnapshot);
  const dirty = useMemo(
    () => isRecipeDirty(currentRecipe, savedSnapshot),
    [currentRecipe, savedSnapshot],
  );
  useEffect(() => {
    if (!enabled) return;
    useUnsavedChangesStore.getState().setDirty(dirty);
  }, [enabled, dirty]);
  useEffect(() => {
    if (enabled) return;
    // When the guard is disabled (e.g., switching into read-only mode), clear
    // any stale dirty flag so the global store stays correct.
    useUnsavedChangesStore.getState().setDirty(false);
  }, [enabled]);

  // ─── beforeunload: refresh / close tab / external nav ───
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: BeforeUnloadEvent) => {
      // Read directly from the recipe store so we always see the latest dirty
      // state — bypasses any cache lag in the unsavedChangesStore.isDirty.
      const { currentRecipe: cur, savedSnapshot: snap } = useRecipeStore.getState();
      if (!isRecipeDirty(cur, snap)) return;
      // Modern browsers ignore the message string and show their own generic
      // dialog — both `preventDefault` and setting `returnValue` are required
      // for cross-browser support.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [enabled]);

  // ─── popstate: browser back/forward inside the SPA ───
  // Strategy: push a sentinel history entry on mount so the first back press
  // pops the sentinel (firing `popstate`) instead of leaving the editor. The
  // handler then re-pushes the sentinel and asks the guard to confirm. On
  // confirmed navigation, we set a "navigating away" ref so the listener
  // skips the re-push for that one event and `router.back()` proceeds.
  useEffect(() => {
    if (!enabled) return;

    const skipNextRef = { current: false };

    // Push the sentinel so back-button presses fire popstate.
    try {
      window.history.pushState({ [SENTINEL_KEY]: true }, '', window.location.href);
    } catch (err) {
      console.error('[UnsavedChangesGuard] Failed to push history sentinel:', err);
    }

    const handler = () => {
      if (skipNextRef.current) {
        // User confirmed leave — let the natural popstate pass through.
        skipNextRef.current = false;
        return;
      }
      // Read dirty directly from the recipe store so we never miss a prompt
      // due to a stale cached flag.
      const { currentRecipe: cur, savedSnapshot: snap } = useRecipeStore.getState();
      const dirtyNow = isRecipeDirty(cur, snap);
      if (!dirtyNow) {
        // Clean state — the user's back press should actually go back. The
        // popstate already moved us back one entry (out of the sentinel);
        // go back one more to reach the real previous page.
        skipNextRef.current = true;
        window.history.back();
        return;
      }
      // Dirty: re-push the sentinel so we stay put, then ask the guard.
      try {
        window.history.pushState({ [SENTINEL_KEY]: true }, '', window.location.href);
      } catch (err) {
        console.error('[UnsavedChangesGuard] Failed to re-push history sentinel:', err);
      }
      useUnsavedChangesStore.getState().guardNavigation(() => {
        // User picked Save or Discard. Tell the listener to let the next
        // popstate through, then go back to leave the page.
        skipNextRef.current = true;
        window.history.back();
      });
    };

    window.addEventListener('popstate', handler);
    return () => {
      window.removeEventListener('popstate', handler);
      // Try to remove the sentinel we pushed on mount, but only if it's still
      // the top of the stack (otherwise we'd accidentally pop a real entry).
      const top = window.history.state as Record<string, unknown> | null;
      if (top && top[SENTINEL_KEY]) {
        // Replace the sentinel entry rather than going back, so we don't
        // trigger another popstate during teardown.
        try {
          window.history.replaceState(null, '', window.location.href);
        } catch (err) {
          console.error('[UnsavedChangesGuard] Failed to clear history sentinel:', err);
        }
      }
    };
  }, [enabled]);

  // ─── Guarded router.push for editor controls ───
  const guardedPush = useCallback(
    (href: string) => {
      if (!enabled) {
        router.push(href);
        return;
      }
      useUnsavedChangesStore.getState().guardNavigation(() => router.push(href));
    },
    [enabled, router],
  );

  return { guardedPush };
}
