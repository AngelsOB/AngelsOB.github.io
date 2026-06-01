'use client';

/**
 * Shared click handler for `<Link>` components that need to route through the
 * unsaved-changes guard. Used by every top-level nav surface that can
 * navigate AWAY from the recipe editor:
 *
 *   - NavBar (classic /betabuilder UI)
 *   - HSHeader (HopSkip primary nav)
 *   - HSBrandMark (HopSkip logo)
 *   - HSFooter (HopSkip footer links)
 *
 * Behavior:
 *   - If the click is a modifier-click (cmd/ctrl/shift/alt) or middle/right
 *     click, pass through natively — the user wants "open in new tab" etc.
 *   - If an editor is registered with the guard, always preventDefault and
 *     delegate to `guardNavigation`. `guardNavigation` does a fresh dirty
 *     check against the recipe store and either navigates immediately (clean)
 *     or opens the confirmation modal (dirty).
 *   - If no editor is registered, the click passes through and Next.js's
 *     <Link> handles navigation natively.
 */

import { useRouter } from 'next/navigation';
import { useUnsavedChangesStore } from '../stores/unsavedChangesStore';

export function useGuardedLinkClick(href: string, extraOnClick?: () => void) {
  const router = useRouter();
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Modifier-clicks and middle/right clicks pass through — let the browser
    // handle "open in new tab" / "save link" natively.
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      extraOnClick?.();
      return;
    }
    const { isActive, guardNavigation } = useUnsavedChangesStore.getState();
    if (isActive) {
      // An editor is mounted — always preventDefault and let the guard
      // re-check dirty state against the source of truth (the recipe store).
      e.preventDefault();
      guardNavigation(() => router.push(href));
    }
    extraOnClick?.();
  };
}
