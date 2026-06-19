"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";

import { hsTokens, emptyStateTitleStyle } from "../../tokens";
import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import HopPresetModal from "../modals/HopPresetModal";
import CustomHopModal from "../modals/CustomHopModal";
import { LedgerRowMotion, LedgerRowsAnimated } from "./LedgerRowMotion";
import { useHopHoverPreview } from "./hopHoverPreview";

import { uid } from "@/utils/uid";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { usePresetStore } from "@/modules/recipe/stores/presetStore";
import { useRecipeCalculations } from "@/modules/recipe/hooks/useRecipeCalculations";
import { toast } from "@/stores/toastStore";
import { hopFlavorCalculationService } from "@/modules/recipe/services/HopFlavorCalculationService";
import { hopEnrichmentService } from "@/modules/recipe/services/HopEnrichmentService";
import { recipeCalculationService } from "@/modules/recipe/services/RecipeCalculationService";
import { volumeCalculationService } from "@/modules/recipe/services/VolumeCalculationService";
import type { Hop } from "@/modules/recipe/models/Recipe";
import type {
  HopPreset,
  HopFlavorProfile,
} from "@/modules/recipe/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/recipe/models/Presets";

type Usage = Hop["type"];

// Brew-day order: mash → first wort → boil → whirlpool → dry hop. Drives both
// the section ordering and the use dropdown.
const USAGE_ORDER: Usage[] = [
  "mash",
  "first wort",
  "boil",
  "whirlpool",
  "dry hop",
];

const USAGE_LABEL: Record<Usage, string> = {
  boil: "Boil",
  whirlpool: "Whirlpool",
  "dry hop": "Dry hop",
  "first wort": "First wort",
  mash: "Mash",
};

/** Color associated with each usage type — used as the dot inside the
 *  UsageSelect pill and the row badge in the radar legend. */
const USAGE_COLOR: Record<Usage, string> = {
  boil: hsTokens.hops,
  whirlpool: hsTokens.honey,
  "dry hop": hsTokens.yeast,
  "first wort": "#6b9c5a",
  mash: hsTokens.roast,
};

/** Default field values when switching a hop to a new usage type. */
function defaultsForUsage(u: Usage): Partial<Hop> {
  switch (u) {
    case "boil":
      return { type: "boil", timeMinutes: 60 };
    case "whirlpool":
      return {
        type: "whirlpool",
        temperatureC: 80,
        whirlpoolTimeMinutes: 15,
      };
    case "dry hop":
      return { type: "dry hop", dryHopStartDay: 0, dryHopDays: 3 };
    case "first wort":
      return { type: "first wort" };
    case "mash":
      return { type: "mash" };
  }
}

/** Caption text describing the hop's purpose, based on AA%. */
function purposeOf(alphaAcid: number): "aroma" | "dual" | "bittering" {
  if (alphaAcid < 6) return "aroma";
  if (alphaAcid <= 10) return "dual";
  return "bittering";
}

// ─── Grouping (use & time / variety) ──────────────────────────────

type GroupMode = "use-time" | "variety";

const GROUP_MODE_DEFAULT: GroupMode = "variety";
const GROUP_MODE_STORAGE_KEY = "hopskip:group-mode";

/** Read the persisted grouping mode (defaults to variety). Only touches
 *  storage on the client; the grouping UI is client-only so reading it in the
 *  initial state can't cause an SSR hydration mismatch. */
function readGroupMode(): GroupMode {
  if (typeof window === "undefined") return GROUP_MODE_DEFAULT;
  try {
    const saved = window.localStorage.getItem(GROUP_MODE_STORAGE_KEY);
    if (saved === "use-time" || saved === "variety") return saved;
  } catch {
    // storage blocked (private mode) — fall through to the default.
  }
  return GROUP_MODE_DEFAULT;
}

/** Idle delay before a hop re-settles into its live section after an edit.
 *  Keeps a row from hopping between boxes on every stepper click while the
 *  user dials in a time (e.g. 15 → 20 → … → 60 min). */
const GROUP_SETTLE_MS = 1150;

interface HopGroup {
  /** Stable key for React reconciliation + map dedupe. */
  key: string;
  /** Primary label — "Boil" / "Whirlpool" / variety name. */
  label: string;
  /** Secondary timing label — "60 min", "from day 3" (use-time only). */
  sublabel?: string;
  /** Swatch color — usage color (use-time) or dominant-flavor tint (variety). */
  accentColor: string;
  /** Usage + scheduling time defining a use-time section — the drop target a
   *  dragged row retimes into. */
  usage: Usage;
  timeKey: number;
  usageIndex: number;
  hops: Hop[];
  totalGrams: number;
  totalIbu: number;
}

/** The scheduling time that sub-splits a usage in "use & time" mode. Returns
 *  null for uses with no timing (first wort, mash) so they form one group. */
function timeKeyForHop(hop: Hop): number | null {
  switch (hop.type) {
    case "boil":
      return hop.timeMinutes ?? 0;
    case "whirlpool":
      return hop.whirlpoolTimeMinutes ?? 0;
    case "dry hop":
      return hop.dryHopStartDay ?? 0;
    default:
      return null;
  }
}

/** Human timing label for a group's sublabel. */
function timeSublabel(hop: Hop): string | undefined {
  switch (hop.type) {
    case "boil":
      return `${hop.timeMinutes ?? 0} min`;
    case "whirlpool":
      return `${hop.whirlpoolTimeMinutes ?? 0} min`;
    case "dry hop": {
      const day = hop.dryHopStartDay ?? 0;
      return day === 0 ? "at pitch" : `on day ${day}`;
    }
    default:
      return undefined;
  }
}

/** Dominant-flavor accent color for a hop (mirrors RowMiniRadar's tint). */
function accentForHop(hop: Hop): string {
  const flavor =
    hop.flavor ?? hopEnrichmentService.getFlavorByName(hop.name) ?? null;
  if (!flavor) return hsTokens.hops;
  let bestKey: (typeof HOP_FLAVOR_KEYS)[number] = HOP_FLAVOR_KEYS[0];
  let bestV = -1;
  for (const k of HOP_FLAVOR_KEYS) {
    const v = flavor[k] ?? 0;
    if (v > bestV) {
      bestV = v;
      bestKey = k;
    }
  }
  return HOP_FLAVOR_COLOR[bestKey] ?? hsTokens.hops;
}

/** SSR-safe layout effect — avoids the useLayoutEffect warning during Next's
 *  server render while still running pre-paint on the client. */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Size every input in a column (grouped by its `data-hop-input` key) to the
 *  widest one in the section, so each column's boxes stay compact yet match
 *  all the way down. Measured against the live DOM because the script numerals
 *  are proportional — counting characters can't predict the pixel width. */
function equalizeInputWidths(root: HTMLElement | null) {
  if (!root) return;
  const byCol = new Map<string, HTMLElement[]>();
  for (const cell of root.querySelectorAll<HTMLElement>("[data-hop-input]")) {
    const key = cell.dataset.hopInput || "";
    const arr = byCol.get(key);
    if (arr) arr.push(cell);
    else byCol.set(key, [cell]);
  }
  for (const cells of byCol.values()) {
    // Only resting cells are measurable; an editing cell holds a bare <input>
    // with no intrinsic content width. They still receive the final width.
    const measurable = cells.filter((el) => !el.querySelector("input"));
    for (const el of measurable) el.style.width = "";
    let max = 0;
    for (const el of measurable) max = Math.max(max, el.offsetWidth);
    if (max <= 0) continue;
    for (const el of cells) el.style.width = `${max}px`;
  }
}

/** A hop's section placement. Captured per hop id so it can be FROZEN while a
 *  row is being edited (the debounced regroup) — see HopSection's settle
 *  effect — then refreshed once edits go idle. */
interface GroupAssignment {
  key: string;
  label: string;
  sublabel?: string;
  accentColor: string;
  /** Sort inputs for use-time ordering (carried so order stays stable while a
   *  frozen row's live time differs from its section). */
  usageIndex: number;
  timeKey: number;
  usage: Usage;
}

/** Live section assignment for a hop under a grouping mode. */
function computeAssignment(hop: Hop, mode: GroupMode): GroupAssignment {
  if (mode === "variety") {
    return {
      key: `v:${hop.name}`,
      label: hop.name,
      accentColor: accentForHop(hop),
      usageIndex: 0,
      timeKey: 0,
      usage: hop.type,
    };
  }
  const tk = timeKeyForHop(hop);
  return {
    key: tk === null ? `u:${hop.type}` : `u:${hop.type}:${tk}`,
    label: USAGE_LABEL[hop.type],
    sublabel: timeSublabel(hop),
    accentColor: USAGE_COLOR[hop.type],
    usageIndex: USAGE_ORDER.indexOf(hop.type),
    timeKey: tk ?? 0,
    usage: hop.type,
  };
}

/** Brew-day order for two additions: by usage (USAGE_ORDER), then by time —
 *  boil/whirlpool longest-first (goes in earliest), dry hop earliest-day-first.
 *  Used to order the rows inside a section (mash always leads). */
function brewDayCompare(a: Hop, b: Hop): number {
  const ui = USAGE_ORDER.indexOf(a.type) - USAGE_ORDER.indexOf(b.type);
  if (ui !== 0) return ui;
  const ta = timeKeyForHop(a) ?? 0;
  const tb = timeKeyForHop(b) ?? 0;
  return a.type === "dry hop" ? ta - tb : tb - ta;
}

/** Partition hops into bounded sections. "use-time" keys by usage + its
 *  scheduling time (Boil 60, Boil 15, Whirlpool 20min, …); "variety" keys by
 *  hop name (all Citra together). Groups carry per-group gram + IBU subtotals.
 *
 *  `overrides` supplies a frozen assignment per hop id so a row doesn't jump
 *  sections mid-edit; hops absent from it (e.g. a just-added hop) fall back to
 *  their live assignment. Subtotals always reflect live hop values. */
function buildHopGroups(
  hops: Hop[],
  mode: GroupMode,
  og: number,
  batchVolumeGal: number,
  boilGravity: number,
  boilTimeMin: number,
  overrides?: Record<string, GroupAssignment>
): HopGroup[] {
  const map = new Map<string, HopGroup>();
  const order: string[] = [];

  for (const h of hops) {
    const a = overrides?.[h.id] ?? computeAssignment(h, mode);

    let group = map.get(a.key);
    if (!group) {
      group = {
        key: a.key,
        label: a.label,
        sublabel: a.sublabel,
        accentColor: a.accentColor,
        usageIndex: a.usageIndex,
        timeKey: a.timeKey,
        usage: a.usage,
        hops: [],
        totalGrams: 0,
        totalIbu: 0,
      };
      map.set(a.key, group);
      order.push(a.key);
    }
    group.hops.push(h);
    group.totalGrams += h.grams;
    group.totalIbu += recipeCalculationService.calculateSingleHopIBU(
      h,
      og,
      batchVolumeGal,
      boilGravity,
      boilTimeMin
    );
  }

  const groups = order.map((k) => map.get(k)!);

  if (mode === "use-time") {
    // Order by usage (brew order), then by time within usage. Boil/whirlpool
    // run longest-first (early-boil additions lead); dry hop runs earliest
    // start-day first. Reads the (possibly frozen) assignment so section order
    // is stable while a row is mid-edit.
    groups.sort((a, b) => {
      const ui = a.usageIndex - b.usageIndex;
      if (ui !== 0) return ui;
      return a.usage === "dry hop"
        ? a.timeKey - b.timeKey
        : b.timeKey - a.timeKey;
    });
  }
  // variety mode keeps first-seen order (matches the radar legend).

  // Within every section, order the rows by brew day (no-op for use-time
  // sections where all rows share a timing; meaningful inside a variety card
  // whose additions span boil → whirlpool → dry hop).
  for (const g of groups) g.hops.sort(brewDayCompare);

  return groups;
}

