"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";

import { hsTokens } from "../../tokens";
import {
  springEnter,
  springSoft,
  springTilt,
  springTrack,
  tweenStandard,
} from "../../motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import FermentablePresetModal from "../modals/FermentablePresetModal";
import CustomFermentableModal from "../modals/CustomFermentableModal";

// All bill-stack property animations (segment widths shifting as
// percentages change, new segment growing on add, hover-expand, color
// swatch interpolation, padding collapse) use the shared `springSoft`
// token — same family as the ledger rows, lower energy. Exits use
// `tweenStandard` for a calm fade-out.
//
// Minimum share a hovered segment will claim, so even a 2% sliver can
// surface its %+name label. Siblings scale proportionally to fill the
// remaining width. Tuned to comfortably fit "30% / Cara Munich" at the
// display font size in the typical sidebar width.
const HOVER_REVEAL_PCT = 30;

import { uid } from "@/utils/uid";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { usePresetStore } from "@/modules/beta-builder/presentation/stores/presetStore";
import { toast } from "@/stores/toastStore";
import { fermentableCalculationService } from "@/modules/beta-builder/domain/services/FermentableCalculationService";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import type { Fermentable } from "@/modules/beta-builder/domain/models/Recipe";
import type { FermentablePreset } from "@/modules/beta-builder/domain/models/Presets";
import { getFermentability } from "@/modules/beta-builder/data/fermentablePresets";
import { getCountryFlag, BREWING_ORIGINS } from "@/utils/flags";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

type Mode = "amount" | "percent";

type GrainCategory = "Base malt" | "Crystal" | "Specialty" | "Roasted" | "Adjunct" | "Sugar";

const CAT_COLOR: Record<GrainCategory, string> = {
  "Base malt": hsTokens.malt,
  Crystal: hsTokens.roast,
  Specialty: hsTokens.yeast,
  Roasted: hsTokens.ink,
  Adjunct: hsTokens.honey,
  Sugar: hsTokens.hops,
};

/** Heuristic: derive a category label from the Fermentable's Lovibond + name. */
function categorize(f: Fermentable): GrainCategory {
  const name = f.name.toLowerCase();
  if (
    name.includes("sugar") ||
    name.includes("honey") ||
    name.includes("dextrose") ||
    name.includes("syrup")
  ) {
    return "Sugar";
  }
  if (
    name.includes("flak") ||
    name.includes("torrified") ||
    name.includes("oat") ||
    name.includes("rice") ||
    name.includes("corn") ||
    name.includes("adjunct")
  ) {
    return "Adjunct";
  }
  const L = f.colorLovibond;
  if (L < 10) return "Base malt";
  if (L < 50) return "Crystal";
  if (L < 200) return "Specialty";
  return "Roasted";
}

