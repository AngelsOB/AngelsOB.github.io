"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

// easeInOutCirc — slow start, fast middle, slow finish. Gives the
// slide a bit more "weight" on the main column where there's more
// content to move. HelperCardMorph stays on a standard easeOut so the
// sidebar doesn't pick up the same heft.
const EASE = [0.85, 0, 0.15, 1] as const;

interface Props {
  activeTab: string;
  direction: "left" | "right";
  isShared: boolean;
  children: ReactNode;
}

/**
 * Animates the main column when the active tab changes — a directional
 * cross-fade slide that coordinates with HelperCardMorph in the sidebar.
 *
 * Mechanics:
 *   - `AnimatePresence mode="popLayout"` lets the outgoing section be
 *     position:absolute'd so the new section can claim its space
 *     immediately. This keeps the sidebar's framer-motion `layout`
 *     animation running in parallel without the main column blocking
 *     the layout re-measure.
 *   - Direction comes from HopSkipBuilder's `tabDirection` state — a
 *     forward (right) move slides the new section in from the right,
 *     a backward (left) move slides it in from the left.
 *   - The motion.div carries `.hs-section-frame brew-theme` so existing
 *     theming continues to apply.
 *
 * Deliberately NO outer `layout` FLIP wrapper: the empty↔2-column
 * collapse is an instant CSS grid switch (`.section-empty`), not an
 * animated grow. A `layout` wrapper here would FLIP-scale the whole
 * section frame on every tab change (the tabs differ in height), which
 * reads as a squish/flicker. Keep tab switches to the clean cross-fade.
 */
export default function MainSectionMorph({
  activeTab,
  direction,
  isShared,
  children,
}: Props) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={activeTab}
        className={`hs-section-frame brew-theme${
          isShared ? " brew-read-only" : ""
        }`}
        initial={{ opacity: 0, x: direction === "right" ? 14 : -14 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: direction === "right" ? -14 : 14 }}
        transition={{ duration: 0.125, ease: EASE }}
        style={{ position: "relative", minWidth: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