export default function HopSection() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const addHop = useRecipeStore((s) => s.addHop);
  const updateHop = useRecipeStore((s) => s.updateHop);
  const removeHop = useRecipeStore((s) => s.removeHop);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);

  const hopPresetsGrouped = usePresetStore((s) => s.hopPresetsGrouped);
  const loadHopPresets = usePresetStore((s) => s.loadHopPresets);
  const saveHopPreset = usePresetStore((s) => s.saveHopPreset);
  const presetsLoading = usePresetStore((s) => s.isLoading);

  const calculations = useRecipeCalculations(currentRecipe);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Defaults to variety; persisted so the choice survives leaving and
  // re-entering the hop section (and page reloads).
  const [groupMode, setGroupMode] = useState<GroupMode>(readGroupMode);
  const handleGroupModeChange = (m: GroupMode) => {
    setGroupMode(m);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(GROUP_MODE_STORAGE_KEY, m);
      } catch {
        // ignore (storage blocked)
      }
    }
  };

  // Debounced section assignments. While a row is actively edited, its hop
  // keeps its prior section (frozen here) so it doesn't jump boxes on every
  // stepper click; the map refreshes GROUP_SETTLE_MS after edits go idle.
  // `mode` is tracked so a mode toggle ignores the stale (other-mode) map.
  const [groupAssign, setGroupAssign] = useState<{
    mode: GroupMode;
    map: Record<string, GroupAssignment>;
  }>({ mode: groupMode, map: {} });
  const settleTimerRef = useRef<number | null>(null);
  const prevGroupModeRef = useRef<GroupMode>(groupMode);
  const prevHopSigRef = useRef<string>("");
  // Set by a drag-drop retime so the dropped row regroups immediately instead
  // of waiting out the stepper debounce (a drop is a deliberate move).
  const forceRegroupRef = useRef(false);

  useEffect(() => {
    loadHopPresets();
  }, [loadHopPresets]);

  // Flat hop library + name lookup — fed into the shared hover hook so
  // it can resolve a row's hop name → full preset and run the similar-
  // hops cosine over the 9-axis flavor vector.
  const hopPresetByName = useMemo(() => {
    const m = new Map<string, HopPreset>();
    for (const group of hopPresetsGrouped) {
      for (const p of group.items) m.set(p.name, p);
    }
    return m;
  }, [hopPresetsGrouped]);
  const flatHopLibrary = useMemo<HopPreset[]>(
    () => Array.from(hopPresetByName.values()),
    [hopPresetByName]
  );

  // Shared hover-preview instance for all hop rows in this section.
  // 300ms dwell (default) — a quick stepper-tap or row sweep shouldn't
  // fire the panel; the picker modal uses 0 instead.
  const {
    portal: hoverPortal,
    getTriggerProps: getHopHoverTriggerProps,
    clear: clearHopHoverPreview,
  } = useHopHoverPreview(flatHopLibrary, {
    // Clicking a "Similar hops" chip in the hover panel swaps that row's
    // hop in place — same field updates as a picker-modal swap, minus
    // the modal. The row's grams/time/usage are preserved by the partial
    // updateHop.
    onSelect: (chosen, hopId) => {
      const flavor =
        chosen.flavor ?? hopEnrichmentService.getFlavorByName(chosen.name);
      updateHop(hopId, {
        name: chosen.name,
        alphaAcid: chosen.alphaAcidPercent,
        flavor,
      });
      toast.success(`Swapped to ${chosen.name}`);
    },
  });

  // Hide the hover preview when the swap picker opens — the cursor
  // hasn't physically left the trigger boundary, so mouseLeave doesn't
  // fire on its own and the panel would linger behind the modal.
  useEffect(() => {
    if (isPickerOpen) clearHopHoverPreview();
  }, [isPickerOpen, clearHopHoverPreview]);

  const hops = useMemo(
    () => currentRecipe?.hops ?? [],
    [currentRecipe?.hops]
  );

  // Resettle sections after edits go idle. Each hop edit produces a new `hops`
  // reference, re-running this effect and pushing the timer out, so a burst of
  // stepper clicks collapses into a single regroup once the user pauses. Only
  // numeric timing edits debounce: a mode toggle, a use switch, a variety swap,
  // or an add/remove (all captured by the structural signature) regroup now, so
  // those deliberate moves land immediately while the time stepper stays put.
  useEffect(() => {
    const modeChanged = prevGroupModeRef.current !== groupMode;
    prevGroupModeRef.current = groupMode;

    const sig = hops.map((h) => `${h.id}:${h.type}:${h.name}`).join("|");
    const structuralChange = sig !== prevHopSigRef.current;
    prevHopSigRef.current = sig;

    const forced = forceRegroupRef.current;
    forceRegroupRef.current = false;

    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    const snapshot = () => {
      const map: Record<string, GroupAssignment> = {};
      for (const h of hops) map[h.id] = computeAssignment(h, groupMode);
      return map;
    };
    if (modeChanged || structuralChange || forced) {
      setGroupAssign({ mode: groupMode, map: snapshot() });
      return;
    }
    settleTimerRef.current = window.setTimeout(() => {
      setGroupAssign({ mode: groupMode, map: snapshot() });
    }, GROUP_SETTLE_MS);
    return () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [hops, groupMode]);

  // Frozen assignments to feed the ledger. Ignored when the stored map predates
  // a mode toggle (the effect above refreshes it on the next tick).
  const frozenAssignments =
    groupAssign.mode === groupMode ? groupAssign.map : undefined;

  const totalGrams = hops.reduce((sum, h) => sum + h.grams, 0);

  const handleSelectPreset = (preset: HopPreset) => {
    const flavor =
      preset.flavor ?? hopEnrichmentService.getFlavorByName(preset.name);
    if (editingId) {
      updateHop(editingId, {
        name: preset.name,
        alphaAcid: preset.alphaAcidPercent,
        flavor,
      });
    } else {
      const next: Hop = {
        id: uid(),
        name: preset.name,
        alphaAcid: preset.alphaAcidPercent,
        grams: 28,
        type: "boil",
        timeMinutes: 60,
        flavor,
      };
      addHop(next);
    }
    setEditingId(null);
    setIsPickerOpen(false);
  };

  const handleSwapHop = (id: string) => {
    setEditingId(id);
    setIsPickerOpen(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setIsPickerOpen(true);
  };

  // Add another addition of an existing variety (variety-mode card header
  // "+"). Skips the preset picker by cloning name/AA/flavor from a hop already
  // in the bill; defaults the new addition to boil/60 min/28 g so the user
  // dials it in like a fresh add.
  const handleAddVariety = (sourceHop: Hop) => {
    addHop({
      id: uid(),
      name: sourceHop.name,
      alphaAcid: sourceHop.alphaAcid,
      grams: 28,
      type: "boil",
      timeMinutes: 60,
      flavor: sourceHop.flavor,
    });
  };

  const handleSaveCustomPreset = (preset: HopPreset) => {
    saveHopPreset(preset);
    toast.success(`"${preset.name}" saved — select it from the list to add`);
  };

  const handleChangeUsage = (id: string, next: Usage) => {
    const defaults = defaultsForUsage(next);
    // Clear stale fields from the prior usage before applying new defaults.
    const cleared: Partial<Hop> = {
      timeMinutes: undefined,
      temperatureC: undefined,
      whirlpoolTimeMinutes: undefined,
      dryHopStartDay: undefined,
      dryHopDays: undefined,
    };
    updateHop(id, { ...cleared, ...defaults });
  };

  // Drop a row onto another use-time section: adopt that section's usage +
  // scheduling time. Same-usage drops just retime; cross-usage drops retype
  // with the new usage's defaults and then set the section's time.
  const handleRetimeHop = (id: string, usage: Usage, timeKey: number) => {
    const hop = hops.find((h) => h.id === id);
    if (!hop) return;

    let updates: Partial<Hop> | null = null;
    if (hop.type === usage) {
      // Same usage — only retime (skip a no-op drop onto the same section).
      if (usage === "boil" && hop.timeMinutes !== timeKey)
        updates = { timeMinutes: timeKey };
      else if (usage === "whirlpool" && hop.whirlpoolTimeMinutes !== timeKey)
        updates = { whirlpoolTimeMinutes: timeKey };
      else if (usage === "dry hop" && hop.dryHopStartDay !== timeKey)
        updates = { dryHopStartDay: timeKey };
    } else {
      // Different usage — retype with that usage's defaults, then set the time.
      const cleared: Partial<Hop> = {
        timeMinutes: undefined,
        temperatureC: undefined,
        whirlpoolTimeMinutes: undefined,
        dryHopStartDay: undefined,
        dryHopDays: undefined,
      };
      const next: Partial<Hop> = { ...cleared, ...defaultsForUsage(usage) };
      if (usage === "boil") next.timeMinutes = timeKey;
      else if (usage === "whirlpool") next.whirlpoolTimeMinutes = timeKey;
      else if (usage === "dry hop") next.dryHopStartDay = timeKey;
      updates = next;
    }

    if (!updates) return;
    // Bypass the stepper debounce — a drop should land the row in its new
    // section immediately.
    forceRegroupRef.current = true;
    updateHop(id, updates);
  };

  return (
    <section className="hs-hops-section" style={sectionFrameStyle}>
      <HopSectionStyles />

      <SectionTitle />

      {hops.length === 0 ? (
        <EmptyState onAdd={handleAddNew} />
      ) : (
        <div className="hs-hops-grid">
          <div className="hs-hops-grid-lhead">
            <LedgerHeaderRow
              entryCount={hops.length}
              ibu={calculations?.ibu ?? 0}
              groupMode={groupMode}
              onGroupModeChange={handleGroupModeChange}
              onAdd={handleAddNew}
            />
          </div>

          <div className="hs-hops-grid-ltable">
            <Ledger
              hops={hops}
              groupMode={groupMode}
              assignments={frozenAssignments}
              totalGrams={totalGrams}
              og={calculations?.og ?? 1.05}
              batchVolumeGal={(currentRecipe ? volumeCalculationService.calculatePostBoilVolume(currentRecipe) : 20) * 0.264172}
              boilGravity={
                ((calculations?.preBoilGravity ?? calculations?.og ?? 1.05) +
                  (calculations?.og ?? 1.05)) /
                2
              }
              boilTimeMin={currentRecipe?.equipment?.boilTimeMin ?? 60}
              onExtendBoil={(min) => {
                if (!currentRecipe) return;
                updateRecipe({
                  equipment: { ...currentRecipe.equipment, boilTimeMin: min },
                });
              }}
              onGramsChange={(id, v) =>
                updateHop(id, { grams: Math.max(0, v) })
              }
              onTimeMinutesChange={(id, v) =>
                updateHop(id, { timeMinutes: Math.max(0, v) })
              }
              onTemperatureChange={(id, v) =>
                updateHop(id, {
                  temperatureC: Math.max(0, Math.min(100, v)),
                })
              }
              onWhirlpoolTimeChange={(id, v) =>
                updateHop(id, { whirlpoolTimeMinutes: Math.max(0, v) })
              }
              onDryHopDaysChange={(id, v) =>
                updateHop(id, { dryHopDays: Math.max(0, v) })
              }
              onDryHopStartDayChange={(id, v) =>
                updateHop(id, { dryHopStartDay: Math.max(0, v) })
              }
              onSwap={handleSwapHop}
              onUsageChange={handleChangeUsage}
              onRetime={handleRetimeHop}
              onRemove={removeHop}
              onAdd={handleAddNew}
              onAddVariety={handleAddVariety}
              getHoverTriggerProps={(hop) => {
                // Prefer the live library preset when present (carries
                // alpha/beta/oil + flavorConfidence). Fall back to a
                // synthesized preset built from the recipe's own Hop
                // data so legacy/custom hops still get a preview as
                // long as we have a flavor vector for them.
                const fromLib = hopPresetByName.get(hop.name);
                if (fromLib) return getHopHoverTriggerProps(fromLib, hop.id);
                const flavor =
                  hop.flavor ??
                  hopEnrichmentService.getFlavorByName(hop.name);
                if (!flavor) return {};
                return getHopHoverTriggerProps(
                  {
                    name: hop.name,
                    alphaAcidPercent: hop.alphaAcid,
                    flavor,
                  },
                  hop.id
                );
              }}
            />
          </div>

        </div>
      )}

      <HopPresetModal
        isOpen={isPickerOpen}
        editing={Boolean(editingId)}
        onClose={() => {
          setIsPickerOpen(false);
          setEditingId(null);
        }}
        onSelect={handleSelectPreset}
        onCreateCustom={() => setIsCustomOpen(true)}
        presetsGrouped={hopPresetsGrouped}
        isLoading={presetsLoading}
      />

      <CustomHopModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
        onSave={handleSaveCustomPreset}
      />

      {hoverPortal}
    </section>
  );
}

// Trigger handler props returned by useHopHoverPreview. Pulled out as a
// named type so HopLedger + LedgerRow can pipe them through without a
// verbose inline shape.
type HopHoverTriggerProps = {
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
};

/** Larger version of RowMiniRadar with axis labels — used in the
 *  variety card's left rail (the section's old per-row hover preview
 *  was removed and migrated to `useHopHoverPreview`'s shared panel).
 *  Single-flavor 9-axis polygon. `fill` makes it size to its container's
 *  height (square, capped by width) so the rail radar scales with the
 *  addition count. */
function RowHoverMiniRadar({
  flavor,
  color,
  fill = false,
}: {
  flavor: HopFlavorProfile;
  color: string;
  fill?: boolean;
}) {
  const size = 170;
  const pad = 26;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;
  const max = 5;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const labelAt = (i: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = radius + 10;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");
  const polyPoints = HOP_FLAVOR_KEYS.map((k, i) =>
    pointAt(i, flavor[k] ?? 0).join(",")
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height={fill ? "100%" : "auto"}
      preserveAspectRatio="xMidYMid meet"
      style={
        fill
          ? {
              position: "absolute",
              top: 8,
              left: 8,
              width: "calc(100% - 16px)",
              height: "calc(100% - 16px)",
              display: "block",
            }
          : { display: "block", margin: "0 auto" }
      }
      aria-hidden
    >
      {[0.5, 1].map((m) => (
        <polygon
          key={m}
          points={ringPoints(m)}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.4}
          opacity={m === 1 ? 0.3 : 0.18}
        />
      ))}
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [x, y] = pointAt(i, max);
        return (
          <line
            key={k}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--hs-ink)"
            strokeWidth={0.25}
            opacity={0.2}
          />
        );
      })}
      <polygon
        points={polyPoints}
        fill={color}
        fillOpacity={0.32}
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [lx, ly] = labelAt(i);
        return (
          <text
            key={`label-${k}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 7,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fill: HOP_FLAVOR_COLOR[k] ?? hsTokens.muted,
            }}
          >
            {HOP_FLAVOR_LABEL[k]?.split(" ")[0] ?? k}
          </text>
        );
      })}
    </svg>
  );
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

// ─── Section title (kicker + h2 + hops rule, no controls) ────────

function SectionTitle() {
  return (
    <header
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${hsTokens.hops}`,
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
        Hops.
      </h2>
    </header>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "44px 18px",
        background: hsTokens.cream2,
        border: `1.5px dashed ${hsTokens.ink}`,
        borderRadius: 14,
        textAlign: "center",
      }}
    >
      <HSScriptNote color={hsTokens.hops} rotate={-3} style={emptyStateTitleStyle}>
        Hop Bill
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 14,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 380,
          lineHeight: 1.4,
        }}
      >
        Bitterness, aroma, dry-hop punch — pick the varieties that shape your
        beer and the section will fill in IBU + flavor live.
      </p>
      <HSButton onClick={onAdd} color={hsTokens.hops} size="md">
        + Add your first hop
      </HSButton>
    </div>
  );
}

// ─── Ledger header row ────────────────────────────────────────────

