"use client";

import type { ReactNode } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domMax,
  m,
  useReducedMotion,
} from "framer-motion";

import { dur, easeStandard } from "../../motion";

// easeInOutCirc — slow start, fast middle, slow finish. Gives the directional
// tab slide a bit more "weight" on the main column.
const EASE = [0.85, 0, 0.15, 1] as const;

// The section's width morph (empty ↔ 2-column). A smooth easeOut, not a spring:
// the spring's overshoot read as "poppy"; this glides the column to its new
// width without a bounce.
const SMOOTH = { duration: dur.slow, ease: easeStandard } as const;

interface Props {
  activeTab: string;
  direction: "left" | "right";
  isShared: boolean;
  children: ReactNode;
}

/**
 * The main builder column. Two motions, deliberately split so they don't
 * fight over the element's transform:
 *
 *   - Outer `m.div layout` (NOT keyed): FLIP-animates the column's box when
 *     the grid flips between full-width (a section's empty/intro state) and
 *     the 1.6fr 2-column track. Glides on a smooth easeOut (no spring bounce);
 *     `transformOrigin: left top` so it grows/shrinks toward the grid's left
 *     anchor rather than the centre.
 *   - Inner keyed `m.div` (`layout="position"`): the directional tab slide, a
 *     cross-fade that coordinates with the sidebar morph via `popLayout` (the
 *     outgoing section is position:absolute'd so the incoming one claims its
 *     space immediately). Only its position participates in layout, so the
 *     outer width FLIP isn't distorted into a scale on the content.
 *
 * Reduced motion: the width FLIP collapses to an instant cut.
 */
export default function MainSectionMorph({
  activeTab,
  direction,
  isShared,
  children,
}: Props) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domMax} strict>
      <m.div
        layout
        transition={{ layout: reduced ? { duration: 0 } : SMOOTH }}
        style={{ minWidth: 0, transformOrigin: "left top" }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div
            key={activeTab}
            layout="position"
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
          </m.div>
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  );
}
