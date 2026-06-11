"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import HSActionMenu from "../HSActionMenu";
import YeastPresetModal from "../modals/YeastPresetModal";
import CustomYeastModal from "../modals/CustomYeastModal";
import { LedgerRowMotion, LedgerRowsAnimated } from "./LedgerRowMotion";

import { uid } from "@/utils/uid";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { usePresetStore } from "@/modules/recipe/stores/presetStore";
import { useRecipeCalculations } from "@/modules/recipe/hooks/useRecipeCalculations";
import { toast } from "@/stores/toastStore";
import { starterCalculationService } from "@/modules/recipe/services/StarterCalculationService";
import type {
  Yeast,
  YeastType,
  StarterStep,
  StarterInfo,
} from "@/modules/recipe/models/Recipe";
import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { getYeastLabFavicon } from "@/modules/recipe/utils/yeastLabIcons";
import { inferDefaultYeastType } from "./yeastDetails";
import { useYeastHoverPreview } from "./yeastHoverPreview";

type YeastModelKey = "white-none" | "white-shaking" | "braukaiser";

const YEAST_TYPE_OPTIONS: Array<{ value: YeastType; label: string; short: string }> = [
  { value: "liquid-100", label: "Liquid 100B", short: "Liquid 100B" },
  { value: "liquid-200", label: "Liquid 200B", short: "Liquid 200B" },
  { value: "dry", label: "Dry 11g", short: "Dry" },
  { value: "slurry", label: "Slurry", short: "Slurry" },
];

const STARTER_MODEL_OPTIONS: Array<{ value: YeastModelKey; label: string }> = [
  { value: "white-none", label: "No agitation" },
  { value: "white-shaking", label: "Shaking" },
  { value: "braukaiser", label: "Stir plate" },
];

function modelToKey(m: StarterStep["model"]): YeastModelKey {
  if (m.kind === "white") {
    return m.aeration === "none" ? "white-none" : "white-shaking";
  }
  return "braukaiser";
}

function keyToModel(k: YeastModelKey): StarterStep["model"] {
  if (k === "braukaiser") return { kind: "braukaiser" };
  return { kind: "white", aeration: k === "white-none" ? "none" : "shaking" };
}

// ─── Yeast strain quick-picks ─────────────────────────────────────────
// Three real, widely-available strains that cover the bulk of homebrew
// use cases (clean ale / clean lager / hot-ferment kveik). "Or browse
// the full library" lives next to them as the escape hatch for everything
// else. Only the editorial blurb + which strains to feature live here;
// the actual stats (lab, attenuation) are resolved live from the yeast
// library so a shortcut can never drift from its real preset.
const FEATURED_STRAIN_PICKS: Array<{
  name: string; // must match a YeastPreset name in the library
  label: string;
  blurb: string;
}> = [
  { name: "SafAle US-05", label: "SafAle US-05", blurb: "clean American ale" },
  { name: "SafLager W-34/70", label: "SafLager 34/70", blurb: "clean German lager" },
  { name: "LalBrew Voss Kveik", label: "LalBrew Voss", blurb: "Norwegian kveik" },
];

interface YeastGenerator {
  label: string;
  sub: string;
  preset: YeastPreset;
}

// ─── Main component ─────────────────────────────────────────────────

interface StrainRowData {
  yeast: Yeast;
  attenuationPct: number;
}