function LedgerHeaderRow({
  entryCount,
  ibu,
  groupMode,
  onGroupModeChange,
  onAdd,
}: {
  entryCount: number;
  ibu: number;
  groupMode: GroupMode;
  onGroupModeChange: (m: GroupMode) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="hs-hops-ledger-head"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 2,
      }}
    >
      <Eyebrow size={11}>Hop bill</Eyebrow>
      <HopGroupToggle mode={groupMode} onChange={onGroupModeChange} />
      <span
        aria-hidden
        style={{
          flex: 1,
          minWidth: 20,
          height: 1,
          background: hsTokens.ink,
          opacity: 0.22,
        }}
      />
      <HSScriptNote color={hsTokens.muted} size={16} rotate={-3}>
        {entryCount} entr{entryCount === 1 ? "y" : "ies"}
      </HSScriptNote>
      <IbuPill value={ibu} />
      <HSButton onClick={onAdd} color={hsTokens.hops} size="sm">
        + Add hop
      </HSButton>
    </div>
  );
}

/** Segmented "group by" toggle (Use & time · Variety). Mirrors the radar
 *  card's RadarModeToggle shape with a hops-green active state. A small
 *  "group" eyebrow sits inside the pill's left edge for context. */
function HopGroupToggle({
  mode,
  onChange,
}: {
  mode: GroupMode;
  onChange: (m: GroupMode) => void;
}) {
  const cellStyle = (active: boolean): CSSProperties => ({
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "5px 11px",
    border: "none",
    background: active ? hsTokens.hops : "transparent",
    color: active ? hsTokens.cream : hsTokens.ink,
    cursor: "pointer",
    transition: "background 120ms ease",
    whiteSpace: "nowrap",
  });
  const opts: Array<{ id: GroupMode; label: string }> = [
    { id: "use-time", label: "Use & time" },
    { id: "variety", label: "Variety" },
  ];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <Eyebrow size={9} color={hsTokens.muted}>
        Group
      </Eyebrow>
      <div
        role="tablist"
        aria-label="Group hops by"
        style={{
          display: "inline-flex",
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 999,
          overflow: "hidden",
          boxShadow: hsTokens.sh1,
        }}
      >
        {opts.map((o, i) => (
          <span key={o.id} style={{ display: "inline-flex" }}>
            <button
              type="button"
              role="tab"
              aria-selected={mode === o.id}
              style={cellStyle(mode === o.id)}
              onClick={() => onChange(o.id)}
            >
              {o.label}
            </button>
            {i < opts.length - 1 ? (
              <span
                aria-hidden
                style={{
                  width: 1.5,
                  background: hsTokens.ink,
                  alignSelf: "stretch",
                }}
              />
            ) : null}
          </span>
        ))}
      </div>
    </span>
  );
}

function IbuPill({ value }: { value: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
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
        IBU
      </span>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 17,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        {Math.round(value)}
      </span>
    </span>
  );
}

// ─── Ledger ───────────────────────────────────────────────────────

/** Column layout: [mini radar | name+caption | use | time | weight | IBU | ×]. */
const LEDGER_COLS = "52px minmax(0, 1.3fr) 116px 128px 88px 64px 32px";

/** Darker, slightly tinted background applied to the IBU column so it
 *  reads as a "summary readout" column distinct from the editable cells. */
// Section-tinted IBU column background — ink-on-paper base + ~4% hops tint.
const IBU_CELL_BG =
  "color-mix(in srgb, color-mix(in srgb, var(--hs-ink) 5%, var(--hs-paper)) 96%, var(--hs-hops))";

function Ledger({
  hops,
  groupMode,
  assignments,
  totalGrams,
  og,
  batchVolumeGal,
  boilGravity,
  boilTimeMin,
  onExtendBoil,
  onGramsChange,
  onTimeMinutesChange,
  onTemperatureChange,
  onWhirlpoolTimeChange,
  onDryHopDaysChange,
  onDryHopStartDayChange,
  onSwap,
  onUsageChange,
  onRetime,
  onRemove,
  onAdd,
  onAddVariety,
  getHoverTriggerProps,
}: {
  hops: Hop[];
  groupMode: GroupMode;
  assignments?: Record<string, GroupAssignment>;
  totalGrams: number;
  og: number;
  batchVolumeGal: number;
  /** Average boil gravity (Tinseth bigness factor); used for kettle additions
   *  so per-row IBU matches the brew-sheet total. */
  boilGravity: number;
  boilTimeMin: number;
  onExtendBoil: (newBoilMin: number) => void;
  onGramsChange: (id: string, v: number) => void;
  onTimeMinutesChange: (id: string, v: number) => void;
  onTemperatureChange: (id: string, v: number) => void;
  onWhirlpoolTimeChange: (id: string, v: number) => void;
  onDryHopDaysChange: (id: string, v: number) => void;
  onDryHopStartDayChange: (id: string, v: number) => void;
  onSwap: (id: string) => void;
  onUsageChange: (id: string, next: Usage) => void;
  onRetime: (id: string, usage: Usage, timeKey: number) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onAddVariety: (sourceHop: Hop) => void;
  /** Per-hop hover-trigger props from `useHopHoverPreview`. Takes the
   *  whole Hop so the row can fall back to recipe-side data (flavor +
   *  alpha) when the hop's name isn't in the live library. */
  getHoverTriggerProps: (hop: Hop) => HopHoverTriggerProps;
}) {
  const groups = buildHopGroups(
    hops,
    groupMode,
    og,
    batchVolumeGal,
    boilGravity,
    boilTimeMin,
    assignments
  );
  const grandIbu = groups.reduce((sum, g) => sum + g.totalIbu, 0);

  // After each render, equalize input widths per column across the whole
  // section so weight/time boxes are compact but match down the column.
  const groupsRef = useRef<HTMLDivElement>(null);
  useIsoLayoutEffect(() => {
    equalizeInputWidths(groupsRef.current);
  });

  // Drag-to-retime: dropping a row onto another use-time section adopts that
  // section's usage + time. Mouse needs an 8px travel and touch a press-hold,
  // so clicking the row's inputs and scrolling with a finger still work.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );
  const [activeHop, setActiveHop] = useState<Hop | null>(null);
  const handleDragStart = (e: DragStartEvent) => {
    setActiveHop(hops.find((h) => h.id === e.active.id) ?? null);
  };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveHop(null);
    const data = e.over?.data.current as
      | { usage?: Usage; timeKey?: number }
      | undefined;
    if (!data || data.usage === undefined || data.timeKey === undefined) return;
    onRetime(String(e.active.id), data.usage, data.timeKey);
  };

  // One LedgerRow (motion-wrapped). The per-hop IBU is recomputed here so the
  // row readout matches the group + grand subtotals exactly. `draggable` is on
  // for use-time rows (retiming) and off for the variety singles table.
  const renderRow = (h: Hop, isLast: boolean, draggable: boolean) => {
    const ibuContribution = recipeCalculationService.calculateSingleHopIBU(
      h,
      og,
      batchVolumeGal,
      boilGravity,
      boilTimeMin
    );
    return (
      <LedgerRowMotion key={h.id}>
        <LedgerRow
          hop={h}
          ibuContribution={ibuContribution}
          isLast={isLast}
          draggable={draggable}
          boilTimeMin={boilTimeMin}
          onExtendBoil={onExtendBoil}
          onGramsChange={(v) => onGramsChange(h.id, v)}
          onTimeMinutesChange={(v) => onTimeMinutesChange(h.id, v)}
          onTemperatureChange={(v) => onTemperatureChange(h.id, v)}
          onWhirlpoolTimeChange={(v) => onWhirlpoolTimeChange(h.id, v)}
          onDryHopDaysChange={(v) => onDryHopDaysChange(h.id, v)}
          onDryHopStartDayChange={(v) => onDryHopStartDayChange(h.id, v)}
          onSwap={() => onSwap(h.id)}
          onUsageChange={(next) => onUsageChange(h.id, next)}
          onRemove={() => onRemove(h.id)}
          hoverProps={getHoverTriggerProps(h)}
        />
      </LedgerRowMotion>
    );
  };

  // Variety-mode row: drops the per-row name + radar (those live big in the
  // card's left rail) and leads with what the addition is used for.
  const renderVarietyRow = (h: Hop, isLast: boolean) => {
    const ibuContribution = recipeCalculationService.calculateSingleHopIBU(
      h,
      og,
      batchVolumeGal,
      boilGravity,
      boilTimeMin
    );
    return (
      <LedgerRowMotion key={h.id}>
        <VarietyRow
          hop={h}
          ibuContribution={ibuContribution}
          isLast={isLast}
          boilTimeMin={boilTimeMin}
          onExtendBoil={onExtendBoil}
          onGramsChange={(v) => onGramsChange(h.id, v)}
          onTimeMinutesChange={(v) => onTimeMinutesChange(h.id, v)}
          onTemperatureChange={(v) => onTemperatureChange(h.id, v)}
          onWhirlpoolTimeChange={(v) => onWhirlpoolTimeChange(h.id, v)}
          onDryHopDaysChange={(v) => onDryHopDaysChange(h.id, v)}
          onDryHopStartDayChange={(v) => onDryHopStartDayChange(h.id, v)}
          onUsageChange={(next) => onUsageChange(h.id, next)}
          onRemove={() => onRemove(h.id)}
        />
      </LedgerRowMotion>
    );
  };

  return (
    <>
      {/* Each group is its own bounded card (border + radius). Use-time groups
          are vertical tables; variety groups put a big title + radar in a left
          rail with the additions beside it. A grand-total band closes the
          stack. On mobile .hs-hops-ledger borders are stripped (see styles);
          the per-group bands carry the separation instead. */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveHop(null)}
      >
        <div
          ref={groupsRef}
          className="hs-hops-groups"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          {groupMode === "variety"
            ? (() => {
                // A variety earns the big rail card only once it has 2+
                // additions; one-off varieties stay as plain rows in a shared
                // "Single additions" table (no oversized radar for a lone hop).
                const multis = groups.filter((g) => g.hops.length >= 2);
                const singles = groups
                  .filter((g) => g.hops.length === 1)
                  .sort((a, b) => brewDayCompare(a.hops[0], b.hops[0]));
                return (
                  <>
                    {multis.map((group) => (
                      <VarietyGroupCard
                        key={group.key}
                        group={group}
                        renderVarietyRow={renderVarietyRow}
                        onAddVariety={onAddVariety}
                      />
                    ))}
                    {singles.length > 0 ? (
                      <SinglesTableCard
                        singles={singles}
                        renderRow={renderRow}
                      />
                    ) : null}
                  </>
                );
              })()
            : groups.map((group) => (
                <UseTimeGroupCard
                  key={group.key}
                  group={group}
                  renderRow={renderRow}
                />
              ))}
          <GrandHopTotal
            entries={hops.length}
            totalGrams={totalGrams}
            totalIbu={grandIbu}
          />
        </div>
        <DragOverlay dropAnimation={null}>
          {activeHop ? <DragRowPreview hop={activeHop} /> : null}
        </DragOverlay>
      </DndContext>
      <MobileAddRow onAdd={onAdd} />
    </>
  );
}

/** Floating preview shown under the cursor while dragging a row. */
function DragRowPreview({ hop }: { hop: Hop }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh3,
        cursor: "grabbing",
        transform: "rotate(-1.5deg)",
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 16,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        {hop.name}
      </span>
      <span
        style={{
          fontFamily: hsTokens.script,
          fontSize: 14,
          color: hsTokens.muted,
        }}
      >
        drop on a section to retime
      </span>
    </div>
  );
}

// ─── Group cards (use-time tables / variety left-rail layout) ──────

const GROUP_CARD_STYLE: CSSProperties = {
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: 14,
  boxShadow: hsTokens.sh3,
  overflow: "hidden",
};

/** Use & time group: a vertical table — title band, its own column header,
 *  rows, then a subtotal row at the bottom. Doubles as a drop target: a row
 *  dragged in adopts this section's usage + time. */
function UseTimeGroupCard({
  group,
  renderRow,
}: {
  group: HopGroup;
  renderRow: (h: Hop, isLast: boolean, draggable: boolean) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: group.key,
    data: { usage: group.usage, timeKey: group.timeKey },
  });
  return (
    <div
      ref={setNodeRef}
      className="hs-hops-ledger"
      style={{
        ...GROUP_CARD_STYLE,
        border: `2px solid ${isOver ? hsTokens.hops : hsTokens.ink}`,
        boxShadow: isOver
          ? `0 0 0 3px color-mix(in srgb, ${hsTokens.hops} 30%, transparent), ${hsTokens.sh3}`
          : GROUP_CARD_STYLE.boxShadow,
        transition: "box-shadow 120ms ease, border-color 120ms ease",
      }}
    >
      <GroupTitleBand label={group.label} sublabel={group.sublabel} />
      <LedgerHead />
      <LedgerRowsAnimated>
        {group.hops.map((h, i) =>
          renderRow(h, i === group.hops.length - 1, true)
        )}
      </LedgerRowsAnimated>
      <LedgerTotal
        entries={group.hops.length}
        totalGrams={group.totalGrams}
        totalIbu={group.totalIbu}
        label="Subtotal"
      />
    </div>
  );
}

/** Shared table collecting one-off varieties — each renders as a plain row
 *  (name + radar + use/time/weight/IBU), the "old way" before a variety grows
 *  into its own rail card. */
function SinglesTableCard({
  singles,
  renderRow,
}: {
  singles: HopGroup[];
  renderRow: (h: Hop, isLast: boolean, draggable: boolean) => ReactNode;
}) {
  const totalGrams = singles.reduce((s, g) => s + g.totalGrams, 0);
  const totalIbu = singles.reduce((s, g) => s + g.totalIbu, 0);
  return (
    <div className="hs-hops-ledger" style={GROUP_CARD_STYLE}>
      <GroupTitleBand
        label="Single additions"
        sublabel={`${singles.length} ${
          singles.length === 1 ? "variety" : "varieties"
        }`}
      />
      <LedgerHead />
      <LedgerRowsAnimated>
        {singles.map((g, i) =>
          renderRow(g.hops[0], i === singles.length - 1, false)
        )}
      </LedgerRowsAnimated>
      <LedgerTotal
        entries={singles.length}
        totalGrams={totalGrams}
        totalIbu={totalIbu}
        label="Subtotal"
      />
    </div>
  );
}

/** Slim band naming a group — title (+ timing sublabel) on the section's hops
 *  tint, matching the single-color tinting of the other builder sections.
 *  Stays visible on mobile (unlike the column header) so each section keeps
 *  its label when the table collapses to per-hop cards. */
