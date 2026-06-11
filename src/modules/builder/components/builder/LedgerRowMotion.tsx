"use client";

import type { ReactNode } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domMax,
  m,
  useReducedMotion,
} from "framer-motion";

import { springEnter, tweenStandard } from "../../motion";

interface RowsProps {
  children: ReactNode;
}

/**
 * Mounts the LazyMotion + AnimatePresence shell shared by all three
 * ingredient ledgers (Fermentable, Hop, Yeast). One mount point per
 * ledger.
 *
 *   - `initial={false}` so existing rows don't animate on first mount —
 *     only new additions get the slide-in.
 *   - No `mode="popLayout"` — in this framer-motion build popLayout did
 *     not actually absolute-position exiting rows (they stayed
 *     `position: static`), so the bill height could only update after
 *     the exit completed and the row unmounted, producing a "row
 *     vanishes → bill snaps" sequence. We collapse the row's height
 *     directly instead (see LedgerRowMotion below), and the surrounding
 *     bill reflows in sync via normal block-flow each frame.
 *   - `LazyMotion features={domMax} strict` matches HelperCardMorph and
 *     keeps the bundle slim by forcing the use of `m` instead of `motion`.
 */
export function LedgerRowsAnimated({ children }: RowsProps) {
  return (
    <LazyMotion features={domMax} strict>
      <AnimatePresence initial={false}>{children}</AnimatePresence>
    </LazyMotion>
  );
}

interface RowProps {
  children: ReactNode;
}

/**
 * Per-row motion wrapper. The caller passes a stable `key` so
 * AnimatePresence can track which row is being added/removed.
 *
 *   - Enter: slides down 8px and fades in via the shared `springEnter`
 *     token (see src/modules/builder/motion.ts) — fast initial reach,
 *     gentle settle with a touch of overshoot.
 *   - Exit: collapses height to 0 and fades to 0 on `tweenStandard`.
 *     Removing a row is destructive — a calm easeOut reads right;
 *     a spring on the way out feels too celebratory.
 *   - Reduced motion: drops the y-axis offset on entrance and the
 *     height collapse on exit (opacity-only). Movement is the part
 *     that triggers vestibular symptoms — a pure fade is safe.
 */
export function LedgerRowMotion({ children }: RowProps) {
  const reduced = useReducedMotion();
  const enterY = reduced ? 0 : -8;
  const exitHeight = reduced ? "auto" : 0;
  return (
    <m.div
      initial={{ opacity: 0, y: enterY }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: exitHeight, transition: tweenStandard }}
      transition={springEnter}
      style={{ overflow: "hidden" }}
    >
      {children}
    </m.div>
  );
}