export default function YeastSection() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const addYeast = useRecipeStore((s) => s.addYeast);
  const updateYeast = useRecipeStore((s) => s.updateYeast);
  const removeYeast = useRecipeStore((s) => s.removeYeast);

  const yeastPresetsGrouped = usePresetStore((s) => s.yeastPresetsGrouped);
  const loadYeastPresets = usePresetStore((s) => s.loadYeastPresets);
  const saveYeastPreset = usePresetStore((s) => s.saveYeastPreset);
  const presetsLoading = usePresetStore((s) => s.isLoading);

  const calculations = useRecipeCalculations(currentRecipe);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

  useEffect(() => {
    loadYeastPresets();
  }, [loadYeastPresets]);

  // Quick-pick shortcuts resolve their stats from the live yeast library
  // (single source of truth) rather than carrying hardcoded copies.
  const presetByName = useMemo(() => {
    const m = new Map<string, YeastPreset>();
    for (const group of yeastPresetsGrouped) {
      for (const p of group.items) m.set(p.name, p);
    }
    return m;
  }, [yeastPresetsGrouped]);

  const featuredGenerators = useMemo<YeastGenerator[]>(() => {
    return FEATURED_STRAIN_PICKS.flatMap((pick) => {
      const preset = presetByName.get(pick.name);
      if (!preset) return [];
      const att = preset.attenuationPercent;
      const sub =
        att != null ? `${pick.blurb} · ${Math.round(att * 100)}%` : pick.blurb;
      return [{ label: pick.label, sub, preset }];
    });
  }, [presetByName]);

  const yeasts = useMemo(
    () => currentRecipe?.yeasts ?? [],
    [currentRecipe?.yeasts]
  );

  const strainRows = useMemo<StrainRowData[]>(
    () =>
      yeasts.map((y) => ({
        yeast: y,
        attenuationPct: Math.round(y.attenuation * 100),
      })),
    [yeasts]
  );

  // The current UI is single-strain (matches classic). Multi-strain
  // (blends) lives in the data model — when we wire it up the ledger
  // already handles N rows. For now everything below the ledger
  // (starter steps, pitch dashboard) operates on the first strain.
  const primary: Yeast | null = yeasts[0] ?? null;
  const primaryPreset = primary ? presetByName.get(primary.name) ?? null : null;
  const starterInfo: StarterInfo = useMemo(
    () =>
      primary?.starter ?? {
        yeastType: inferDefaultYeastType(primaryPreset),
        packs: 1,
        mfgDate: "",
        slurryLiters: 0,
        slurryBillionPerMl: 1,
        steps: [],
      },
    [primary, primaryPreset]
  );

  const writeStarter = (partial: Partial<StarterInfo>) => {
    if (!primary) return;
    updateYeast(primary.id, { starter: { ...starterInfo, ...partial } });
  };

  const handleSelectPreset = (preset: YeastPreset) => {
    const inferredType = inferDefaultYeastType(preset);
    if (swapTargetId) {
      const existing = yeasts.find((y) => y.id === swapTargetId);
      const nextStarter: StarterInfo = existing?.starter
        ? { ...existing.starter, yeastType: inferredType }
        : {
            yeastType: inferredType,
            packs: 1,
            mfgDate: "",
            slurryLiters: 0,
            slurryBillionPerMl: 1,
            steps: [],
          };
      updateYeast(swapTargetId, {
        name: preset.name,
        attenuation: preset.attenuationPercent ?? 0.75,
        laboratory: preset.category,
        starter: nextStarter,
      });
    } else {
      const newYeast: Yeast = {
        id: uid(),
        name: preset.name,
        attenuation: preset.attenuationPercent ?? 0.75,
        laboratory: preset.category,
        starter: {
          yeastType: inferredType,
          packs: 1,
          mfgDate: "",
          slurryLiters: 0,
          slurryBillionPerMl: 1,
          steps: [],
        },
      };
      addYeast(newYeast);
    }
    setIsPickerOpen(false);
    setSwapTargetId(null);
  };

  const handleSaveCustomPreset = (preset: YeastPreset) => {
    saveYeastPreset(preset);
    toast.success(`"${preset.name}" saved — select it from the list to add`);
  };

  const handleAddStrain = () => {
    setSwapTargetId(null);
    setIsPickerOpen(true);
  };

  const handleSwapStrain = (id: string) => {
    setSwapTargetId(id);
    setIsPickerOpen(true);
  };

  // Flat library — feeds the shared hover-preview hook for peer +
  // substitute resolution.
  const libraryFlat = useMemo<YeastPreset[]>(
    () => Array.from(presetByName.values()),
    [presetByName]
  );

  // Single hover-preview instance for all strain cards in the section.
  // Each card spreads `getTriggerProps(preset)` onto its outer div so
  // hovering anywhere on the card surfaces the same tooltip the picker
  // shows. Cleared imperatively when the swap modal opens so it doesn't
  // linger behind the modal overlay.
  const {
    portal: hoverPortal,
    getTriggerProps: getHoverTriggerProps,
    clear: clearHoverPreview,
  } = useYeastHoverPreview(libraryFlat);

  // Hide the card hover preview when the swap picker opens — the cursor
  // hasn't physically left the card boundary, so mouseLeave doesn't fire
  // on its own and the tooltip would otherwise linger behind the modal.
  useEffect(() => {
    if (isPickerOpen) clearHoverPreview();
  }, [isPickerOpen, clearHoverPreview]);

  const handleApplyGenerator = (gen: YeastGenerator) => {
    if (yeasts.length > 0) {
      if (
        !confirm(
          `This will replace the current yeast strain with the ${gen.label} preset. Continue?`
        )
      ) {
        return;
      }
      yeasts.forEach((y) => removeYeast(y.id));
    }
    addYeast({
      id: uid(),
      name: gen.preset.name,
      attenuation: gen.preset.attenuationPercent ?? 0.75,
      laboratory: gen.preset.category,
      starter: {
        yeastType: inferDefaultYeastType(gen.preset),
        packs: 1,
        mfgDate: "",
        slurryLiters: 0,
        slurryBillionPerMl: 1,
        steps: [],
      },
    });
  };

  const handleAttenuationCommit = (id: string, decimalValue: number) => {
    updateYeast(id, {
      attenuation: Math.max(0.4, Math.min(0.99, decimalValue)),
    });
  };

  const handleAttenuationNudge = (id: string, current: number, dir: 1 | -1) => {
    const next = Math.max(0.4, Math.min(0.99, parseFloat((current + dir * 0.01).toFixed(2))));
    if (next !== current) updateYeast(id, { attenuation: next });
  };

  const handlePacksCommit = (id: string, v: number) => {
    if (!primary || primary.id !== id) return;
    if (starterInfo.yeastType === "slurry") {
      writeStarter({ slurryLiters: Math.max(0, parseFloat(v.toFixed(2))) });
    } else {
      writeStarter({ packs: Math.max(0, Math.round(v)) });
    }
  };

  const handlePacksNudge = (id: string, current: number, dir: 1 | -1) => {
    if (!primary || primary.id !== id) return;
    if (starterInfo.yeastType === "slurry") {
      const next = Math.max(0, parseFloat((current + dir * 0.1).toFixed(2)));
      if (next !== current) writeStarter({ slurryLiters: next });
    } else {
      const next = Math.max(0, current + dir);
      if (next !== current) writeStarter({ packs: next });
    }
  };

  const handleTypeChange = (next: YeastType) => {
    writeStarter({ yeastType: next });
  };

  const handleMfgDateChange = (v: string) => {
    writeStarter({ mfgDate: v });
  };

  // ─── Starter calc + dashboard derivations ─────────────────────────
  const starterResults = useMemo(() => {
    if (!currentRecipe) return null;
    return starterCalculationService.calculateStarter(
      currentRecipe.batchVolumeL || 20,
      calculations?.og ?? 1.05,
      starterInfo.yeastType,
      starterInfo.packs,
      starterInfo.mfgDate,
      starterInfo.slurryLiters ?? 0,
      starterInfo.slurryBillionPerMl ?? 1,
      starterInfo.steps
    );
  }, [currentRecipe, calculations?.og, starterInfo]);

  const hasSteps = starterInfo.steps.length > 0;
  const availableCells = starterResults
    ? hasSteps
      ? starterResults.finalEndB
      : starterResults.cellsAvailableB
    : 0;
  const requiredCells = starterResults?.requiredCellsB ?? 0;
  const cellDiff = availableCells - requiredCells;
  const underpitched = cellDiff < 0;

  const starterModelKey: YeastModelKey =
    starterInfo.steps.length > 0
      ? modelToKey(starterInfo.steps[0].model)
      : "white-shaking";

  const handleAddStarterStep = () => {
    if (!primary) return;
    if (starterInfo.steps.length >= 3) return;
    const nextSteps: StarterStep[] = [
      ...starterInfo.steps,
      {
        id: uid(),
        liters: 2,
        gravity: 1.036,
        model: keyToModel(starterModelKey),
      },
    ];
    writeStarter({ steps: nextSteps });
  };

  const handleUpdateStarterStep = (id: string, updates: Partial<StarterStep>) => {
    writeStarter({
      steps: starterInfo.steps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    });
  };

  const handleRemoveStarterStep = (id: string) => {
    writeStarter({ steps: starterInfo.steps.filter((s) => s.id !== id) });
  };

  const handleStarterModelChange = (next: YeastModelKey) => {
    const model = keyToModel(next);
    writeStarter({ steps: starterInfo.steps.map((s) => ({ ...s, model })) });
  };

  if (!currentRecipe) return null;

  return (
    <section className="hs-yeast-section" style={sectionFrameStyle}>
      <YeastSectionStyles />

      <SectionTitle />

      <div className="hs-yeast-grid">
        <div className="hs-yeast-grid-lhead">
          <StrainBlockHeader
            hasStrains={strainRows.length > 0}
            onAdd={handleAddStrain}
          />
        </div>

        <div className="hs-yeast-grid-main">
          <div className="hs-yeast-block">
            {strainRows.length === 0 ? (
              <StrainEmptyState
                onAdd={handleAddStrain}
                generators={featuredGenerators}
                onApplyGenerator={handleApplyGenerator}
              />
            ) : (
              <StrainLedger
                rows={strainRows}
                yeastType={starterInfo.yeastType}
                packs={starterInfo.packs}
                slurryLiters={starterInfo.slurryLiters ?? 0}
                mfgDate={starterInfo.mfgDate ?? ""}
                presetByName={presetByName}
                recipeAbv={calculations?.abv ?? null}
                getHoverTriggerProps={getHoverTriggerProps}
                onSwap={handleSwapStrain}
                onRemove={removeYeast}
                onAttenuationChange={(id, v) => handleAttenuationCommit(id, v / 100)}
                onAttenuationNudge={(id, current, dir) =>
                  handleAttenuationNudge(id, current, dir)
                }
                onPacksChange={handlePacksCommit}
                onPacksNudge={(id, current, dir) => handlePacksNudge(id, current, dir)}
                onTypeChange={handleTypeChange}
                onMfgDateChange={handleMfgDateChange}
                onAdd={handleAddStrain}
              />
            )}
          </div>

          {primary ? (
            <div className="hs-yeast-block">
              <StarterBlock
                steps={starterInfo.steps}
                stepResults={starterResults?.stepResults ?? []}
                modelKey={starterModelKey}
                onModelChange={handleStarterModelChange}
                onAddStep={handleAddStarterStep}
                onUpdateStep={handleUpdateStarterStep}
                onRemoveStep={handleRemoveStarterStep}
                underpitched={underpitched}
                deficit={cellDiff}
              />
            </div>
          ) : null}
        </div>

      </div>

      <YeastPresetModal
        isOpen={isPickerOpen}
        editing={Boolean(swapTargetId)}
        onClose={() => {
          setIsPickerOpen(false);
          setSwapTargetId(null);
        }}
        onSelect={handleSelectPreset}
        onCreateCustom={() => setIsCustomOpen(true)}
        presetsGrouped={yeastPresetsGrouped}
        isLoading={presetsLoading}
      />

      <CustomYeastModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
        onSave={handleSaveCustomPreset}
      />

      {hoverPortal}
    </section>
  );
}

// React.MouseEvent handlers returned by useYeastHoverPreview. Pulled out
// as a named type because both StrainLedger and StrainCard pass them
// through unchanged — saving a verbose inline type at each call site.
type HoverTriggerProps = {
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
};

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

// ─── Section title ───────────────────────────────────────────────

