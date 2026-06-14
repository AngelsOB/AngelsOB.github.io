"use client";

import { AnimatePresence, LazyMotion, domMax, m } from "framer-motion";

import { FermentableHelperCard } from "./FermentableSection";
import { HopHelperCard } from "./HopSection";
import { MashHelperCard } from "./MashSection";
import { WaterHelperCard } from "./WaterSection";
import { YeastHelperCard } from "./YeastSection";
import { FermentationHelperCard } from "./FermentationSection";

type TabKey =
  | "fermentables"
  | "hops"
  | "mash"
  | "water"
  | "yeast"
  | "fermentation"
  | "brewsheet";

interface Props {
  activeTab: TabKey;
}

// Clean easeOut — fast accel into the morph, gentle decel into place.
// Matches the rest of the app's motion vocabulary.
const EASE = [0.22, 1, 0.36, 1] as const;
// One duration for everything (layout morph + content fade) so the
// motion reads as one beat. 125ms is right at the edge of "fast
// enough to feel instant but still readable as a transition."
const DUR = 0.125;

function renderHelper(tab: TabKey) {
  switch (tab) {
    case "fermentables":
      return <FermentableHelperCard />;
    case "hops":
      return <HopHelperCard />;
    case "mash":
      return <MashHelperCard />;
    case "water":
      return <WaterHelperCard />;
    case "yeast":
      return <YeastHelperCard />;
    case "fermentation":
      return <FermentationHelperCard />;
    default:
      return null;
  }
}

/**
 * The "morph" between tab helper cards in the builder side column.
 *
 * Architecture:
 *   - `LazyMotion features={domMax}` unlocks the `layout` prop.
 *   - The `m.div layout` wrapper tweens its bounding box via FLIP, so
 *     the column resizes smoothly as helper cards of different heights
 *     swap in.
 *   - `AnimatePresence mode="popLayout"` is what makes it feel like a
 *     morph rather than a fade-in: the exiting card stays in the DOM
 *     (position: absolute) while the new card mounts, and both
 *     transition opacity for the same `DUR`. The overlap is the morph.
 *   - Critical detail: ALL durations are `DUR`. Earlier versions had
 *     layout at 500ms and content at 220ms — the box kept resizing
 *     for 280ms after contents settled, which the eye read as two
 *     sequential steps. Lockstep timing eliminates that.
 */
export default function HelperCardMorph({ activeTab }: Props) {
  if (activeTab === "brewsheet") return null;
  return (
    <LazyMotion features={domMax} strict>
      <m.div
        layout
        transition={{ layout: { duration: DUR, ease: EASE } }}
        style={{ position: "relative", minWidth: 0 }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <m.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: DUR, ease: EASE }}
          >
            {renderHelper(activeTab)}
          </m.div>
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  );
}
