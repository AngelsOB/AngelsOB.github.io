"use client";

import { AnimatePresence, LazyMotion, domMax, m } from "framer-motion";

import { FermentableHelperCard } from "./FermentableSection";
import { HopHelperCard } from "./HopSection";
import { MashHelperCard } from "./MashSection";
import { WaterHelperCard } from "./WaterSection";
import { YeastHelperCard } from "./YeastSection";
import { FermentationHelperCard } from "./FermentationSection";
import SharedBrewersNotesCard from "./SharedBrewersNotesCard";

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
  notes: string;
  tags: string[];
  onNotesChange: (v: string) => void;
  onTagsChange: (v: string[]) => void;
  readOnly?: boolean;
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
 * The "morph" between tab helper cards, plus the persistent Brewer's
 * notes card that lives in the same side column.
 *
 * Architecture:
 *   - `LazyMotion features={domMax}` unlocks the `layout` prop.
 *   - Nested `m.div layout` wrappers (outer side column, helper slot,
 *     notes slot) all tween their bounding boxes via FLIP, so the
 *     notes card slides up/down with the helper instead of snapping.
 *   - `AnimatePresence mode="popLayout"` is what makes it feel like a
 *     morph rather than a fade-in: the exiting card stays in the DOM
 *     (position: absolute) while the new card mounts, and both
 *     transition opacity + blur for the same `DUR`. The overlap is
 *     the morph.
 *   - Critical detail: ALL durations are `DUR`. Earlier versions had
 *     layout at 500ms and content at 220ms — the box kept resizing
 *     for 280ms after contents settled, which the eye read as two
 *     sequential steps. Lockstep timing eliminates that.
 *   - The notes card is rendered *once* (no key) so it never
 *     re-mounts — caret / scroll position survive tab switches.
 */
export default function HelperCardMorph({
  activeTab,
  notes,
  tags,
  onNotesChange,
  onTagsChange,
  readOnly,
}: Props) {
  if (activeTab === "brewsheet") return null;
  return (
    <LazyMotion features={domMax} strict>
      <m.div
        layout
        transition={{ layout: { duration: DUR, ease: EASE } }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 0,
        }}
      >
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

        <m.div layout transition={{ layout: { duration: DUR, ease: EASE } }}>
          <SharedBrewersNotesCard
            notes={notes}
            tags={tags}
            onNotesChange={onNotesChange}
            onTagsChange={onTagsChange}
            readOnly={readOnly}
          />
        </m.div>
      </m.div>
    </LazyMotion>
  );
}