function SectionTitle() {
  return (
    <header
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${hsTokens.yeast}`,
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
        Yeast.
      </h2>
    </header>
  );
}

// ─── Block primitives (shared by strain + starter blocks) ────────

const triggerPillStyle: CSSProperties = {
  background: hsTokens.paper,
  border: `1.5px solid ${hsTokens.ink}`,
  borderRadius: 999,
  padding: "6px 14px",
  width: "auto",
  height: "auto",
  boxShadow: hsTokens.sh1,
  color: hsTokens.ink,
  cursor: "pointer",
};

function BlockEyebrow({
  label,
  meta,
  right,
}: {
  label: string;
  meta?: string | null;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 2,
      }}
    >
      <Eyebrow size={11}>{label}</Eyebrow>
      <span
        aria-hidden
        style={{
          flex: 1,
          minWidth: 20,
          height: 1.5,
          background: hsTokens.ink,
          opacity: 0.18,
        }}
      />
      {meta ? (
        <HSScriptNote color={hsTokens.muted} size={16} rotate={-3}>
          {meta}
        </HSScriptNote>
      ) : null}
      {right}
    </div>
  );
}

function BlockHeaderActions({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {children}
    </div>
  );
}

// ─── Strain empty state ──────────────────────────────────────────

function StrainEmptyState({
  onAdd,
  generators,
  onApplyGenerator,
}: {
  onAdd: () => void;
  generators: YeastGenerator[];
  onApplyGenerator: (g: YeastGenerator) => void;
}) {
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
        gap: 16,
      }}
    >
      <HSScriptNote color={hsTokens.yeast} size={24} rotate={-4}>
        nothing pitched yet —
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 15,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 460,
          lineHeight: 1.4,
        }}
      >
        Pick a quick start, or browse the full library — we&apos;ll size your
        pitch and tell you whether you need a starter.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
          width: "100%",
          maxWidth: 580,
        }}
      >
        {generators.map((g) => (
          <button
            key={g.label}
            type="button"
            onClick={() => onApplyGenerator(g)}
            className="hs-yeast-gen-card"
            style={{
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 12,
              padding: "14px 16px",
              cursor: "pointer",
              boxShadow: hsTokens.sh2,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              textAlign: "left",
              fontFamily: hsTokens.body,
              color: hsTokens.ink,
              transition: "transform 90ms ease, box-shadow 90ms ease",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.01em",
                color: hsTokens.ink,
              }}
            >
              {g.label}
            </span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
              }}
            >
              {g.sub}
            </span>
          </button>
        ))}
      </div>
      <HSButton onClick={onAdd} color={hsTokens.yeast} size="md">
        Or browse the full library
      </HSButton>
    </div>
  );
}

// ─── Strain cards ────────────────────────────────────────────────

function StrainLedger({
  rows,
  yeastType,
  packs,
  slurryLiters,
  mfgDate,
  presetByName,
  recipeAbv,
  getHoverTriggerProps,
  onSwap,
  onRemove,
  onAttenuationChange,
  onAttenuationNudge,
  onPacksChange,
  onPacksNudge,
  onTypeChange,
  onMfgDateChange,
  onAdd,
}: {
  rows: StrainRowData[];
  yeastType: YeastType;
  packs: number;
  slurryLiters: number;
  mfgDate: string;
  presetByName: Map<string, YeastPreset>;
  recipeAbv: number | null;
  getHoverTriggerProps: (
    preset: YeastPreset | null | undefined
  ) => HoverTriggerProps;
  onSwap: (id: string) => void;
  onRemove: (id: string) => void;
  onAttenuationChange: (id: string, v: number) => void;
  onAttenuationNudge: (id: string, current: number, dir: 1 | -1) => void;
  onPacksChange: (id: string, v: number) => void;
  onPacksNudge: (id: string, current: number, dir: 1 | -1) => void;
  onTypeChange: (next: YeastType) => void;
  onMfgDateChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="hs-yeast-strain-list-wrap"
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      <div
        className="hs-yeast-strain-cards"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <LedgerRowsAnimated>
          {rows.map((r, i) => (
            <LedgerRowMotion key={r.yeast.id}>
              <StrainCard
                row={r}
                index={i}
                isOnlyOne={rows.length === 1}
                yeastType={yeastType}
                packs={packs}
                slurryLiters={slurryLiters}
                mfgDate={mfgDate}
                preset={presetByName.get(r.yeast.name) ?? null}
                recipeAbv={recipeAbv}
                hoverProps={getHoverTriggerProps(presetByName.get(r.yeast.name))}
                onSwap={() => onSwap(r.yeast.id)}
                onRemove={() => onRemove(r.yeast.id)}
                onAttenuationChange={(v) => onAttenuationChange(r.yeast.id, v)}
                onAttenuationNudge={(dir) =>
                  onAttenuationNudge(r.yeast.id, r.attenuationPct, dir)
                }
                onPacksChange={(v) => onPacksChange(r.yeast.id, v)}
                onPacksNudge={(dir) => {
                  const current = yeastType === "slurry" ? slurryLiters : packs;
                  onPacksNudge(r.yeast.id, current, dir);
                }}
                onTypeChange={onTypeChange}
                onMfgDateChange={onMfgDateChange}
              />
            </LedgerRowMotion>
          ))}
        </LedgerRowsAnimated>
      </div>
      <MobileAddRow onAdd={onAdd} label="+ Add another strain" />
    </div>
  );
}

/**
 * Strain-block header — section-style row (left-aligned title + hairline
 * running through it) with column labels punching paper-bg "windows" in
 * the line above their respective card columns. The title doubles as
 * the STRAIN column label so we don't duplicate it. ATTENUATION sits
 * over the atten chip; SOURCE centres over the packs cell via the same
 * right-flushed spacer pattern the card uses. The "+ Pick strain"
 * button parks on the right end of the line, also with a paper window
 * so the hairline ends cleanly into it. Empty state strips down to a
 * plain eyebrow.
 */
function StrainBlockHeader({
  hasStrains,
  onAdd,
}: {
  hasStrains: boolean;
  onAdd: () => void;
}) {
  if (!hasStrains) {
    return <BlockEyebrow label="The yeast strain" meta={null} right={null} />;
  }
  const labelStyle: CSSProperties = {
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: hsTokens.muted,
    lineHeight: 1,
  };
  // Inline span around each label punches a paper-bg "window" so the
  // continuous hairline behind the row visually breaks around the text.
  const punchStyle: CSSProperties = {
    background: hsTokens.paper,
    padding: "0 10px",
    position: "relative",
    zIndex: 1,
  };
  return (
    <div
      className="hs-yeast-strain-block-header"
      style={{
        position: "relative",
        minHeight: 28,
      }}
    >
      {/* Continuous hairline behind everything — section-divider style. */}
      <span
        aria-hidden
        className="hs-yeast-strain-block-rule"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 1.5,
          background: hsTokens.ink,
          opacity: 0.18,
          pointerEvents: "none",
        }}
      />

      {/* Title at the section's left edge — absolutely positioned so
          it doesn't claim a grid column (which would force the column
          labels out of alignment with the card content beneath). */}
      <div
        className="hs-yeast-strain-block-title"
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2,
        }}
      >
        <span style={{ ...punchStyle, paddingLeft: 0 }}>
          <Eyebrow size={11} style={{ whiteSpace: "nowrap" }}>
            The yeast strain
          </Eyebrow>
        </span>
      </div>

      {/* Column labels live in a grid whose template + horizontal
          padding match the StrainCard exactly, so labels sit directly
          above their respective card cells. Padding is 14px (not 12px)
          because the card has a 2px border outside its own 12px padding
          — the grid needs to clear both to land columns over chips. */}
      <div
        className="hs-yeast-strain-block-cols"
        style={{
          display: "grid",
          gridTemplateColumns:
            "44px minmax(140px, 1fr) 100px minmax(330px, auto) 28px",
          alignItems: "center",
          columnGap: 12,
          padding: "0 14px",
          minHeight: 28,
        }}
      >
        <span aria-hidden />
        <span aria-hidden />
        <div className="hs-yeast-strain-block-col-label">
          <span
            style={{ ...labelStyle, ...punchStyle, display: "inline-block" }}
          >
            Attenuation
          </span>
        </div>
        <div
          className="hs-yeast-strain-block-col-label"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <span
            aria-hidden
            style={{ display: "block", width: 100, height: 1 }}
          />
          <span
            style={{
              ...labelStyle,
              ...punchStyle,
              display: "inline-block",
              textAlign: "center",
            }}
          >
            Source
          </span>
          <span aria-hidden style={{ display: "block", width: 80, height: 1 }} />
        </div>
        <span aria-hidden />
      </div>

      {/* Button parks at the right end of the rule. A paper-bg sliver
          before the button cuts the hairline cleanly so it doesn't
          read as "continuing under the button". */}
      <div
        className="hs-yeast-strain-block-header-action"
        style={{
          position: "absolute",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          background: hsTokens.paper,
          paddingLeft: 12,
          zIndex: 2,
        }}
      >
        <HSButton onClick={onAdd} color={hsTokens.yeast} size="sm">
          + Pick strain
        </HSButton>
      </div>
    </div>
  );
}

function StrainCard({
  row,
  index,
  isOnlyOne,
  yeastType,
  packs,
  slurryLiters,
  mfgDate,
  preset,
  recipeAbv,
  hoverProps,
  onSwap,
  onRemove,
  onAttenuationChange,
  onAttenuationNudge,
  onPacksChange,
  onPacksNudge,
  onTypeChange,
  onMfgDateChange,
}: {
  row: StrainRowData;
  index: number;
  isOnlyOne: boolean;
  yeastType: YeastType;
  packs: number;
  slurryLiters: number;
  mfgDate: string;
  preset: YeastPreset | null;
  recipeAbv: number | null;
  hoverProps: HoverTriggerProps;
  onSwap: () => void;
  onRemove: () => void;
  onAttenuationChange: (v: number) => void;
  onAttenuationNudge: (dir: 1 | -1) => void;
  onPacksChange: (v: number) => void;
  onPacksNudge: (dir: 1 | -1) => void;
  onTypeChange: (next: YeastType) => void;
  onMfgDateChange: (v: string) => void;
}) {
  // Alcohol-tolerance flag — surfaces when the recipe's estimated ABV
  // approaches or exceeds the strain's published tolerance, i.e. when
  // we're at risk of a stuck ferment. Two bands:
  //  • "approaching" — within 1% below tolerance (honey, soft alert)
  //  • "exceeds"     — at/above tolerance (roast, stronger alert)
  // Brewer can still ship it; we just nudge. Rendered inline beneath
  // the lab caption so it stays visible without hover.
  const abvFlag: AbvFlag | null = useMemo(() => {
    if (recipeAbv == null || !preset?.alcoholTolerance) return null;
    const tol = preset.alcoholTolerance;
    if (recipeAbv >= tol) {
      return {
        kind: "exceeds",
        label: `${recipeAbv.toFixed(1)}% ABV · over ${Math.round(tol)}% max`,
        title: `${preset.name} tops out around ${Math.round(tol)}% ABV — your recipe is estimated at ${recipeAbv.toFixed(1)}%. Stuck-fermentation risk.`,
      };
    }
    if (tol - recipeAbv <= 1) {
      return {
        kind: "approaching",
        label: `${recipeAbv.toFixed(1)}% ABV · near ${Math.round(tol)}% max`,
        title: `${preset.name} tops out around ${Math.round(tol)}% ABV — your recipe is estimated at ${recipeAbv.toFixed(1)}%. Watch for sluggish finish.`,
      };
    }
    return null;
  }, [recipeAbv, preset]);
  // The yeast-type cycle only applies to the primary strain — multi-
  // strain blends share one set of source fields at the section level.
  const isPrimary = index === 0;
  const typeLabel =
    YEAST_TYPE_OPTIONS.find((o) => o.value === yeastType)?.short ?? yeastType;
  const ageStr = mfgAge(mfgDate);

  const packsValue = yeastType === "slurry" ? slurryLiters : packs;
  const packsFormat = (v: number) =>
    yeastType === "slurry" ? v.toFixed(1) : String(Math.round(v));
  const packsSuffix = yeastType === "slurry" ? "L" : "pack";
  const packsStep = yeastType === "slurry" ? 0.1 : 1;

  return (
    <div className="hs-yeast-strain-card" {...hoverProps}>
      {/* Lab favicon badge (click → swap strain) — enlarged from 36→44
          to match the card scale. */}
      <div
        className="hs-yeast-badge-cell"
        style={{
          gridArea: "badge",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={onSwap}
          aria-label={`Swap ${row.yeast.name}`}
          className="hs-yeast-badge-btn"
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: hsTokens.cream,
            border: `2px solid ${hsTokens.ink}`,
            boxShadow: hsTokens.sh1,
            padding: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <LabBadgeInner laboratory={row.yeast.laboratory} />
        </button>
      </div>

      {/* Strain identity — name + lab caption. */}
      <div style={{ gridArea: "identity", minWidth: 0 }}>
        <button
          type="button"
          onClick={onSwap}
          aria-label={`Swap ${row.yeast.name}`}
          className="hs-yeast-name-btn"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            textAlign: "left",
            color: hsTokens.ink,
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 15,
            lineHeight: 1.15,
            letterSpacing: "0.01em",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
            width: "100%",
          }}
        >
          <span
            className="hs-yeast-name"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.yeast.name}
          </span>
        </button>
        {row.yeast.laboratory ? (
          <span
            style={{
              display: "block",
              marginTop: 3,
              fontFamily: hsTokens.script,
              fontSize: 14,
              color: hsTokens.muted,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {row.yeast.laboratory}
          </span>
        ) : null}
        {abvFlag ? (
          <div style={{ marginTop: 5 }}>
            <StrainAbvChip flag={abvFlag} />
          </div>
        ) : null}
      </div>

      {/* Attenuation chip */}
      <div
        className="hs-yeast-edit-cell"
        style={{ gridArea: "atten", display: "flex", justifyContent: "flex-start" }}
      >
        <EditableCell
          value={row.attenuationPct}
          step={1}
          min={40}
          max={99}
          format={(v) => String(Math.round(v))}
          suffix="%"
          ariaLabel={`Attenuation for ${row.yeast.name}`}
          onCommit={onAttenuationChange}
          onNudge={onAttenuationNudge}
        />
      </div>

      {/* Source cluster — Type ▾ + Packs editable + Mfg date picker.
          Three pitch-metadata fields packed horizontally so they read as
          a single group, distinct from the yeast-identity group on the
          left. Right-aligned inside the cell. Slurry/dry hide the mfg
          picker (irrelevant — dry yeast has no per-pack viability decay). */}
      <div
        style={{
          gridArea: "source",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "nowrap",
          minWidth: 0,
        }}
      >
        {isPrimary ? (
          <>
            <HSActionMenu
              trigger={
                <span
                  style={{
                    fontFamily: hsTokens.body,
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  {typeLabel} ▾
                </span>
              }
              triggerAriaLabel="Change yeast source type"
              triggerStyle={typeChipStyle}
              items={YEAST_TYPE_OPTIONS.map((o) => ({
                label: o.label,
                onClick: () => onTypeChange(o.value),
              }))}
            />
            <EditableCell
              value={packsValue}
              step={packsStep}
              min={0}
              max={20}
              format={packsFormat}
              suffix={packsSuffix}
              ariaLabel={
                yeastType === "slurry"
                  ? `Slurry amount for ${row.yeast.name}`
                  : `Packs for ${row.yeast.name}`
              }
              onCommit={onPacksChange}
              onNudge={onPacksNudge}
            />
            {yeastType !== "dry" && yeastType !== "slurry" ? (
              <MfgDatePill value={mfgDate} onChange={onMfgDateChange} age={ageStr} />
            ) : null}
          </>
        ) : (
          <span style={{ fontFamily: hsTokens.script, fontSize: 16, color: hsTokens.muted }}>
            shares primary&apos;s source
          </span>
        )}
      </div>

      {/* Actions: remove ×. (Swap handled by clicking the strain name
          or the lab badge, so a dedicated pencil button is redundant.) */}
      <div
        style={{
          gridArea: "actions",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 2,
        }}
      >
        <IconBtn
          ariaLabel={`Remove ${row.yeast.name}`}
          onClick={onRemove}
          disabled={isOnlyOne}
          className="hs-yeast-remove-btn"
          danger
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
        </IconBtn>
      </div>

    </div>
  );
}

// ─── ABV-tolerance chip (rendered inline under the lab caption) ──────

type AbvFlag = {
  kind: "approaching" | "exceeds";
  label: string;
  title: string;
};

/**
 * Alcohol-tolerance flag — surfaces when the recipe's estimated ABV
 * approaches or exceeds the strain's published tolerance. Two tones:
 * honey for "approaching" (cautionary), roast for "exceeds" (warning).
 * Brewer can override by overpitching, picking a higher-tol strain, or
 * lowering OG; we just nudge.
 */
function StrainAbvChip({ flag }: { flag: AbvFlag }) {
  const exceeds = flag.kind === "exceeds";
  const accent = exceeds ? hsTokens.roast : hsTokens.honey;
  return (
    <span
      title={flag.title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        background: `color-mix(in srgb, ${hsTokens.paper} 78%, ${accent} 18%)`,
        border: `1.5px solid ${accent}`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: accent,
          border: `1px solid ${hsTokens.ink}`,
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: hsTokens.ink,
          letterSpacing: "0.01em",
        }}
      >
        {flag.label}
      </span>
    </span>
  );
}

// ─── Type chip + mfg date picker ─────────────────────────────────

const typeChipStyle: CSSProperties = {
  background: hsTokens.paper,
  border: `1.5px solid ${hsTokens.ink}`,
  borderRadius: 999,
  padding: "3px 10px",
  width: "auto",
  height: "auto",
  color: hsTokens.ink,
  cursor: "pointer",
  boxShadow: hsTokens.sh1,
};

/**
 * Manufacturing-date pill — clones the FermentationSection DatePill
 * pattern. The visible affordance is a styled pill (filled when a date
 * is set, dashed when empty); clicking calls `showPicker()` on a hidden
 * native `<input type="date">` so the OS calendar pops up over the row
 * instead of expanding inline as a second sub-row.
 */
function MfgDatePill({
  value,
  onChange,
  age,
}: {
  value: string;
  onChange: (v: string) => void;
  age: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    const el = inputRef.current;
    if (!el) return;
    type ShowPicker = () => void;
    const sp = (el as HTMLInputElement & { showPicker?: ShowPicker }).showPicker;
    if (typeof sp === "function") sp.call(el);
    else el.click();
  };

  const hasDate = Boolean(value);
  const text = hasDate ? (age ?? "set") : "mfg date";

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={hasDate ? `Change mfg date — currently ${age ?? value}` : "Set mfg date"}
        className="hs-yeast-date-pill"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          background: hasDate ? hsTokens.paper : "transparent",
          border: `1.5px solid ${hasDate ? hsTokens.ink : "rgba(26, 22, 18, 0.4)"}`,
          borderStyle: hasDate ? "solid" : "dashed",
          borderRadius: 999,
          padding: "4px 10px",
          cursor: "pointer",
          height: 26,
          boxShadow: hasDate ? hsTokens.sh1 : "none",
          fontFamily: hsTokens.body,
          color: hsTokens.ink,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            fontFamily: hasDate ? hsTokens.script : hsTokens.body,
            fontSize: hasDate ? 15 : 10,
            fontWeight: hasDate ? 500 : 700,
            letterSpacing: hasDate ? "0" : "0.14em",
            textTransform: hasDate ? "none" : "uppercase",
            color: hasDate ? hsTokens.ink : hsTokens.muted,
            lineHeight: 1,
          }}
        >
          {text}
        </span>
        {hasDate ? (
          <span
            role="button"
            aria-label="Clear mfg date"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange("");
              }
            }}
            style={{
              fontFamily: hsTokens.body,
              fontSize: 13,
              color: hsTokens.muted,
              cursor: "pointer",
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            ×
          </span>
        ) : null}
      </button>
      {/* Hidden native date input — triggered via showPicker() above.
          Position off-screen but keep mounted so the ref stays stable. */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-hidden
        tabIndex={-1}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          left: 0,
          top: 26,
        }}
      />
    </div>
  );
}

function mfgAge(mfgDate: string): string | null {
  if (!mfgDate) return null;
  const [y, m, d] = mfgDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const made = new Date(y, m - 1, d, 12);
  const days = Math.floor((Date.now() - made.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days === 0) return "today";
  if (days < 30) return `${days}d old`;
  const months = Math.floor(days / 30);
  return `${months}mo old`;
}

// ─── Lab badge (favicon → letter fallback) ───────────────────────

function LabBadgeInner({ laboratory }: { laboratory?: string }) {
  const favicon = getYeastLabFavicon(laboratory);
  if (favicon) {
    return (
      <img
        src={favicon}
        alt={laboratory || "Yeast lab"}
        width={28}
        height={28}
        style={{
          width: 28,
          height: 28,
          objectFit: "contain",
          display: "block",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        fontFamily: hsTokens.display,
        fontSize: 18,
        color: hsTokens.yeast,
        lineHeight: 1,
      }}
    >
      {laboratory?.charAt(0).toUpperCase() || "Y"}
    </span>
  );
}

// ─── Starter block (second main-column block) ────────────────────

function StarterBlock({
  steps,
  stepResults,
  modelKey,
  onModelChange,
  onAddStep,
  onUpdateStep,
  onRemoveStep,
  underpitched,
  deficit,
}: {
  steps: StarterStep[];
  stepResults: Array<{ id: string; dmeGrams: number; endBillion: number }>;
  modelKey: YeastModelKey;
  onModelChange: (next: YeastModelKey) => void;
  onAddStep: () => void;
  onUpdateStep: (id: string, updates: Partial<StarterStep>) => void;
  onRemoveStep: (id: string) => void;
  underpitched: boolean;
  /** Available − Required in billions of cells. Negative when underpitched. */
  deficit: number;
}) {
  // State 1: steps exist → full ledger view with header chrome.
  if (steps.length > 0) {
    const totalLiters = steps.reduce((sum, s) => sum + s.liters, 0);
    const totalDme = stepResults.reduce((sum, r) => sum + r.dmeGrams, 0);
    const atMax = steps.length >= 3;
    const modelLabel =
      STARTER_MODEL_OPTIONS.find((o) => o.value === modelKey)?.label ?? "Shaking";

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <BlockEyebrow
          label="The starter schedule"
          meta={`${steps.length} ${steps.length === 1 ? "step" : "steps"} · ${totalLiters.toFixed(1)} L · ${Math.round(totalDme)} g DME · ${modelLabel.toLowerCase()}`}
          right={
            <BlockHeaderActions>
              <HSActionMenu
                trigger={
                  <span
                    style={{
                      fontFamily: hsTokens.body,
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    Method ▾
                  </span>
                }
                triggerAriaLabel="Change growth model"
                triggerStyle={triggerPillStyle}
                items={STARTER_MODEL_OPTIONS.map((o) => ({
                  label: o.label,
                  onClick: () => onModelChange(o.value),
                }))}
              />
              <HSButton
                onClick={onAddStep}
                color={hsTokens.yeast}
                size="sm"
                disabled={atMax}
              >
                {atMax ? "Max 3 steps" : "+ Add step"}
              </HSButton>
            </BlockHeaderActions>
          }
        />
        <StarterLedger
          steps={steps}
          stepResults={stepResults}
          onUpdate={onUpdateStep}
          onRemove={onRemoveStep}
        />
      </div>
    );
  }

  // State 2: no steps + underpitched → PROMINENT prompt.
  if (underpitched) {
    return <StarterPromptProminent onAdd={onAddStep} deficit={Math.abs(deficit)} />;
  }

  // State 3: no steps + adequate pitch → subtle one-line hint.
  return <StarterPromptSubtle onAdd={onAddStep} />;
}

/**
 * Prominent starter prompt — surfaces when the brewer is underpitched.
 * Tone is honey + yeast-peach (warm, helpful), not roast (alarm). The
 * cell deficit is surfaced as a concrete number so the brewer knows the
 * size of the gap, but the framing reads as a friendly suggestion — not
 * a warning the recipe is broken.
 */
function StarterPromptProminent({
  onAdd,
  deficit,
}: {
  onAdd: () => void;
  deficit: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          paddingTop: 2,
        }}
      >
        <Eyebrow size={11} color={hsTokens.honey}>
          Let&apos;s grow your pitch
        </Eyebrow>
        <span
          aria-hidden
          style={{
            flex: 1,
            minWidth: 20,
            height: 1.5,
            background: hsTokens.honey,
            opacity: 0.32,
          }}
        />
        <HSScriptNote color={hsTokens.muted} size={16} rotate={-3}>
          {Math.round(deficit)} B cells shy
        </HSScriptNote>
      </div>

      <div
        style={{
          // Honey-tinted cream2 — warm and inviting, not alarming. The
          // accent reads as "here's a nudge" rather than "your recipe is
          // broken". Boil-temp honey on cream is also the same family
          // the brewer's-notes card uses, which keeps the palette tight.
          background: "color-mix(in srgb, var(--hs-cream-2) 80%, var(--hs-honey) 16%)",
          border: `2px solid ${hsTokens.honey}`,
          borderRadius: 12,
          padding: "22px 24px",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          boxShadow: hsTokens.sh2,
        }}
      >
        <HSScriptNote color={hsTokens.yeast} size={24} rotate={-4}>
          build a starter —
        </HSScriptNote>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 14,
            color: hsTokens.ink,
            margin: 0,
            maxWidth: 520,
            lineHeight: 1.45,
          }}
        >
          You&apos;re <strong>{Math.round(deficit)} billion cells shy</strong> of a
          healthy pitch — a small starter (about 1–2 L of 1.036 wort) usually
          closes the gap. We&apos;ll size the DME and project the cell count as
          you tune it.
        </p>
        <HSButton onClick={onAdd} color={hsTokens.yeast} size="md">
          + Build a starter
        </HSButton>
      </div>
    </div>
  );
}

/**
 * Subtle starter hint — surfaces when the brewer has enough cells for a
 * healthy pitch. The block stays out of the way: no eyebrow header, no
 * full card, just a single muted line with an inline "add starter" link.
 * Brewers who want a margin (older yeast, lager pitch rate, etc.) can
 * click in; brewers who don't can ignore it.
 */
function StarterPromptSubtle({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 4px 2px",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.script,
          fontSize: 15,
          color: hsTokens.muted,
          lineHeight: 1.2,
        }}
      >
        We have enough cells. Starter optional.
      </span>
      <button
        type="button"
        onClick={onAdd}
        className="hs-yeast-subtle-add"
        style={{
          background: "transparent",
          border: "none",
          padding: "2px 0",
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          cursor: "pointer",
          borderBottom: `1.5px dotted ${hsTokens.ink}55`,
        }}
      >
        + Add starter
      </button>
    </div>
  );
}

// ─── Starter ledger (Hop-style — echoes the mash ledger so the two
// step-based blocks share a visual language). 6 cols: # / label /
// size / gravity / DME (read-only tinted stripe) / × ──────────────

const STARTER_LEDGER_COLS = "44px minmax(0, 1.5fr) 132px 150px 100px 64px";

function StarterLedger({
  steps,
  stepResults,
  onUpdate,
  onRemove,
}: {
  steps: StarterStep[];
  stepResults: Array<{ id: string; dmeGrams: number; endBillion: number }>;
  onUpdate: (id: string, updates: Partial<StarterStep>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="hs-yeast-ledger hs-yeast-starter-ledger"
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        overflow: "hidden",
      }}
    >
      <StarterLedgerHead />
      {steps.map((s, i) => {
        const res = stepResults[i];
        return (
          <StarterLedgerRow
            key={s.id}
            step={s}
            index={i}
            isLast={i === steps.length - 1}
            dmeGrams={res?.dmeGrams ?? null}
            onSizeChange={(v) => onUpdate(s.id, { liters: Math.max(0.1, v) })}
            onSizeNudge={(dir) =>
              onUpdate(s.id, {
                liters: Math.max(0.1, parseFloat((s.liters + dir * 0.5).toFixed(1))),
              })
            }
            onGravityChange={(v) => onUpdate(s.id, { gravity: Math.max(1.0, v) })}
            onGravityNudge={(dir) =>
              onUpdate(s.id, {
                gravity: Math.max(1.0, parseFloat((s.gravity + dir * 0.002).toFixed(3))),
              })
            }
            onRemove={() => onRemove(s.id)}
          />
        );
      })}
    </div>
  );
}

function StarterLedgerHead() {
  const cellStyle: CSSProperties = {
    display: "block",
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: hsTokens.muted,
    lineHeight: 1,
  };
  return (
    <div
      className="hs-yeast-ledger-head-row"
      style={{
        display: "grid",
        gridTemplateColumns: STARTER_LEDGER_COLS,
        padding: "10px 18px 8px",
        borderBottom: `2px solid ${hsTokens.ink}`,
        // Section-tinted ledger head: ~7% yeast mixed into cream.
        background: "color-mix(in srgb, var(--hs-cream) 96%, var(--hs-yeast))",
        gap: 14,
        alignItems: "center",
      }}
    >
      <span style={{ ...cellStyle, textAlign: "center" }}>#</span>
      <span style={cellStyle}>Step</span>
      <span style={{ ...cellStyle, textAlign: "center", paddingRight: 32 }}>Size</span>
      <span style={{ ...cellStyle, textAlign: "center", paddingRight: 32 }}>Gravity</span>
      <span style={{ ...cellStyle, textAlign: "center" }}>DME</span>
      <span style={{ ...cellStyle, textAlign: "right" }}>—</span>
    </div>
  );
}

function StarterLedgerRow({
  step,
  index,
  isLast,
  dmeGrams,
  onSizeChange,
  onSizeNudge,
  onGravityChange,
  onGravityNudge,
  onRemove,
}: {
  step: StarterStep;
  index: number;
  isLast: boolean;
  dmeGrams: number | null;
  onSizeChange: (v: number) => void;
  onSizeNudge: (dir: 1 | -1) => void;
  onGravityChange: (v: number) => void;
  onGravityNudge: (dir: 1 | -1) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="hs-yeast-ledger-row hs-yeast-data-row"
      style={{
        display: "grid",
        gridTemplateColumns: STARTER_LEDGER_COLS,
        padding: "14px 18px",
        borderBottom: isLast ? "none" : `1px solid ${hsTokens.ink}22`,
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* Step # badge */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <span
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: hsTokens.yeast,
            border: `2px solid ${hsTokens.ink}`,
            boxShadow: hsTokens.sh1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: hsTokens.display,
            fontSize: 14,
            color: hsTokens.ink,
            lineHeight: 1,
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* Step label */}
      <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 15,
            lineHeight: 1.15,
            letterSpacing: "0.01em",
            color: hsTokens.ink,
          }}
        >
          Starter step {index + 1}
        </span>
      </div>

      {/* Size chip */}
      <div className="hs-yeast-edit-cell" style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={step.liters}
          step={0.5}
          min={0.1}
          max={50}
          format={(v) => v.toFixed(1)}
          suffix="L"
          ariaLabel={`Size for starter step ${index + 1}`}
          onCommit={onSizeChange}
          onNudge={onSizeNudge}
        />
      </div>

      {/* Gravity chip */}
      <div className="hs-yeast-edit-cell" style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={step.gravity}
          step={0.002}
          min={1.0}
          max={1.1}
          format={(v) => v.toFixed(3)}
          suffix="SG"
          ariaLabel={`Gravity for starter step ${index + 1}`}
          onCommit={onGravityChange}
          onNudge={onGravityNudge}
        />
      </div>

      {/* DME (computed, read-only) — yeast-tinted stripe that extends
          edge-to-edge across the cell. Negative vertical margin cancels
          the row's 14px padding so the stripe meets the row's top and
          bottom borders. Mirrors the hops IBU column pattern. */}
      <div
        className="hs-yeast-dme-cell"
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          background:
            "color-mix(in srgb, color-mix(in srgb, var(--hs-ink) 5%, var(--hs-paper)) 96%, var(--hs-yeast))",
          padding: "14px 12px",
          margin: "-14px 0",
        }}
        title="DME needed for this starter step"
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 22,
            color: hsTokens.ink,
            letterSpacing: "-0.01em",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {dmeGrams != null ? Math.round(dmeGrams) : "—"}
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
      </div>

      {/* Actions: remove × */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 2,
        }}
      >
        <IconBtn
          ariaLabel={`Remove starter step ${index + 1}`}
          onClick={onRemove}
          className="hs-yeast-remove-btn"
          danger
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </IconBtn>
      </div>
    </div>
  );
}

// ─── Editable chip — paper bg, script numerals, yeast-bordered input ─

function EditableCell({
  value,
  onCommit,
  onNudge,
  step,
  min,
  max,
  format,
  suffix,
  ariaLabel,
}: {
  value: number;
  onCommit: (v: number) => void;
  onNudge: (dir: 1 | -1) => void;
  step: number;
  min?: number;
  max?: number;
  format: (v: number) => string;
  suffix?: string;
  ariaLabel: string;
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
      if (!Number.isNaN(parsed)) {
        const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, parsed));
        if (clamped !== value) onCommit(clamped);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
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
        step={step}
        min={min}
        max={max}
        aria-label={ariaLabel}
        style={{
          width: 96,
          background: hsTokens.cream,
          border: `1.5px solid ${hsTokens.yeast}`,
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
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        type="button"
        onClick={enterEdit}
        aria-label={`Edit ${format(value)}${suffix ?? ""}`}
        className="hs-yeast-edit-btn"
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
          boxShadow: hsTokens.sh1,
          transition: "background 90ms ease, box-shadow 90ms ease",
        }}
      >
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
        onUp={() => onNudge(1)}
        onDown={() => onNudge(-1)}
      />
    </div>
  );
}

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
      className="hs-yeast-steppers"
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
        e.currentTarget.style.background = hsTokens.yeast;
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

function IconBtn({
  children,
  onClick,
  ariaLabel,
  disabled,
  className,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
      style={{
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.25 : 0.55,
        color: danger ? hsTokens.roast : hsTokens.ink,
        padding: 0,
        transition: "opacity 90ms ease, background 90ms ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.background = danger
          ? "rgba(212, 69, 44, 0.12)"
          : hsTokens.cream2;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "0.55";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ─── Pitch readout (sidebar visualizer) ─────────────────────────

function PitchReadout({
  available,
  required,
  diff,
  underpitched,
  hasStrain,
  starterCount,
}: {
  available: number;
  required: number;
  diff: number;
  underpitched: boolean;
  hasStrain: boolean;
  starterCount: number;
}) {
  const availStr = hasStrain ? `${available.toFixed(0)} B` : "—";
  const reqStr = hasStrain ? `${required.toFixed(0)} B` : "—";
  const diffPrefix = diff >= 0 ? "+" : "";
  const diffStr = hasStrain ? `${diffPrefix}${diff.toFixed(0)} B` : "—";
  const diffColor = !hasStrain ? hsTokens.muted : underpitched ? hsTokens.roast : hsTokens.hops;

  return (
    <div
      className="hs-yeast-readout"
      style={{
        // Subtle ingredient tint: ~5% yeast in the bg AND ~15% mixed into
        // the ink border. Compound signal — neither dimension loud alone.
        background:
          "color-mix(in srgb, color-mix(in srgb, var(--hs-cream), var(--hs-cream-2)) 95%, var(--hs-yeast))",
        border: `2px solid color-mix(in srgb, ${hsTokens.ink} 85%, var(--hs-yeast))`,
        borderRadius: 12,
        boxShadow: hsTokens.sh3,
        padding: "14px 16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {/* Card header — names what the readout is so the brewer doesn't
          have to infer "B" stands for billion cells. Single Eyebrow,
          hairline divider, no subtitle (the row values speak for
          themselves once the section name is established). */}
      <div
        style={{
          borderBottom: `1px solid ${hsTokens.ink}22`,
          paddingBottom: 8,
          marginBottom: 2,
        }}
      >
        <Eyebrow size={11}>Cells</Eyebrow>
      </div>
      <ReadoutRow
        label="Available"
        sub={starterCount > 0 ? `after ${starterCount} starter step${starterCount === 1 ? "" : "s"}` : null}
        value={availStr}
      />
      <ReadoutRow label="Required" value={reqStr} />
      <ReadoutRow
        label={underpitched && hasStrain ? "Deficit" : "Surplus"}
        sub={
          !hasStrain
            ? "pick a strain"
            : underpitched
              ? "add a starter step"
              : "good to pitch"
        }
        value={diffStr}
        valueColor={diffColor}
      />
    </div>
  );
}

function ReadoutRow({
  label,
  sub,
  value,
  valueColor,
}: {
  label: string;
  sub?: string | null;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        padding: "3px 0",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 8,
          minWidth: 0,
        }}
      >
        <Eyebrow size={10}>{label}</Eyebrow>
        {sub ? (
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 13,
              color: hsTokens.muted,
              lineHeight: 1,
            }}
          >
            {sub}
          </span>
        ) : null}
      </div>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 17,
          color: valueColor ?? hsTokens.ink,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}


// ─── Eyebrow ──────────────────────────────────────────────────────

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

// ─── Dashed border SVG bg helper ─────────────────────────────────

function dashedBorderBg(
  color: string,
  opts: { dash: number; gap: number; strokeWidth: number; radius: number }
) {
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
const MOBILE_ADD_DASH = 12;
const MOBILE_ADD_GAP = 8;
const MOBILE_ADD_STROKE = 1.75;

function MobileAddRow({ onAdd, label }: { onAdd: () => void; label: string }) {
  const restBg = "color-mix(in srgb, var(--hs-cream-2) 65%, transparent)";
  const restBorder = dashedBorderBg("#5a4f42", {
    dash: MOBILE_ADD_DASH,
    gap: MOBILE_ADD_GAP,
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  const hoverBorder = dashedBorderBg("#1a1612", {
    dash: MOBILE_ADD_DASH,
    gap: MOBILE_ADD_GAP,
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  return (
    <button
      type="button"
      className="hs-yeast-mobile-add"
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
        e.currentTarget.style.backgroundColor = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.ink;
        e.currentTarget.style.backgroundImage = hoverBorder;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = restBg;
        e.currentTarget.style.color = hsTokens.muted;
        e.currentTarget.style.backgroundImage = restBorder;
      }}
    >
      {label}
    </button>
  );
}

// ─── Styles (responsive + row hover) ─────────────────────────────

function YeastSectionStyles() {
  return (
    <style>{`
      .hs-yeast-section .hs-yeast-grid {
        display: flex;
        flex-direction: column;
        row-gap: 16px;
        min-width: 0;
      }
      .hs-yeast-section .hs-yeast-grid-lhead { min-width: 0; }
      .hs-yeast-section .hs-yeast-grid-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .hs-yeast-section .hs-yeast-block {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .hs-yeast-section .hs-yeast-strain-list-wrap { min-width: 0; }

      /* The LedgerRowMotion wrapper sets overflow:hidden inline so the
         exit animation can collapse height to 0. That clips the strain
         card's 2px hard shadow. Override here so the shadow renders the
         same way it does in FermentableSection (which has no motion
         wrapper). During exit the height still animates to 0 — fading
         opacity hides the brief overflow. */
      .hs-yeast-section .hs-yeast-strain-cards > div {
        overflow: visible !important;
      }

      @media (max-width: 900px) {
        .hs-yeast-section .hs-yeast-grid { row-gap: 14px; }
      }

      /* Strain card — badge | identity | atten | source | actions.
         Resting body carries a gentle yeast wash at the same intensity
         as the starter ledger head (~4%) so the two yeast surfaces
         read at matching strength. Fixed-pixel columns (not auto) so
         the labels in StrainBlockHeader can line up deterministically. */
      .hs-yeast-section .hs-yeast-strain-card {
        display: grid;
        grid-template-columns: 44px minmax(140px, 1fr) 100px minmax(330px, auto) 28px;
        grid-template-areas: "badge identity atten source actions";
        align-items: center;
        column-gap: 12px;
        row-gap: 8px;
        padding: 10px 12px;
        background: color-mix(in srgb, var(--hs-cream) 96%, var(--hs-yeast));
        border: 2px solid var(--hs-ink);
        border-radius: 10px;
        box-shadow: 2px 2px 0 var(--hs-ink);
      }

      /* Starter ledger — Hop-style connected table inside a paper-bg
         frame. Last data row gets bottom-corner radius so the
         hover-tinted background stays inside the rounded outline. */
      .hs-yeast-section .hs-yeast-starter-ledger > .hs-yeast-data-row:last-of-type {
        border-bottom-left-radius: 12px;
        border-bottom-right-radius: 12px;
      }

      /* Desktop hover — strain cards lift; starter rows just tint. */
      @media (min-width: 561px) and (hover: hover) {
        .hs-yeast-section .hs-yeast-strain-card {
          transition: box-shadow 110ms ease, transform 110ms ease, background 110ms ease;
        }
        .hs-yeast-section .hs-yeast-strain-card:hover {
          background: color-mix(in srgb, var(--hs-cream) 88%, var(--hs-yeast));
          box-shadow: 3px 3px 0 var(--hs-ink);
          transform: translate(-1px, -1px);
        }
        .hs-yeast-section .hs-yeast-remove-btn {
          opacity: 0.32;
          transition: opacity 90ms ease, background 90ms ease;
        }
        .hs-yeast-section .hs-yeast-strain-card:hover .hs-yeast-remove-btn {
          opacity: 1;
        }
        .hs-yeast-section .hs-yeast-remove-btn:hover {
          background: rgba(212, 69, 44, 0.12);
        }
        .hs-yeast-section .hs-yeast-name-btn:hover .hs-yeast-name {
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .hs-yeast-section .hs-yeast-edit-btn:hover {
          background: ${hsTokens.cream2};
        }
        .hs-yeast-section .hs-yeast-gen-card:hover {
          transform: translate(-1px, -1px);
          box-shadow: ${hsTokens.sh3};
        }
        .hs-yeast-section .hs-yeast-badge-btn:hover {
          transform: translate(-1px, -1px);
          box-shadow: ${hsTokens.sh2};
        }
        .hs-yeast-section .hs-yeast-subtle-add:hover {
          color: ${hsTokens.ink} !important;
          border-bottom-style: solid !important;
        }
      }

      @media (min-width: 641px) and (hover: hover) {
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row {
          transition: background 90ms ease;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row:hover {
          background: color-mix(in srgb, color-mix(in srgb, var(--hs-paper) 20%, var(--hs-cream-2)) 98%, var(--hs-yeast));
        }
      }

      /* Mobile (≤560px) — strain reflows to 3-row card layout. Strain
         block header drops column labels (cards' grid is different
         under reflow). Title + button stay, plus the section rule
         between them. */
      @media (max-width: 560px) {
        .hs-yeast-section .hs-yeast-mobile-add { display: flex !important; }
        .hs-yeast-section .hs-yeast-strain-block-cols {
          display: none !important;
        }
        .hs-yeast-section .hs-yeast-strain-block-title {
          position: static !important;
          transform: none !important;
        }
        .hs-yeast-section .hs-yeast-strain-block-header {
          display: flex !important;
          align-items: center;
          gap: 10px;
          min-height: 28px;
        }
        .hs-yeast-section .hs-yeast-strain-block-header-action {
          position: static !important;
          transform: none !important;
          margin-left: auto;
        }

        .hs-yeast-section .hs-yeast-strain-card {
          grid-template-columns: auto minmax(0, 1fr) auto;
          grid-template-areas:
            "badge identity actions"
            "atten atten    atten"
            "source source  source";
          row-gap: 10px;
        }
        .hs-yeast-section .hs-yeast-strain-card .hs-yeast-edit-cell {
          justify-content: flex-start !important;
        }

        /* Always-visible bare steppers + actions (touch can't hover). */
        .hs-yeast-section .hs-yeast-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 2px !important;
        }
        .hs-yeast-section .hs-yeast-remove-btn { opacity: 1 !important; }

        .hs-yeast-section { padding: 18px 14px !important; }
      }

      /* Mobile (≤640px) — starter ledger collapses to stacked rows
         like the mash ledger does. */
      @media (max-width: 640px) {
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 0 !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-steppers button {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          width: 26px !important;
          height: 22px !important;
          color: ${hsTokens.muted} !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-steppers button svg {
          width: 14px !important;
          height: 9px !important;
          stroke-width: 2 !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-remove-btn {
          opacity: 1 !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-ledger-head-row {
          display: none !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row {
          display: grid !important;
          grid-template-columns: 44px minmax(0, 1fr) auto !important;
          grid-template-areas:
            "badge label   actions"
            "size  gravity dme" !important;
          column-gap: 12px !important;
          row-gap: 10px !important;
          padding: 16px 0 !important;
          border-bottom: 1px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row:last-of-type {
          border-bottom: none !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row > :nth-child(1) {
          grid-area: badge;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row > :nth-child(2) {
          grid-area: label;
          min-width: 0;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row > :nth-child(3) {
          grid-area: size !important;
          justify-self: start !important;
          justify-content: flex-start;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row > :nth-child(4) {
          grid-area: gravity !important;
          justify-self: center !important;
          justify-content: center;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row > :nth-child(5) {
          grid-area: dme !important;
          justify-self: end !important;
          justify-content: flex-end;
          margin: 0 !important;
        }
        .hs-yeast-section .hs-yeast-starter-ledger .hs-yeast-data-row > :nth-child(6) {
          grid-area: actions;
          justify-self: end;
        }
      }
    `}</style>
  );
}

// ─── Helper-card container (mounted by HelperCardMorph) ───────────

export function YeastHelperCard() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const calculations = useRecipeCalculations(currentRecipe);
  const yeastPresetsGrouped = usePresetStore((s) => s.yeastPresetsGrouped);
  const yeasts = useMemo(
    () => currentRecipe?.yeasts ?? [],
    [currentRecipe?.yeasts]
  );
  const primary: Yeast | null = yeasts[0] ?? null;
  // Look up the primary strain's preset so the starter-type fallback
  // can mirror form/category instead of always assuming liquid-100.
  const primaryPreset = useMemo<YeastPreset | null>(() => {
    if (!primary) return null;
    for (const group of yeastPresetsGrouped) {
      for (const p of group.items) if (p.name === primary.name) return p;
    }
    return null;
  }, [primary, yeastPresetsGrouped]);
  const starterInfo: StarterInfo = useMemo(
    () =>
      primary?.starter ?? {
        yeastType: inferDefaultYeastType(primaryPreset),
        packs: 1,
        mfgDate: "",
        slurryLiters: 0,
        slurryBillionPerMl: 1,
        steps: [],
      },
    [primary, primaryPreset]
  );
  const starterResults = useMemo(() => {
    if (!currentRecipe) return null;
    return starterCalculationService.calculateStarter(
      currentRecipe.batchVolumeL || 20,
      calculations?.og ?? 1.05,
      starterInfo.yeastType,
      starterInfo.packs,
      starterInfo.mfgDate,
      starterInfo.slurryLiters ?? 0,
      starterInfo.slurryBillionPerMl ?? 1,
      starterInfo.steps
    );
  }, [currentRecipe, calculations?.og, starterInfo]);
  const hasSteps = starterInfo.steps.length > 0;
  const availableCells = starterResults
    ? hasSteps
      ? starterResults.finalEndB
      : starterResults.cellsAvailableB
    : 0;
  const requiredCells = starterResults?.requiredCellsB ?? 0;
  const cellDiff = availableCells - requiredCells;
  const underpitched = cellDiff < 0;
  if (yeasts.length === 0) return null;
  return (
    <PitchReadout
      available={availableCells}
      required={requiredCells}
      diff={cellDiff}
      underpitched={underpitched}
      hasStrain={!!primary}
      starterCount={starterInfo.steps.length}
    />
  );
}
