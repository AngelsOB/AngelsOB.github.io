"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { Recipe } from "@/modules/recipe/models/Recipe";

/** Describes ONE card click that's eligible to open the preview panel. The
 *  caller supplies how to load the full recipe (so this hook is agnostic to
 *  Firestore vs. local Zustand vs. seed-recipe lookups). */
export interface PreviewSelection {
  /** Stable id used to detect "same card clicked again → navigate". */
  id: string;
  /** Where to navigate when the card is clicked a second time or the mock's
   *  Open-recipe pill is pressed. */
  openHref: string;
  /** Resolver for the full Recipe used by the BuilderMock data mapper. */
  loadFull: () => Promise<Recipe | null>;
}

interface Options {
  /** False on narrow viewports — caller should compute via media query. When
   *  false, handleSelect short-circuits to a direct navigation (no panel). */
  canPreview: boolean;
  /** When true (e.g. compare-mode), preview also short-circuits to navigate. */
  disabled?: boolean;
}

export function usePreviewState({ canPreview, disabled }: Options) {
  const router = useRouter();
  const [selection, setSelection] = useState<PreviewSelection | null>(null);
  // `full` is intentionally NOT cleared when `selection` changes — that's the
  // morph: we keep showing the previous recipe in the panel until the new
  // recipe's full data lands, so the BuilderMock reconciles in place instead of
  // flashing to a skeleton between recipes.
  const [full, setFull] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const handleSelect = useCallback(
    async (sel: PreviewSelection) => {
      if (!canPreview || disabled) {
        router.push(sel.openHref);
        return;
      }
      if (selection?.id === sel.id) {
        router.push(sel.openHref);
        return;
      }
      setSelection(sel);
      setError(null);
      setLoading(true);
      const s = ++seq.current;
      try {
        const f = await sel.loadFull();
        if (s !== seq.current) return;
        if (!f) {
          setError("Recipe not found");
          return;
        }
        setFull(f);
      } catch (err) {
        if (s !== seq.current) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (s === seq.current) setLoading(false);
      }
    },
    [canPreview, disabled, selection?.id, router],
  );

  const handleClose = useCallback(() => {
    seq.current++;
    setSelection(null);
    setFull(null);
    setError(null);
    setLoading(false);
  }, []);

  // Auto-close when the viewport shrinks below the preview breakpoint. Caller
  // toggling `disabled` (e.g. compare-mode) does NOT close — we only prevent
  // NEW preview selections in that mode; the already-open panel can stay.
  useEffect(() => {
    if (!canPreview && selection) {
      handleClose();
    }
  }, [canPreview, selection, handleClose]);

  const handleRetry = useCallback(() => {
    if (!selection) return;
    setError(null);
    setLoading(true);
    const s = ++seq.current;
    selection
      .loadFull()
      .then((f) => {
        if (s !== seq.current) return;
        if (!f) {
          setError("Recipe not found");
          return;
        }
        setFull(f);
      })
      .catch((err) => {
        if (s !== seq.current) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (s === seq.current) setLoading(false);
      });
  }, [selection]);

  return {
    selection,
    full,
    loading,
    error,
    handleSelect,
    handleClose,
    handleRetry,
  } as const;
}