export default function FermentableSection() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const addFermentable = useRecipeStore((s) => s.addFermentable);
  const updateFermentable = useRecipeStore((s) => s.updateFermentable);
  const removeFermentable = useRecipeStore((s) => s.removeFermentable);
  const reorderFermentables = useRecipeStore((s) => s.reorderFermentables);

  const fermentablePresetsGrouped = usePresetStore((s) => s.fermentablePresetsGrouped);
  const loadFermentablePresets = usePresetStore((s) => s.loadFermentablePresets);
  const saveFermentablePreset = usePresetStore((s) => s.saveFermentablePreset);
  const presetsLoading = usePresetStore((s) => s.isLoading);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("amount");
  const [targetABV, setTargetABV] = useState(5.0);
  const [percentById, setPercentById] = useState<Record<string, number>>({});

  const handleModeChange = useCallback((m: Mode) => {
    setMode(m);
  }, []);

  // Back-calculate grain weights from percents + target ABV.
  // Called only from explicit user input — never from an effect — so it
  // cannot silently mutate weights on mode toggle.
  const recalcWeightsFromPercents = useCallback(
    (percents: Record<string, number>, abv: number) => {
      if (!currentRecipe) return;
      const updated = fermentableCalculationService.calculateWeightsFromPercentsAndABV(
        currentRecipe.fermentables,
        percents,
        abv,
        currentRecipe.batchVolumeL,
        currentRecipe.equipment.mashEfficiencyPercent || 75,
        recipeCalculationService.getEffectiveAttenuation(currentRecipe)
      );
      updated.forEach((f) => {
        const cur = currentRecipe.fermentables.find((cf) => cf.id === f.id);
        if (cur && Math.abs(f.weightKg - cur.weightKg) > 0.001) {
          updateFermentable(f.id, { weightKg: f.weightKg });
        }
      });
    },
    [currentRecipe, updateFermentable]
  );

  const handleTargetABVChange = useCallback((v: number) => {
    setTargetABV(v);
    recalcWeightsFromPercents(percentById, v);
  }, [percentById, recalcWeightsFromPercents]);

  useEffect(() => {
    loadFermentablePresets();
  }, [loadFermentablePresets]);

  const handleSelectPreset = (preset: FermentablePreset) => {
    if (editingId) {
      updateFermentable(editingId, {
        name: preset.name,
        colorLovibond: preset.colorLovibond,
        ppg: preset.potentialGu,
        efficiencyPercent:
          preset.type === "extract" || preset.type === "sugar" ? 100 : 75,
        originCode: preset.originCode,
        fermentability: getFermentability(preset),
      });
    } else {
      const next: Fermentable = {
        id: uid(),
        name: preset.name,
        weightKg: 1.0,
        colorLovibond: preset.colorLovibond,
        ppg: preset.potentialGu,
        efficiencyPercent:
          preset.type === "extract" || preset.type === "sugar" ? 100 : 75,
        originCode: preset.originCode,
        fermentability: getFermentability(preset),
      };
      addFermentable(next);
    }
    setEditingId(null);
    setIsPickerOpen(false);
  };

  const handleSwapFermentable = (id: string) => {
    setEditingId(id);
    setIsPickerOpen(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setIsPickerOpen(true);
  };

  const handleSaveCustomPreset = (preset: FermentablePreset) => {
    saveFermentablePreset(preset);
    toast.success(`"${preset.name}" saved — select it from the list to add`);
  };

  const totalGrainKg =
    currentRecipe?.fermentables.reduce((sum, f) => sum + f.weightKg, 0) ?? 0;

  useEffect(() => {
    if (mode !== "percent" || !currentRecipe) return;
    const percents = fermentableCalculationService.calculatePercentsFromWeights(
      currentRecipe.fermentables
    );
    setPercentById((prev) => ({ ...percents, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentRecipe?.fermentables]);

  // Seed targetABV from the recipe's actual ABV when entering % mode.
  // Depends only on [mode] — not [currentRecipe] — so it never re-fires
  // while the user is working in % mode. Sets only local state; never
  // touches stored grain weights.
  useEffect(() => {
    if (mode !== "percent" || !currentRecipe) return;
    const og = recipeCalculationService.calculateOG(currentRecipe);
    const fg = recipeCalculationService.calculateFG(currentRecipe);
    setTargetABV(parseFloat(recipeCalculationService.calculateABV(og, fg).toFixed(1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const totalPercent = useMemo(() => {
    if (mode !== "percent" || !currentRecipe) return 0;
    return fermentableCalculationService.calculateTotalPercent(
      currentRecipe.fermentables,
      percentById
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentRecipe?.fermentables, percentById]);

  const fermentables = useMemo(
    () => currentRecipe?.fermentables ?? [],
    [currentRecipe?.fermentables]
  );

  // Rows enriched with derived display data — used by both BillStack + Ledger.
  const rows = useMemo<RowData[]>(() => {
    return fermentables.map((f) => {
      const pct = totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
      return {
        f,
        pct,
        srmColor: srmToRgb(f.colorLovibond),
        category: categorize(f),
      };
    });
  }, [fermentables, totalGrainKg]);

  return (
    <section className="hs-ferm-section" style={sectionFrameStyle}>
      <FermentableSectionStyles />

      {fermentables.length === 0 ? (
        <>
          <SectionTitle />
          <EmptyState onAdd={handleAddNew} />
        </>
      ) : (
        <>
          <FermControls
            entryCount={fermentables.length}
            totalGrainKg={totalGrainKg}
            mode={mode}
            onModeChange={handleModeChange}
            targetABV={targetABV}
            onTargetABVChange={handleTargetABVChange}
            totalPercent={totalPercent}
            onAdd={handleAddNew}
          />

          <GrainList
            rows={rows}
            mode={mode}
            percentById={percentById}
            totalGrainKg={totalGrainKg}
            totalPercent={totalPercent}
            onWeightChange={(id, v) =>
              updateFermentable(id, { weightKg: Math.max(0, v) })
            }
            onPercentChange={(id, v) => {
              const next = {
                ...percentById,
                [id]: Math.max(0, Math.min(100, v)),
              };
              setPercentById(next);
              recalcWeightsFromPercents(next, targetABV);
            }}
            onSwap={handleSwapFermentable}
            onRemove={removeFermentable}
            onReorder={reorderFermentables}
            onAdd={handleAddNew}
          />
        </>
      )}

      <FermentablePresetModal
        isOpen={isPickerOpen}
        editing={Boolean(editingId)}
        onClose={() => {
          setIsPickerOpen(false);
          setEditingId(null);
        }}
        onSelect={handleSelectPreset}
        onCreateCustom={() => setIsCustomOpen(true)}
        presetsGrouped={fermentablePresetsGrouped}
        isLoading={presetsLoading}
      />

      <CustomFermentableModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
        onSave={handleSaveCustomPreset}
      />
    </section>
  );
}

// ─── Row data shape ──────────────────────────────────────────────

interface RowData {
  f: Fermentable;
  pct: number;
  srmColor: string;
  category: GrainCategory;
}

// ─── Outer frame ──────────────────────────────────────────────────

const sectionFrameStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 22,
  padding: 24,
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: "0 0 14px 14px",
  boxShadow: hsTokens.sh3,
  position: "relative",
};

// ─── Section title (kicker + h2 + malt rule, no controls) ────────

function SectionTitle() {
  return (
    <header
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${hsTokens.malt}`,
      }}
    >
      <h2
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(32px, 4.6vw, 44px)",
          letterSpacing: "-0.035em",
          lineHeight: 0.95,
          color: hsTokens.ink,
          margin: "4px 0 0",
        }}
      >
        Fermentables.
      </h2>
    </header>
  );
}

// ─── Bill stack — colored % visualization of the whole grain bill ─

/** Pick a short label for a segment overlay — strips brand prefixes like
 *  "1886 Malt House - " or "Muntons - " so the malt name is what shows. */
function shortName(full: string): string {
  if (full.includes(" - ")) {
    const after = full.split(" - ").slice(-1)[0].trim();
    return after.split(" ").slice(0, 2).join(" ");
  }
  return full.split(" ").slice(0, 2).join(" ");
}

function BillStack({
  rows,
  totalGrainKg,
}: {
  rows: RowData[];
  totalGrainKg: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  // X position (within the bar's local coords, in px) the tooltip
  // anchors to. Updated on mousemove; framer-motion springs the
  // tooltip toward this value so it tracks the cursor with a little
  // life of its own.
  const [cursorX, setCursorX] = useState<number>(0);
  // Tooltip rotation in degrees. Derived from cursor velocity — moving
  // right tilts the card left (it "swings" trailing the motion), and
  // vice versa. Settles back to 0 once the cursor rests. Range clamped
  // to ±18° so the tilt is playful, not chaotic.
  const [tilt, setTilt] = useState<number>(0);
  // Hover-intent gate. The tooltip only appears after the cursor has
  // hovered without moving for SHOW_DELAY_MS — prevents the card from
  // flashing in/out during a quick sweep across the bar. Once visible,
  // it sticks (no dismissal while inside the bar). On leave, a short
  // HIDE_COOLDOWN_MS keeps it visible so brief excursions don't
  // dismiss it.
  const [tooltipVisible, setTooltipVisible] = useState<boolean>(false);
  const barRef = useRef<HTMLDivElement | null>(null);
  // Last clientX we saw, used to compute dx on the next mousemove.
  // Refs (not state) so updates don't trigger re-renders on every move.
  const lastClientXRef = useRef<number | null>(null);
  // Timer that resets tilt to 0 after the cursor stops moving. Without
  // this the card would freeze at its last tilted angle when the user
  // rests on a segment.
  const tiltRestTimerRef = useRef<number | null>(null);
  // Hover-intent timers. `showTimer` fires after the cursor has been
  // still for the dwell period and reveals the tooltip. `hideTimer`
  // fires after the cursor has been outside the bar long enough that
  // we believe the user is genuinely done.
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  // Reduced-motion: drop the width interpolation (segments snap to their
  // new widths) and keep only the opacity transition for entry/exit.
  const reduced = useReducedMotion();

  // Reveal the tooltip only after the cursor has dwelled this long
  // without moving. 300ms is the classic "hover intent" sweet spot —
  // long enough to filter sweeps, short enough to feel responsive.
  const SHOW_DELAY_MS = 300;
  // After the cursor leaves the bar, wait this long before tearing the
  // tooltip down. Re-entry within the cooldown cancels the dismiss so
  // brief overshoots don't flicker the card.
  const HIDE_COOLDOWN_MS = 350;

  const hovered = hoveredIdx !== null ? rows[hoveredIdx] : null;

  // Effective widths each segment renders at. When a segment is hovered,
  // it claims at least HOVER_REVEAL_PCT of the bar so its %+name label
  // can surface; the other segments are scaled proportionally to fill
  // the remaining width. Without a hover, segments render at their true
  // r.pct. Memoized so framer-motion doesn't re-trigger on every paint.
  const displayPcts = useMemo<number[]>(() => {
    const originalPcts = rows.map((r) => r.pct);
    if (hoveredIdx === null || reduced) return originalPcts;
    const hoveredRow = rows[hoveredIdx];
    if (!hoveredRow || hoveredRow.pct >= HOVER_REVEAL_PCT) return originalPcts;
    const reveal = HOVER_REVEAL_PCT;
    const othersTotal = originalPcts.reduce(
      (sum, pct, i) => (i === hoveredIdx ? sum : sum + pct),
      0
    );
    // Defensive: if hovered grain is the only one with weight, others
    // are already 0 — give the hovered the whole bar.
    if (othersTotal <= 0) {
      return originalPcts.map((_, i) => (i === hoveredIdx ? 100 : 0));
    }
    const scale = (100 - reveal) / othersTotal;
    return originalPcts.map((pct, i) =>
      i === hoveredIdx ? reveal : pct * scale
    );
  }, [rows, hoveredIdx, reduced]);

  // Cancel any pending timers when this BillStack unmounts (e.g. user
  // navigates away mid-hover). Without this the dangling setTimeout
  // would fire on a stale closure.
  useEffect(() => {
    return () => {
      if (tiltRestTimerRef.current !== null) {
        window.clearTimeout(tiltRestTimerRef.current);
      }
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Hover-intent: arm or re-arm the show timer. Called on bar enter and
  // on each mousemove while the tooltip is still hidden. Each fresh
  // call clears the previous timer, so the tooltip only appears once
  // the cursor has been still for SHOW_DELAY_MS continuously.
  function armShowTimer() {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
    }
    showTimerRef.current = window.setTimeout(() => {
      setTooltipVisible(true);
      showTimerRef.current = null;
    }, SHOW_DELAY_MS);
  }

  // Mouseenter on the bar: re-entry during the hide cooldown means the
  // user came back — cancel the dismissal. If the tooltip isn't visible
  // yet, start the show-intent timer so the dwell test can run even
  // without a subsequent mousemove (e.g. user places the cursor and
  // holds still).
  function onBarMouseEnter() {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!tooltipVisible) armShowTimer();
  }

  // Cursor X within the bar's own coordinate space (0 = left edge of
  // bar). The framer-motion `x` animation springs toward this value, so
  // moving the cursor causes the tooltip to glide horizontally rather
  // than snap. We also derive a velocity-driven tilt from dx so the
  // card "swings" while the cursor is in motion — same trick the old
  // cursor-following tooltip used; brought back because it's fun.
  function onBarMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    setCursorX(e.clientX - rect.left);

    const last = lastClientXRef.current;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    // Negative sign so the card tilts AWAY from the direction of
    // motion (moving right → tilts left, dragging behind the cursor).
    // 0.35 multiplier and ±10° clamp keep the swing gentle — the
    // motion reads as a slight, playful sway rather than a swing.
    const rotation = Math.max(-10, Math.min(10, -dx * 0.35));
    setTilt(rotation);

    if (tiltRestTimerRef.current !== null) {
      window.clearTimeout(tiltRestTimerRef.current);
    }
    // After 120ms of no movement the card settles upright. Matches the
    // old code's rest timing.
    tiltRestTimerRef.current = window.setTimeout(() => setTilt(0), 120);

    // Hover-intent: if the tooltip is not yet visible, every mousemove
    // resets the dwell timer — the cursor has to stop for SHOW_DELAY_MS
    // before the card appears. Once visible, mousemove no longer
    // affects visibility (the tooltip is "sticky" and just slides with
    // the cursor).
    if (!tooltipVisible) armShowTimer();
  }

  function onBarMouseLeave() {
    // Cancel a pending show — the user left before the dwell completed.
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    // Tilt resets immediately so the card doesn't freeze tilted while
    // it fades out during the cooldown.
    setTilt(0);
    lastClientXRef.current = null;
    if (tiltRestTimerRef.current !== null) {
      window.clearTimeout(tiltRestTimerRef.current);
      tiltRestTimerRef.current = null;
    }
    // Schedule the dismissal. If the user returns to the bar within
    // HIDE_COOLDOWN_MS, `onBarMouseEnter` cancels this timer and the
    // tooltip stays put.
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setTooltipVisible(false);
      setHoveredIdx(null);
      hideTimerRef.current = null;
    }, HIDE_COOLDOWN_MS);
  }

  return (
    <div
      className="hs-ferm-bill-stack"
      style={{
        // Subtle ingredient tint: ~5% malt in the bg AND ~15% mixed into the
        // ink border. Compound signal — neither dimension loud on its own.
        background:
          "color-mix(in srgb, color-mix(in srgb, var(--hs-cream), var(--hs-cream-2)) 95%, var(--hs-malt))",
        border: `2px solid color-mix(in srgb, ${hsTokens.ink} 85%, var(--hs-malt))`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Eyebrow size={11}>The bill</Eyebrow>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 14,
            color: hsTokens.ink,
          }}
        >
          {totalGrainKg.toFixed(2)} kg{" "}
          <span style={{ color: hsTokens.muted, fontWeight: 400 }}>
            · {rows.length} grain{rows.length === 1 ? "" : "s"}
          </span>
        </span>
      </div>
      {/* position:relative so the absolutely-positioned tooltip (below)
          anchors above the bar rather than the document. */}
      <div style={{ position: "relative" }}>
      {/* Bill bar is a presentational chart; hover events drive the
          tooltip that sits above it. Segment buttons aren't appropriate
          (they aren't activatable beyond hovering — clicking does nothing). */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={barRef}
        className="hs-ferm-bill-bar"
        onMouseEnter={onBarMouseEnter}
        onMouseMove={onBarMouseMove}
        onMouseLeave={onBarMouseLeave}
        style={{
          display: "flex",
          height: 64,
          borderRadius: 6,
          border: `2px solid ${hsTokens.ink}`,
          overflow: "hidden",
          boxShadow: hsTokens.sh1,
          background: hsTokens.cream2,
        }}
      >
        <AnimatePresence initial={false}>
          {rows.map((r, i) => {
            const isHovered = i === hoveredIdx;
            const dark = r.f.colorLovibond > 25;
            // Hovering a small slice should also surface the label the
            // way the dominant slice surfaces it — the segment expands
            // (see displayPcts above) and we lift the label render gate
            // to match. The text still shows the *true* r.pct so users
            // see the actual share, not the expanded visual share.
            const showLabel = isHovered || r.pct >= 25;
            const showName = isHovered || r.pct >= 30;
            const bigFont = isHovered || r.pct >= 30;
            const targetWidth = `${displayPcts[i]}%`;
            // Divider rule: ink 1.5px by default; switch to a thin (1px)
            // light cream stroke ONLY when this slice AND the next are both
            // dark — ink-on-dark blends a chocolate / black-malt stack into
            // one indistinct blob. Light-and-light or mixed pairs keep ink.
            const nextRow = rows[i + 1];
            const bothDark = dark && Boolean(nextRow && nextRow.f.colorLovibond > 25);
            const dividerStroke = bothDark
              ? `1px solid color-mix(in oklch, ${hsTokens.paper} 88%, ${hsTokens.ink})`
              : `1.5px solid ${hsTokens.ink}`;
            // Framer-motion interpolates "rgb(r,g,b)" values natively, so
            // swapping a grain (e.g. Pale → Crystal) tweens its segment
            // color over the same duration as the width shift. Width
            // animation: percentage strings interpolate numerically.
            return (
              // Presentational segment — hover updates the cursor-follow tooltip;
              // no click behaviour, so no role is appropriate here.
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions
              <m.div
                key={r.f.id}
                onMouseEnter={() => setHoveredIdx(i)}
                initial={{
                  width: reduced ? targetWidth : 0,
                  opacity: 0,
                  backgroundColor: r.srmColor,
                  paddingLeft: reduced ? 4 : 0,
                  paddingRight: reduced ? 4 : 0,
                }}
                animate={{
                  width: targetWidth,
                  opacity: 1,
                  backgroundColor: r.srmColor,
                  paddingLeft: 4,
                  paddingRight: 4,
                }}
                exit={{
                  width: reduced ? targetWidth : 0,
                  opacity: 0,
                  paddingLeft: reduced ? 4 : 0,
                  paddingRight: reduced ? 4 : 0,
                  // Calm tween for exit — matches the ledger-row exit
                  // pattern (entrance springs, exit eases). Also avoids
                  // any spring overshoot below 0 on the way to width: 0.
                  transition: tweenStandard,
                }}
                // `springSoft` — gentler than the ledger-row entrance.
                // Bar segments are delicate (small width/color shifts,
                // hover-expand on tiny slices), so the snappy
                // `springEnter` reads as aggressive here. Same family
                // of motion, lower energy.
                transition={springSoft}
                style={{
                  borderRight: i < rows.length - 1 ? dividerStroke : "none",
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingTop: 4,
                  paddingBottom: 4,
                  // border-box so width: 0 collapses fully. The inner
                  // padding-left/right are animated separately so the
                  // exiting segment can shed its horizontal padding
                  // alongside its width — otherwise the 4px L/R padding
                  // plus 2px border floor the exit at ~10px and the
                  // sibling segments visibly snap when it finally
                  // unmounts.
                  boxSizing: "border-box",
                  // Flex items default to min-width: auto, which prevents
                  // shrinking below content size. min-width:0 lets the
                  // exit reach a true zero.
                  minWidth: 0,
                  overflow: "hidden",
                  cursor: "default",
                }}
              >
                {showLabel ? (
                  <div
                    style={{
                      textAlign: "center",
                      color: dark ? "#fff" : hsTokens.ink,
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: hsTokens.display,
                        fontSize: bigFont ? 24 : 16,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                      }}
                    >
                      {Math.round(r.pct)}%
                    </div>
                    {showName ? (
                      <div
                        style={{
                          fontFamily: hsTokens.body,
                          fontWeight: 700,
                          fontSize: 9,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          marginTop: 3,
                          opacity: 0.92,
                        }}
                      >
                        {shortName(r.f.name)}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
      {/* Anchored tooltip — sits above the bar, bounces in on first
          hover, slides horizontally with the cursor via a tight spring,
          and drops a small vertical connector line down to the bar so
          the user can see which segment it's pointing at. */}
      <AnimatePresence>
        {tooltipVisible && hovered ? (
          <m.div
            key="bill-tooltip"
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              pointerEvents: "none",
              zIndex: 10,
              // Small lift above the bar so the connector line has room
              // to land cleanly on the bar's top edge.
              paddingBottom: 0,
            }}
            // Initial x set to the current cursor position so the
            // tooltip pops in AT the cursor instead of sliding in from
            // x=0 (framer-motion's implicit default for transforms).
            initial={{ x: cursorX }}
            animate={{ x: cursorX }}
            // Shared `springTrack` token — same spring used anywhere
            // we follow a continuously-updating value with the cursor.
            transition={{ x: springTrack }}
          >
            {/* Center the card+line stack on the anchor X. CSS transform
                here is independent of framer-motion's transforms on the
                nested motion divs, so they compose cleanly. */}
            <div
              style={{
                transform: "translateX(-50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <m.div
                // Symmetric in/out — the same shape that the card exits
                // with is the shape it enters from. Less pop than the
                // previous { scale: 0.7, y: 10 } initial, but the
                // user-facing motion now reads as one consistent
                // gesture played forward or in reverse.
                initial={{ opacity: 0, scale: 0.85, y: 6, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, y: 0, rotate: tilt }}
                exit={{ opacity: 0, scale: 0.85, y: 6, rotate: 0 }}
                transition={{
                  // House spring — same one new ingredient rows use, so
                  // the tooltip pop and a grain row arriving below feel
                  // like the same family of motion.
                  ...springEnter,
                  // Tilt rotation gets the `springTilt` token — tighter,
                  // less bouncy than the entrance spring. Responds
                  // quickly to cursor velocity without compounding into
                  // chaotic rocking when the cursor moves fast.
                  rotate: springTilt,
                }}
                style={{
                  background: hsTokens.paper,
                  border: `2px solid ${hsTokens.ink}`,
                  borderRadius: 10,
                  boxShadow: hsTokens.sh2,
                  padding: "10px 14px",
                  minWidth: 220,
                  maxWidth: 320,
                  // Grow upward from the bottom so the pop-in keeps the
                  // line-meeting-point fixed while the card expands.
                  // Rotation also pivots around this point — the card
                  // swings like a tag hanging from the connector line.
                  transformOrigin: "bottom center",
                }}
              >
                <div
                  style={{
                    fontFamily: hsTokens.body,
                    fontWeight: 700,
                    fontSize: 14,
                    color: hsTokens.ink,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {hovered.f.name}
                  {hovered.f.originCode ? (
                    <span style={{ marginLeft: 6 }}>
                      {getCountryFlag(hovered.f.originCode)}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: hsTokens.body,
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {hovered.pct.toFixed(1)}% of grain bill ·{" "}
                  {hovered.f.weightKg.toFixed(2)} kg
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: hsTokens.mono,
                    fontSize: 11,
                    color: hsTokens.muted,
                    letterSpacing: "0.02em",
                  }}
                >
                  {hovered.f.colorLovibond}°L · {hovered.f.ppg} PPG ·{" "}
                  {(hovered.f.colorLovibond * 1.97).toFixed(1)} EBC
                </div>
              </m.div>
              {/* Connector — drops from the card's bottom-center to the
                  bar's top edge. transformOrigin top so it "draws on"
                  downward as scaleY animates 0 → 1. Slight delay so it
                  appears after the card has settled into place. */}
              <m.div
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                exit={{ scaleY: 0, opacity: 0 }}
                transition={{
                  // Same `springTilt` token; tiny delay so the line
                  // appears just after the card has arrived.
                  scaleY: { ...springTilt, delay: 0.06 },
                  opacity: { duration: 0.12, delay: 0.06 },
                }}
                style={{
                  width: 2,
                  height: 12,
                  background: hsTokens.ink,
                  transformOrigin: "top",
                }}
              />
            </div>
          </m.div>
        ) : null}
      </AnimatePresence>
      </div>
      {/* Mono weight legend — each weight sits at the start of its slice. */}
      <div style={{ display: "flex", marginTop: 8 }}>
        <AnimatePresence initial={false}>
          {rows.map((r) => {
            const targetWidth = `${r.pct}%`;
            return (
              <m.div
                key={r.f.id}
                initial={{ width: reduced ? targetWidth : 0, opacity: 0 }}
                animate={{ width: targetWidth, opacity: 1 }}
                exit={{
                  width: reduced ? targetWidth : 0,
                  opacity: 0,
                  transition: tweenStandard,
                }}
                // `springSoft` to match the bar segments above —
                // weight legend widths move in lockstep with their
                // slice, so they should share the same spring.
                transition={springSoft}
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 10,
                  color: hsTokens.muted,
                  paddingLeft: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.f.weightKg.toFixed(2)}kg
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>

    </div>
  );
}

// ─── Section controls — bill meta + drag hint + mode/ABV/add ─────
//
// Rendered as a <div>, NOT a <header>: the builder hoists each section's
// title into the shared BuilderTitleBar (spanning both grid columns) and
// hides the section's own first <header> via overrides.css. The
// "Fermentables." title + malt rule therefore come from BuilderTitleBar;
// this row only carries the meta + controls (the old LedgerHeaderRow's job).

function FermControls({
  entryCount,
  totalGrainKg,
  mode,
  onModeChange,
  targetABV,
  onTargetABVChange,
  totalPercent,
  onAdd,
}: {
  entryCount: number;
  totalGrainKg: number;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  targetABV: number;
  onTargetABVChange: (v: number) => void;
  totalPercent: number;
  onAdd: () => void;
}) {
  return (
    <div
      className="hs-ferm-controls"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          fontWeight: 800,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          whiteSpace: "nowrap",
        }}
      >
        {entryCount} in the bill · {totalGrainKg.toFixed(2)} kg
      </span>
      <HSScriptNote color={hsTokens.muted} size={15} rotate={-3}>
        drag to reorder
      </HSScriptNote>
      <span
        aria-hidden
        style={{
          flex: 1,
          minWidth: 12,
          height: 1,
          background: hsTokens.ink,
          opacity: 0.22,
        }}
      />
      {mode === "percent" ? (
        <TargetABVPill
          value={targetABV}
          onChange={onTargetABVChange}
          totalPercent={totalPercent}
        />
      ) : null}
      <ModeToggle mode={mode} onChange={onModeChange} />
      <HSButton onClick={onAdd} color={hsTokens.malt} size="sm">
        + Add fermentable
      </HSButton>
    </div>
  );
}

// ─── Mode toggle (segmented) ─────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const cellStyle = (active: boolean): CSSProperties => ({
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "6px 14px",
    border: "none",
    background: active ? hsTokens.malt : "transparent",
    color: hsTokens.ink,
    cursor: "pointer",
    transition: "background 120ms ease",
  });
  return (
    <div
      role="tablist"
      aria-label="Editing mode"
      style={{
        display: "inline-flex",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        overflow: "hidden",
        boxShadow: hsTokens.sh1,
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "amount"}
        style={cellStyle(mode === "amount")}
        onClick={() => onChange("amount")}
      >
        Amount
      </button>
      <span
        aria-hidden
        style={{ width: 1.5, background: hsTokens.ink, alignSelf: "stretch" }}
      />
      <button
        type="button"
        role="tab"
        aria-selected={mode === "percent"}
        style={cellStyle(mode === "percent")}
        onClick={() => onChange("percent")}
      >
        %
      </button>
    </div>
  );
}

// ─── Target ABV pill (% mode only) ───────────────────────────────

function TargetABVPill({
  value,
  onChange,
  totalPercent,
}: {
  value: number;
  onChange: (v: number) => void;
  totalPercent: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 14px 5px 16px",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: hsTokens.sh1,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        Target ABV
      </span>
      <InlineNumberValue
        value={value}
        onCommit={onChange}
        step={0.1}
        min={0}
        precision={1}
        format={(v) => v.toFixed(1)}
        suffix="%"
        ariaLabel="Target ABV percentage"
      />
      <span
        style={{
          fontFamily: hsTokens.script,
          fontSize: 14,
          color: hsTokens.muted,
          transform: "rotate(-2deg)",
          display: "inline-block",
          whiteSpace: "nowrap",
        }}
      >
        sum {totalPercent.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Grain list — draggable per-grain cards + total ──────────────

function GrainList({
  rows,
  mode,
  percentById,
  totalGrainKg,
  totalPercent,
  onWeightChange,
  onPercentChange,
  onSwap,
  onRemove,
  onReorder,
  onAdd,
}: {
  rows: RowData[];
  mode: Mode;
  percentById: Record<string, number>;
  totalGrainKg: number;
  totalPercent: number;
  onWeightChange: (id: string, v: number) => void;
  onPercentChange: (id: string, v: number) => void;
  onSwap: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  onAdd: () => void;
}) {
  const totalEbc = Math.round(srmFromGrainBill(rows) * 1.97);
  const ids = rows.map((r) => r.f.id);

  // The whole card is the drag surface (no handle), so activation has to
  // coexist with clicking the inner controls and — on touch — scrolling the
  // list. Mouse: require 8px of travel before a drag starts, so a click on
  // the name / value / × still registers as a click. Touch: require a 180ms
  // press-and-hold, so a finger swipe scrolls the page and only a deliberate
  // hold begins a drag. Keyboard sensor keeps reordering accessible.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex, newIndex);
  };

  return (
    <div className="hs-ferm-list-wrap">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul
            className="hs-ferm-cards"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {rows.map((r) => (
              <GrainCard
                key={r.f.id}
                row={r}
                mode={mode}
                percentValue={percentById[r.f.id] ?? r.pct}
                onWeightChange={(v) => onWeightChange(r.f.id, v)}
                onPercentChange={(v) => onPercentChange(r.f.id, v)}
                onSwap={() => onSwap(r.f.id)}
                onRemove={() => onRemove(r.f.id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <GrainTotal
        mode={mode}
        totalGrainKg={totalGrainKg}
        totalPercent={totalPercent}
        totalEbc={totalEbc}
      />

      {/* Dashed empty-row CTA — mobile only. Saves a scroll-up to reach the
          Add button in the (now offscreen) header. */}
      <MobileAddRow onAdd={onAdd} />
    </div>
  );
}

/**
 * SVG background-image as a faux dashed border. CSS native `border-style:
 * dashed` doesn't let you control dash length or gap — modern browsers
 * pick those proportionally to the stroke. SVG's `stroke-dasharray`
 * lets us pick exact values, and the SVG scales to the button via 100%
 * width/height so the dash rhythm stays consistent at any width.
 */
function dashedBorderBg(color: string, opts: { dash: number; gap: number; strokeWidth: number; radius: number }) {
  const { dash, gap, strokeWidth, radius } = opts;
  const c = color.replace("#", "%23");
  const half = strokeWidth / 2;
  return (
    `url("data:image/svg+xml;utf8,` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' preserveAspectRatio='none'>` +
    `<rect x='${half}' y='${half}' ` +
    `width='calc(100%25 - ${strokeWidth}px)' height='calc(100%25 - ${strokeWidth}px)' ` +
    `rx='${radius - half}' ry='${radius - half}' ` +
    `fill='none' stroke='${c}' stroke-width='${strokeWidth}' ` +
    `stroke-dasharray='${dash} ${gap}'/>` +
    `</svg>")`
  );
}

const MOBILE_ADD_RADIUS = 12;
const MOBILE_ADD_DASH = "12";
const MOBILE_ADD_GAP = "8";
const MOBILE_ADD_STROKE = 1.75;

function MobileAddRow({ onAdd }: { onAdd: () => void }) {
  // Use longhand `borderWidth/Style/Color` patterns elsewhere — but here
  // we draw the border via SVG so dashes can be visibly longer with
  // proportional gaps (CSS native dashed is too cramped). At rest we
  // also tint with a gentle cream2 bg so it reads as a clickable cell.
  const restBg = "color-mix(in srgb, var(--hs-cream-2) 65%, transparent)";
  const restBorder = dashedBorderBg("#5a4f42" /* hs-muted literal for SVG */, {
    dash: Number(MOBILE_ADD_DASH),
    gap: Number(MOBILE_ADD_GAP),
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  const hoverBorder = dashedBorderBg("#1a1612" /* hs-ink literal */, {
    dash: Number(MOBILE_ADD_DASH),
    gap: Number(MOBILE_ADD_GAP),
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  return (
    <button
      type="button"
      className="hs-ferm-mobile-add"
      onClick={onAdd}
      style={{
        display: "none",
        width: "100%",
        border: "none",
        backgroundColor: restBg,
        backgroundImage: restBorder,
        backgroundRepeat: "no-repeat",
        borderRadius: MOBILE_ADD_RADIUS,
        padding: "16px 14px",
        margin: "10px 0 2px",
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
        cursor: "pointer",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "background-color 90ms ease, color 90ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hsTokens.cream2;
        e.currentTarget.style.backgroundImage = hoverBorder;
        e.currentTarget.style.color = hsTokens.ink;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = restBg;
        e.currentTarget.style.backgroundImage = restBorder;
        e.currentTarget.style.color = hsTokens.muted;
      }}
    >
      + Add another fermentable
    </button>
  );
}

// ─── Grain card (sortable, draggable by the grip handle) ─────────

function GrainCard({
  row,
  mode,
  percentValue,
  onWeightChange,
  onPercentChange,
  onSwap,
  onRemove,
}: {
  row: RowData;
  mode: Mode;
  percentValue: number;
  onWeightChange: (v: number) => void;
  onPercentChange: (v: number) => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const { f, pct, srmColor, category } = row;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: f.id });

  const editableValue = mode === "amount" ? f.weightKg : percentValue;
  const computedDisplay =
    mode === "amount" ? pct.toFixed(1) : f.weightKg.toFixed(2);
  const computedSuffix = mode === "amount" ? "%" : "kg";
  const step = mode === "amount" ? 0.5 : 1;
  const editPrecision = mode === "amount" ? 2 : 1;
  const editSuffix = mode === "amount" ? "kg" : "%";

  return (
    <li
      ref={setNodeRef}
      className="hs-ferm-card"
      // The whole card is the drag surface — attributes + listeners are spread
      // here, not on a handle. The inner name / value / × controls stay usable
      // because the sensors only start a drag after a small mouse travel or a
      // touch press-and-hold (see GrainList).
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 5 : undefined,
        opacity: isDragging ? 0.92 : 1,
        // While dragging, lift the card off the page. At rest, leave boxShadow
        // unset so the .hs-ferm-card base + :hover shadows (stylesheet) apply.
        boxShadow: isDragging ? hsTokens.sh3 : undefined,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      {...attributes}
      {...listeners}
    >
      {/* Swatch + PPG */}
      <div
        className="hs-ferm-swatch-cell"
        style={{
          gridArea: "swatch",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Swatch color={srmColor} L={f.colorLovibond} ppg={f.ppg} />
      </div>

      {/* Name (click to swap) + category pill, stacked */}
      <div style={{ gridArea: "name", minWidth: 0 }}>
        <button
          type="button"
          className="hs-ferm-name-btn"
          onClick={onSwap}
          aria-label={`Swap ${f.name}`}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
            minWidth: 0,
            color: "inherit",
            fontFamily: "inherit",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            className="hs-ferm-name"
            style={{
              fontFamily: hsTokens.body,
              fontSize: 15,
              fontWeight: 600,
              color: hsTokens.ink,
              lineHeight: 1.2,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={f.name}
          >
            {f.name}
          </span>
          {f.originCode ? (
            <span
              title={BREWING_ORIGINS[f.originCode] ?? f.originCode}
              style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
            >
              {getCountryFlag(f.originCode)}
            </span>
          ) : null}
        </button>
        <div style={{ marginTop: 5 }}>
          <CategoryPill category={category} />
        </div>
      </div>

      {/* Boxed editable value (Weight in amount mode, % in percent mode) */}
      <div
        className="hs-ferm-edit-cell"
        style={{ gridArea: "editable", display: "flex", justifyContent: "flex-end" }}
      >
        <EditableCell
          value={editableValue}
          step={step}
          min={0}
          max={mode === "percent" ? 100 : undefined}
          precision={editPrecision}
          suffix={editSuffix}
          format={(v) => (mode === "amount" ? v.toFixed(2) : v.toFixed(1))}
          ariaLabel={mode === "amount" ? "Weight in kg" : "Percentage"}
          onCommit={(v) => {
            if (mode === "amount") onWeightChange(v);
            else onPercentChange(v);
          }}
        />
      </div>

      {/* Computed value — plain number on the side (Share / kg) */}
      <span
        className="hs-ferm-side"
        style={{
          gridArea: "side",
          display: "inline-flex",
          alignItems: "baseline",
          justifyContent: "flex-end",
          gap: 2,
          minWidth: 50,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontWeight: 700,
            fontSize: 13,
            color: hsTokens.muted,
          }}
        >
          {computedDisplay}
        </span>
        <span
          style={{ fontFamily: hsTokens.mono, fontSize: 10, color: hsTokens.muted }}
        >
          {computedSuffix}
        </span>
      </span>

      {/* Remove — ghost × that fades in on card hover. */}
      <button
        type="button"
        className="hs-ferm-remove-btn"
        onClick={onRemove}
        aria-label={`Remove ${f.name}`}
        style={{
          gridArea: "remove",
          width: 28,
          height: 28,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          color: hsTokens.roast,
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </li>
  );
}

// ─── Grain total — clean footer line below the cards ─────────────

function GrainTotal({
  mode,
  totalGrainKg,
  totalPercent,
  totalEbc,
}: {
  mode: Mode;
  totalGrainKg: number;
  totalPercent: number;
  totalEbc: number;
}) {
  return (
    <div
      className="hs-ferm-total"
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginTop: 14,
        paddingTop: 14,
        borderTop: `2px solid ${hsTokens.ink}`,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 18,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        Total grain bill
      </span>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{ fontFamily: hsTokens.mono, fontSize: 10, color: hsTokens.muted }}
        >
          ~{totalEbc} EBC
        </span>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 22,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
              color: hsTokens.ink,
            }}
          >
            {mode === "amount" ? totalGrainKg.toFixed(2) : totalPercent.toFixed(1)}
          </span>
          <span
            style={{ fontFamily: hsTokens.mono, fontSize: 11, color: hsTokens.muted }}
          >
            {mode === "amount" ? "kg" : "%"}
          </span>
        </span>
      </span>
    </div>
  );
}

// Pure utility: rough SRM total via Morey's weighted-MCU heuristic.
// We don't have batchVolume here — use the recipe sum approximation
// (sum(weightKg * L) / total weight) which yields a "grain bill SRM"
// good enough for an EBC caption in the total row.
function srmFromGrainBill(rows: RowData[]): number {
  const totalW = rows.reduce((s, r) => s + r.f.weightKg, 0);
  if (totalW === 0) return 0;
  const weightedL =
    rows.reduce((s, r) => s + r.f.weightKg * r.f.colorLovibond, 0) / totalW;
  // Rough conversion grain-bill °L → final SRM via Morey-ish factor.
  return Math.max(0, 1.4922 * Math.pow(weightedL, 0.6859));
}

// ─── Swatch ──────────────────────────────────────────────────────

function Swatch({
  color,
  L,
  ppg,
}: {
  color: string;
  L: number;
  ppg: number;
}) {
  const dark = L > 30;
  return (
    <>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 7,
          background: color,
          border: `1.5px solid ${hsTokens.ink}`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          boxShadow: hsTokens.sh1,
          position: "relative",
        }}
        title={`${L}°L · ${ppg} PPG`}
      >
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 10,
            fontWeight: 600,
            color: dark ? "#fff" : hsTokens.ink,
            opacity: 0.92,
            letterSpacing: "0.02em",
          }}
        >
          {L}°
        </span>
      </div>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 9,
          color: hsTokens.muted,
          letterSpacing: "0.05em",
        }}
      >
        {ppg} PPG
      </span>
    </>
  );
}

// ─── Category pill ───────────────────────────────────────────────

function CategoryPill({ category }: { category: GrainCategory }) {
  const dark = category === "Roasted";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "3px 8px",
        background: CAT_COLOR[category],
        color: dark ? hsTokens.cream : hsTokens.ink,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        whiteSpace: "nowrap",
        lineHeight: 1.1,
        flexShrink: 0,
      }}
    >
      {category}
    </span>
  );
}

// ─── Eyebrow primitive ───────────────────────────────────────────

function Eyebrow({
  children,
  size = 10,
  color = hsTokens.muted,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ─── Editable cell — Caveat handwritten value with dotted underline ─

function EditableCell({
  value,
  onCommit,
  step,
  min,
  max,
  format,
  suffix,
  ariaLabel,
  precision,
}: {
  value: number;
  onCommit: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  format: (v: number) => string;
  suffix?: string;
  ariaLabel: string;
  precision?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enterEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  const nudge = (dir: 1 | -1) => {
    const raw = value + dir * step;
    const decimals =
      precision ?? Math.max(0, (String(step).split(".")[1] ?? "").length);
    const rounded = parseFloat(raw.toFixed(decimals));
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, rounded));
    if (clamped !== value) onCommit(clamped);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        // Swallow drag-start so selecting digits inside the field never grabs
        // the card (the whole card is the drag surface).
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        step={step}
        min={min}
        max={max}
        aria-label={ariaLabel}
        style={{
          width: 96,
          background: hsTokens.cream,
          border: `1.5px solid ${hsTokens.malt}`,
          outline: "none",
          fontFamily: hsTokens.script,
          fontWeight: 500,
          fontSize: 23,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          textAlign: "left",
          padding: "4px 9px",
          margin: 0,
          appearance: "textfield",
          borderRadius: 7,
        }}
      />
    );
  }

  return (
    // Presentational wrapper for hover-stepper visibility. The interactive
    // children (edit button + stepper buttons) handle all keyboard/touch input.
    // onMouseDown/onTouchStart stop propagation so clicking — or click-and-
    // holding — the chip or its steppers never starts a card drag.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        type="button"
        onClick={enterEdit}
        aria-label={`Edit ${format(value)}${suffix ?? ""}`}
        className="hs-ferm-edit-btn"
        style={{
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          padding: "3px 32px 3px 11px",
          margin: 0,
          cursor: "text",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 5,
          color: "inherit",
          fontFamily: "inherit",
          borderRadius: 7,
          // Hard offset shadow (matches the hops section's editable chip).
          boxShadow: hsTokens.sh1,
          transition: "background 90ms ease, box-shadow 90ms ease",
        }}
      >
        {/* Handwritten (script) numerals in a defined box — matches the hops
            section's editable cell. */}
        <span
          style={{
            fontFamily: hsTokens.script,
            fontWeight: 500,
            fontSize: 25,
            lineHeight: 1.05,
            color: hsTokens.ink,
          }}
        >
          {format(value)}
        </span>
        {suffix ? (
          <span
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            {suffix}
          </span>
        ) : null}
      </button>
      <HoverSteppers
        visible={hovered}
        onUp={() => nudge(1)}
        onDown={() => nudge(-1)}
      />
    </div>
  );
}

// ─── Hover steppers ───────────────────────────────────────────────

function HoverSteppers({
  visible,
  onUp,
  onDown,
}: {
  visible: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div
      className="hs-ferm-steppers"
      aria-hidden={!visible}
      style={{
        position: "absolute",
        right: 2,
        top: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 1,
        opacity: visible ? 1 : 0,
        transition: "opacity 90ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <StepperBtn onClick={onUp} direction="up" label="Increase" />
      <StepperBtn onClick={onDown} direction="down" label="Decrease" />
    </div>
  );
}

function StepperBtn({
  onClick,
  direction,
  label,
}: {
  onClick: () => void;
  direction: "up" | "down";
  label: string;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      style={{
        width: 16,
        height: 14,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: hsTokens.paper,
        border: `1px solid ${hsTokens.ink}`,
        borderRadius: 3,
        cursor: "pointer",
        color: hsTokens.muted,
        padding: 0,
        lineHeight: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hsTokens.malt;
        e.currentTarget.style.color = hsTokens.ink;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.muted;
      }}
    >
      <svg
        width="9"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "up" ? <path d="M1 5 5 1 9 5" /> : <path d="M1 1 5 5 9 1" />}
      </svg>
    </button>
  );
}

// ─── Inline number value (Target ABV pill) ───────────────────────

function InlineNumberValue({
  value,
  onCommit,
  step,
  min,
  max,
  format,
  suffix,
  ariaLabel,
  precision,
}: {
  value: number;
  onCommit: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  format: (v: number) => string;
  suffix?: string;
  ariaLabel: string;
  precision?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enterEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed);
    }
    setEditing(false);
  };
  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };
  const nudge = (dir: 1 | -1) => {
    const raw = value + dir * step;
    const decimals =
      precision ?? Math.max(0, (String(step).split(".")[1] ?? "").length);
    const rounded = parseFloat(raw.toFixed(decimals));
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, rounded));
    if (clamped !== value) onCommit(clamped);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        minWidth: 72,
        height: 26,
        justifyContent: "flex-end",
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          step={step}
          min={min}
          max={max}
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: hsTokens.cream,
            border: "none",
            outline: `2px solid ${hsTokens.malt}`,
            outlineOffset: -2,
            fontFamily: hsTokens.script,
            fontWeight: 500,
            fontSize: 22,
            color: hsTokens.ink,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
            padding: "0 8px",
            margin: 0,
            appearance: "textfield",
            borderRadius: 4,
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={enterEdit}
            aria-label={`Edit ${format(value)}${suffix ?? ""}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "0 26px 0 8px",
              margin: 0,
              cursor: "text",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
              color: hsTokens.ink,
            }}
          >
            <span
              style={{
                fontFamily: hsTokens.script,
                fontWeight: 500,
                fontSize: 22,
                lineHeight: 1,
                color: hsTokens.ink,
              }}
            >
              {format(value)}
            </span>
            {suffix ? (
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 12,
                  color: hsTokens.muted,
                }}
              >
                {suffix}
              </span>
            ) : null}
          </button>
          <HoverSteppers
            visible={hovered}
            onUp={() => nudge(1)}
            onDown={() => nudge(-1)}
          />
        </>
      )}
    </div>
  );
}

// ─── Styles (row hover, mobile responsive, touch always-on steppers) ─

function FermentableSectionStyles() {
  return (
    <style>{`
      .hs-ferm-section .hs-ferm-list-wrap { min-width: 0; }

      /* Per-grain card — swatch | name | boxed value | side % | ×. The whole
         card is draggable (no handle), so inner controls set their own cursor
         to override the card's grab cursor on hover. */
      .hs-ferm-section .hs-ferm-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto auto;
        grid-template-areas: "swatch name editable side remove";
        align-items: center;
        column-gap: 12px;
        row-gap: 8px;
        padding: 10px 12px;
        background: var(--hs-cream);
        border: 2px solid var(--hs-ink);
        border-radius: 10px;
        box-shadow: 2px 2px 0 var(--hs-ink);
      }

      /* Desktop hover — lift the card toward its shadow, reveal the ghost ×. */
      @media (min-width: 561px) and (hover: hover) {
        .hs-ferm-section .hs-ferm-card {
          transition: box-shadow 110ms ease, transform 110ms ease, background 110ms ease;
        }
        .hs-ferm-section .hs-ferm-card:hover {
          background: color-mix(in srgb, var(--hs-cream) 92%, var(--hs-paper));
          box-shadow: 3px 3px 0 var(--hs-ink);
          transform: translate(-1px, -1px);
        }
        .hs-ferm-section .hs-ferm-remove-btn {
          opacity: 0.32;
          transition: opacity 90ms ease, background 90ms ease;
        }
        .hs-ferm-section .hs-ferm-card:hover .hs-ferm-remove-btn { opacity: 1; }
        .hs-ferm-section .hs-ferm-remove-btn:hover {
          background: rgba(212, 69, 44, 0.12);
        }
        .hs-ferm-section .hs-ferm-name-btn:hover .hs-ferm-name {
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .hs-ferm-section .hs-ferm-edit-btn:hover {
          background: ${hsTokens.cream2};
        }
      }

      /* Mobile (≤560px) — two-row card, always-visible steppers + ×. */
      @media (max-width: 560px) {
        .hs-ferm-section .hs-ferm-mobile-add { display: flex !important; }

        .hs-ferm-section .hs-ferm-card {
          grid-template-columns: auto minmax(0, 1fr) auto;
          grid-template-areas:
            "swatch name     remove"
            "swatch editable side";
          row-gap: 10px;
        }
        .hs-ferm-section .hs-ferm-edit-cell { justify-content: flex-start !important; }

        /* Always-visible bare steppers (touch can't hover). */
        .hs-ferm-section .hs-ferm-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 2px !important;
        }
        .hs-ferm-section .hs-ferm-remove-btn { opacity: 1 !important; }

        .hs-ferm-section { padding: 18px 14px !important; }
        .hs-ferm-bill-stack { padding: 12px !important; }
      }
    `}</style>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        background: hsTokens.cream2,
        border: `1.5px dashed ${hsTokens.ink}`,
        borderRadius: 10,
        padding: "32px 28px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <HSScriptNote color={hsTokens.malt} size={24} rotate={-4}>
        empty bill —
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 15,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 380,
          lineHeight: 1.4,
        }}
      >
        Start with your base malt, then layer in specialty grains. The picker has every common
        fermentable.
      </p>
      <HSButton onClick={onAdd} color={hsTokens.malt} size="md">
        Add your first fermentable
      </HSButton>
    </div>
  );
}

// ─── Helper-card container (mounted by HelperCardMorph) ───────────

export function FermentableHelperCard() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const fermentables = useMemo(
    () => currentRecipe?.fermentables ?? [],
    [currentRecipe?.fermentables]
  );
  const totalGrainKg = fermentables.reduce((sum, f) => sum + f.weightKg, 0);
  const rows: RowData[] = useMemo(
    () =>
      fermentables.map((f) => {
        const pct = totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
        return {
          f,
          pct,
          srmColor: srmToRgb(f.colorLovibond),
          category: categorize(f),
        };
      }),
    [fermentables, totalGrainKg]
  );
  if (fermentables.length === 0) return null;
  return <BillStack rows={rows} totalGrainKg={totalGrainKg} />;
}