function GroupTitleBand({
  label,
  sublabel,
}: {
  label: string;
  sublabel?: string;
}) {
  return (
    <div
      className="hs-hops-group-title"
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 9,
        padding: "9px 16px",
        background: "color-mix(in srgb, var(--hs-cream) 94%, var(--hs-hops))",
        borderBottom: `2px solid ${hsTokens.ink}`,
      }}
    >
      <span
        title={label}
        style={{
          fontFamily: hsTokens.display,
          fontSize: 17,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
          lineHeight: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          minWidth: 0,
        }}
      >
        {label}
      </span>
      {sublabel ? (
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 15,
            color: hsTokens.muted,
            transform: "rotate(-1deg)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

// ─── Variety group (left rail + additions table) ──────────────────

/** Right-table columns for a variety card: use | time | weight | IBU | ×. */
const VARIETY_COLS = "minmax(110px, 1fr) minmax(110px, 1fr) 92px 64px 32px";

/** Variety group: the variety's identity (big title + radar + AA/adds) lives
 *  in a left rail; every addition of that variety sits beside it as a row that
 *  leads with what it's used for. */
function VarietyGroupCard({
  group,
  renderVarietyRow,
  onAddVariety,
}: {
  group: HopGroup;
  renderVarietyRow: (h: Hop, isLast: boolean) => ReactNode;
  onAddVariety: (sourceHop: Hop) => void;
}) {
  const firstHop = group.hops[0];
  const flavor = firstHop
    ? firstHop.flavor ??
      hopEnrichmentService.getFlavorByName(firstHop.name) ??
      null
    : null;
  const aa = firstHop?.alphaAcid ?? 0;
  const count = group.hops.length;

  return (
    <div
      className="hs-hops-ledger hs-hops-variety-card"
      style={GROUP_CARD_STYLE}
    >
      <div
        className="hs-hops-variety-layout"
        style={{ display: "flex", alignItems: "stretch" }}
      >
        {/* Left rail — variety identity. */}
        <aside
          className="hs-hops-variety-aside"
          style={{
            width: 200,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "16px 16px 18px",
            background: hsTokens.paper,
            borderRight: `2px solid ${hsTokens.ink}`,
          }}
        >
          <span
            title={group.label}
            style={{
              fontFamily: hsTokens.display,
              fontSize: 22,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: hsTokens.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
              alignSelf: "stretch",
              textAlign: "center",
            }}
          >
            {group.label}
          </span>

          {/* Radar sits directly on the rail. The container is positioned +
              flex:1 so the absolutely-positioned svg robustly fills the rail's
              slack (percentage heights resolve against an abs-positioned
              container), scaling the radar with the row count — compact for a
              2-row variety, large for a tall one, no dead space. */}
          <div
            style={{
              flex: 1,
              minHeight: 104,
              alignSelf: "stretch",
              position: "relative",
            }}
          >
            {flavor ? (
              <RowHoverMiniRadar
                flavor={flavor}
                color={group.accentColor}
                fill
              />
            ) : (
              <p
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: hsTokens.script,
                  fontSize: 14,
                  color: hsTokens.muted,
                  textAlign: "center",
                  margin: 0,
                  padding: "0 10px",
                  lineHeight: 1.35,
                }}
              >
                no flavor data for this variety
              </p>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "6px 14px",
              paddingTop: 2,
            }}
          >
            <SubStat value={aa.toFixed(1)} unit="% AA" />
            <SubStat value={String(count)} unit={count === 1 ? "add" : "adds"} />
          </div>
        </aside>

        {/* Right — the additions table. */}
        <div
          className="hs-hops-variety-main"
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <VarietyColumnHead
            onAdd={firstHop ? () => onAddVariety(firstHop) : undefined}
            varietyLabel={group.label}
          />
          <LedgerRowsAnimated>
            {group.hops.map((h, i) =>
              renderVarietyRow(h, i === group.hops.length - 1)
            )}
          </LedgerRowsAnimated>
          <VarietyTotalRow group={group} />
        </div>
      </div>
    </div>
  );
}

function VarietyColumnHead({
  onAdd,
  varietyLabel,
}: {
  onAdd?: () => void;
  varietyLabel?: string;
}) {
  return (
    <div
      className="hs-hops-ledger-row hs-hops-ledger-head-row"
      style={{
        display: "grid",
        gridTemplateColumns: VARIETY_COLS,
        padding: "10px 14px",
        background: "color-mix(in srgb, var(--hs-cream) 96%, var(--hs-hops))",
        borderBottom: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 12,
      }}
    >
      <Eyebrow size={10} style={{ display: "block", textAlign: "center" }}>
        Use
      </Eyebrow>
      <Eyebrow size={10} style={{ display: "block", textAlign: "center" }}>
        Time
      </Eyebrow>
      <Eyebrow
        size={10}
        style={{ display: "block", textAlign: "center", paddingRight: 28 }}
      >
        Weight
      </Eyebrow>
      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: IBU_CELL_BG,
          padding: "10px 12px",
          margin: "-10px -12px",
        }}
      >
        <Eyebrow size={10} style={{ letterSpacing: "0.18em" }}>
          IBU
        </Eyebrow>
      </div>
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          aria-label={
            varietyLabel
              ? `Add another addition of ${varietyLabel}`
              : "Add another addition of this variety"
          }
          title={
            varietyLabel
              ? `Add another addition of ${varietyLabel}`
              : "Add another addition"
          }
          style={{
            justifySelf: "center",
            width: 24,
            height: 24,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: hsTokens.paper,
            color: hsTokens.hops,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            boxShadow: hsTokens.sh1,
            cursor: "pointer",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function VarietyRow({
  hop,
  ibuContribution,
  isLast,
  boilTimeMin,
  onExtendBoil,
  onGramsChange,
  onTimeMinutesChange,
  onTemperatureChange,
  onWhirlpoolTimeChange,
  onDryHopDaysChange,
  onDryHopStartDayChange,
  onUsageChange,
  onRemove,
}: {
  hop: Hop;
  ibuContribution: number;
  isLast: boolean;
  boilTimeMin: number;
  onExtendBoil: (newBoilMin: number) => void;
  onGramsChange: (v: number) => void;
  onTimeMinutesChange: (v: number) => void;
  onTemperatureChange: (v: number) => void;
  onWhirlpoolTimeChange: (v: number) => void;
  onDryHopDaysChange: (v: number) => void;
  onDryHopStartDayChange: (v: number) => void;
  onUsageChange: (next: Usage) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="hs-hops-ledger-row hs-hops-variety-row"
      style={{
        display: "grid",
        gridTemplateColumns: VARIETY_COLS,
        padding: "14px 14px",
        borderBottom: isLast ? "none" : `1px solid ${hsTokens.ink}22`,
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <UsageSelect usage={hop.type} onChange={onUsageChange} />
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <TimingCell
          hop={hop}
          boilTimeMin={boilTimeMin}
          onExtendBoil={onExtendBoil}
          onTimeMinutesChange={onTimeMinutesChange}
          onTemperatureChange={onTemperatureChange}
          onWhirlpoolTimeChange={onWhirlpoolTimeChange}
          onDryHopDaysChange={onDryHopDaysChange}
          onDryHopStartDayChange={onDryHopStartDayChange}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={hop.grams}
          step={1}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="g"
          ariaLabel="Hop weight in grams"
          onCommit={onGramsChange}
          colKey="weight"
        />
      </div>
      <div
        className="hs-hops-ibu-cell"
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: IBU_CELL_BG,
          padding: "14px 12px",
          margin: "-14px -12px",
        }}
        title="Estimated IBU contribution from this addition"
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 18,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            color: ibuContribution > 0.05 ? hsTokens.ink : hsTokens.muted,
            lineHeight: 1,
          }}
        >
          {ibuContribution > 0.05 ? ibuContribution.toFixed(1) : "—"}
        </span>
      </div>
      <button
        type="button"
        className="hs-hops-remove-btn"
        onClick={onRemove}
        aria-label={`Remove ${hop.name} (${USAGE_LABEL[hop.type]})`}
        style={{
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
    </div>
  );
}

/** Subtotal row closing a variety card's additions table. */
function VarietyTotalRow({ group }: { group: HopGroup }) {
  return (
    <div
      className="hs-hops-ledger-row hs-hops-variety-total"
      style={{
        display: "grid",
        gridTemplateColumns: VARIETY_COLS,
        padding: "12px 14px",
        background: "color-mix(in srgb, var(--hs-cream-2) 96%, var(--hs-hops))",
        borderTop: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 15,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        Subtotal
      </span>
      <span />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 18,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
              color: hsTokens.ink,
            }}
          >
            {group.totalGrams.toFixed(0)}
          </span>
          <span
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            g
          </span>
        </span>
      </div>
      <div
        className="hs-hops-ibu-cell"
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "color-mix(in srgb, color-mix(in srgb, var(--hs-ink) 9%, var(--hs-cream-2)) 96%, var(--hs-hops))",
          padding: "12px",
          margin: "-12px",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 18,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            color: hsTokens.ink,
          }}
        >
          {group.totalIbu.toFixed(0)}
        </span>
      </div>
      <span />
    </div>
  );
}

function SubStat({ value, unit }: { value: string; unit: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 15,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{ fontFamily: hsTokens.mono, fontSize: 10, color: hsTokens.muted }}
      >
        {unit}
      </span>
    </span>
  );
}

function LedgerHead() {
  return (
    <div
      className="hs-hops-ledger-row hs-hops-ledger-head-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "10px 14px 10px 18px",
        // Section-tinted column header — hops green, like every other builder
        // section tints its own furniture with its single section color.
        background: "color-mix(in srgb, var(--hs-cream) 96%, var(--hs-hops))",
        borderBottom: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 12,
      }}
    >
      <Eyebrow size={9} style={{ display: "block", textAlign: "center" }}>
        Flavor
      </Eyebrow>
      <Eyebrow size={10}>
        Hop
        <span
          style={{
            color: hsTokens.ink,
            opacity: 0.4,
            marginLeft: 8,
            fontWeight: 600,
            textTransform: "none",
            letterSpacing: "0.04em",
            fontSize: 10,
          }}
        >
          click name to swap
        </span>
      </Eyebrow>
      <Eyebrow size={10} style={{ display: "block", textAlign: "center" }}>
        Use
      </Eyebrow>
      <Eyebrow size={10} style={{ display: "block", textAlign: "center" }}>
        Time
      </Eyebrow>
      <Eyebrow
        size={10}
        style={{ display: "block", textAlign: "center", paddingRight: 28 }}
      >
        Weight
      </Eyebrow>
      {/* Wrapper div carries the IBU bg + alignSelf stretch so the colored
          band fills the head's full vertical extent (matching the data + total
          rows). Negative horizontal margins consume the full column gap on
          each side. */}
      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: IBU_CELL_BG,
          padding: "10px 12px",
          margin: "-10px -12px",
        }}
      >
        <Eyebrow size={10} style={{ letterSpacing: "0.18em" }}>
          IBU
        </Eyebrow>
      </div>
      <span />
    </div>
  );
}

