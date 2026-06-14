"use client";

import {
  AnimatePresence,
  LazyMotion,
  domMax,
  m,
  useReducedMotion,
} from "framer-motion";

import HelperCardMorph from "./HelperCardMorph";
import { dur, easeStandard, tweenStandard } from "../../motion";

// Fluid, non-bouncy curve for the column appear + box settle. A spring's
// overshoot read as "poppy" here; a clean easeOut glides into place.
const SMOOTH = { duration: dur.slow, ease: easeStandard } as const;

type TabKey =
  | "fermentables"
  | "hops"
  | "mash"
  | "water"
  | "yeast"
  | "fermentation"
  | "brewsheet";

interface Props {
  /** Render the side column? False during a section's full-width empty/intro
   *  state (and on the brew sheet) — the column springs out / in across this. */
  show: boolean;
  activeTab: TabKey;
}

/**
 * The builder side column (contextual helper card), wrapped so it morphs in /
 * out as a section moves between its full-width empty state and the 2-column
 * populated layout. Mirrors HSPreviewColumn's choreography with the shared
 * motion tokens:
 *
 *   - Enter: the column glides in (opacity + a small x) on a smooth easeOut,
 *     and the card content fades a beat later — a soft two-stage land, no pop.
 *   - Exit: a calm `tweenStandard` fade. `mode="popLayout"` lifts the leaving
 *     column out of grid flow (position: absolute) so the grid collapses to a
 *     single column and the main section FLIP-grows without waiting on it.
 *   - Reduced motion: drop the offset and the delay (opacity only / instant).
 */
export default function SideColumnMorph({ show, activeTab }: Props) {
  const reduced = useReducedMotion();
  return (
    <LazyMotion features={domMax} strict>
      <AnimatePresence mode="popLayout" initial={false}>
        {show ? (
          <m.div
            key="side"
            className="hs-builder-side"
            layout
            initial={{ opacity: 0, x: reduced ? 0 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, transition: tweenStandard }}
            transition={reduced ? { duration: 0 } : SMOOTH}
          >
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: dur.standard, ease: easeStandard, delay: 0.08 }
              }
            >
              <HelperCardMorph activeTab={activeTab} />
            </m.div>
          </m.div>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