function LedgerRow({
  hop,
  ibuContribution,
  isLast,
  draggable,
  boilTimeMin,
  onExtendBoil,
  onGramsChange,
  onTimeMinutesChange,
  onTemperatureChange,
  onWhirlpoolTimeChange,
  onDryHopDaysChange,
  onDryHopStartDayChange,
  onSwap,
  onUsageChange,
  onRemove,
  hoverProps,
}: {
  hop: Hop;
  ibuContribution: number;
  isLast: boolean;
  draggable: boolean;
  boilTimeMin: number;
  onExtendBoil: (newBoilMin: number) => void;
  onGramsChange: (v: number) => void;
  onTimeMinutesChange: (v: number) => void;
  onTemperatureChange: (v: number) => void;
  onWhirlpoolTimeChange: (v: number) => void;
  onDryHopDaysChange: (v: number) => void;
  onDryHopStartDayChange: (v: number) => void;
  onSwap: () => void;
  onUsageChange: (next: Usage) => void;
  onRemove: () => void;
  hoverProps: HopHoverTriggerProps;
}) {
  const purpose = purposeOf(hop.alphaAcid);
  const hopFlavor =
    hop.flavor ?? hopEnrichmentService.getFlavorByName(hop.name) ?? null;
  // Whole row is the drag activator (a row dragged onto another section
  // retimes). Mouse/touch sensors only start a drag after travel/press-hold,
  // so the inner inputs and buttons still take clicks.
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: hop.id,
    disabled: !draggable,
  });
  return (
    <div
      ref={setNodeRef}
      className="hs-hops-ledger-row hs-hops-data-row"
      {...(draggable ? listeners : {})}
      {...hoverProps}
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 14px 14px 18px",
        borderBottom: isLast ? "none" : `1px solid ${hsTokens.ink}22`,
        alignItems: "center",
        gap: 12,
        cursor: draggable ? "grab" : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* Per-hop mini flavor radar — replaces the colored use-badge.
          The hover trigger is on the row, not the radar specifically,
          so any cursor inside the row surfaces the preview (after the
          300ms dwell — quick edits don't fire it). */}
      <div className="hs-hops-radar-cell">
        <RowMiniRadar flavor={hopFlavor} hopName={hop.name} />
      </div>

      {/* Hop name — click to swap */}
      <button
        type="button"
        className="hs-hops-name-btn"
        onClick={onSwap}
        aria-label={`Swap ${hop.name}`}
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
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            <span
              className="hs-hops-name"
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
              title={hop.name}
            >
              {hop.name}
            </span>
            <PurposePill purpose={purpose} />
          </div>
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 14,
              color: hsTokens.muted,
              transform: "rotate(-1deg)",
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {hop.alphaAcid.toFixed(1)}% AA
          </span>
        </div>
      </button>

      {/* Use selector — styled pill with portal'd menu. */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <UsageSelect usage={hop.type} onChange={onUsageChange} />
      </div>

      {/* Timing — varies by usage type */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <TimingCell
          hop={hop}
          boilTimeMin={boilTimeMin}
          onExtendBoil={onExtendBoil}
          onTimeMinutesChange={onTimeMinutesChange}
          onTemperatureChange={onTemperatureChange}
          onWhirlpoolTimeChange={onWhirlpoolTimeChange}
          onDryHopDaysChange={onDryHopDaysChange}
          onDryHopStartDayChange={onDryHopStartDayChange}
        />
      </div>

      {/* Weight (always editable) */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={hop.grams}
          step={1}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="g"
          ariaLabel="Hop weight in grams"
          onCommit={onGramsChange}
          colKey="weight"
        />
      </div>

      {/* IBU contribution — skinny darker readout cell. Negative horizontal
          margins (-12px each side) consume the full row column-gap so the
          tinted bg meets the Weight cell's right edge and the Actions cell's
          left edge. alignSelf stretch + the negative vertical margin makes
          the cell fill the row's full height (overriding the row's
          align-items: center which would otherwise center-shrink the cell). */}
      <div
        className="hs-hops-ibu-cell"
        style={{
          alignSelf: "stretch",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: IBU_CELL_BG,
          padding: "14px 12px",
          margin: "-14px -12px",
        }}
        title={`Estimated IBU contribution from this addition`}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 18,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            color: ibuContribution > 0.05 ? hsTokens.ink : hsTokens.muted,
            lineHeight: 1,
          }}
        >
          {ibuContribution > 0.05 ? ibuContribution.toFixed(1) : "—"}
        </span>
      </div>

      {/* Remove — ghost × that fades in on row hover. */}
      <button
        type="button"
        className="hs-hops-remove-btn"
        onClick={onRemove}
        aria-label={`Remove ${hop.name}`}
        style={{
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
    </div>
  );
}

/** Grand total — clean like the fermentables grain total (a top rule, no
 *  tinted band) but laid out on the ledger grid so its weight + IBU line up
 *  under those columns. Carries the total-row class so it collapses to a tidy
 *  3-cell row on mobile. */
function GrandHopTotal({
  entries,
  totalGrams,
  totalIbu,
}: {
  entries: number;
  totalGrams: number;
  totalIbu: number;
}) {
  const stat = (value: string, unit: string) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 20,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        {value}
      </span>
      <span
        style={{ fontFamily: hsTokens.mono, fontSize: 11, color: hsTokens.muted }}
      >
        {unit}
      </span>
    </span>
  );
  return (
    <div
      className="hs-hops-ledger-row hs-hops-total-row"
      style={{
        // Match the card rows' inner inset (2px border + 18/14 padding) so the
        // columns line up across the section.
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "16px 16px 16px 20px",
        borderTop: `2px solid ${hsTokens.ink}`,
        background: "transparent",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span />
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 18,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
          whiteSpace: "nowrap",
        }}
      >
        Total hops
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 400,
            color: hsTokens.muted,
            marginLeft: 8,
          }}
        >
          {entries} addition{entries === 1 ? "" : "s"}
        </span>
      </span>
      <span />
      <span />
      <div style={{ display: "flex", justifyContent: "center" }}>
        {stat(totalGrams.toFixed(0), "g")}
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        {stat(totalIbu.toFixed(0), "IBU")}
      </div>
      <span />
    </div>
  );
}

function LedgerTotal({
  totalGrams,
  totalIbu,
  entries,
  label = "Total hops",
}: {
  totalGrams: number;
  totalIbu: number;
  entries: number;
  label?: string;
}) {
  return (
    <div
      className="hs-hops-ledger-row hs-hops-total-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 14px 14px 18px",
        // Section-tinted total band — same 7% hops mix as the ledger head.
        background: "color-mix(in srgb, var(--hs-cream-2) 96%, var(--hs-hops))",
        borderTop: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          color: hsTokens.muted,
          textAlign: "center",
        }}
      >
        {entries}
      </span>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 16,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        {label}
      </span>
      <span />
      <span />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 20,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
              color: hsTokens.ink,
            }}
          >
            {totalGrams.toFixed(0)}
          </span>
          <span
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            g
          </span>
        </span>
      </div>
      <div
        className="hs-hops-ibu-cell"
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Section-tinted darker stripe: ~4% hops layered onto the ink-on-cream2
          // base so the column reads as "this section's read-only column".
          background: "color-mix(in srgb, color-mix(in srgb, var(--hs-ink) 9%, var(--hs-cream-2)) 96%, var(--hs-hops))",
          padding: "14px 12px",
          margin: "-14px -12px",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 20,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            color: hsTokens.ink,
          }}
        >
          {totalIbu.toFixed(0)}
        </span>
      </div>
      <span />
    </div>
  );
}

// ─── Usage select (pill dropdown) ────────────────────────────────

/** Bespoke select-style menu (not HSActionMenu) — the shared primitive uses
 *  position: absolute which gets clipped by the ledger's overflow: hidden.
 *  This variant portals the panel to document.body and positions via fixed
 *  coords from the trigger's getBoundingClientRect. Renders as a normal
 *  dropdown pill (colored dot + label + caret), not a colored square. */
function UsageSelect({
  usage,
  onChange,
}: {
  usage: Usage;
  onChange: (next: Usage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const color = USAGE_COLOR[usage];

  // Open: compute fixed coords from the trigger rect.
  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  };

  // Outside click + ESC + scroll-close.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onScrollOrResize = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 6, left: rect.left });
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Change use (currently ${USAGE_LABEL[usage]})`}
        title={`Use: ${USAGE_LABEL[usage]}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px 6px 10px",
          background: hsTokens.cream2,
          color: hsTokens.ink,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 999,
          boxShadow: hsTokens.sh1,
          cursor: "pointer",
          minWidth: 100,
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: color,
              border: `1.5px solid ${hsTokens.ink}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 12,
              fontWeight: 600,
              color: hsTokens.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {USAGE_LABEL[usage]}
          </span>
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ color: hsTokens.muted, flexShrink: 0 }}
        >
          <path d="M1 1 5 5 9 1" />
        </svg>
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            // .hs-theme wrapper ensures CSS custom properties (var(--hs-paper)
            // etc.) cascade into the portal. Without it, the panel can render
            // with no background when the theme class lives deeper in the tree
            // than the portal target. Literal hex fallback on the bg as a
            // belt-and-braces guard.
            <div
              className="hs-theme"
              ref={panelRef}
              role="menu"
              aria-label="Change hop use"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                minWidth: 168,
                background: "#f8f3dc",
                backgroundColor: "var(--hs-paper, #f8f3dc)",
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 8,
                boxShadow: hsTokens.sh2,
                zIndex: 200,
                overflow: "hidden",
                fontFamily: hsTokens.body,
              }}
            >
              {USAGE_ORDER.map((u) => {
                const active = u === usage;
                return (
                  <button
                    key={u}
                    type="button"
                    role="menuitem"
                    disabled={active}
                    onClick={() => {
                      if (!active) onChange(u);
                      setOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (active) return;
                      e.currentTarget.style.background = hsTokens.cream2;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      background: "transparent",
                      color: hsTokens.ink,
                      border: "none",
                      cursor: active ? "default" : "pointer",
                      opacity: active ? 0.55 : 1,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: USAGE_COLOR[u],
                        border: `1.5px solid ${hsTokens.ink}`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1 }}>{USAGE_LABEL[u]}</span>
                    {active ? (
                      <span
                        style={{
                          fontFamily: hsTokens.mono,
                          fontSize: 9,
                          color: hsTokens.muted,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        current
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

// ─── Per-row mini hop flavor radar ────────────────────────────────

/** Tiny inline SVG (~44px) showing THIS hop's flavor polygon. Replaces the
 *  colored use-square as the leftmost column. Hovering it shows a larger
 *  cursor-follow flavor preview (mirroring the modal's preset preview). */
function RowMiniRadar({
  flavor,
  hopName,
}: {
  flavor: HopFlavorProfile | null;
  hopName: string;
}) {
  const size = 44;
  const pad = 4;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;

  if (!flavor) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        focusable="false"
      >
        <title>No flavor data</title>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          opacity={0.35}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: hsTokens.script,
            fontSize: 14,
            fill: hsTokens.muted,
          }}
        >
          ?
        </text>
      </svg>
    );
  }

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / 5) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const ringPoints = HOP_FLAVOR_KEYS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
  const polyPoints = HOP_FLAVOR_KEYS.map((k, i) =>
    pointAt(i, flavor[k] ?? 0).join(",")
  ).join(" ");

  let bestKey: (typeof HOP_FLAVOR_KEYS)[number] = HOP_FLAVOR_KEYS[0];
  let bestV = -1;
  for (const k of HOP_FLAVOR_KEYS) {
    const v = flavor[k] ?? 0;
    if (v > bestV) {
      bestV = v;
      bestKey = k;
    }
  }
  const color = HOP_FLAVOR_COLOR[bestKey] ?? hsTokens.hops;

  return (
    <button
      type="button"
      aria-label={`${hopName} flavor profile`}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: "default",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        focusable="false"
      >
        <polygon
          points={ringPoints}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
          opacity={0.25}
        />
        <polygon
          points={polyPoints}
          fill={color}
          fillOpacity={0.32}
          stroke={color}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─── Timing cell (per-row, shapeshifts by usage type) ─────────────

function TimingCell({
  hop,
  boilTimeMin,
  onExtendBoil,
  onTimeMinutesChange,
  onTemperatureChange,
  onWhirlpoolTimeChange,
  onDryHopDaysChange,
  onDryHopStartDayChange,
}: {
  hop: Hop;
  boilTimeMin: number;
  onExtendBoil: (newBoilMin: number) => void;
  onTimeMinutesChange: (v: number) => void;
  onTemperatureChange: (v: number) => void;
  onWhirlpoolTimeChange: (v: number) => void;
  onDryHopDaysChange: (v: number) => void;
  onDryHopStartDayChange: (v: number) => void;
}) {
  if (hop.type === "boil") {
    return (
      <BoilTimingCell
        hop={hop}
        boilTimeMin={boilTimeMin}
        onExtendBoil={onExtendBoil}
        onTimeMinutesChange={onTimeMinutesChange}
      />
    );
  }
  if (hop.type === "whirlpool") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          alignItems: "flex-start",
        }}
      >
        <EditableCell
          value={hop.whirlpoolTimeMinutes ?? 15}
          step={5}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="min"
          ariaLabel="Whirlpool time in minutes"
          onCommit={onWhirlpoolTimeChange}
          compact
          colKey="time"
        />
        <EditableCell
          value={hop.temperatureC ?? 80}
          step={5}
          min={40}
          max={100}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="°C"
          ariaLabel="Whirlpool temperature"
          onCommit={onTemperatureChange}
          compact
          muted
          colKey="time"
        />
      </div>
    );
  }
  if (hop.type === "dry hop") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          alignItems: "flex-start",
        }}
      >
        <EditableCell
          value={hop.dryHopDays ?? 3}
          step={1}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="days"
          ariaLabel="Dry hop duration in days"
          onCommit={onDryHopDaysChange}
          compact
          colKey="time"
        />
        <EditableCell
          value={hop.dryHopStartDay ?? 0}
          step={1}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="day in"
          ariaLabel="Dry hop start day"
          onCommit={onDryHopStartDayChange}
          compact
          muted
          colKey="time"
        />
      </div>
    );
  }
  // first wort or mash — no timing
  return (
    <span
      style={{
        fontFamily: hsTokens.script,
        fontSize: 17,
        color: hsTokens.muted,
        transform: "rotate(-1deg)",
        display: "inline-block",
        opacity: 0.85,
      }}
      title={
        hop.type === "first wort"
          ? "Added before boil — no timing"
          : "Added to mash — no timing"
      }
    >
      no timing
    </span>
  );
}

/** Boil-time cell with an over-boil floating warning. Split out from TimingCell
 *  so hooks (anchor ref) only run on the boil branch — the timing column
 *  shapeshifts between usages, so the cell-level wrapper keeps hook calls
 *  unconditional per render. */
function BoilTimingCell({
  hop,
  boilTimeMin,
  onExtendBoil,
  onTimeMinutesChange,
}: {
  hop: Hop;
  boilTimeMin: number;
  onExtendBoil: (newBoilMin: number) => void;
  onTimeMinutesChange: (v: number) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const hopMin = hop.timeMinutes ?? 0;
  const overBoil = hopMin > boilTimeMin;
  return (
    <div ref={anchorRef} style={{ display: "inline-flex" }}>
      <EditableCell
        value={hopMin}
        step={5}
        min={0}
        precision={0}
        format={(v) => v.toFixed(0)}
        suffix="min"
        ariaLabel="Boil time in minutes"
        onCommit={onTimeMinutesChange}
        colKey="time"
      />
      {overBoil ? (
        <OverBoilWarning
          hopMin={hopMin}
          boilMin={boilTimeMin}
          onExtend={() => onExtendBoil(hopMin)}
          anchorRef={anchorRef}
        />
      ) : null}
    </div>
  );
}

/** Floating note shown beside a boil hop's time when the addition is scheduled
 *  longer than the boil itself. Portaled to document.body so the group card's
 *  overflow:hidden (it clips children for rounded corners) doesn't cut it off.
 *  Position is synced to the anchor cell each frame so it tracks through the
 *  row's framer-motion enter/exit transitions. Clicking extends the boil to
 *  match — the explicit fix beats silently mutating boilTimeMin behind the
 *  user's back (it drives boil-off, pre-boil volume, and OG math). */
function OverBoilWarning({
  hopMin,
  boilMin,
  onExtend,
  anchorRef,
}: {
  hopMin: number;
  boilMin: number;
  onExtend: () => void;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const noteRef = useRef<HTMLButtonElement>(null);

  useIsoLayoutEffect(() => {
    let frame = 0;
    let lastTop = -1;
    let lastLeft = -1;
    const tick = () => {
      const a = anchorRef.current;
      const n = noteRef.current;
      if (a && n) {
        const r = a.getBoundingClientRect();
        // Document-relative coords (viewport rect + scroll offset) so the
        // note — portaled to body with position: absolute — scrolls with the
        // page naturally. Using fixed + viewport coords forces a per-frame
        // catch-up against scroll, which reads as floaty.
        // Anchor: just inside the cell's left edge, vertically centered. The
        // note's right-center is placed here (see transform) so its body
        // extends LEFT, sitting in front of the boil input's left side.
        const top = r.top + r.height / 2 + window.scrollY;
        const left = r.left + 8 + window.scrollX;
        if (top !== lastTop || left !== lastLeft) {
          n.style.top = `${top}px`;
          n.style.left = `${left}px`;
          lastTop = top;
          lastLeft = left;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [anchorRef]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <button
      ref={noteRef}
      type="button"
      onClick={onExtend}
      className="hs-theme hs-hops-over-boil"
      title={`This addition is ${hopMin} min but the boil is only ${boilMin} min.`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        transform: "translate(-100%, -50%) rotate(-3deg)",
        transformOrigin: "right center",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        padding: "7px 12px 8px",
        background: hsTokens.paper,
        color: hsTokens.roast,
        border: `1.5px solid ${hsTokens.roast}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh2,
        fontFamily: hsTokens.script,
        fontSize: 16,
        lineHeight: 1.1,
        cursor: "pointer",
        zIndex: 1000,
      }}
    >
      <span
        style={{
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textUnderlineOffset: 2,
        }}
      >
        extend boil to {hopMin} min
      </span>
      <span
        aria-hidden
        style={{
          fontFamily: hsTokens.display,
          fontSize: 18,
          lineHeight: 1,
          fontWeight: 700,
        }}
      >
        !
      </span>
    </button>,
    document.body
  );
}

// ─── Purpose pill (aroma / dual / bittering) ──────────────────────

function PurposePill({
  purpose,
}: {
  purpose: "aroma" | "dual" | "bittering";
}) {
  const color =
    purpose === "aroma"
      ? hsTokens.honey
      : purpose === "dual"
        ? hsTokens.hops
        : "#3a6e30";
  const dark = purpose === "bittering";
  const label =
    purpose === "aroma" ? "Aroma" : purpose === "dual" ? "Dual" : "Bittering";
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
        background: color,
        color: dark ? hsTokens.cream : hsTokens.ink,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        whiteSpace: "nowrap",
        lineHeight: 1.1,
        flexShrink: 0,
      }}
    >
      {label}
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
  compact,
  muted,
  colKey,
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
  compact?: boolean;
  muted?: boolean;
  /** Column id (e.g. "weight" / "time") used to equalize input widths across
   *  the section — see equalizeInputWidths. */
  colKey?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Script numerals stay (the hops section's handwritten character) but live
  // in a defined box now — trimmed a touch so the boxed cell isn't oversized.
  const valueFontSize = compact ? (muted ? 17 : 20) : 25;
  const editFontSize = compact ? 19 : 23;

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
    // Wrapper persists across edit/rest so its measured (equalized) width
    // carries over; `data-hop-input` lets equalizeInputWidths size every input
    // in a column to the widest one in the section.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      data-hop-input={colKey}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", display: "inline-flex" }}
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
            width: "100%",
            background: hsTokens.cream,
            border: `1.5px solid ${hsTokens.hops}`,
            outline: "none",
            fontFamily: hsTokens.script,
            fontWeight: 500,
            fontSize: editFontSize,
            color: hsTokens.ink,
            fontVariantNumeric: "tabular-nums",
            textAlign: "left",
            padding: "4px 9px",
            margin: 0,
            appearance: "textfield",
            borderRadius: 7,
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={enterEdit}
            aria-label={`Edit ${format(value)}${suffix ?? ""}`}
            className="hs-hops-edit-btn"
            style={{
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.ink}`,
              padding: "3px 25px 3px 10px",
              margin: 0,
              cursor: "text",
              width: "100%",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 5,
              color: "inherit",
              fontFamily: "inherit",
              borderRadius: 7,
              boxShadow: hsTokens.sh1,
              transition: "background 90ms ease, box-shadow 90ms ease",
            }}
          >
            <span
              style={{
                fontFamily: hsTokens.script,
                fontWeight: 500,
                fontSize: valueFontSize,
                lineHeight: 1.05,
                color: muted ? hsTokens.muted : hsTokens.ink,
                opacity: muted ? 0.92 : 1,
              }}
            >
              {format(value)}
            </span>
            {suffix ? (
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: compact ? 10 : 11,
                  color: hsTokens.muted,
                }}
              >
                {suffix}
              </span>
            ) : null}
          </button>
          <HoverSteppers
            visible={hovered}
            compact={compact}
            onUp={() => nudge(1)}
            onDown={() => nudge(-1)}
          />
        </>
      )}
    </div>
  );
}

// ─── Hover steppers ───────────────────────────────────────────────

function HoverSteppers({
  visible,
  compact,
  onUp,
  onDown,
}: {
  visible: boolean;
  compact?: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div
      className="hs-hops-steppers"
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
      <StepperBtn onClick={onUp} direction="up" label="Increase" compact={compact} />
      <StepperBtn onClick={onDown} direction="down" label="Decrease" compact={compact} />
    </div>
  );
}

function StepperBtn({
  onClick,
  direction,
  label,
  compact,
}: {
  onClick: () => void;
  direction: "up" | "down";
  label: string;
  compact?: boolean;
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
        width: compact ? 14 : 16,
        height: compact ? 12 : 14,
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
        e.currentTarget.style.background = hsTokens.hops;
        e.currentTarget.style.color = hsTokens.cream;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.muted;
      }}
    >
      <svg
        width={compact ? 8 : 10}
        height={compact ? 5 : 6}
        viewBox="0 0 10 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "up" ? <path d="M1 5 5 1 9 5" /> : <path d="M1 1 5 5 9 1" />}
      </svg>
    </button>
  );
}

// ─── Hop flavor radar card (sidebar visualizer) ───────────────────

const HOP_FLAVOR_LABEL: Record<string, string> = {
  citrus: "Citrus",
  tropicalFruit: "Tropical",
  stoneFruit: "Stone fruit",
  berry: "Berry",
  floral: "Floral",
  grassy: "Grassy",
  herbal: "Herbal",
  spice: "Spice",
  resinPine: "Pine",
};

const HOP_FLAVOR_COLOR: Record<string, string> = {
  citrus: "#facc15",
  tropicalFruit: "#fb923c",
  stoneFruit: "#f97316",
  berry: "#a855f7",
  floral: "#f472b6",
  grassy: "#84cc16",
  herbal: "#22c55e",
  spice: "#ef4444",
  resinPine: "#16a34a",
};

/** Distinct palette for individual hop polygons (cycled by index). Chosen
 *  to read against the cream-2 card background and stay visually separable
 *  when 4-6 hops overlap. */
const HOP_SERIES_PALETTE = [
  "#2b6fb8", // water blue
  "#d4452c", // roast red
  "#ee7755", // yeast peach
  "#a855f7", // berry purple
  "#facc15", // citrus yellow
  "#0e7f7a", // teal
];

type RadarMode = "estimated" | "individual" | "both";

interface HopSeries {
  /** Stable id (hop.id for individual entries, "__estimated__" for aggregate). */
  id: string;
  name: string;
  flavor: HopFlavorProfile;
  grams?: number;
  color: string;
  isEstimated: boolean;
}

function HopFlavorRadarCard({
  hops,
  batchVolumeL,
}: {
  hops: Hop[];
  batchVolumeL: number;
}) {
  const [mode, setMode] = useState<RadarMode>("estimated");
  const [hoveredSeriesId, setHoveredSeriesId] = useState<string | null>(null);

  const flavorByName = useMemo(() => {
    const map = new Map<string, HopFlavorProfile>();
    for (const h of hops) {
      const fromInline = h.flavor;
      const fromEnrich = hopEnrichmentService.getFlavorByName(h.name);
      const flavor = fromInline ?? fromEnrich;
      if (flavor) map.set(h.name, flavor);
    }
    return map;
  }, [hops]);

  const aggregateFlavor = useMemo(() => {
    if (flavorByName.size === 0) return null;
    return hopFlavorCalculationService.calculateCombinedFlavor(
      hops,
      flavorByName,
      batchVolumeL
    );
  }, [hops, flavorByName, batchVolumeL]);

  /** Individual hop series — one per UNIQUE variety with flavor data, in
   *  first-seen order. Grams sum across all additions of the same hop so
   *  the legend reads "Citra 49g" not "Citra · Citra · Citra". */
  const individualSeries = useMemo<HopSeries[]>(() => {
    const byName = new Map<
      string,
      { flavor: HopFlavorProfile; totalGrams: number; firstId: string }
    >();
    for (const h of hops) {
      const flavor = flavorByName.get(h.name);
      if (!flavor) continue;
      const existing = byName.get(h.name);
      if (existing) {
        existing.totalGrams += h.grams;
      } else {
        byName.set(h.name, {
          flavor,
          totalGrams: h.grams,
          firstId: h.id,
        });
      }
    }
    const out: HopSeries[] = [];
    let i = 0;
    for (const [name, info] of byName.entries()) {
      out.push({
        id: info.firstId,
        name,
        flavor: info.flavor,
        grams: info.totalGrams,
        color: HOP_SERIES_PALETTE[i % HOP_SERIES_PALETTE.length],
        isEstimated: false,
      });
      i += 1;
    }
    return out;
  }, [hops, flavorByName]);

  const estimatedSeries = useMemo<HopSeries | null>(() => {
    if (!aggregateFlavor) return null;
    return {
      id: "__estimated__",
      name: "Estimated",
      flavor: aggregateFlavor,
      color: hsTokens.hops,
      isEstimated: true,
    };
  }, [aggregateFlavor]);

  // Active series for the current mode. The render layer reads strokes/fills
  // off each series to layer multiple polygons cleanly.
  const activeSeries = useMemo<HopSeries[]>(() => {
    if (!estimatedSeries) return [];
    if (mode === "estimated") return [estimatedSeries];
    if (mode === "individual") return individualSeries;
    // "both": estimated last so it draws ON TOP of individuals (heavier stroke).
    return [...individualSeries, estimatedSeries];
  }, [mode, estimatedSeries, individualSeries]);

  // Dominant contributor per axis (for the hover tooltip).
  const dominantPerAxis = useMemo(() => {
    const out: Record<string, { name: string; value: number } | null> = {};
    for (const k of HOP_FLAVOR_KEYS) out[k] = null;
    if (flavorByName.size === 0) return out;
    for (const h of hops) {
      const profile = flavorByName.get(h.name);
      if (!profile) continue;
      const gpl = batchVolumeL > 0 ? h.grams / batchVolumeL : 0;
      if (gpl <= 0) continue;
      for (const k of HOP_FLAVOR_KEYS) {
        const contrib = (profile[k] ?? 0) * gpl;
        const prior = out[k];
        if (!prior || contrib > prior.value) {
          out[k] = { name: h.name, value: contrib };
        }
      }
    }
    return out;
  }, [hops, flavorByName, batchVolumeL]);

  return (
    <div
      className="hs-hops-radar-card"
      style={{
        // Subtle ingredient tint: ~5% hops-green in the bg AND ~15% mixed
        // into the ink border. Compound signal — neither loud on its own.
        background:
          "color-mix(in srgb, color-mix(in srgb, var(--hs-cream), var(--hs-cream-2)) 95%, var(--hs-hops))",
        border: `2px solid color-mix(in srgb, ${hsTokens.ink} 85%, var(--hs-hops))`,
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
        <Eyebrow size={11}>Flavor profile</Eyebrow>
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
          aroma-weighted
        </span>
        <span aria-hidden style={{ flex: 1 }} />
        {individualSeries.length >= 1 && estimatedSeries ? (
          <RadarModeToggle mode={mode} onChange={setMode} />
        ) : null}
      </div>
      {estimatedSeries ? (
        <>
          <HopFlavorRadarSvg
            series={activeSeries}
            dominantPerAxis={dominantPerAxis}
            mode={mode}
            hoveredSeriesId={hoveredSeriesId}
          />
          <RadarLegend
            mode={mode}
            individualSeries={individualSeries}
            estimatedSeries={estimatedSeries}
            hoveredSeriesId={hoveredSeriesId}
            onHoverSeries={setHoveredSeriesId}
          />
        </>
      ) : (
        <RadarEmpty hops={hops} />
      )}
    </div>
  );
}

/** Segmented toggle (Estimated · All · Both). Mirrors the fermentables
 *  Amount/% ModeToggle shape with a hops-green active state. */
function RadarModeToggle({
  mode,
  onChange,
}: {
  mode: RadarMode;
  onChange: (m: RadarMode) => void;
}) {
  const cellStyle = (active: boolean): CSSProperties => ({
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "4px 9px",
    border: "none",
    background: active ? hsTokens.hops : "transparent",
    color: active ? hsTokens.cream : hsTokens.ink,
    cursor: "pointer",
    transition: "background 120ms ease",
  });
  const opts: Array<{ id: RadarMode; label: string }> = [
    { id: "estimated", label: "Est." },
    { id: "both", label: "Both" },
    { id: "individual", label: "Each" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Radar series mode"
      style={{
        display: "inline-flex",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        overflow: "hidden",
        boxShadow: hsTokens.sh1,
      }}
    >
      {opts.map((o, i) => (
        <span key={o.id} style={{ display: "inline-flex" }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === o.id}
            style={cellStyle(mode === o.id)}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
          {i < opts.length - 1 ? (
            <span
              aria-hidden
              style={{ width: 1.5, background: hsTokens.ink, alignSelf: "stretch" }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** Legend strip below the radar — color swatch + name + grams per series.
 *  Hovering an entry highlights the matching polygon in the radar (bulge +
 *  full opacity) and dims the others. A compact cursor-follow stats card
 *  appears BELOW the cursor (anchored to the cursor's top-center) so it
 *  never covers the radar sitting above the legend. Tilt-on-velocity
 *  plumbing is borrowed from BillStack in FermentableSection. */
function RadarLegend({
  mode,
  individualSeries,
  estimatedSeries,
  hoveredSeriesId,
  onHoverSeries,
}: {
  mode: RadarMode;
  individualSeries: HopSeries[];
  estimatedSeries: HopSeries;
  hoveredSeriesId: string | null;
  onHoverSeries: (id: string | null) => void;
}) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const entries: HopSeries[] =
    mode === "estimated"
      ? [estimatedSeries]
      : mode === "individual"
        ? individualSeries
        : [estimatedSeries, ...individualSeries];

  const hovered =
    hoveredSeriesId !== null
      ? entries.find((e) => e.id === hoveredSeriesId) ?? null
      : null;

  // Every flavor note present on the hovered series, sorted strongest first.
  // Hop presets store integer 0-5 scores (0 = absent), so `> 0` is the
  // natural "exists" threshold. Combined/estimated profiles may carry
  // tiny fractional residues — anything > 0 still represents a real
  // contribution and shows up on the radar polygon, so we list it too.
  const topNotes = useMemo(() => {
    if (!hovered) return [] as Array<{ k: string; v: number }>;
    return HOP_FLAVOR_KEYS.map((k) => ({
      k,
      v: hovered.flavor[k] ?? 0,
    }))
      .filter((e) => e.v > 0)
      .sort((a, b) => b.v - a.v);
  }, [hovered]);

  // For an "Estimated" hover, grams = sum across all individuals (the
  // estimated series itself doesn't carry grams).
  const totalGrams = useMemo(
    () => individualSeries.reduce((sum, s) => sum + (s.grams ?? 0), 0),
    [individualSeries]
  );
  const hoveredGrams = hovered
    ? hovered.isEstimated
      ? totalGrams
      : hovered.grams ?? 0
    : 0;

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    // Tooltip's top-center anchored 14px below the cursor — keeps the radar
    // above completely unobscured even when the user hovers the topmost
    // legend row.
    t.style.transform = `translate(${clientX}px, ${clientY + 14}px) translate(-50%, 0%) rotate(${rotation}deg)`;
  }

  function onItemMouseMove(e: React.MouseEvent<HTMLElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove ? 0 : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
      // Snap to cursor on first appearance so the card doesn't fly in from
      // the prior resting position (which would otherwise be the viewport
      // origin, since the tooltip is position:fixed at 0,0).
      t.style.transition = "none";
      applyTransform(e.clientX, e.clientY, 0);
      void t.offsetHeight;
      t.style.transition = "opacity 140ms ease, transform 90ms ease-out";
    } else {
      applyTransform(e.clientX, e.clientY, rotation);
    }
    t.style.opacity = "1";
    if (restTimerRef.current !== null) window.clearTimeout(restTimerRef.current);
    const restClientX = e.clientX;
    const restClientY = e.clientY;
    restTimerRef.current = window.setTimeout(
      () => applyTransform(restClientX, restClientY, 0),
      120
    );
  }

  function onWrapperMouseLeave() {
    onHoverSeries(null);
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: `1px solid ${hsTokens.ink}22`,
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 10px",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseLeave={onWrapperMouseLeave}
    >
      {entries.map((s) => {
        const isDimmed = hoveredSeriesId !== null && hoveredSeriesId !== s.id;
        return (
        <span
          key={s.id}
          onMouseEnter={() => onHoverSeries(s.id)}
          onMouseMove={onItemMouseMove}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: hsTokens.body,
            fontSize: 12,
            color: hsTokens.ink,
            lineHeight: 1.1,
            cursor: "pointer",
            opacity: isDimmed ? 0.4 : 1,
            transition: "opacity 180ms ease",
            // Pad the hit area so flicking the cursor along the legend strip
            // catches each entry without pixel-hunting. Vertical padding
            // dominates because the chips are already comfortably wide.
            padding: "8px 6px",
            borderRadius: 6,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 10,
              borderRadius: 3,
              background: s.color,
              border: `1.5px solid ${hsTokens.ink}`,
              opacity: s.isEstimated ? 0.95 : 0.6,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: s.isEstimated ? 700 : 600 }}>{s.name}</span>
          {s.isEstimated ? null : s.grams !== undefined ? (
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 10,
                color: hsTokens.muted,
              }}
            >
              {s.grams.toFixed(0)}g
            </span>
          ) : null}
        </span>
        );
      })}
      {/* Compact cursor-following stats card for the hovered legend entry.
          Vertically lean (2 short rows) and anchored BELOW the cursor so it
          never blocks the radar above. */}
      <div
        ref={tooltipRef}
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 100,
          transition: "opacity 140ms ease, transform 90ms ease-out",
          willChange: "transform, opacity",
        }}
      >
        {hovered ? (
          <div
            style={{
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 10,
              boxShadow: hsTokens.sh2,
              padding: "8px 12px",
              minWidth: 180,
              maxWidth: 260,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 13,
                  color: hsTokens.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {hovered.name}
                {null}
              </span>
              {hoveredGrams > 0 ? (
                <span
                  style={{
                    fontFamily: hsTokens.mono,
                    fontSize: 11,
                    color: hsTokens.muted,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {hoveredGrams.toFixed(0)}g
                </span>
              ) : null}
            </div>
            {topNotes.length > 0 ? (
              <div
                style={{
                  marginTop: 5,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "3px 8px",
                  fontFamily: hsTokens.body,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                }}
              >
                {topNotes.map((n) => (
                  <span
                    key={n.k}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background:
                          HOP_FLAVOR_COLOR[n.k] ?? hsTokens.muted,
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      {HOP_FLAVOR_LABEL[n.k]?.split(" ")[0] ?? n.k}
                    </span>
                    <span
                      style={{
                        fontFamily: hsTokens.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0,
                        color: hsTokens.ink,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {n.v.toFixed(1)}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 5,
                  fontFamily: hsTokens.script,
                  fontSize: 12,
                  color: hsTokens.muted,
                }}
              >
                no standout flavor notes
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RadarEmpty({ hops }: { hops: Hop[] }) {
  return (
    <p
      style={{
        fontFamily: hsTokens.script,
        fontSize: 16,
        color: hsTokens.muted,
        lineHeight: 1.4,
        margin: 0,
        textAlign: "center",
        padding: "32px 8px",
      }}
    >
      {hops.length === 0
        ? "Add a hop with flavor data and the radar will fill in."
        : "These hops don't have flavor data yet — try one from the picker."}
    </p>
  );
}

function HopFlavorRadarSvg({
  series,
  dominantPerAxis,
  mode,
  hoveredSeriesId,
}: {
  series: HopSeries[];
  dominantPerAxis: Record<string, { name: string; value: number } | null>;
  /** Mode is appended to series keys so toggling between estimated/all/both
   *  remounts the visible polygons and replays the bounce-in animation. */
  mode: string;
  /** When non-null, the matching polygon bulges + stays opaque while the
   *  other polygons fade back. Driven by legend hover in the parent. */
  hoveredSeriesId: string | null;
}) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const size = 240;
  const max = 5;
  const pad = 32;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  /** Label anchor + position: near-horizontal axes anchor start/end so the
   *  text grows OUTWARD from the ring (no overlap with the web); top/bottom
   *  stay middle-anchored. The longest side labels intentionally extend past
   *  the viewBox — the svg renders with overflow visible and the card's 18px
   *  padding absorbs them, which keeps the canvas (and so the ring) full
   *  size instead of shrinking it to make room for label gutters. */
  const labelLayoutAt = (i: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const cos = Math.cos(angle);
    const anchor: "start" | "middle" | "end" =
      cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
    const r = anchor === "middle" ? radius + 14 : radius + 6;
    return {
      lx: cx + r * cos,
      ly: cy + r * Math.sin(angle),
      anchor,
    };
  };

  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  /** Polygon points for a given flavor profile (string form for `points` attr). */
  const flavorPolyPoints = (flavor: HopFlavorProfile) =>
    HOP_FLAVOR_KEYS.map((k, i) => pointAt(i, flavor[k] ?? 0).join(","))
      .join(" ");

  /** Vertex coords for the data dots — only rendered for the estimated polygon. */
  const estimatedPoints = useMemo(() => {
    const est = series.find((s) => s.isEstimated);
    if (!est) return [] as Array<readonly [number, number]>;
    return HOP_FLAVOR_KEYS.map((k, i) => pointAt(i, est.flavor[k] ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    t.style.transform = `translate(${clientX}px, ${clientY - 14}px) translate(-50%, -100%) rotate(${rotation}deg)`;
  }

  function onAxisMouseMove(e: React.MouseEvent<SVGElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove ? 0 : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
      t.style.transition = "none";
      applyTransform(e.clientX, e.clientY, 0);
      void t.offsetHeight;
      t.style.transition = "opacity 140ms ease, transform 90ms ease-out";
    } else {
      applyTransform(e.clientX, e.clientY, rotation);
    }
    t.style.opacity = "1";
    if (restTimerRef.current !== null) window.clearTimeout(restTimerRef.current);
    const restClientX = e.clientX;
    const restClientY = e.clientY;
    restTimerRef.current = window.setTimeout(
      () => applyTransform(restClientX, restClientY, 0),
      120
    );
  }

  function onAxisMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    setHoveredAxis(null);
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  // Tooltip data comes from the estimated series if present, otherwise the
  // sum of selected individuals on the hovered axis.
  const hoveredKey = hoveredAxis as keyof HopFlavorProfile | null;
  const estSeries = series.find((s) => s.isEstimated) ?? null;
  const hoveredValue = hoveredKey
    ? estSeries
      ? estSeries.flavor[hoveredKey] ?? 0
      : series.reduce((acc, s) => acc + (s.flavor[hoveredKey] ?? 0), 0) /
        Math.max(1, series.length)
    : 0;
  const hoveredDom = hoveredKey ? dominantPerAxis[hoveredKey] : null;

  return (
    <>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        // maxWidth slightly above the viewBox lets the ring render a touch
        // larger when the side column has room; overflow stays visible so
        // the start/end-anchored side labels can spill into the card padding
        // instead of costing canvas (= ring) size.
        style={{
          maxWidth: 260,
          display: "block",
          margin: "0 auto",
          overflow: "visible",
        }}
        aria-label="Estimated hop flavor profile"
      >
        {/* Rings + axes wrapped in a single fading group — the group's
            opacity goes 0 → 1, multiplied by each child's natural opacity
            attribute. After animation: group at 1, rings at 0.35/0.2,
            axes at 0.25 — identical to the static pre-animation state. */}
        <g className="hs-hops-radar-grid">
          {[0.25, 0.5, 0.75, 1].map((mult) => (
            <polygon
              key={mult}
              points={ringPoints(mult)}
              fill="none"
              stroke="var(--hs-ink)"
              strokeWidth={0.5}
              opacity={mult === 1 ? 0.35 : 0.2}
            />
          ))}
          {HOP_FLAVOR_KEYS.map((k, i) => {
            const [x, y] = pointAt(i, max);
            return (
              <line
                key={k}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="var(--hs-ink)"
                strokeWidth={0.3}
                opacity={0.25}
              />
            );
          })}
        </g>
        {/* series polygons — individual hops draw first at lower opacity,
            estimated draws last so its heavier stroke sits on top. Each
            series scale-bounces in (staggered 120ms by series index) and
            then subtly breathes via the inner polygon animation. Keyed by
            id so toggling view mode (est/both/each) replays the entrance
            on freshly-mounted series. */}
        {series.map((s, si) => {
          const isHovered = hoveredSeriesId === s.id;
          const isDimmed = hoveredSeriesId !== null && !isHovered;
          return (
            <g
              key={`${mode}-${s.id}`}
              className="hs-hops-radar-series"
              style={{
                animationDelay: `${si * 120}ms`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            >
              {/* Inner wrapper handles the legend-hover bulge + dim. The
                  entrance animation rides on the OUTER group so the two
                  transforms compose without fighting. */}
              <g
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHovered ? "scale(1.07)" : "scale(1)",
                  opacity: isDimmed ? 0.22 : 1,
                  transition:
                    "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
                }}
              >
                <polygon
                  points={flavorPolyPoints(s.flavor)}
                  fill={s.color}
                  fillOpacity={
                    isHovered
                      ? s.isEstimated
                        ? 0.5
                        : 0.36
                      : s.isEstimated
                        ? 0.32
                        : 0.18
                  }
                  stroke={s.color}
                  strokeWidth={
                    isHovered
                      ? s.isEstimated
                        ? 2.4
                        : 1.8
                      : s.isEstimated
                        ? 1.8
                        : 1.2
                  }
                  strokeLinejoin="round"
                  strokeDasharray={s.isEstimated ? undefined : "3 3"}
                  style={{
                    transition:
                      "fill-opacity 200ms ease, stroke-width 200ms ease",
                  }}
                />
              </g>
            </g>
          );
        })}
        {/* Estimated vertex dots — scale-in staggered AFTER the grid + series
            have settled (start at 600ms, 40ms per dot clockwise). The wrapping
            group mirrors the estimated polygon's hover state so the dots ride
            outward with the bulge instead of being orphaned inside the
            scaled polygon. */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform:
              hoveredSeriesId === "__estimated__" ? "scale(1.07)" : "scale(1)",
            opacity:
              hoveredSeriesId !== null && hoveredSeriesId !== "__estimated__"
                ? 0.22
                : 1,
            transition:
              "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
          }}
        >
          {estimatedPoints.map(([x, y], i) => (
            <circle
              key={i}
              className="hs-hops-radar-dot"
              style={{ animationDelay: `${600 + i * 40}ms` }}
              cx={x}
              cy={y}
              r={2.2}
              fill={hsTokens.hops}
              stroke="var(--hs-ink)"
              strokeWidth={0.5}
            />
          ))}
        </g>
        {/* axis labels + invisible hover hit areas. */}
        {HOP_FLAVOR_KEYS.map((k, i) => {
          const { lx, ly, anchor } = labelLayoutAt(i);
          const labelColor = HOP_FLAVOR_COLOR[k];
          // Two-word labels ("Stone fruit") stack so neither line outruns
          // the side gutter.
          const words = HOP_FLAVOR_LABEL[k].split(" ");
          return (
            <g key={`label-${k}`}>
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                style={{
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fill: labelColor,
                  pointerEvents: "none",
                }}
              >
                {words.length === 1
                  ? HOP_FLAVOR_LABEL[k]
                  : words.map((w, wi) => (
                      <tspan key={wi} x={lx} dy={wi === 0 ? -5 : 10}>
                        {w}
                      </tspan>
                    ))}
              </text>
              <circle
                cx={lx}
                cy={ly}
                r={24}
                fill="transparent"
                onMouseEnter={() => setHoveredAxis(k)}
                onMouseMove={onAxisMouseMove}
                onMouseLeave={onAxisMouseLeave}
                style={{ cursor: "default" }}
              />
            </g>
          );
        })}
      </svg>

      {/* Cursor-following tooltip. position: fixed escapes the card's
          overflow: hidden bounding. */}
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden={hoveredAxis === null}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 100,
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 140ms ease, transform 90ms ease-out",
          padding: "10px 14px",
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 10,
          boxShadow: hsTokens.sh3,
          maxWidth: 240,
        }}
      >
        {hoveredAxis ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: hsTokens.script,
                fontSize: 15,
                color: HOP_FLAVOR_COLOR[hoveredAxis] ?? hsTokens.ink,
                transform: "rotate(-2deg)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: HOP_FLAVOR_COLOR[hoveredAxis],
                  border: `1px solid ${hsTokens.ink}`,
                }}
              />
              {HOP_FLAVOR_LABEL[hoveredAxis]}
            </div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 14,
                color: hsTokens.ink,
              }}
            >
              {hoveredValue.toFixed(1)}
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 11,
                  color: hsTokens.muted,
                  marginLeft: 4,
                }}
              >
                / 5
              </span>
            </div>
            {hoveredDom ? (
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 12,
                  color: hsTokens.muted,
                }}
              >
                most from{" "}
                <span style={{ color: hsTokens.ink, fontWeight: 600 }}>
                  {hoveredDom.name}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

// ─── Mobile add row (dashed-border "add another" CTA) ─────────────

function dashedBorderBg(
  color: string,
  opts: { dash: number; gap: number; strokeWidth: number; radius: number }
) {
  const { dash, gap, strokeWidth, radius } = opts;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><rect width='100%' height='100%' rx='${radius}' ry='${radius}' fill='none' stroke='${color}' stroke-width='${strokeWidth}' stroke-dasharray='${dash} ${gap}'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const MOBILE_ADD_RADIUS = 12;
const MOBILE_ADD_DASH = 12;
const MOBILE_ADD_GAP = 8;
const MOBILE_ADD_STROKE = 1.75;

function MobileAddRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label="Add another hop"
      className="hs-hops-mobile-add"
      style={{
        display: "none",
        marginTop: 14,
        width: "100%",
        padding: "16px 12px",
        background: hsTokens.cream2,
        backgroundImage: dashedBorderBg(hsTokens.ink, {
          dash: MOBILE_ADD_DASH,
          gap: MOBILE_ADD_GAP,
          strokeWidth: MOBILE_ADD_STROKE,
          radius: MOBILE_ADD_RADIUS,
        }),
        backgroundRepeat: "no-repeat",
        border: "none",
        borderRadius: MOBILE_ADD_RADIUS,
        cursor: "pointer",
        fontFamily: hsTokens.script,
        fontSize: 18,
        color: hsTokens.hops,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      + Add another hop
    </button>
  );
}

// ─── Section styles ───────────────────────────────────────────────

function HopSectionStyles() {
  return (
    <style>{`
      /* ── Radar chart entrance animations (ported from classic
         HopFlavorRadar) ── Rings + axes fade in, series polygons
         scale-bounce in with stagger. Entrance-only — no perpetual
         animation, and CRUCIALLY no persistent style changes (the classic
         used stroke-dasharray for the rings to draw-in, but that
         dasharray persisted after the animation and changed how the ring
         outlines render — subtle artifacts at the closing vertex). Using
         pure opacity entrance keeps the settled static state identical to
         pre-animation. */
      /* Animate a wrapping group's opacity (0 → 1) rather than each
         element's opacity. The group's opacity compounds with each
         child's opacity attribute (0.35 for outer ring / 0.2 for inner
         rings / 0.25 for axes), so the settled compounded opacity equals
         the original attribute value. Animating the GROUP avoids the
         "fill-mode both forces opacity to 1" problem that bit a prior
         attempt at per-element fades. */
      @keyframes hs-hops-radar-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes hs-hops-radar-enter {
        0%   { opacity: 0; transform: scale(0.3); }
        60%  { opacity: 1; transform: scale(1.04); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes hs-hops-radar-dot-in {
        0%   { opacity: 0; transform: scale(0); }
        100% { opacity: 1; transform: scale(1); }
      }
      .hs-hops-radar-grid {
        animation: hs-hops-radar-fade-in 500ms ease-out both;
      }
      .hs-hops-radar-series {
        animation: hs-hops-radar-enter 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      /* transform-box + transform-origin let SVG circles scale from their
         own center (default would be SVG root origin). */
      .hs-hops-radar-dot {
        transform-box: fill-box;
        transform-origin: center;
        animation: hs-hops-radar-dot-in 320ms ease-out both;
      }
      @media (prefers-reduced-motion: reduce) {
        .hs-hops-radar-grid,
        .hs-hops-radar-series,
        .hs-hops-radar-dot {
          animation: none !important;
        }
      }

      /* Desktop: 2-col grid. Row 1 = ledger header + empty. Row 2 =
         ledger table + aside (radar + notes packed via flex). Aside top
         aligns with the top of the ledger TABLE, not the header row. */
      /* Single-column layout — the aside (radar + notes) has been hoisted
         to the parent HopSkipBuilder grid so it can morph between tabs. */
      .hs-hops-section .hs-hops-grid {
        display: flex;
        flex-direction: column;
        row-gap: 16px;
        min-width: 0;
      }
      .hs-hops-section .hs-hops-grid-lhead { min-width: 0; }
      .hs-hops-section .hs-hops-grid-ltable { min-width: 0; }

      /* Rows are plain paper — the green lives in the header/footer bands, not
         the table body. */
      .hs-hops-section .hs-hops-data-row,
      .hs-hops-section .hs-hops-variety-row {
        background: var(--hs-paper);
      }

      .hs-hops-section .hs-hops-radar-cell {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      @media (max-width: 900px) {
        .hs-hops-section .hs-hops-grid {
          row-gap: 12px;
        }
      }

      /* Desktop hover — subtle cream-2 tint across the ledger row, plus
         fades in the ghost × remove button. */
      @media (min-width: 641px) and (hover: hover) {
        .hs-hops-section .hs-hops-data-row,
        .hs-hops-section .hs-hops-variety-row {
          transition: background 90ms ease;
        }
        .hs-hops-section .hs-hops-data-row:hover,
        .hs-hops-section .hs-hops-variety-row:hover {
          /* Faint hops wash on hover so the active row reads against the plain
             paper rows. */
          background: color-mix(in srgb, var(--hs-paper) 93%, var(--hs-hops));
        }
        .hs-hops-section .hs-hops-remove-btn {
          opacity: 0.32;
          transition: opacity 90ms ease, background 90ms ease;
        }
        .hs-hops-section .hs-hops-data-row:hover .hs-hops-remove-btn,
        .hs-hops-section .hs-hops-variety-row:hover .hs-hops-remove-btn {
          opacity: 1;
        }
        .hs-hops-section .hs-hops-remove-btn:hover {
          background: rgba(212, 69, 44, 0.12);
        }
        .hs-hops-section .hs-hops-name-btn:hover .hs-hops-name {
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .hs-hops-section .hs-hops-edit-btn:hover {
          background: ${hsTokens.cream2};
        }
      }

      /* Variety cards stack the left rail above the additions table once the
         side-by-side row gets tight. */
      @media (max-width: 768px) {
        .hs-hops-section .hs-hops-variety-layout {
          flex-direction: column;
        }
        .hs-hops-section .hs-hops-variety-aside {
          width: auto !important;
          border-right: none !important;
          border-bottom: 2px solid ${hsTokens.ink};
        }
        .hs-hops-section .hs-hops-variety-aside svg {
          max-width: 150px;
        }
      }

      /* Mobile (≤640px) — collapse ledger into per-hop cards, always-
         visible steppers, no per-cell hover tints. */
      @media (max-width: 640px) {
        .hs-hops-section .hs-hops-mobile-add {
          display: flex !important;
        }

        .hs-hops-section .hs-hops-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 0 !important;
        }
        .hs-hops-section .hs-hops-steppers button {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          width: 26px !important;
          height: 22px !important;
          color: ${hsTokens.muted} !important;
        }
        .hs-hops-section .hs-hops-steppers button svg {
          width: 14px !important;
          height: 9px !important;
          stroke-width: 2 !important;
        }
        .hs-hops-section .hs-hops-remove-btn {
          opacity: 1 !important;
        }
        .hs-hops-section .hs-hops-ledger {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .hs-hops-section .hs-hops-ledger-head-row {
          display: none !important;
        }
        /* Mobile reflow for the 7-column desktop ledger (mini radar / name /
           use / time / weight / IBU / remove). Stacks into 3 rows so each
           pair of related controls (use+time, weight+IBU) sits inline. */
        .hs-hops-section .hs-hops-data-row {
          display: grid !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          grid-template-areas:
            "radar  name    remove"
            "radar  usecell timecell"
            "weight weight  ibucell" !important;
          column-gap: 12px !important;
          row-gap: 10px !important;
          padding: 16px 0 !important;
          border-bottom: 1px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-hops-section .hs-hops-data-row:last-of-type {
          border-bottom: none !important;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(1) {
          grid-area: radar;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(2) {
          grid-area: name;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(3) {
          grid-area: usecell;
          display: flex !important;
          justify-content: flex-start;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(4) {
          grid-area: timecell;
          display: flex !important;
          justify-content: flex-end;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(5) {
          grid-area: weight;
          display: flex !important;
          align-items: center;
          justify-content: flex-start;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(6) {
          grid-area: ibucell;
          margin: 0 !important;
          padding: 8px 14px !important;
          border-radius: 8px;
          min-height: 0 !important;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(7) {
          grid-area: remove;
          justify-self: end;
        }
        .hs-hops-section .hs-hops-edit-btn {
          padding: 4px 38px 4px 8px !important;
        }
        /* Mobile total: collapse to a 3-cell row "Total hops · Σg · ΣIBU".
           Hides the index, use/time placeholders, and the actions cell. */
        .hs-hops-section .hs-hops-total-row {
          display: grid !important;
          grid-template-columns: 1fr auto auto !important;
          column-gap: 14px !important;
          align-items: baseline !important;
          padding: 16px 0 !important;
          border-top: 2px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-hops-section .hs-hops-total-row > * {
          padding: 0 !important;
        }
        /* Hide entry count (col 1), use placeholder (col 3), time placeholder
           (col 4), and actions placeholder (col 7). Visible: name (2), grams
           (5), ibu total (6). */
        .hs-hops-section .hs-hops-total-row > :nth-child(1),
        .hs-hops-section .hs-hops-total-row > :nth-child(3),
        .hs-hops-section .hs-hops-total-row > :nth-child(4),
        .hs-hops-section .hs-hops-total-row > :nth-child(7) {
          display: none !important;
        }
        /* IBU total cell on mobile: keep its tinted bg as a chip. */
        .hs-hops-section .hs-hops-total-row > :nth-child(6) {
          margin: 0 !important;
          padding: 6px 12px !important;
          border-radius: 8px;
          min-height: 0 !important;
        }
        .hs-hops-section {
          padding: 18px 14px !important;
        }
        .hs-hops-radar-card {
          padding: 12px !important;
        }
        .hs-hops-ledger-head {
          flex-wrap: wrap;
        }

        /* Variety row reflow: use+remove / time / weight+IBU, mirroring the
           use-time data-row stack. */
        .hs-hops-section .hs-hops-variety-row {
          grid-template-columns: minmax(0, 1fr) auto !important;
          grid-template-areas:
            "usecell  remove"
            "timecell timecell"
            "weight   ibucell" !important;
          column-gap: 12px !important;
          row-gap: 10px !important;
          padding: 16px 0 !important;
          border-bottom: 1px solid ${hsTokens.ink} !important;
        }
        .hs-hops-section .hs-hops-variety-row:last-of-type {
          border-bottom: none !important;
        }
        .hs-hops-section .hs-hops-variety-row > :nth-child(1) {
          grid-area: usecell;
          justify-content: flex-start !important;
        }
        .hs-hops-section .hs-hops-variety-row > :nth-child(2) {
          grid-area: timecell;
          justify-content: flex-start !important;
        }
        .hs-hops-section .hs-hops-variety-row > :nth-child(3) {
          grid-area: weight;
          justify-content: flex-start !important;
        }
        .hs-hops-section .hs-hops-variety-row > :nth-child(4) {
          grid-area: ibucell;
          margin: 0 !important;
          padding: 8px 14px !important;
          border-radius: 8px;
        }
        .hs-hops-section .hs-hops-variety-row > :nth-child(5) {
          grid-area: remove;
          justify-self: end;
        }
        /* Variety subtotal collapses to "Subtotal · Σg · ΣIBU". */
        .hs-hops-section .hs-hops-variety-total {
          grid-template-columns: 1fr auto auto !important;
          column-gap: 14px !important;
          padding: 14px 0 !important;
        }
        .hs-hops-section .hs-hops-variety-total > :nth-child(2),
        .hs-hops-section .hs-hops-variety-total > :nth-child(5) {
          display: none !important;
        }
        .hs-hops-section .hs-hops-variety-total > :nth-child(4) {
          margin: 0 !important;
          padding: 6px 12px !important;
          border-radius: 8px;
        }
      }
    `}</style>
  );
}

// ─── Helper-card container (mounted by HelperCardMorph) ───────────

export function HopHelperCard() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const hops = currentRecipe?.hops ?? [];
  if (hops.length === 0) return null;
  return (
    <HopFlavorRadarCard
      hops={hops}
      batchVolumeL={currentRecipe?.batchVolumeL ?? 20}
    />
  );
}

