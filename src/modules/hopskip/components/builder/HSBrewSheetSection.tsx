"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import type {
  FermentationStep,
  FermentationStepType,
  Recipe,
  RecipeCalculations,
} from "@/modules/beta-builder/domain/models/Recipe";
import type {
  BrewSession,
  GravityLogEntry,
  OgFixChoice,
  SessionActuals,
  SessionStatus,
} from "@/modules/beta-builder/domain/models/BrewSession";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { waterChemistryService } from "@/modules/beta-builder/domain/services/WaterChemistryService";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { postBoilVolume } from "@/calculators/boilOff";
import { dilutionWater } from "@/calculators/dilution";
import { abvFromOGFG } from "@/calculators/abv";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import { hsTokens } from "@/modules/hopskip/tokens";
import { getYeastLabFavicon } from "@/modules/beta-builder/presentation/utils/yeastLabIcons";

/**
 * Bundles the brew-mode props that get threaded into every wired cell.
 * When this is null, the sheet renders display-only (blank paper cells).
 */
type BrewMode = {
  actuals: SessionActuals;
  addedFlags: Record<string, boolean>;
  onActualsChange: (partial: Partial<SessionActuals>) => void;
  onAddedChange: (id: string, checked: boolean) => void;
  /**
   * Commit a per-ingredient actual amount (in the ingredient's native unit).
   * Pass `undefined` to clear. Writes to `actuals.ingredientActualAmounts[id]`.
   */
  onIngredientActualChange: (id: string, amount: number | undefined) => void;
};

interface Props {
  recipe: Recipe;
  calculations: RecipeCalculations | null;

  // ─── Brew Mode (Phase 2.5b) ───
  /** When true, blank actual cells become controlled inputs. */
  isBrewMode?: boolean;
  /** Current session id (only when isBrewMode). */
  sessionId?: string;
  /** Session status for the pill in TitleBlock. */
  sessionStatus?: SessionStatus;
  /** Actual measurements for the loaded session. */
  actuals?: SessionActuals;
  /** Onboarding flags — which hop / other-ingredient ids have been "added". */
  addedFlags?: Record<string, boolean>;
  /** Commit partial actuals to the store (writes are auto-saved upstream). */
  onActualsChange?: (partial: Partial<SessionActuals>) => void;
  /** Commit an "Added" checkbox toggle. */
  onAddedChange?: (id: string, checked: boolean) => void;
  /** Commit a per-ingredient actual amount (in the ingredient's native unit). */
  onIngredientActualChange?: (id: string, amount: number | undefined) => void;
  /** Status pill change. */
  onStatusChange?: (status: SessionStatus) => void;
  /** Brew toggle handler — entry or exit. Undefined disables the toggle. */
  onToggleBrewMode?: () => void;
  /** Prior sessions for this recipe (for the picker dropdown). */
  priorSessions?: BrewSession[];
  /** Resume a specific prior session by id. */
  onResumeSession?: (id: string) => void;
  /** Start a brand-new session (from the picker). */
  onCreateNewSession?: () => void;
}

const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
const lToGal = (l: number) => (l * 0.264172).toFixed(2);
const kgToLb = (kg: number) => (kg * 2.20462).toFixed(2);

/**
 * Returns a recipe clone with fermentable weights and hop grams substituted from
 * the user's actual brew-day measurements. Only ids present in `actualAmounts`
 * are overridden — planned amounts stay otherwise. Used for recomputing OG/IBU/SRM
 * from actuals (Phase 2.5b Brew Mode).
 *
 * Water salts and other-ingredient actuals are intentionally skipped — the mash
 * pH / final water profile recompute path is more involved and lives in a follow-up.
 */
function applyIngredientActualsToRecipe(
  recipe: Recipe,
  actualAmounts: Record<string, number> | undefined,
  mashSplitSalts?: SaltAdditionsObj,
  spargeSplitSalts?: SaltAdditionsObj,
): Recipe {
  if (!actualAmounts || Object.keys(actualAmounts).length === 0) return recipe;
  let touched = false;
  const fermentables = recipe.fermentables.map((f) => {
    const actual = actualAmounts[f.id];
    if (actual !== undefined && Math.abs(actual - f.weightKg) > 0.0001) {
      touched = true;
      return { ...f, weightKg: actual };
    }
    return f;
  });
  const hops = recipe.hops.map((h) => {
    const actual = actualAmounts[h.id];
    if (actual !== undefined && Math.abs(actual - h.grams) > 0.0001) {
      touched = true;
      return { ...h, grams: actual };
    }
    return h;
  });

  // Salt substitution — when user has entered actual mash/sparge amounts via
  // `salt:mash:<key>` / `salt:sparge:<key>` ids, sum them into a new total and
  // override recipe.waterChemistry.saltAdditions. This lets `estimatedMashPh`
  // and downstream mash-pH math reflect actual salt loading.
  let adjustedSalts: SaltAdditionsObj | undefined;
  if (
    recipe.waterChemistry?.saltAdditions &&
    mashSplitSalts &&
    spargeSplitSalts
  ) {
    const planned = recipe.waterChemistry.saltAdditions as SaltAdditionsObj;
    const next: SaltAdditionsObj = { ...planned };
    let saltTouched = false;
    SALT_DEFS.forEach((d) => {
      const mashActual = actualAmounts[`salt:mash:${d.key}`];
      const spargeActual = actualAmounts[`salt:sparge:${d.key}`];
      if (mashActual !== undefined || spargeActual !== undefined) {
        const mash = mashActual ?? mashSplitSalts[d.key] ?? 0;
        const sparge = spargeActual ?? spargeSplitSalts[d.key] ?? 0;
        next[d.key] = mash + sparge;
        saltTouched = true;
      }
    });
    if (saltTouched) {
      adjustedSalts = next;
      touched = true;
    }
  }

  if (!touched) return recipe;
  const out: Recipe = { ...recipe, fermentables, hops };
  if (adjustedSalts && recipe.waterChemistry) {
    out.waterChemistry = {
      ...recipe.waterChemistry,
      saltAdditions: adjustedSalts,
    };
  }
  return out;
}

type SaltAdditionsObj = NonNullable<
  NonNullable<Recipe["waterChemistry"]>["saltAdditions"]
>;

export default function HSBrewSheetSection({
  recipe,
  calculations,
  isBrewMode = false,
  sessionStatus,
  actuals,
  addedFlags,
  onActualsChange,
  onAddedChange,
  onIngredientActualChange,
  onStatusChange,
  onToggleBrewMode,
  priorSessions,
  onResumeSession,
  onCreateNewSession,
}: Props) {
  const handlePrint = useCallback(() => {
    if (typeof window !== "undefined") window.print();
  }, []);

  // Only thread the BrewMode bundle into children when all the handlers are wired.
  const brewMode: BrewMode | null =
    isBrewMode && onActualsChange && onAddedChange && onIngredientActualChange
      ? {
          actuals: actuals ?? {},
          addedFlags: addedFlags ?? {},
          onActualsChange,
          onAddedChange,
          onIngredientActualChange,
        }
      : null;

  const titleBlockProps = {
    onPrint: handlePrint,
    isBrewMode,
    sessionStatus,
    onStatusChange,
    onToggleBrewMode,
    priorSessions: priorSessions ?? [],
    onResumeSession,
    onCreateNewSession,
  };

  const hasData =
    calculations && (calculations.og > 1 || calculations.strikeTempC != null);

  if (!hasData || !calculations) {
    return (
      <section className="hs-print-area" style={pageStyle}>
        <PrintStyles />
        <TitleBlock {...titleBlockProps} />
        <div
          style={{
            padding: "28px 22px",
            background: hsTokens.paper,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 12,
            fontFamily: hsTokens.body,
            fontSize: 13,
            color: hsTokens.muted,
            textAlign: "center",
            lineHeight: 1.5,
            boxShadow: hsTokens.sh2,
          }}
        >
          Add fermentables and mash steps to see your brew sheet.
        </div>
      </section>
    );
  }

  // Derived data
  const boilOff =
    (recipe.equipment.boilOffRateLPerHour * recipe.equipment.boilTimeMin) / 60;
  const postBoilHotL = Math.max(0, calculations.preBoilVolumeL - boilOff);
  const pitchTempC = recipe.fermentationSteps?.[0]?.temperatureC;
  const totalGrainKg = recipe.fermentables.reduce(
    (sum, f) => sum + f.weightKg,
    0,
  );
  const totalHopG = recipe.hops.reduce((sum, h) => sum + h.grams, 0);
  const apparentAttenuation =
    calculations.og > 1.0 && calculations.fg > 0
      ? Math.round(
          ((calculations.og - calculations.fg) / (calculations.og - 1)) * 100,
        )
      : 0;

  // Salt split (planned mash + sparge per salt key) — derived from recipe and
  // planned water volumes. Used as the baseline when the brewer enters salt
  // actuals (so we can sum mash-actual + sparge-actual back into a total).
  const salts = recipe.waterChemistry?.saltAdditions;
  const hasSalts =
    salts &&
    Object.values(salts).some((v): v is number => typeof v === "number" && v > 0);
  const saltSplit =
    hasSalts && salts
      ? waterChemistryService.splitSaltsProportionally(
          salts,
          calculations.mashWaterL,
          calculations.spargeWaterL,
        )
      : { mashSalts: {}, spargeSalts: {} };
  const mashSplitSalts = saltSplit.mashSalts as SaltAdditionsObj;
  const spargeSplitSalts = saltSplit.spargeSalts as SaltAdditionsObj;

  // ─── Brew Mode: recompute OG/IBU/SRM/mash-pH/etc from actual ingredient amounts ───
  // When the brewer enters actual grain weights, hop grams, or salt amounts that
  // differ from plan, we surface the recomputed values INLINE in the Targets table —
  // original gets a strikethrough, revised value drops below in script font, with
  // a "*due to X" note.
  const ingredientActualAmounts = brewMode?.actuals.ingredientActualAmounts;
  const actualsCalculations = brewMode
    ? (() => {
        const adjustedRecipe = applyIngredientActualsToRecipe(
          recipe,
          ingredientActualAmounts,
          mashSplitSalts,
          spargeSplitSalts,
        );
        if (adjustedRecipe === recipe) return null;
        return recipeCalculationService.calculate(adjustedRecipe);
      })()
    : null;

  // Figure out the reason for the revision — used as the "*due to X changes" annotation.
  const revisionReason = (() => {
    if (!actualsCalculations || !ingredientActualAmounts) return null;
    const grainChanged = recipe.fermentables.some((f) => {
      const a = ingredientActualAmounts[f.id];
      return a !== undefined && Math.abs(a - f.weightKg) > 0.0001;
    });
    const hopChanged = recipe.hops.some((h) => {
      const a = ingredientActualAmounts[h.id];
      return a !== undefined && Math.abs(a - h.grams) > 0.0001;
    });
    const saltChanged = SALT_DEFS.some((d) => {
      return (
        ingredientActualAmounts[`salt:mash:${d.key}`] !== undefined ||
        ingredientActualAmounts[`salt:sparge:${d.key}`] !== undefined
      );
    });
    if (grainChanged && (hopChanged || saltChanged)) return "ingredient changes";
    if (grainChanged) return "grain changes";
    if (hopChanged && saltChanged) return "hop and salt changes";
    if (hopChanged) return "hop changes";
    if (saltChanged) return "salt changes";
    return null;
  })();

  // Final mineral profile (source + salts dissolved in total water).
  // Renders only when both source profile and salts are present.
  const sourceProfile = recipe.waterChemistry?.sourceProfile;
  const finalProfile =
    sourceProfile && hasSalts && salts
      ? waterChemistryService.calculateFinalProfileFromTotalSalts(
          sourceProfile,
          salts,
          calculations.mashWaterL,
          calculations.spargeWaterL,
        )
      : null;

  // ─── Brew Mode: recompute final water profile from actual salt amounts ───
  // Salt actuals live in `ingredientActualAmounts` keyed by `salt:mash:<key>` and
  // `salt:sparge:<key>`. We sum mash + sparge per salt to get the effective total,
  // then re-run `calculateFinalProfileFromTotalSalts`.
  const actualsFinalProfile = (() => {
    if (!brewMode || !sourceProfile || !salts) return null;
    const actualsMap = brewMode.actuals.ingredientActualAmounts ?? {};
    // Check if any salt key has an override
    const hasSaltOverride = SALT_DEFS.some((d) => {
      const mashKey = `salt:mash:${d.key}`;
      const spargeKey = `salt:sparge:${d.key}`;
      return mashKey in actualsMap || spargeKey in actualsMap;
    });
    if (!hasSaltOverride) return null;

    const adjustedTotals: SaltAdditionsObj = { ...(salts as SaltAdditionsObj) };
    SALT_DEFS.forEach((d) => {
      const mashActual = actualsMap[`salt:mash:${d.key}`];
      const spargeActual = actualsMap[`salt:sparge:${d.key}`];
      const mashPlanned = mashSplitSalts[d.key] ?? 0;
      const spargePlanned = spargeSplitSalts[d.key] ?? 0;
      const mash = mashActual ?? mashPlanned;
      const sparge = spargeActual ?? spargePlanned;
      const total = mash + sparge;
      // Only override if we have data for this salt
      if (mashActual !== undefined || spargeActual !== undefined) {
        adjustedTotals[d.key] = total;
      }
    });
    return waterChemistryService.calculateFinalProfileFromTotalSalts(
      sourceProfile,
      adjustedTotals,
      calculations.mashWaterL,
      calculations.spargeWaterL
    );
  })();
  const hasWaterProfileRevision =
    actualsFinalProfile != null &&
    finalProfile != null &&
    (Math.abs(actualsFinalProfile.Ca - finalProfile.Ca) >= 1 ||
      Math.abs(actualsFinalProfile.Mg - finalProfile.Mg) >= 1 ||
      Math.abs(actualsFinalProfile.Na - finalProfile.Na) >= 1 ||
      Math.abs(actualsFinalProfile.Cl - finalProfile.Cl) >= 1 ||
      Math.abs(actualsFinalProfile.SO4 - finalProfile.SO4) >= 1 ||
      Math.abs(actualsFinalProfile.HCO3 - finalProfile.HCO3) >= 1);

  // Boil-section revision flag — used to render the top-right "*due to X" note
  // in the Boil ScheduleSection header. Water and Fermentation annotations live
  // inline next to their respective struck-out cells (no separate flag needed).
  const hasBoilRevision =
    actualsCalculations != null &&
    (Math.abs(actualsCalculations.preBoilVolumeL - calculations.preBoilVolumeL) >= 0.05 ||
      Math.abs(actualsCalculations.preBoilGravity - calculations.preBoilGravity) >= 0.001 ||
      Math.abs(actualsCalculations.og - calculations.og) >= 0.001);

  // Hop flavor aggregate (gram-weighted, hops without inline flavor data skipped)
  const aggregateFlavor = computeAggregateHopFlavor(recipe.hops);

  // Other ingredients filtered by timing
  const mashAdditions = recipe.otherIngredients.filter((o) => o.timing === "mash");
  const boilAdditions = recipe.otherIngredients.filter(
    (o) => o.timing === "boil" || o.timing === "whirlpool",
  );

  // First/last runnings estimates.
  // First runnings = the wort drained before sparge. Assuming uniform extract
  // concentration in the mash, its SG equals the mash concentration:
  //   first SG = 1 + (preBoilSG - 1) × (preBoilVol / mashVol)
  // Last runnings target ≥ 1.010 — safety floor to avoid tannin extraction.
  const firstRunningsSG =
    calculations.mashWaterL > 0 && calculations.preBoilGravity > 1
      ? 1 +
        (calculations.preBoilGravity - 1) *
          (calculations.preBoilVolumeL / calculations.mashWaterL)
      : null;

  // Hop grouping
  const boilHops = recipe.hops
    .filter(
      (h) => h.type === "boil" || h.type === "first wort" || h.type === "mash",
    )
    .sort((a, b) => (b.timeMinutes ?? 0) - (a.timeMinutes ?? 0));
  const whirlpoolHops = recipe.hops.filter((h) => h.type === "whirlpool");
  const dryHops = recipe.hops
    .filter((h) => h.type === "dry hop")
    .sort((a, b) => (a.dryHopStartDay ?? 0) - (b.dryHopStartDay ?? 0));

  return (
    <section className="hs-print-area" style={pageStyle}>
      <PrintStyles />
      <TitleBlock {...titleBlockProps} />

      {/* Top strip: brew data + targets + yeast */}
      <div
        className="hs-print-cols-3"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        <MiniTable
          title="Brew Data"
          accent={hsTokens.honey}
          rows={[
            { label: "Recipe", target: recipe.name || "—" },
            { label: "Beer Style", target: recipe.style || "—" },
            { label: "Brew Date", actualSlot: true },
            { label: "Brew #", actualSlot: true },
            { label: "Brewer", actualSlot: true },
            {
              left: {
                label: "Batch Volume",
                target: `${recipe.batchVolumeL.toFixed(1)} L`,
                hint: `${lToGal(recipe.batchVolumeL)} gal`,
              },
              topRight: {
                label: "Mash",
                target: `${calculations.mashWaterL.toFixed(1)} L`,
                hint: `${lToGal(calculations.mashWaterL)} gal`,
              },
              bottomRight: {
                label: "Sparge",
                target: `${calculations.spargeWaterL.toFixed(1)} L`,
                hint: `${lToGal(calculations.spargeWaterL)} gal`,
              },
            },
          ]}
        />
        <MiniTable
          title="Targets"
          accent={hsTokens.malt}
          rows={[
            {
              label: "OG",
              target: calculations.og.toFixed(3),
              actualSlot: true,
              revisedTarget:
                actualsCalculations &&
                Math.abs(actualsCalculations.og - calculations.og) >= 0.001
                  ? actualsCalculations.og.toFixed(3)
                  : undefined,
              revisionReason: revisionReason ?? undefined,
              actualNode: brewMode ? (
                <CellInput
                  value={brewMode.actuals.originalGravity}
                  onCommit={(v) => brewMode.onActualsChange({ originalGravity: v })}
                  step={0.001}
                  format={(v) => v.toFixed(3)}
                />
              ) : undefined,
            },
            {
              label: "FG",
              target: calculations.fg.toFixed(3),
              actualSlot: true,
              revisedTarget:
                actualsCalculations &&
                Math.abs(actualsCalculations.fg - calculations.fg) >= 0.001
                  ? actualsCalculations.fg.toFixed(3)
                  : undefined,
              revisionReason: revisionReason ?? undefined,
              actualNode: brewMode ? (
                <CellInput
                  value={brewMode.actuals.finalGravity}
                  onCommit={(v) => brewMode.onActualsChange({ finalGravity: v })}
                  step={0.001}
                  format={(v) => v.toFixed(3)}
                />
              ) : undefined,
            },
            {
              label: "ABV",
              target: `${calculations.abv.toFixed(1)} %`,
              actualSlot: true,
              revisedTarget:
                actualsCalculations &&
                Math.abs(actualsCalculations.abv - calculations.abv) >= 0.1
                  ? `${actualsCalculations.abv.toFixed(1)} %`
                  : undefined,
              revisionReason: revisionReason ?? undefined,
              // Auto-computed from OG + FG actuals — read-only display
              actualNode:
                brewMode &&
                brewMode.actuals.originalGravity != null &&
                brewMode.actuals.finalGravity != null
                  ? (
                      <span
                        style={{
                          fontFamily: hsTokens.mono,
                          fontSize: 12,
                          color: hsTokens.ink,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {abvFromOGFG(
                          brewMode.actuals.originalGravity,
                          brewMode.actuals.finalGravity
                        ).toFixed(1)}{" "}
                        %
                      </span>
                    )
                  : undefined,
            },
            {
              label: "IBU",
              target: `${Math.round(calculations.ibu)}`,
              revisedTarget:
                actualsCalculations &&
                Math.round(actualsCalculations.ibu) !== Math.round(calculations.ibu)
                  ? `${Math.round(actualsCalculations.ibu)}`
                  : undefined,
              revisionReason: revisionReason ?? undefined,
            },
            {
              label: "SRM",
              target: (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: srmToRgb(calculations.srm),
                      border: `1px solid ${hsTokens.ink}`,
                    }}
                  />
                  {calculations.srm.toFixed(1)}
                </span>
              ),
              revisedTarget:
                actualsCalculations &&
                Math.abs(actualsCalculations.srm - calculations.srm) >= 0.1 ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: srmToRgb(actualsCalculations.srm),
                        border: `1px solid ${hsTokens.ink}`,
                      }}
                    />
                    {actualsCalculations.srm.toFixed(1)}
                  </span>
                ) : undefined,
              revisionReason: revisionReason ?? undefined,
            },
            (() => {
              // Mash pH target: when lactic acid / baking soda adjustments are
              // planned (recommendations from MashPhCalculationService), display
              // the post-adjustment target. Otherwise show the raw predicted pH.
              // When salt or grain actuals shift the underlying estimatedMashPh,
              // we render a strikethrough revision.
              const adj = calculations.mashPhAdjustment;
              const hasPlannedAdjustment =
                adj != null &&
                (adj.lacticAcid88Ml > 0 || adj.bakingSodaG > 0);
              const plannedPh = hasPlannedAdjustment
                ? adj.targetPh
                : calculations.estimatedMashPh;
              const displayedPh =
                plannedPh != null ? plannedPh.toFixed(2) : "—";
              // Revised mash pH from actuals — uses the same logic (post-adjustment
              // target when adjustments planned, else raw estimated pH).
              const adjActuals = actualsCalculations?.mashPhAdjustment;
              const hasActualsAdjustment =
                adjActuals != null &&
                (adjActuals.lacticAcid88Ml > 0 || adjActuals.bakingSodaG > 0);
              const revisedPh = actualsCalculations
                ? hasActualsAdjustment
                  ? adjActuals.targetPh
                  : actualsCalculations.estimatedMashPh
                : null;
              const revised =
                plannedPh != null &&
                revisedPh != null &&
                Math.abs(revisedPh - plannedPh) >= 0.01
                  ? revisedPh.toFixed(2)
                  : undefined;
              return {
                label: "Mash pH",
                target: displayedPh,
                hint: hasPlannedAdjustment ? "after adjustments" : undefined,
                revisedTarget: revised,
                revisionReason: revisionReason ?? undefined,
                actualSlot: true,
                actualNode: brewMode ? (
                  <CellInput
                    value={brewMode.actuals.mashPH}
                    onCommit={(v) => brewMode.onActualsChange({ mashPH: v })}
                    step={0.01}
                    format={(v) => v.toFixed(2)}
                  />
                ) : undefined,
              };
            })(),
          ]}
        />
        <MiniTable
          title="Yeast"
          accent={hsTokens.yeast}
          rows={buildYeastRows(recipe, pitchTempC)}
        />
      </div>

      {/* 01 Ingredients — category header + 2 sub-framed sections */}
      <CategoryHeader
        eyebrow="01"
        title="Ingredients"
        accent={hsTokens.malt}
      />
      <div
        className="hs-print-cols-2"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: 14,
        }}
      >
        <ScheduleSection
          title="Grains"
          accent={hsTokens.malt}
          compactHeader
        >
          {recipe.fermentables.length === 0 ? (
            <EmptyRow text="No fermentables — add grains in the Fermentables tab." />
          ) : (
            <Table>
              <THead
                columns={[
                  { label: "Grain", width: "auto" },
                  { label: "kg", width: "70px", align: "center" },
                  { label: "lb", width: "70px", align: "center" },
                  { label: "%", width: "60px", align: "center" },
                  ...(brewMode
                    ? [
                        {
                          label: "Added",
                          width: "70px",
                          align: "center" as const,
                          isActual: true,
                        },
                      ]
                    : []),
                ]}
              />
              <tbody>
                {recipe.fermentables.map((f, i) => {
                  const pct =
                    totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
                  const srmApprox = Math.max(
                    0,
                    f.colorLovibond * 1.3546 - 0.76,
                  );
                  return (
                    <tr key={f.id ?? i}>
                      <Td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 3,
                              background: srmToRgb(srmApprox),
                              border: `1px solid ${hsTokens.ink}`,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontWeight: 600 }}>
                            {f.name || "Unnamed grain"}
                          </span>
                        </span>
                      </Td>
                      <Td align="center" font="mono">
                        {f.weightKg.toFixed(2)}
                      </Td>
                      <Td align="center" font="mono">
                        {kgToLb(f.weightKg)}
                      </Td>
                      <Td align="center" font="mono">
                        {pct.toFixed(1)}%
                      </Td>
                      {brewMode ? (
                        <AddedCell
                          id={f.id}
                          plannedAmount={f.weightKg}
                          unit="kg"
                          brewMode={brewMode}
                          precision={3}
                        />
                      ) : null}
                    </tr>
                  );
                })}
                <tr>
                  <Td>
                    <span
                      style={{
                        fontWeight: 600,
                        color: hsTokens.muted,
                        textTransform: "uppercase",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                      }}
                    >
                      Total
                    </span>
                  </Td>
                  <Td align="center" font="mono">
                    <strong>{totalGrainKg.toFixed(2)}</strong>
                  </Td>
                  <Td align="center" font="mono">
                    <strong>{kgToLb(totalGrainKg)}</strong>
                  </Td>
                  <Td align="center" font="mono">
                    100%
                  </Td>
                  {brewMode ? <Td>&nbsp;</Td> : null}
                </tr>
              </tbody>
            </Table>
          )}
        </ScheduleSection>

        <ScheduleSection
          title="Hops"
          accent={hsTokens.hops}
          compactHeader
        >
          {recipe.hops.length === 0 ? (
            <EmptyRow text="No hops — add additions in the Hops tab." />
          ) : (
            <HopsList
              boilHops={boilHops}
              whirlpoolHops={whirlpoolHops}
              dryHops={dryHops}
              totalHopG={totalHopG}
              flavor={aggregateFlavor}
              brewMode={brewMode}
            />
          )}
        </ScheduleSection>
      </div>


      {/* 02 Water — matrix: Mash | Sparge × (Target | Actual), rows = volume / temp / salts / adjustments */}
      <ScheduleSection
        title="Water"
        eyebrow="02"
        accent={hsTokens.water}
      >
        <WaterMatrix
          mashWaterL={calculations.mashWaterL}
          spargeWaterL={calculations.spargeWaterL}
          totalWaterL={calculations.totalWaterL}
          strikeTempC={calculations.strikeTempC}
          spargeTempC={76}
          salts={hasSalts ? (salts as SaltAdditionsObj) : undefined}
          mashSalts={mashSplitSalts}
          spargeSalts={spargeSplitSalts}
          mashPhAdjustment={calculations.mashPhAdjustment}
          estimatedMashPh={calculations.estimatedMashPh}
          finalProfile={finalProfile}
          revisedFinalProfile={
            hasWaterProfileRevision ? actualsFinalProfile : null
          }
          brewMode={brewMode}
        />
      </ScheduleSection>

      {/* 03 Mash — stat strip + schedule + measurements log + (optional) additions */}
      <ScheduleSection
        title="Mash"
        eyebrow="03"
        accent={hsTokens.roast}
      >
        {recipe.mashSteps.length === 0 ? (
          <EmptyRow text="No mash schedule — add steps in the Mash tab." />
        ) : (
          <div className="hs-mash-schedule">
            <Table>
              <THead
                columns={[
                  { label: "Step", width: "auto" },
                  { label: "Temp", width: "180px", align: "center" },
                  { label: "Duration", width: "120px", align: "center" },
                  { label: "Actual Temp", width: "160px", align: "center", isActual: true },
                  { label: "Time Hit", width: "140px", align: "center", isActual: true },
                ]}
              />
              <tbody>
                {recipe.mashSteps.map((s, i) => {
                  const stepKey = s.id ?? `mash-step-${i}`;
                  const stepActual =
                    brewMode?.actuals.mashStepActuals?.[stepKey];
                  return (
                    <tr key={s.id ?? i} className="hs-sched-row">
                      <td className="hs-sched-title" style={mashStepCellStyle}>
                        <span className="hs-sched-index" style={mashStepIndexStyle}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="hs-sched-name" style={mashStepNameStyle}>
                          {s.name || `Step ${i + 1}`}
                        </span>
                      </td>
                      <td
                        data-label="Temp"
                        style={{ ...mashStepCellStyle, textAlign: "center" }}
                      >
                        <span className="hs-sched-value" style={mashStepValueStyle}>
                          {s.temperatureC.toFixed(1)} °C
                        </span>
                        <span className="hs-sched-hint" style={mashStepHintStyle}>
                          {cToF(s.temperatureC)} °F
                        </span>
                      </td>
                      <td
                        data-label="Duration"
                        style={{ ...mashStepCellStyle, textAlign: "center" }}
                      >
                        <span className="hs-sched-value" style={mashStepValueStyle}>
                          {s.durationMinutes} min
                        </span>
                      </td>
                      <td
                        data-label="Actual temp"
                        className="hs-sched-actual"
                        style={{ ...mashStepCellStyle, ...mashStepActualStyle }}
                      >
                        {brewMode ? (
                          <CellInput
                            value={stepActual?.actualTempC}
                            onCommit={(v) =>
                              brewMode.onActualsChange({
                                mashStepActuals: {
                                  ...(brewMode.actuals.mashStepActuals ?? {}),
                                  [stepKey]: {
                                    ...stepActual,
                                    actualTempC: v,
                                  },
                                },
                              })
                            }
                            step={0.1}
                            format={(v) => v.toFixed(1)}
                            suffix=" °C"
                          />
                        ) : (
                          " "
                        )}
                      </td>
                      <td
                        data-label="Time hit"
                        className="hs-sched-actual"
                        style={{ ...mashStepCellStyle, ...mashStepActualStyle }}
                      >
                        {brewMode ? (
                          <CellInput
                            value={stepActual?.timeHitMin}
                            onCommit={(v) =>
                              brewMode.onActualsChange({
                                mashStepActuals: {
                                  ...(brewMode.actuals.mashStepActuals ?? {}),
                                  [stepKey]: {
                                    ...stepActual,
                                    timeHitMin: v,
                                  },
                                },
                              })
                            }
                            step={1}
                            format={(v) => v.toFixed(0)}
                            suffix=" min"
                          />
                        ) : (
                          " "
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}

        {/* Mash additions (whirlfloc/yeast nutrient added at mash, lactic, etc.) */}
        {mashAdditions.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            <Table>
              <THead
                columns={[
                  { label: "Mash addition", width: "auto" },
                  { label: "Amount", width: "120px", align: "center" },
                  { label: "Added", width: "120px", align: "center", isActual: true },
                ]}
              />
              <tbody>
                {mashAdditions.map((o) => (
                  <tr key={o.id}>
                    <Td>
                      <span style={{ fontWeight: 600 }}>{o.name}</span>
                      {o.notes ? <span style={hintStyle}>{o.notes}</span> : null}
                    </Td>
                    <Td align="center" font="mono">
                      {o.amount} {o.unit}
                    </Td>
                    <AddedCell
                      id={o.id}
                      plannedAmount={o.amount}
                      unit={o.unit}
                      brewMode={brewMode}
                      precision={2}
                    />
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : null}

        {/* Mash checks log — subordinated below the schedule */}
        <MashChecks
          firstRunningsSG={firstRunningsSG}
          brewMode={brewMode}
        />
      </ScheduleSection>

      {/* 04 Boil — numbers (2-col) + combined additions (hops + other) */}
      <ScheduleSection
        title="Boil"
        eyebrow="04"
        accent={hsTokens.hops}
        headerRight={
          hasBoilRevision && revisionReason ? (
            <SectionRevisionNote reason={revisionReason} />
          ) : undefined
        }
      >
        {/* LayoutGroup scopes the shared-layout morph between the predictor
            cards (in the matrix grid) and the matrix flag glyphs (in the
            phase-box headers). Without a LayoutGroup the morph crosses too
            many DOM boundaries to coordinate reliably. */}
        <LayoutGroup id="boil-warnings">
        <BoilNumbersMatrix
          preBoilVolumeL={calculations.preBoilVolumeL}
          preBoilGravity={calculations.preBoilGravity}
          boilTimeMin={recipe.equipment.boilTimeMin}
          boilOff={boilOff}
          postBoilHotL={postBoilHotL}
          og={calculations.og}
          actualsCalculations={actualsCalculations}
          brewMode={brewMode}
          preBoilResolved={brewMode?.actuals.ogFixChoices?.preBoil != null}
          postBoilResolved={brewMode?.actuals.ogFixChoices?.postBoil != null}
          preBoilFlag={
            // Pre-boil flag (hover tooltip with predicted OG + fix options).
            // Shown whenever the pre-boil predictor would render content; if
            // the brewer minimizes the card, the flag becomes the click
            // target to bring it back (with a brief pulse to telegraph that).
            // `morphId` ties this glyph to the card via framer-motion's
            // shared layout animation so minimize/restore visibly morphs.
            brewMode &&
            shouldShowPreBoilPredictor(
              brewMode.actuals,
              actualsCalculations?.og ?? calculations.og,
              recipe.equipment.boilOffRateLPerHour,
              brewMode.actuals.boilTimeMin ?? recipe.equipment.boilTimeMin
            ) ? (
              <OgPredictorTip
                actuals={brewMode.actuals}
                targetOG={actualsCalculations?.og ?? calculations.og}
                originalTargetOG={
                  actualsCalculations &&
                  Math.abs(actualsCalculations.og - calculations.og) >= 0.001
                    ? calculations.og
                    : undefined
                }
                boilOffRateLPerHour={recipe.equipment.boilOffRateLPerHour}
                recipeBoilMin={recipe.equipment.boilTimeMin}
                onClick={
                  brewMode.actuals.ogWarningMinimized?.preBoil
                    ? () =>
                        brewMode.onActualsChange({
                          ogWarningMinimized: {
                            ...(brewMode.actuals.ogWarningMinimized ?? {}),
                            preBoil: false,
                          },
                        })
                    : undefined
                }
                pulse={brewMode.actuals.ogWarningMinimized?.preBoil ?? false}
                morphId="og-warning-pre-boil"
                minimized={
                  brewMode.actuals.ogWarningMinimized?.preBoil ?? false
                }
              />
            ) : null
          }
          postBoilFlag={
            // Post-boil flag — same un-minimize behaviour as above.
            brewMode &&
            shouldShowPostBoilPredictor(
              brewMode.actuals,
              actualsCalculations?.og ?? calculations.og
            ) ? (
              <PostBoilOgTip
                actuals={brewMode.actuals}
                targetOG={actualsCalculations?.og ?? calculations.og}
                originalTargetOG={
                  actualsCalculations &&
                  Math.abs(actualsCalculations.og - calculations.og) >= 0.001
                    ? calculations.og
                    : undefined
                }
                boilOffRateLPerHour={recipe.equipment.boilOffRateLPerHour}
                hops={recipe.hops}
                onClick={
                  brewMode.actuals.ogWarningMinimized?.postBoil
                    ? () =>
                        brewMode.onActualsChange({
                          ogWarningMinimized: {
                            ...(brewMode.actuals.ogWarningMinimized ?? {}),
                            postBoil: false,
                          },
                        })
                    : undefined
                }
                pulse={brewMode.actuals.ogWarningMinimized?.postBoil ?? false}
                morphId="og-warning-post-boil"
                minimized={
                  brewMode.actuals.ogWarningMinimized?.postBoil ?? false
                }
              />
            ) : null
          }
          preBoilCard={
            // Predictor anchored to the Pre-boil row — predicts post-boil OG
            // from pre-boil readings. Hidden when the brewer has minimized
            // it (`ogWarningMinimized.preBoil`) — matrix falls back to its
            // usual side-by-side layout in that case.
            brewMode &&
            !brewMode.actuals.ogWarningMinimized?.preBoil &&
            shouldShowPreBoilPredictor(
              brewMode.actuals,
              actualsCalculations?.og ?? calculations.og,
              recipe.equipment.boilOffRateLPerHour,
              brewMode.actuals.boilTimeMin ?? recipe.equipment.boilTimeMin
            ) ? (
              <OgPredictorCard
                actuals={brewMode.actuals}
                targetOG={actualsCalculations?.og ?? calculations.og}
                targetPreBoilVolumeL={
                  actualsCalculations?.preBoilVolumeL ??
                  calculations.preBoilVolumeL
                }
                targetPreBoilGravity={
                  actualsCalculations?.preBoilGravity ??
                  calculations.preBoilGravity
                }
                boilOffRateLPerHour={recipe.equipment.boilOffRateLPerHour}
                recipeBoilMin={recipe.equipment.boilTimeMin}
                hops={recipe.hops}
                morphId="og-warning-pre-boil"
                selectedKind={brewMode.actuals.ogFixChoices?.preBoil?.kind}
                onSelectFix={(fix) =>
                  // Auto-minimize on selection — the chosen fix is the
                  // brewer's decision, so the loud warning card collapses
                  // into the small inline flag that reads back the choice.
                  brewMode.onActualsChange({
                    ogFixChoices: {
                      ...(brewMode.actuals.ogFixChoices ?? {}),
                      preBoil: {
                        kind: fix.kind,
                        action: fix.titlePlain ?? String(fix.title),
                        at: new Date().toISOString(),
                      },
                    },
                    ogWarningMinimized: {
                      ...(brewMode.actuals.ogWarningMinimized ?? {}),
                      preBoil: true,
                    },
                  })
                }
                onClearFix={() =>
                  // Clearing the choice expands the card back so the brewer
                  // can pick a different fix.
                  brewMode.onActualsChange({
                    ogFixChoices: {
                      ...(brewMode.actuals.ogFixChoices ?? {}),
                      preBoil: undefined,
                    },
                    ogWarningMinimized: {
                      ...(brewMode.actuals.ogWarningMinimized ?? {}),
                      preBoil: false,
                    },
                  })
                }
                onMinimize={() =>
                  brewMode.onActualsChange({
                    ogWarningMinimized: {
                      ...(brewMode.actuals.ogWarningMinimized ?? {}),
                      preBoil: true,
                    },
                  })
                }
              />
            ) : null
          }
          postBoilCard={
            // Predictor anchored to the Post-boil row — compares measured OG
            // to target once post-boil readings are in.
            brewMode &&
            !brewMode.actuals.ogWarningMinimized?.postBoil &&
            shouldShowPostBoilPredictor(
              brewMode.actuals,
              actualsCalculations?.og ?? calculations.og
            ) ? (
              <PostBoilOgCard
                actuals={brewMode.actuals}
                targetOG={actualsCalculations?.og ?? calculations.og}
                targetPostBoilVolumeHotL={postBoilHotL}
                boilOffRateLPerHour={recipe.equipment.boilOffRateLPerHour}
                hops={recipe.hops}
                morphId="og-warning-post-boil"
                selectedKind={brewMode.actuals.ogFixChoices?.postBoil?.kind}
                onSelectFix={(fix) =>
                  brewMode.onActualsChange({
                    ogFixChoices: {
                      ...(brewMode.actuals.ogFixChoices ?? {}),
                      postBoil: {
                        kind: fix.kind,
                        action: fix.titlePlain ?? String(fix.title),
                        at: new Date().toISOString(),
                      },
                    },
                    ogWarningMinimized: {
                      ...(brewMode.actuals.ogWarningMinimized ?? {}),
                      postBoil: true,
                    },
                  })
                }
                onClearFix={() =>
                  brewMode.onActualsChange({
                    ogFixChoices: {
                      ...(brewMode.actuals.ogFixChoices ?? {}),
                      postBoil: undefined,
                    },
                    ogWarningMinimized: {
                      ...(brewMode.actuals.ogWarningMinimized ?? {}),
                      postBoil: false,
                    },
                  })
                }
                onMinimize={() =>
                  brewMode.onActualsChange({
                    ogWarningMinimized: {
                      ...(brewMode.actuals.ogWarningMinimized ?? {}),
                      postBoil: true,
                    },
                  })
                }
              />
            ) : null
          }
        />
        </LayoutGroup>

        {/* Additions section: hops (boil + whirlpool) + other (whirlfloc, nutrient) */}
        {boilHops.length > 0 || whirlpoolHops.length > 0 || boilAdditions.length > 0 ? (
          <>
            <SubLabel>Additions</SubLabel>
            <BoilAdditionsTable
              boilHops={boilHops}
              whirlpoolHops={whirlpoolHops}
              otherAdditions={boilAdditions}
              brewMode={brewMode}
            />
          </>
        ) : null}
      </ScheduleSection>

      {/* 05 Fermentation — schedule is primary; pitch temp is a small lead-in chip */}
      <ScheduleSection
        title="Fermentation"
        eyebrow="05"
        accent={hsTokens.yeast}
      >
        <PitchTempChip pitchTempC={pitchTempC} />

        {recipe.fermentationSteps.length === 0 ? (
          <EmptyRow text="No fermentation steps — add them in the Fermentation tab." />
        ) : (
          <div className="hs-ferment-schedule">
            <Table>
              <THead
                columns={[
                  { label: "Step", width: "auto" },
                  { label: "Type", width: "150px" },
                  { label: "Temp", width: "180px", align: "center" },
                  { label: "Duration", width: "120px", align: "center" },
                  { label: "Actual Temp", width: "160px", align: "center", isActual: true },
                  { label: "Actual Days", width: "140px", align: "center", isActual: true },
                ]}
              />
              <tbody>
                {recipe.fermentationSteps.map((s, i) => (
                  <FermentRow
                    key={s.id ?? i}
                    step={s}
                    index={i}
                    brewMode={brewMode}
                  />
                ))}
                <tr className="hs-sched-row hs-sched-fg-row">
                  <td className="hs-sched-title hs-sched-fg-spacer" style={mashStepCellStyle} colSpan={2}>&nbsp;</td>
                  <td
                    data-label="FG target"
                    style={{ ...mashStepCellStyle, textAlign: "center" }}
                  >
                    <span className="hs-sched-hint" style={mashStepHintStyle}>
                      {apparentAttenuation}% apparent attenuation
                    </span>
                  </td>
                  <td
                    data-label="FG"
                    style={{ ...mashStepCellStyle, textAlign: "center" }}
                  >
                    {actualsCalculations &&
                    Math.abs(actualsCalculations.fg - calculations.fg) >= 0.001 ? (
                      <RevisedValue
                        planned={
                          <span style={mashStepValueStyle}>
                            {calculations.fg.toFixed(3)}
                          </span>
                        }
                        revised={
                          <span
                            style={{
                              ...mashStepValueStyle,
                              fontFamily: hsTokens.script,
                              color: hsTokens.water,
                            }}
                          >
                            {actualsCalculations.fg.toFixed(3)}
                          </span>
                        }
                        reason={revisionReason ?? undefined}
                      />
                    ) : (
                      <span className="hs-sched-value" style={mashStepValueStyle}>
                        {calculations.fg.toFixed(3)}
                      </span>
                    )}
                  </td>
                  <td
                    data-label="Actual FG"
                    className="hs-sched-actual"
                    style={{ ...mashStepCellStyle, ...mashStepActualStyle }}
                  >
                    {brewMode ? (
                      <CellInput
                        value={brewMode.actuals.finalGravity}
                        onCommit={(v) =>
                          brewMode.onActualsChange({ finalGravity: v })
                        }
                        step={0.001}
                        format={(v) => v.toFixed(3)}
                      />
                    ) : (
                      " "
                    )}
                    {brewMode &&
                    brewMode.actuals.originalGravity != null &&
                    brewMode.actuals.finalGravity != null ? (
                      <span
                        style={{
                          display: "block",
                          fontFamily: hsTokens.script,
                          fontSize: 12,
                          color: hsTokens.water,
                          marginTop: 4,
                          lineHeight: 1,
                        }}
                      >
                        actual ABV{" "}
                        {abvFromOGFG(
                          brewMode.actuals.originalGravity,
                          brewMode.actuals.finalGravity
                        ).toFixed(1)}
                        %
                      </span>
                    ) : null}
                  </td>
                  <td
                    data-label="Actual days"
                    className="hs-sched-actual"
                    style={{ ...mashStepCellStyle, ...mashStepActualStyle }}
                  >
                    {brewMode ? (
                      <CellInput
                        value={brewMode.actuals.fermentationDays}
                        onCommit={(v) =>
                          brewMode.onActualsChange({ fermentationDays: v })
                        }
                        step={1}
                        format={(v) => v.toFixed(0)}
                        suffix=" d"
                      />
                    ) : (
                      " "
                    )}
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
        )}
      </ScheduleSection>

      {/* 06 Gravity log — each entry: date/SG/pH/temp on a single-row left
          block (floated) with notes flowing around it. Long notes wrap to
          full-width lines below the stats block (CSS shape-from-float). */}
      <ScheduleSection
        title="Gravity Log"
        eyebrow="06"
        accent={hsTokens.malt}
        compactHeader
      >
        <div className="hs-gravity-log">
          <div className="hs-gravity-header">
            <div>Date</div>
            <div>SG</div>
            <div>pH</div>
            <div>Temp °C</div>
            <div>Notes</div>
          </div>
          {Array.from({ length: 10 }).map((_, i) => {
            const entry = brewMode?.actuals.gravityLog?.[i] ?? undefined;
            const writeEntry = (patch: Partial<GravityLogEntry>) => {
              if (!brewMode) return;
              const log = [...(brewMode.actuals.gravityLog ?? [])];
              while (log.length <= i) log.push({});
              log[i] = { ...log[i], ...patch };
              brewMode.onActualsChange({ gravityLog: log });
            };
            return (
              <div className="hs-gravity-entry" key={i}>
                <div className="hs-gravity-stats">
                  <div className="hs-gravity-cell" data-col="date">
                    {brewMode ? (
                      <CellTextInput
                        value={entry?.date}
                        onCommit={(v) => writeEntry({ date: v })}
                        type="date"
                        align="left"
                      />
                    ) : null}
                  </div>
                  <div className="hs-gravity-cell" data-col="sg">
                    {brewMode ? (
                      <CellInput
                        value={entry?.sg}
                        onCommit={(v) => writeEntry({ sg: v })}
                        step={0.001}
                        format={(v) => v.toFixed(3)}
                      />
                    ) : null}
                  </div>
                  <div className="hs-gravity-cell" data-col="ph">
                    {brewMode ? (
                      <CellInput
                        value={entry?.ph}
                        onCommit={(v) => writeEntry({ ph: v })}
                        step={0.01}
                        format={(v) => v.toFixed(2)}
                      />
                    ) : null}
                  </div>
                  <div className="hs-gravity-cell" data-col="temp">
                    {brewMode ? (
                      <CellInput
                        value={entry?.tempC}
                        onCommit={(v) => writeEntry({ tempC: v })}
                        step={0.1}
                        format={(v) => v.toFixed(1)}
                      />
                    ) : null}
                  </div>
                </div>
                <GravityNotesCell
                  value={entry?.notes}
                  onCommit={(v) => writeEntry({ notes: v })}
                  brewMode={brewMode}
                />
              </div>
            );
          })}
        </div>
      </ScheduleSection>

      {/* Footer note for paper */}
      <div
        className="hs-print-only"
        style={{
          marginTop: 6,
          fontFamily: hsTokens.script,
          fontSize: 14,
          color: hsTokens.muted,
          textAlign: "right",
        }}
      >
        — generated from {recipe.name} · {totalGrainKg.toFixed(2)} kg grain ·{" "}
        {totalHopG.toFixed(0)} g hops
      </div>
    </section>
  );
}

/* ─────────────────── styles ─────────────────── */

const pageStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 20,
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: "0 0 14px 14px",
  boxShadow: hsTokens.sh3,
};

const hintStyle: CSSProperties = {
  display: "block",
  fontFamily: hsTokens.body,
  fontSize: 10,
  color: hsTokens.muted,
  marginTop: 2,
  fontWeight: 400,
  letterSpacing: 0,
  textTransform: "none",
};

/* mash step row — bolder + bigger than default Td to feel like the main mash content */

const mashStepCellStyle: CSSProperties = {
  padding: "12px 12px",
  borderBottom: `1.5px solid ${hsTokens.ink}`,
  fontFamily: hsTokens.body,
  fontSize: 14,
  color: hsTokens.ink,
  verticalAlign: "middle",
  lineHeight: 1.3,
};

const mashStepIndexStyle: CSSProperties = {
  fontFamily: hsTokens.display,
  fontSize: 18,
  color: hsTokens.muted,
  marginRight: 12,
  fontVariantNumeric: "tabular-nums",
  opacity: 0.55,
};

const mashStepNameStyle: CSSProperties = {
  fontFamily: hsTokens.display,
  fontSize: 16,
  letterSpacing: "-0.015em",
  color: hsTokens.ink,
};

const mashStepValueStyle: CSSProperties = {
  display: "block",
  fontFamily: hsTokens.display,
  fontSize: 18,
  letterSpacing: "-0.02em",
  color: hsTokens.ink,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
};

const mashStepHintStyle: CSSProperties = {
  display: "block",
  fontFamily: hsTokens.mono,
  fontSize: 10,
  color: hsTokens.muted,
  fontVariantNumeric: "tabular-nums",
  marginTop: 3,
  lineHeight: 1,
};

const mashStepActualStyle: CSSProperties = {
  position: "relative",
  borderLeft: `1px solid ${hsTokens.ink}`,
  background: hsTokens.cream,
  minHeight: 36,
};

/* ─────────────────── title block (with print button) ─────────────────── */

function TitleBlock({
  onPrint,
  isBrewMode,
  sessionStatus,
  onStatusChange,
  onToggleBrewMode,
  priorSessions,
  onResumeSession,
  onCreateNewSession,
}: {
  onPrint: () => void;
  isBrewMode: boolean;
  sessionStatus?: SessionStatus;
  onStatusChange?: (status: SessionStatus) => void;
  onToggleBrewMode?: () => void;
  priorSessions: BrewSession[];
  onResumeSession?: (id: string) => void;
  onCreateNewSession?: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleBrewClick = () => {
    if (!onToggleBrewMode) return;
    if (isBrewMode) {
      onToggleBrewMode();
      return;
    }
    if (priorSessions.length > 0) {
      setPickerOpen((v) => !v);
      return;
    }
    onToggleBrewMode();
  };

  return (
    <header
      className="hs-print-hide"
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 4,
      }}
    >
      <div>
        <div style={{ marginBottom: 4 }}>
          <HSScriptNote
            color={isBrewMode ? hsTokens.water : hsTokens.honey}
            size={20}
            rotate={-3}
          >
            {isBrewMode ? "recording brew day —" : "brew day —"}
          </HSScriptNote>
        </div>
        <h2
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(28px, 4vw, 40px)",
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            color: hsTokens.ink,
            margin: 0,
          }}
        >
          Brew sheet.
        </h2>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            color: hsTokens.muted,
            marginTop: 6,
            marginBottom: 0,
            lineHeight: 1.5,
          }}
        >
          {isBrewMode
            ? "Recording actuals — auto-saves as you go."
            : "Every target your brew day will need — read top to bottom, kettle to fermenter."}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          position: "relative",
        }}
      >
        {isBrewMode && sessionStatus && onStatusChange ? (
          <StatusPill status={sessionStatus} onChange={onStatusChange} />
        ) : null}
        {onToggleBrewMode ? (
          <BrewToggleButton
            isBrewMode={isBrewMode}
            onClick={handleBrewClick}
            pickerOpen={pickerOpen}
          />
        ) : null}
        {pickerOpen && !isBrewMode && onResumeSession && onCreateNewSession ? (
          <SessionPicker
            priorSessions={priorSessions}
            onResume={(id) => {
              setPickerOpen(false);
              onResumeSession(id);
            }}
            onStartNew={() => {
              setPickerOpen(false);
              onCreateNewSession();
            }}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}
        <IconButton onClick={onPrint} label="Print" title="Print brew sheet">
          <PrinterIcon />
        </IconButton>
      </div>
    </header>
  );
}

/* ─────────────────── Brew toggle / status pill / session picker ─────────────────── */

function BrewToggleButton({
  isBrewMode,
  onClick,
  pickerOpen,
}: {
  isBrewMode: boolean;
  onClick: () => void;
  pickerOpen: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isBrewMode ? "Exit Brew Mode" : "Start a brew session"}
      aria-pressed={isBrewMode}
      aria-expanded={pickerOpen}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: isBrewMode ? hsTokens.ink : hsTokens.hops,
        color: isBrewMode ? hsTokens.cream : hsTokens.cream,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 8,
        boxShadow: hsTokens.sh1,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {isBrewMode ? (
        <>
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: hsTokens.cream,
              animation: "hsBrewPulse 1.4s ease-in-out infinite",
            }}
          />
          <span>Recording</span>
        </>
      ) : (
        <>
          <span>Brew</span>
          {pickerOpen ? <span style={{ fontSize: 9 }}>▴</span> : <span style={{ fontSize: 9 }}>▾</span>}
        </>
      )}
    </button>
  );
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  planning: "Planning",
  brewing: "Brewing",
  fermenting: "Fermenting",
  conditioning: "Conditioning",
  completed: "Completed",
};

const STATUS_ORDER: SessionStatus[] = [
  "planning",
  "brewing",
  "fermenting",
  "conditioning",
  "completed",
];

const STATUS_ACCENT: Record<SessionStatus, string> = {
  planning: hsTokens.muted,
  brewing: hsTokens.hops,
  fermenting: hsTokens.water,
  conditioning: hsTokens.honey,
  completed: hsTokens.malt,
};

function StatusPill({
  status,
  onChange,
}: {
  status: SessionStatus;
  onChange: (next: SessionStatus) => void;
}) {
  const cycle = () => {
    const idx = STATUS_ORDER.indexOf(status);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    onChange(next);
  };
  return (
    <button
      type="button"
      onClick={cycle}
      title="Click to advance brew status"
      aria-label={`Status: ${STATUS_LABELS[status]}. Click to advance.`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: hsTokens.sh1,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: STATUS_ACCENT[status],
        }}
      />
      <span>{STATUS_LABELS[status]}</span>
    </button>
  );
}

function SessionPicker({
  priorSessions,
  onResume,
  onStartNew,
  onClose,
}: {
  priorSessions: BrewSession[];
  onResume: (id: string) => void;
  onStartNew: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pick a brew session"
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        zIndex: 30,
        minWidth: 260,
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh3,
        overflow: "hidden",
        fontFamily: hsTokens.body,
      }}
    >
      <div
        style={{
          padding: "10px 12px 6px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          background: hsTokens.cream2,
          borderBottom: `1px solid ${hsTokens.ink}`,
        }}
      >
        Prior sessions for this recipe
      </div>
      <div style={{ maxHeight: 280, overflowY: "auto" }}>
        {priorSessions.map((s) => {
          const date = new Date(s.brewDate);
          const label = Number.isNaN(date.getTime())
            ? "—"
            : date.toLocaleDateString();
          const og = s.actuals.originalGravity?.toFixed(3);
          const abv = s.calculated?.actualABV?.toFixed(1);
          const summary = og ? `OG ${og}` : abv ? `ABV ${abv}%` : "in progress";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onResume(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                width: "100%",
                padding: "10px 12px",
                background: "transparent",
                border: "none",
                borderBottom: `1px solid color-mix(in oklch, ${hsTokens.ink} 15%, transparent)`,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: hsTokens.body,
                fontSize: 12,
                color: hsTokens.ink,
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 10, color: hsTokens.muted }}>
                  {STATUS_LABELS[s.status]} · {summary}
                </span>
              </span>
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: STATUS_ACCENT[s.status],
                }}
              />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onStartNew}
        style={{
          display: "block",
          width: "100%",
          padding: "10px 12px",
          background: hsTokens.honey,
          color: hsTokens.ink,
          border: "none",
          borderTop: `1.5px solid ${hsTokens.ink}`,
          fontFamily: hsTokens.body,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        + Start new session
      </button>
    </div>
  );
}

function IconButton({
  onClick,
  label,
  title,
  children,
}: {
  onClick: () => void;
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 8,
        boxShadow: hsTokens.sh1,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function PrinterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

/* ─────────────────── schedule section frame ─────────────────── */

function ScheduleSection({
  title,
  eyebrow,
  accent,
  scriptNote,
  compactHeader,
  headerRight,
  children,
}: {
  title: string;
  eyebrow?: string;
  accent: string;
  scriptNote?: string;
  compactHeader?: boolean;
  /** Optional content rendered top-right in the header — used for
   *  "*due to X changes" revision notes (Brew Mode). */
  headerRight?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="hs-print-block"
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh2,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: accent,
          pointerEvents: "none",
        }}
      />
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          padding: compactHeader ? "12px 14px 8px" : "16px 16px 12px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          {eyebrow ? (
            <span
              style={{
                fontFamily: hsTokens.display,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: hsTokens.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {eyebrow}
            </span>
          ) : null}
          <h3
            style={{
              fontFamily: hsTokens.display,
              fontSize: compactHeader ? 16 : 18,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: hsTokens.ink,
              margin: 0,
              textTransform: "none",
            }}
          >
            {title}
          </h3>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            marginLeft: "auto",
          }}
        >
          {scriptNote ? (
            <HSScriptNote color={accent} size={16} rotate={-4}>
              {scriptNote}
            </HSScriptNote>
          ) : null}
          {headerRight}
        </div>
      </header>
      <div
        style={{
          padding: "0 12px 12px",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>
    </section>
  );
}

function CategoryHeader({
  eyebrow,
  title,
  accent,
  scriptNote,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  scriptNote?: string;
}) {
  return (
    <header
      className="hs-print-block"
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 4px 0",
        marginTop: 4,
        marginBottom: -6,
        borderBottom: `2px solid ${accent}`,
        paddingBottom: 8,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {eyebrow}
        </span>
        <h3
          style={{
            fontFamily: hsTokens.display,
            fontSize: 22,
            letterSpacing: "-0.025em",
            lineHeight: 1,
            color: hsTokens.ink,
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      {scriptNote ? (
        <HSScriptNote color={accent} size={17} rotate={-4}>
          {scriptNote}
        </HSScriptNote>
      ) : null}
    </header>
  );
}

/* ─────────────────── mini-table (top strip) ─────────────────── */

interface MiniRow {
  label: string;
  target?: ReactNode;
  hint?: string;
  actualSlot?: boolean;
  /**
   * When set, replaces the static value in Brew Mode with this node
   * (e.g. an editable CellInput). The target stays alongside as the planned value.
   */
  actualNode?: ReactNode;
  /**
   * Recomputed value when actual ingredient amounts shift it (Phase 2.5b).
   * When set, the original `target` renders with a strikethrough and this value
   * drops below it in script font with a "*due to X" annotation.
   */
  revisedTarget?: ReactNode;
  /** Short reason for the revision — used as the annotation. E.g. "grain changes". */
  revisionReason?: string;
}

type MiniRowEntry =
  | MiniRow
  | [MiniRow, MiniRow]
  | { left: MiniRow; topRight: MiniRow; bottomRight: MiniRow };

function isPairEntry(entry: MiniRowEntry): entry is [MiniRow, MiniRow] {
  return Array.isArray(entry);
}

function isSplitRightEntry(
  entry: MiniRowEntry,
): entry is { left: MiniRow; topRight: MiniRow; bottomRight: MiniRow } {
  return !Array.isArray(entry) && "topRight" in entry;
}

function MiniTable({
  title,
  accent,
  rows,
}: {
  title: string;
  accent: string;
  rows: MiniRowEntry[];
}) {
  // Scan all rows (flattening pair/split-right entries) for unique revision
  // reasons. When present, render a single "*due to X changes" footer in the
  // corner of the card instead of repeating the annotation per row.
  const revisionReasons = (() => {
    const set = new Set<string>();
    const scan = (r: MiniRow) => {
      if (r.revisedTarget != null && r.revisionReason) {
        set.add(r.revisionReason);
      }
    };
    rows.forEach((entry) => {
      if (isPairEntry(entry)) {
        entry.forEach(scan);
      } else if (isSplitRightEntry(entry)) {
        scan(entry.left);
        scan(entry.topRight);
        scan(entry.bottomRight);
      } else {
        scan(entry);
      }
    });
    return Array.from(set);
  })();

  return (
    <section
      className="hs-print-block"
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: accent,
          pointerEvents: "none",
        }}
      />
      <div
        className="hs-mini-title"
        style={{
          padding: "12px 12px 8px",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 13,
            color: hsTokens.ink,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          {title}
        </span>
        {revisionReasons.length > 0 ? (
          <span
            className="hs-print-hide"
            style={{
              fontFamily: hsTokens.script,
              fontSize: 16,
              color: hsTokens.roast,
              lineHeight: 1.1,
              textAlign: "right",
            }}
          >
            {revisionReasons.map((r, i) => (
              <span key={r} style={{ display: "block" }}>
                {i === 0 ? "*" : ""}due to {r}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: hsTokens.body,
          fontSize: 12,
          tableLayout: "auto",
        }}
      >
        <tbody>
          {rows.map((entry, i) => {
            if (isPairEntry(entry)) {
              const [a, b] = entry;
              return (
                <tr key={`${i}-${a.label}-${b.label}`}>
                  <MiniLabelCell label={a.label} />
                  <MiniValueCell row={a} />
                  <MiniLabelCell label={b.label} bordered />
                  <MiniValueCell row={b} />
                </tr>
              );
            }
            if (isSplitRightEntry(entry)) {
              return (
                <Fragment key={`${i}-${entry.left.label}-split`}>
                  <tr>
                    <MiniLabelCell label={entry.left.label} rowSpan={2} />
                    <MiniValueCell row={entry.left} rowSpan={2} />
                    <MiniLabelCell label={entry.topRight.label} bordered compact />
                    <MiniValueCell row={entry.topRight} compact />
                  </tr>
                  <tr>
                    <MiniLabelCell label={entry.bottomRight.label} bordered compact />
                    <MiniValueCell row={entry.bottomRight} compact />
                  </tr>
                </Fragment>
              );
            }
            return (
              <tr key={`${i}-${entry.label}`}>
                <MiniLabelCell label={entry.label} />
                <MiniValueCell row={entry} colSpan={3} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function MiniLabelCell({
  label,
  bordered,
  rowSpan,
  compact,
}: {
  label: string;
  bordered?: boolean;
  rowSpan?: number;
  compact?: boolean;
}) {
  return (
    <td
      rowSpan={rowSpan}
      className="hs-mini-label-cell"
      style={{
        padding: compact ? "2px 12px" : "5px 12px",
        borderTop: `1px solid ${hsTokens.ink}`,
        borderRight: `1px solid ${hsTokens.ink}`,
        borderLeft: bordered ? `1px solid ${hsTokens.ink}` : undefined,
        color: hsTokens.muted,
        fontWeight: 600,
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        background: hsTokens.cream2,
        textAlign: "right",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
      }}
    >
      {label}
    </td>
  );
}

function MiniValueCell({
  row,
  colSpan,
  rowSpan,
  compact,
}: {
  row: MiniRow;
  colSpan?: number;
  rowSpan?: number;
  compact?: boolean;
}) {
  const hasActual = row.actualNode !== undefined && row.actualNode !== null;
  const hasRevision = row.revisedTarget !== undefined && row.revisedTarget !== null;
  const innerPad = compact ? "2px 10px" : "5px 10px";

  const targetBlock = (
    <>
      {hasRevision ? (
        <RevisedValue
          planned={row.target}
          revised={row.revisedTarget}
          reason={row.revisionReason}
          compact
        />
      ) : (
        row.target ?? (
          <span style={{ color: hsTokens.muted, fontStyle: "italic", fontWeight: 400 }}>
            —
          </span>
        )
      )}
      {row.hint && !hasRevision ? (
        <span
          style={{
            display: compact ? "inline" : "block",
            fontSize: 10,
            color: hsTokens.muted,
            fontWeight: 400,
            marginLeft: compact ? 6 : 0,
            marginTop: compact ? 0 : 1,
          }}
        >
          {compact ? `· ${row.hint}` : row.hint}
        </span>
      ) : null}
    </>
  );

  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      className="hs-mini-value-cell"
      style={{
        padding: 0,
        borderTop: `1px solid ${hsTokens.ink}`,
        fontFamily: hsTokens.body,
        fontSize: 12,
        fontWeight: 600,
        color: hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        background: row.actualSlot && !row.target ? hsTokens.cream : hsTokens.paper,
        lineHeight: 1.2,
      }}
    >
      {hasActual ? (
        <div
          className="hs-mini-value-row"
          style={{ display: "flex", alignItems: "stretch", minHeight: 26 }}
        >
          <div
            className="hs-mini-target"
            style={{
              flex: "1 1 0",
              minWidth: 0,
              padding: innerPad,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              columnGap: 6,
            }}
          >
            {targetBlock}
          </div>
          <div
            className="hs-mini-actual"
            style={{
              position: "relative",
              flex: "0 0 auto",
              width: 88,
              minHeight: 26,
              borderLeft: `1px dotted color-mix(in oklch, ${hsTokens.ink} 30%, transparent)`,
              background: hsTokens.cream,
              color: hsTokens.water,
              fontWeight: 600,
            }}
          >
            {row.actualNode}
          </div>
        </div>
      ) : (
        <div style={{ padding: innerPad }}>{targetBlock}</div>
      )}
    </td>
  );
}

/**
 * Displays a "scratched-out and penned-in" value: the planned value with a
 * water-blue strikethrough (matching the annotation pen), the revised value
 * below in script (handwriting) font in the same pen color.
 *
 * When `compact` is true, only an asterisk marker is shown next to the revised
 * value — the parent (e.g. MiniTable) is expected to render a single corner
 * note like "*due to grain changes". This avoids repeating the same annotation
 * across many rows.
 *
 * When `compact` is false (default), the inline "*due to X" annotation renders
 * below the revised value (used in single-row contexts like the FG target row
 * or the final water profile).
 */
function RevisedValue({
  planned,
  revised,
  reason,
  compact = false,
  stacked = false,
}: {
  planned: ReactNode;
  revised: ReactNode;
  reason?: string;
  compact?: boolean;
  /**
   * When true, lay out planned (strikethrough) and revised vertically (one per
   * row). Default is inline side-by-side, which fits short values like numbers.
   * Use `stacked` for long content like the water profile mineral string.
   */
  stacked?: boolean;
}) {
  const struck = (
    <span
      style={{
        textDecorationLine: "line-through",
        textDecorationColor: hsTokens.roast,
        textDecorationThickness: "2px",
        textDecorationStyle: "solid",
        color: hsTokens.ink,
        fontWeight: 400,
        opacity: 0.7,
      }}
    >
      {planned}
    </span>
  );
  const renew = (
    <span
      style={{
        fontFamily: hsTokens.script,
        fontSize: 18,
        color: hsTokens.water,
        lineHeight: 1,
      }}
    >
      {revised}
      {compact ? (
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 16,
            color: hsTokens.roast,
            marginLeft: 3,
            verticalAlign: "super",
            lineHeight: 1,
          }}
        >
          *
        </span>
      ) : null}
    </span>
  );
  const inlineReason =
    !compact && reason ? (
      <span
        style={{
          fontFamily: hsTokens.script,
          fontSize: 16,
          color: hsTokens.roast,
          lineHeight: 1.1,
          marginTop: 1,
          whiteSpace: "nowrap",
        }}
      >
        *due to {reason}
      </span>
    ) : null;

  if (stacked) {
    return (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 1 }}>
        {struck}
        <span
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          {renew}
          {inlineReason}
        </span>
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      {struck}
      {renew}
      {inlineReason}
    </span>
  );
}

/**
 * Section-header revision note ("*due to grain changes") — pen-red script font,
 * sized for visibility in the top-right corner of a ScheduleSection header.
 */
function SectionRevisionNote({ reason }: { reason: string }) {
  return (
    <span
      className="hs-print-hide"
      style={{
        fontFamily: hsTokens.script,
        fontSize: 17,
        color: hsTokens.roast,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      *due to {reason}
    </span>
  );
}

/* ─────────────────── water matrix ─────────────────── */

interface WaterMatrixProps {
  mashWaterL: number;
  spargeWaterL: number;
  totalWaterL: number;
  strikeTempC: number | null;
  spargeTempC: number;
  salts?: SaltAdditionsObj;
  mashSalts: SaltAdditionsObj;
  spargeSalts: SaltAdditionsObj;
  mashPhAdjustment: RecipeCalculations["mashPhAdjustment"];
  estimatedMashPh: RecipeCalculations["estimatedMashPh"];
  finalProfile: import("@/modules/beta-builder/domain/services/WaterChemistryService").WaterProfile | null;
  /** Recomputed final profile from actual salt amounts (Brew Mode). */
  revisedFinalProfile: import("@/modules/beta-builder/domain/services/WaterChemistryService").WaterProfile | null;
  brewMode: BrewMode | null;
}

const SALT_DEFS: Array<{ key: keyof SaltAdditionsObj; label: string; unit: string }> = [
  { key: "gypsum_g", label: "Gypsum (CaSO₄)", unit: "g" },
  { key: "cacl2_g", label: "Calcium Chloride (CaCl₂)", unit: "g" },
  { key: "epsom_g", label: "Epsom (MgSO₄)", unit: "g" },
  { key: "nacl_g", label: "Salt (NaCl)", unit: "g" },
  { key: "nahco3_g", label: "Baking Soda (NaHCO₃)", unit: "g" },
];

function WaterMatrix({
  mashWaterL,
  spargeWaterL,
  totalWaterL,
  strikeTempC,
  spargeTempC,
  salts,
  mashSalts,
  spargeSalts,
  mashPhAdjustment,
  estimatedMashPh,
  finalProfile,
  revisedFinalProfile,
  brewMode,
}: WaterMatrixProps) {
  const visibleSalts = salts
    ? SALT_DEFS.filter((d) => {
        const v = salts[d.key];
        return typeof v === "number" && v > 0;
      })
    : [];

  return (
    <table
      className="hs-water-matrix"
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: hsTokens.body,
        fontSize: 13,
        tableLayout: "auto",
      }}
    >
      <thead>
        <tr>
          <th
            rowSpan={2}
            style={{
              ...matrixHeadGroupStyle,
              textAlign: "left",
              background: hsTokens.cream2,
            }}
          >
            Measurement
          </th>
          <th
            colSpan={2}
            style={{
              ...matrixHeadGroupStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Mash
          </th>
          <th
            colSpan={2}
            style={{
              ...matrixHeadGroupStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Sparge
          </th>
        </tr>
        <tr>
          <th
            style={{
              ...matrixHeadSubStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Target
          </th>
          <th
            style={{
              ...matrixHeadSubStyle,
              background: hsTokens.cream,
              color: hsTokens.muted,
            }}
          >
            Actual
          </th>
          <th
            style={{
              ...matrixHeadSubStyle,
              borderLeft: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            Target
          </th>
          <th
            style={{
              ...matrixHeadSubStyle,
              background: hsTokens.cream,
              color: hsTokens.muted,
            }}
          >
            Actual
          </th>
        </tr>
      </thead>
      <tbody>
        {/* Volume row */}
        <MatrixRow
          label="Volume"
          mashTarget={`${mashWaterL.toFixed(1)} L`}
          mashHint={`${lToGal(mashWaterL)} gal`}
          spargeTarget={`${spargeWaterL.toFixed(1)} L`}
          spargeHint={`${lToGal(spargeWaterL)} gal`}
          mashActualNode={
            brewMode ? (
              <CellInput
                value={brewMode.actuals.strikeWaterL}
                onCommit={(v) => brewMode.onActualsChange({ strikeWaterL: v })}
                step={0.1}
                format={(v) => v.toFixed(1)}
                suffix=" L"
              />
            ) : undefined
          }
          spargeActualNode={
            brewMode ? (
              <CellInput
                value={brewMode.actuals.spargeWaterL}
                onCommit={(v) => brewMode.onActualsChange({ spargeWaterL: v })}
                step={0.1}
                format={(v) => v.toFixed(1)}
                suffix=" L"
              />
            ) : undefined
          }
        />
        {/* Temp row */}
        <MatrixRow
          label="Strike / sparge temp"
          mashTarget={
            strikeTempC != null
              ? `${strikeTempC.toFixed(1)} °C`
              : "—"
          }
          mashHint={strikeTempC != null ? `${cToF(strikeTempC)} °F` : undefined}
          spargeTarget={`${spargeTempC.toFixed(0)} °C`}
          spargeHint={`${cToF(spargeTempC)} °F`}
          mashActualNode={
            brewMode ? (
              <CellInput
                value={brewMode.actuals.strikeWaterTempC}
                onCommit={(v) =>
                  brewMode.onActualsChange({ strikeWaterTempC: v })
                }
                step={0.1}
                format={(v) => v.toFixed(1)}
                suffix=" °C"
              />
            ) : undefined
          }
          spargeActualNode={
            brewMode ? (
              <CellInput
                value={brewMode.actuals.spargeWaterTempC}
                onCommit={(v) =>
                  brewMode.onActualsChange({ spargeWaterTempC: v })
                }
                step={0.1}
                format={(v) => v.toFixed(1)}
                suffix=" °C"
              />
            ) : undefined
          }
        />
        {/* Salt rows */}
        {visibleSalts.map((def) => {
          const mashVal = mashSalts[def.key] ?? 0;
          const spargeVal = spargeSalts[def.key] ?? 0;
          const mashId = `salt:mash:${def.key}`;
          const spargeId = `salt:sparge:${def.key}`;
          return (
            <MatrixRow
              key={def.key}
              label={def.label}
              mashTarget={
                mashVal > 0 ? `${mashVal.toFixed(2)} ${def.unit}` : "—"
              }
              spargeTarget={
                spargeVal > 0 ? `${spargeVal.toFixed(2)} ${def.unit}` : "—"
              }
              mashActualCellOverride={
                brewMode && mashVal > 0 ? (
                  <AddedCell
                    id={mashId}
                    plannedAmount={mashVal}
                    unit={def.unit}
                    brewMode={brewMode}
                    precision={2}
                  />
                ) : undefined
              }
              spargeActualCellOverride={
                brewMode && spargeVal > 0 ? (
                  <AddedCell
                    id={spargeId}
                    plannedAmount={spargeVal}
                    unit={def.unit}
                    brewMode={brewMode}
                    precision={2}
                  />
                ) : undefined
              }
            />
          );
        })}
        {/* Mash-only adjustments */}
        {mashPhAdjustment && mashPhAdjustment.lacticAcid88Ml > 0 ? (
          <MatrixRow
            label="Lactic Acid (88%)"
            labelHint={`to pH ${mashPhAdjustment.targetPh.toFixed(2)}`}
            mashTarget={`${mashPhAdjustment.lacticAcid88Ml.toFixed(2)} mL`}
            spargeOmit
            mashActualCellOverride={
              brewMode ? (
                <AddedCell
                  id="salt:mash:lacticAcid"
                  plannedAmount={mashPhAdjustment.lacticAcid88Ml}
                  unit="mL"
                  brewMode={brewMode}
                  precision={2}
                />
              ) : undefined
            }
          />
        ) : null}
        {mashPhAdjustment && mashPhAdjustment.bakingSodaG > 0 ? (
          <MatrixRow
            label="Baking Soda (pH adj.)"
            labelHint={`to pH ${mashPhAdjustment.targetPh.toFixed(2)}`}
            mashTarget={`${mashPhAdjustment.bakingSodaG.toFixed(2)} g`}
            spargeOmit
            mashActualCellOverride={
              brewMode ? (
                <AddedCell
                  id="salt:mash:bakingSodaPh"
                  plannedAmount={mashPhAdjustment.bakingSodaG}
                  unit="g"
                  brewMode={brewMode}
                  precision={2}
                />
              ) : undefined
            }
          />
        ) : null}
        {/* Estimated mash pH — mash-only target */}
        <MatrixRow
          label="Estimated mash pH"
          labelHint="target 5.2–5.6"
          mashTarget={
            estimatedMashPh != null ? estimatedMashPh.toFixed(2) : "—"
          }
          spargeOmit
          mashActualNode={
            brewMode ? (
              <CellInput
                value={brewMode.actuals.mashPH}
                onCommit={(v) => brewMode.onActualsChange({ mashPH: v })}
                step={0.01}
                format={(v) => v.toFixed(2)}
              />
            ) : undefined
          }
        />
        {/* Final profile + Total water — share one summary row */}
        <tr className="hs-water-final-tr">
          <td
            className="hs-water-final-td"
            colSpan={5}
            style={{
              padding: "8px 12px",
              borderTop: `1.5px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
              fontFamily: hsTokens.body,
              fontSize: 11,
              color: hsTokens.ink,
            }}
          >
            <div
              className="hs-water-final-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div className="hs-final-profile" style={{ textAlign: "left" }}>
                {finalProfile ? (
                  <>
                    <span
                      className="hs-final-profile-label"
                      style={{
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: hsTokens.muted,
                        marginRight: 10,
                      }}
                    >
                      Final profile (ppm)
                    </span>
                    {revisedFinalProfile ? (
                      <RevisedValue
                        planned={
                          <span
                            style={{
                              fontFamily: hsTokens.mono,
                              fontSize: 12,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            Ca {Math.round(finalProfile.Ca)} · Mg{" "}
                            {Math.round(finalProfile.Mg)} · Na{" "}
                            {Math.round(finalProfile.Na)} · Cl{" "}
                            {Math.round(finalProfile.Cl)} · SO₄{" "}
                            {Math.round(finalProfile.SO4)} · HCO₃{" "}
                            {Math.round(finalProfile.HCO3)}
                          </span>
                        }
                        revised={
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            Ca {Math.round(revisedFinalProfile.Ca)} · Mg{" "}
                            {Math.round(revisedFinalProfile.Mg)} · Na{" "}
                            {Math.round(revisedFinalProfile.Na)} · Cl{" "}
                            {Math.round(revisedFinalProfile.Cl)} · SO₄{" "}
                            {Math.round(revisedFinalProfile.SO4)} · HCO₃{" "}
                            {Math.round(revisedFinalProfile.HCO3)}
                          </span>
                        }
                        reason="salt changes"
                        stacked
                      />
                    ) : (
                      <span
                        className="hs-final-profile-values"
                        style={{
                          fontFamily: hsTokens.mono,
                          fontSize: 12,
                          color: hsTokens.ink,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        Ca {Math.round(finalProfile.Ca)} · Mg{" "}
                        {Math.round(finalProfile.Mg)} · Na{" "}
                        {Math.round(finalProfile.Na)} · Cl{" "}
                        {Math.round(finalProfile.Cl)} · SO₄{" "}
                        {Math.round(finalProfile.SO4)} · HCO₃{" "}
                        {Math.round(finalProfile.HCO3)}
                      </span>
                    )}
                  </>
                ) : null}
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <span
                  style={{
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                    marginRight: 10,
                  }}
                >
                  Total water
                </span>
                <span style={{ fontFamily: hsTokens.display, fontSize: 14 }}>
                  {totalWaterL.toFixed(1)} L · {lToGal(totalWaterL)} gal
                </span>
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const matrixHeadGroupStyle: CSSProperties = {
  padding: "6px 10px",
  fontFamily: hsTokens.body,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: hsTokens.ink,
  borderTop: `1.5px solid ${hsTokens.ink}`,
  borderBottom: `1px solid ${hsTokens.ink}`,
  textAlign: "center",
};

const matrixHeadSubStyle: CSSProperties = {
  padding: "5px 8px",
  fontFamily: hsTokens.body,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  borderBottom: `1.5px solid ${hsTokens.ink}`,
  color: hsTokens.ink,
  textAlign: "center",
  whiteSpace: "nowrap",
};

function MatrixRow({
  label,
  labelHint,
  mashTarget,
  mashHint,
  spargeTarget,
  spargeHint,
  spargeOmit,
  mashActualNode,
  spargeActualNode,
  mashActualCellOverride,
  spargeActualCellOverride,
}: {
  label: string;
  labelHint?: string;
  mashTarget: string;
  mashHint?: string;
  spargeTarget?: string;
  spargeHint?: string;
  spargeOmit?: boolean;
  /** Content rendered INSIDE the default MatrixActualCell `<td>`. */
  mashActualNode?: ReactNode;
  spargeActualNode?: ReactNode;
  /** REPLACES the default MatrixActualCell `<td>` entirely (e.g. AddedCell which
   *  renders its own `<td>`). When provided, mashActualNode is ignored for that side. */
  mashActualCellOverride?: ReactNode;
  spargeActualCellOverride?: ReactNode;
}) {
  return (
    <tr className="hs-matrix-row">
      <td
        className="hs-matrix-label"
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${hsTokens.ink}`,
          fontFamily: hsTokens.body,
          fontSize: 12,
          color: hsTokens.ink,
          verticalAlign: "middle",
          lineHeight: 1.3,
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        {labelHint ? <span style={hintStyle}>{labelHint}</span> : null}
      </td>
      <MatrixValueCell content={mashTarget} hint={mashHint} bordered phase="Mash" />
      {mashActualCellOverride ?? (
        <MatrixActualCell phase="Mash">{mashActualNode}</MatrixActualCell>
      )}
      <MatrixValueCell
        content={spargeOmit ? "—" : spargeTarget ?? "—"}
        hint={spargeOmit ? undefined : spargeHint}
        bordered
        muted={spargeOmit}
        phase="Sparge"
      />
      {spargeOmit ? (
        <MatrixDashCell />
      ) : (
        spargeActualCellOverride ?? (
          <MatrixActualCell phase="Sparge">{spargeActualNode}</MatrixActualCell>
        )
      )}
    </tr>
  );
}

function MatrixValueCell({
  content,
  hint,
  bordered,
  muted,
  phase,
}: {
  content: string;
  hint?: string;
  bordered?: boolean;
  muted?: boolean;
  phase?: "Mash" | "Sparge";
}) {
  return (
    <td
      className="hs-matrix-target"
      data-phase={phase}
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: bordered ? `1.5px solid ${hsTokens.ink}` : undefined,
        fontFamily: hsTokens.mono,
        fontSize: 12,
        color: muted ? hsTokens.muted : hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.3,
        background: hsTokens.paper,
      }}
    >
      {content}
      {hint ? (
        <span
          style={{
            display: "block",
            fontFamily: hsTokens.body,
            fontSize: 10,
            color: hsTokens.muted,
            marginTop: 1,
          }}
        >
          {hint}
        </span>
      ) : null}
    </td>
  );
}

function MatrixActualCell({
  children,
  phase,
}: {
  children?: ReactNode;
  phase?: "Mash" | "Sparge";
}) {
  return (
    <td
      className="hs-matrix-actual"
      data-phase={phase}
      style={{
        position: "relative",
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream,
        minHeight: 28,
        height: 28,
      }}
    >
      {children ?? " "}
    </td>
  );
}

function MatrixDashCell() {
  return (
    <td
      className="hs-matrix-actual hs-matrix-omit"
      data-phase="Sparge"
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderLeft: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream,
        color: hsTokens.muted,
        fontFamily: hsTokens.mono,
        fontSize: 11,
        textAlign: "center",
        verticalAlign: "middle",
      }}
    >
      —
    </td>
  );
}

/* ─────────────────── hops list with side flavor radar ─────────────────── */

function HopsList({
  boilHops,
  whirlpoolHops,
  dryHops,
  totalHopG,
  flavor,
  brewMode = null,
}: {
  boilHops: Recipe["hops"];
  whirlpoolHops: Recipe["hops"];
  dryHops: Recipe["hops"];
  totalHopG: number;
  flavor: HopFlavorVector | null;
  /** Brew Mode prop — null when in display-only mode. See Phase 2.5b. */
  brewMode?: BrewMode | null;
}) {
  return (
    <div
      className="hs-print-stack"
      style={{
        display: "grid",
        gridTemplateColumns: flavor
          ? "minmax(0, 1fr) clamp(110px, 26%, 200px)"
          : "1fr",
        gap: 16,
        alignItems: "start",
      }}
    >
      <div
        className="hs-hops-list"
        data-brew={brewMode ? "true" : "false"}
        style={{ minWidth: 0 }}
      >
        <HopHeaderRow brewMode={brewMode} />

        {boilHops.length > 0 ? <HopGroupRow label="Boil" accent={hsTokens.hops} brewMode={brewMode} /> : null}
        {boilHops.map((h) => (
          <HopDataRow
            key={h.id}
            id={h.id}
            timeLabel={
              h.type === "first wort"
                ? "first wort"
                : h.type === "mash"
                ? "mash"
                : `${h.timeMinutes ?? 0} min`
            }
            name={h.name}
            grams={h.grams}
            aa={h.alphaAcid}
            brewMode={brewMode}
          />
        ))}

        {whirlpoolHops.length > 0 ? (
          <HopGroupRow label="Whirlpool" accent={hsTokens.honey} brewMode={brewMode} />
        ) : null}
        {whirlpoolHops.map((h) => (
          <HopDataRow
            key={h.id}
            id={h.id}
            timeLabel={
              h.temperatureC != null
                ? `${h.temperatureC.toFixed(0)} °C${
                    h.whirlpoolTimeMinutes != null
                      ? ` · ${h.whirlpoolTimeMinutes}′`
                      : ""
                  }`
                : "whirlpool"
            }
            name={h.name}
            grams={h.grams}
            aa={h.alphaAcid}
            brewMode={brewMode}
          />
        ))}

        {dryHops.length > 0 ? (
          <HopGroupRow label="Dry hop" accent={hsTokens.hops} brewMode={brewMode} />
        ) : null}
        {dryHops.map((h) => (
          <HopDataRow
            key={h.id}
            id={h.id}
            timeLabel={
              h.dryHopStartDay != null
                ? `day ${h.dryHopStartDay}${
                    h.dryHopDays != null ? ` · ${h.dryHopDays}d` : ""
                  }`
                : "dry hop"
            }
            name={h.name}
            grams={h.grams}
            aa={h.alphaAcid}
            brewMode={brewMode}
          />
        ))}

        <HopTotalRow totalHopG={totalHopG} brewMode={brewMode} />
      </div>

      {flavor ? (
        <div style={{ textAlign: "center" }} aria-label="Estimated hop flavor">
          <HopFlavorMini flavor={flavor} size={190} />
          <div
            style={{
              fontFamily: hsTokens.body,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              marginTop: -4,
            }}
          >
            Est. flavor
          </div>
        </div>
      ) : null}
    </div>
  );
}

const HOP_GRID_COLS = "minmax(96px, 110px) 1fr minmax(60px, 70px) minmax(50px, 60px)";
const HOP_GRID_COLS_BREW = `${HOP_GRID_COLS} minmax(56px, 64px)`;
const hopGridCols = (brewMode: BrewMode | null) =>
  brewMode ? HOP_GRID_COLS_BREW : HOP_GRID_COLS;

function HopHeaderRow({ brewMode }: { brewMode: BrewMode | null }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: hopGridCols(brewMode),
        borderTop: `1.5px solid ${hsTokens.ink}`,
        borderBottom: `1.5px solid ${hsTokens.ink}`,
        background: hsTokens.cream2,
      }}
    >
      <HopHeaderCell>Stage / Time</HopHeaderCell>
      <HopHeaderCell>Variety</HopHeaderCell>
      <HopHeaderCell align="center">Grams</HopHeaderCell>
      <HopHeaderCell align="center">AA %</HopHeaderCell>
      {brewMode ? <HopHeaderCell align="center">Added</HopHeaderCell> : null}
    </div>
  );
}

function HopHeaderCell({
  children,
  align,
}: {
  children: ReactNode;
  align?: "left" | "center" | "right";
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        textAlign: align ?? "left",
      }}
    >
      {children}
    </div>
  );
}

function HopGroupRow({
  label,
  accent,
}: {
  label: string;
  accent: string;
  /** Brew Mode prop accepted but not yet rendered here — see Phase 2.5b. */
  brewMode?: BrewMode | null;
}) {
  return (
    <div
      style={{
        padding: "6px 10px",
        background: hsTokens.cream2,
        fontFamily: hsTokens.body,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        borderBottom: `1px solid ${hsTokens.ink}`,
        borderTop: `1px solid ${hsTokens.ink}`,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: 999,
          background: accent,
          border: `1px solid ${hsTokens.ink}`,
          marginRight: 8,
          verticalAlign: "middle",
        }}
      />
      {label}
    </div>
  );
}

function HopDataRow({
  id,
  timeLabel,
  name,
  grams,
  aa,
  brewMode,
}: {
  id: string;
  timeLabel: string;
  name: string;
  grams: number;
  aa: number;
  brewMode: BrewMode | null;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: hopGridCols(brewMode),
        borderBottom: `1px solid ${hsTokens.ink}`,
      }}
    >
      <HopDataCell font="mono">{timeLabel}</HopDataCell>
      <HopDataCell>
        <span style={{ fontWeight: 600 }}>{name || "Unnamed hop"}</span>
      </HopDataCell>
      <HopDataCell align="center" font="mono">
        {grams}
      </HopDataCell>
      <HopDataCell align="center" font="mono">
        {aa.toFixed(1)}%
      </HopDataCell>
      {brewMode ? (
        <AddedCell
          id={id}
          plannedAmount={grams}
          unit="g"
          brewMode={brewMode}
          precision={1}
          display="div"
        />
      ) : null}
    </div>
  );
}

function HopDataCell({
  children,
  align,
  font,
}: {
  children?: ReactNode;
  align?: "left" | "center" | "right";
  font?: "body" | "mono";
}) {
  return (
    <div
      className="hs-hop-data-cell"
      style={{
        padding: "8px 10px",
        fontFamily: font === "mono" ? hsTokens.mono : hsTokens.body,
        fontSize: 12,
        color: hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        textAlign: align ?? "left",
        verticalAlign: "middle",
        lineHeight: 1.3,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

function HopTotalRow({
  totalHopG,
  brewMode,
}: {
  totalHopG: number;
  brewMode: BrewMode | null;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: hopGridCols(brewMode),
        borderBottom: `1px solid ${hsTokens.ink}`,
        background: hsTokens.cream2,
      }}
    >
      <HopDataCell>
        <span
          style={{
            fontWeight: 600,
            color: hsTokens.muted,
            textTransform: "uppercase",
            fontSize: 10,
            letterSpacing: "0.12em",
          }}
        >
          Total
        </span>
      </HopDataCell>
      <HopDataCell />
      <HopDataCell align="center" font="mono">
        <strong>{totalHopG.toFixed(0)} g</strong>
      </HopDataCell>
      <HopDataCell />
      {brewMode ? <HopDataCell /> : null}
    </div>
  );
}

/* ─────────────────── table primitives ─────────────────── */

function Table({ children }: { children: ReactNode }) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: hsTokens.body,
        fontSize: 13,
        tableLayout: "auto",
      }}
    >
      {children}
    </table>
  );
}

interface ColumnDef {
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  isActual?: boolean;
}

function THead({ columns }: { columns: ColumnDef[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c, i) => (
          <th
            key={i}
            style={{
              padding: "8px 10px",
              fontFamily: hsTokens.body,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: c.isActual ? hsTokens.muted : hsTokens.ink,
              background: c.isActual ? hsTokens.cream : hsTokens.cream2,
              borderTop: `1.5px solid ${hsTokens.ink}`,
              borderBottom: `1.5px solid ${hsTokens.ink}`,
              borderLeft: i > 0 ? `1px solid ${hsTokens.ink}` : "none",
              textAlign: c.align ?? "left",
              width: c.width,
              whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Td({
  children,
  align,
  font,
  colSpan,
}: {
  children?: ReactNode;
  align?: "left" | "center" | "right";
  font?: "body" | "mono" | "display";
  colSpan?: number;
}) {
  const fontFamily =
    font === "mono"
      ? hsTokens.mono
      : font === "display"
      ? hsTokens.display
      : hsTokens.body;
  return (
    <td
      colSpan={colSpan}
      style={{
        padding: "8px 10px",
        borderBottom: `1px solid ${hsTokens.ink}`,
        fontFamily,
        fontSize: 12,
        color: hsTokens.ink,
        fontVariantNumeric: "tabular-nums",
        textAlign: align ?? "left",
        verticalAlign: "middle",
        lineHeight: 1.3,
      }}
    >
      {children}
    </td>
  );
}

/**
 * Gravity-log notes cell. Sits next to a float-left stats block so that
 * its first visual line shares the row with date/SG/pH/temp; any text that
 * overflows wraps onto new lines that extend the FULL row width below the
 * stats block. Click-to-edit swaps in a full-width textarea.
 */
function GravityNotesCell({
  value,
  onCommit,
  brewMode,
}: {
  value: string | undefined;
  onCommit: (v: string | undefined) => void;
  brewMode: BrewMode | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const enterEdit = () => {
    if (!brewMode) return;
    setDraft(value ?? "");
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed.length > 0 ? trimmed : undefined;
    if (next !== value) onCommit(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  useEffect(() => {
    if (editing) {
      taRef.current?.focus();
      taRef.current?.select();
    }
  }, [editing]);

  // Auto-grow the textarea so it expands with content rather than scrolling.
  // Reset height first, then set to scrollHeight — fires on every draft change.
  useEffect(() => {
    if (!editing) return;
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [draft, editing]);

  if (editing) {
    return (
      <textarea
        ref={taRef}
        className="hs-gravity-notes-edit"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") cancel();
        }}
        rows={1}
        aria-label="Notes"
      />
    );
  }

  return (
    <div
      className="hs-gravity-notes-display"
      role={brewMode ? "button" : undefined}
      tabIndex={brewMode ? 0 : undefined}
      onClick={enterEdit}
      onKeyDown={(e) => {
        if (brewMode && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          enterEdit();
        }
      }}
      aria-label={value ? `Edit notes: ${value}` : "Add notes"}
    >
      {value ?? " "}
    </div>
  );
}


/* ─────────────────── Brew Mode primitives (Phase 2.5b) ─────────────────── */

/**
 * Inline click-to-edit number cell. Default state shows the committed value
 * in HS script (handwriting) font; clicking swaps in an input field that
 * blurs/Enters to commit. Escape cancels. Empty + view = invisible
 * (the cream `<td>` background shows through as a paper-ready space).
 */
function CellInput({
  value,
  onCommit,
  step = 0.1,
  format,
  suffix,
  align = "center",
}: {
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  step?: number;
  format?: (v: number) => string;
  suffix?: string;
  align?: "left" | "center" | "right";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const enterEdit = () => {
    setDraft(value === undefined ? "" : String(value));
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      if (value !== undefined) onCommit(undefined);
    } else {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value === undefined ? "" : String(value));
    setEditing(false);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const justify =
    align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center";

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
        aria-label="Actual value"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          background: hsTokens.cream,
          border: "none",
          outline: "none",
          fontFamily: hsTokens.mono,
          fontSize: 13,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          textAlign: align,
          padding: "0 10px",
          margin: 0,
        }}
      />
    );
  }

  const display =
    value === undefined ? "" : `${format ? format(value) : value}${suffix ?? ""}`;

  return (
    <button
      type="button"
      onClick={enterEdit}
      aria-label={display ? `Edit ${display}` : "Add actual value"}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        padding: "0 10px",
        margin: 0,
        cursor: "text",
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        fontFamily: hsTokens.script,
        fontSize: 18,
        color: hsTokens.ink,
        lineHeight: 1,
        letterSpacing: "0.005em",
      }}
    >
      {display}
    </button>
  );
}

/**
 * Inline click-to-edit text cell — same pattern as CellInput but for text/date.
 */
function CellTextInput({
  value,
  onCommit,
  type = "text",
  align = "left",
  wrap = false,
}: {
  value: string | undefined;
  onCommit: (v: string | undefined) => void;
  type?: "text" | "date";
  align?: "left" | "center" | "right";
  /** When true, the display wraps to multiple lines and the editor is a
   *  textarea instead of a single-line input. The parent cell must allow
   *  auto height for this to grow visually. */
  wrap?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const enterEdit = () => {
    setDraft(value ?? "");
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    const next = trimmed.length > 0 ? trimmed : undefined;
    if (next !== value) onCommit(next);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const justify =
    align === "right" ? "flex-end" : align === "left" ? "flex-start" : "center";

  if (editing) {
    if (wrap) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            // Enter inserts newline; Cmd/Ctrl+Enter commits; Escape cancels.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") cancel();
          }}
          rows={1}
          aria-label="Actual value"
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            minHeight: 28,
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            fontFamily: hsTokens.body,
            fontSize: 13,
            color: hsTokens.ink,
            textAlign: align,
            padding: "6px 10px",
            margin: 0,
            lineHeight: 1.3,
          }}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        aria-label="Actual value"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          background: hsTokens.cream,
          border: "none",
          outline: "none",
          fontFamily: type === "text" ? hsTokens.body : hsTokens.mono,
          fontSize: 13,
          color: hsTokens.ink,
          textAlign: align,
          padding: "0 10px",
          margin: 0,
        }}
      />
    );
  }

  const display = value ?? "";

  if (wrap) {
    return (
      <button
        type="button"
        onClick={enterEdit}
        aria-label={display ? `Edit ${display}` : "Add actual value"}
        style={{
          position: "relative",
          display: "block",
          width: "100%",
          minHeight: 28,
          background: "transparent",
          border: "none",
          outline: "none",
          padding: "6px 10px",
          margin: 0,
          cursor: "text",
          textAlign: align,
          fontFamily: hsTokens.script,
          fontSize: 18,
          color: hsTokens.ink,
          lineHeight: 1.3,
          letterSpacing: "0.005em",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {display}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEdit}
      aria-label={display ? `Edit ${display}` : "Add actual value"}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        padding: "0 10px",
        margin: 0,
        cursor: "text",
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        fontFamily: hsTokens.script,
        fontSize: 18,
        color: hsTokens.ink,
        lineHeight: 1,
        letterSpacing: "0.005em",
      }}
    >
      {display}
    </button>
  );
}

/**
 * Hand-drawn ink-stroked checkmark glyph — pairs with the polygon star aesthetic
 * from HSRatingStars (round linecap, ink color, 2px stroke).
 */
function CheckGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M3 8.5 L6.8 12 L13 4"
        stroke={hsTokens.ink}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Hand-drawn warning triangle glyph — pairs with `CheckGlyph`'s round-cap
 * 2px linework so the brew sheet's caution + success flags share a notebook
 * sketch vocabulary. No fill — clean outline like an ink doodle.
 */
function WarningTriangleGlyph({ color }: { color: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M8 2.5 L13.6 13.2 L2.4 13.2 Z"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 6.3 L8 9.4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.5" r="0.95" fill={color} />
    </svg>
  );
}

/**
 * Hand-drawn ink arrow — used in the matrix's flanking layout to point each
 * predictor card at the phase box it explains. Same round-cap 2px vocabulary
 * as `CheckGlyph` / `WarningTriangleGlyph`.
 */
function ArrowGlyph({
  direction,
  color = hsTokens.muted,
}: {
  direction: "left" | "right";
  color?: string;
}) {
  // Long horizontal stroke with a chevron head on the pointing end.
  const path =
    direction === "left"
      ? "M22 8 L2 8 M8 3 L2 8 L8 13"
      : "M2 8 L22 8 M16 3 L22 8 L16 13";
  return (
    <svg
      width="26"
      height="16"
      viewBox="0 0 24 16"
      aria-hidden
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d={path}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Convert the leading verb of a fix action (present-tense imperative) to
 * past-tense so the matrix flag reads as a completed brewer's note —
 * "Added ~2.4 L water at flameout" instead of "Add ~2.4 L water…".
 */
function toPastTense(action: string): string {
  if (!action) return action;
  return action
    .replace(/^Add\b/, "Added")
    .replace(/^Boil\b/, "Boiled")
    .replace(/^Accept\b/, "Accepted")
    .replace(/^Dilute\b/, "Diluted")
    .replace(/^Stir\b/, "Stirred");
}

/**
 * Compact severity flag — glyph + short label inside the phase-box header.
 * Acts as either a passive indicator (no `onClick`) or, when its predictor
 * card is minimized, a clickable target that morphs the card back in.
 *
 * Severity drives the color:
 *  - `caution`: roast/red
 *  - `success`: hops/green (uses CheckGlyph)
 *  - `info`: water/blue
 *
 * (The hover tooltip from earlier iterations was removed — the predictor
 * card itself surfaces the full details now, so a duplicate tooltip on the
 * flag added clutter.)
 */
function BrewTipFlag({
  severity,
  shortLabel,
  onClick,
  pulse,
  morphId,
  minimized,
}: {
  severity: "caution" | "info" | "success";
  shortLabel: ReactNode;
  /** Optional click handler — used to un-minimize the predictor card. */
  onClick?: () => void;
  /** Brief attention-grab pulse animation. */
  pulse?: boolean;
  /** Framer-motion `layoutId` shared with the predictor card so the morph
   *  animates the card → flag transition. */
  morphId?: string;
  /** Whether the predictor card is currently minimized — the flag only
   *  claims the morph `layoutId` while the card is hidden. */
  minimized?: boolean;
}) {
  const sevColor =
    severity === "caution"
      ? hsTokens.roast
      : severity === "success"
      ? hsTokens.hops
      : hsTokens.water;

  return (
    <motion.button
      type="button"
      // Key changes when the layoutId activates/deactivates so framer-motion
      // treats this as a fresh mount — triggers the shared-layout morph
      // from the predictor card's position to here.
      key={minimized && morphId ? `${morphId}-min` : "flag"}
      className="hs-print-hide"
      layoutId={minimized && morphId ? morphId : undefined}
      transition={{
        layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
      }}
      onClick={onClick}
      aria-label={
        onClick
          ? "Show fix options"
          : typeof shortLabel === "string"
          ? shortLabel
          : "Brew tip"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 4px",
        margin: 0,
        background: "transparent",
        border: "none",
        outline: "none",
        borderRadius: 4,
        fontFamily: hsTokens.script,
        // Bumped from 15 → 18 so the brewer's note reads at a glance even
        // when it carries the full "Gravity X pts high — Added Y" sentence.
        fontSize: 18,
        color: sevColor,
        cursor: onClick ? "pointer" : "default",
        lineHeight: 1.15,
        animation: pulse ? "hsTipFlagPulse 1.6s ease-in-out 3" : undefined,
      }}
    >
      {severity === "success" ? (
        <CheckGlyph />
      ) : (
        <WarningTriangleGlyph color={sevColor} />
      )}
      <span>{shortLabel}</span>
    </motion.button>
  );
}

/**
 * Click-to-toggle checkmark variant of CellInput — same position: absolute fill,
 * but renders a CheckGlyph when checked. Used in the water salts matrix where
 * "actual" is a yes/no rather than a measurement.
 */
function CellCheck({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={checked ? "Mark as not added" : "Mark as added"}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked ? <CheckGlyph /> : null}
    </button>
  );
}

/**
 * Click-to-edit "Added" cell with a popover for entering actual amounts.
 *
 * Three display states:
 * - Empty: not yet marked as added.
 * - Check glyph: added with the planned amount (no actual amount recorded).
 * - Script-font number: added with a recorded actual amount that differs from plan.
 *
 * Clicking the cell opens a popover with two affordances:
 *   1. "Use planned" button — fast path; sets added=true, clears actualAmount.
 *   2. Number input — saves added=true with the entered actualAmount.
 *
 * `actualAmount` lets downstream calculations (OG/IBU/water profile) use real
 * weights instead of planned ones when the brewer measured something different.
 */
function AddedCell({
  id,
  plannedAmount,
  unit,
  brewMode,
  display = "td",
  precision = 2,
}: {
  id: string;
  plannedAmount: number;
  unit: string;
  brewMode: BrewMode | null;
  /** Render as a <td> (default) or <div> for grid-cell consumers. */
  display?: "td" | "div";
  /** Decimal precision for the displayed actual amount. Default 2. */
  precision?: number;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const added = brewMode ? Boolean(brewMode.addedFlags[id]) : false;
  const actualAmount = brewMode?.actuals.ingredientActualAmounts?.[id];
  const hasActual =
    actualAmount !== undefined &&
    Math.abs(actualAmount - plannedAmount) > 0.0001;

  const handleOpen = () => {
    if (!brewMode) return;
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  };

  const handleSavePlanned = () => {
    if (!brewMode) return;
    brewMode.onAddedChange(id, true);
    brewMode.onIngredientActualChange(id, undefined);
    setOpen(false);
  };

  const handleSaveActual = (amount: number) => {
    if (!brewMode) return;
    brewMode.onAddedChange(id, true);
    brewMode.onIngredientActualChange(id, amount);
    setOpen(false);
  };

  const handleClear = () => {
    if (!brewMode) return;
    brewMode.onAddedChange(id, false);
    brewMode.onIngredientActualChange(id, undefined);
    setOpen(false);
  };

  // Button content: empty / check glyph / actual amount in script font.
  let content: ReactNode = null;
  if (added) {
    if (hasActual) {
      content = (
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 17,
            color: hsTokens.ink,
            lineHeight: 1,
          }}
        >
          {actualAmount!.toFixed(precision)} {unit}
        </span>
      );
    } else {
      content = <CheckGlyph />;
    }
  }

  // When not in Brew Mode, render a plain inert cell (paper-ready blank).
  const inertCellContent = " ";
  const interactiveCellContent = (
    <button
      ref={triggerRef}
      type="button"
      onClick={handleOpen}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label={
        added
          ? hasActual
            ? `Edit added amount (currently ${actualAmount!.toFixed(precision)} ${unit})`
            : `Added — click to edit`
          : `Mark as added`
      }
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: "transparent",
        border: "none",
        outline: "none",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {content}
    </button>
  );

  const cell =
    display === "td" ? (
      <td
        style={{
          position: "relative",
          padding: "8px 10px",
          borderBottom: `1px solid ${hsTokens.ink}`,
          borderLeft: `1px solid ${hsTokens.ink}`,
          background: hsTokens.cream,
          textAlign: "center",
          verticalAlign: "middle",
          minHeight: 28,
        }}
      >
        {brewMode ? interactiveCellContent : inertCellContent}
      </td>
    ) : (
      <div
        style={{
          position: "relative",
          padding: "8px 6px",
          borderLeft: `1px solid ${hsTokens.ink}`,
          background: hsTokens.cream,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 28,
        }}
      >
        {brewMode ? interactiveCellContent : inertCellContent}
      </div>
    );

  return (
    <>
      {cell}
      {open && rect && brewMode ? (
        <AddedActualPopover
          anchorRect={rect}
          plannedAmount={plannedAmount}
          unit={unit}
          currentActual={actualAmount}
          currentAdded={added}
          precision={precision}
          onSavePlanned={handleSavePlanned}
          onSaveActual={handleSaveActual}
          onClear={handleClear}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Small popover for committing an "Added" cell value.
 * Positioned via fixed coords from the trigger element's bounding rect so it
 * escapes any parent `overflow: hidden` (matches the cursor-follow tooltip pattern
 * from HSCompareRecipesPage).
 */
function AddedActualPopover({
  anchorRect,
  plannedAmount,
  unit,
  currentActual,
  currentAdded,
  precision,
  onSavePlanned,
  onSaveActual,
  onClear,
  onClose,
}: {
  anchorRect: DOMRect;
  plannedAmount: number;
  unit: string;
  currentActual: number | undefined;
  currentAdded: boolean;
  precision: number;
  onSavePlanned: () => void;
  onSaveActual: (amount: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(
    currentActual !== undefined ? String(currentActual) : ""
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    // Focus the input on open (small delay lets the popover finish mounting)
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 10);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [onClose]);

  const commitActual = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return;
    onSaveActual(parsed);
  };

  // Position: prefer below the anchor; flip up if it would go off-screen.
  // Width is fixed; centered horizontally on the anchor's mid-point, clamped to viewport.
  const POPOVER_WIDTH = 240;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const anchorMidX = anchorRect.left + anchorRect.width / 2;
  let left = Math.round(anchorMidX - POPOVER_WIDTH / 2);
  left = Math.max(8, Math.min(left, viewportW - POPOVER_WIDTH - 8));
  const flipUp = anchorRect.bottom + 180 > viewportH;
  const top = flipUp
    ? Math.round(anchorRect.top - 8)
    : Math.round(anchorRect.bottom + 6);
  const transform = flipUp ? "translateY(-100%)" : undefined;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Mark ingredient as added"
      style={{
        position: "fixed",
        top,
        left,
        transform,
        zIndex: 100,
        width: POPOVER_WIDTH,
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh3,
        overflow: "hidden",
        fontFamily: hsTokens.body,
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          background: hsTokens.cream2,
          borderBottom: `1px solid ${hsTokens.ink}`,
        }}
      >
        Mark as added
      </div>

      <button
        type="button"
        onClick={onSavePlanned}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          borderBottom: `1px solid color-mix(in oklch, ${hsTokens.ink} 15%, transparent)`,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: hsTokens.body,
          fontSize: 12,
          color: hsTokens.ink,
        }}
      >
        <CheckGlyph />
        <span>
          <span style={{ fontWeight: 600 }}>Use planned amount</span>{" "}
          <span style={{ color: hsTokens.muted, fontSize: 11 }}>
            ({plannedAmount.toFixed(precision)} {unit})
          </span>
        </span>
      </button>

      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        <label
          htmlFor="hs-added-actual-input"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          Different amount
        </label>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            ref={inputRef}
            id="hs-added-actual-input"
            type="number"
            step={0.01}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitActual();
              }
            }}
            placeholder={plannedAmount.toFixed(precision)}
            style={{
              flex: 1,
              padding: "6px 8px",
              background: hsTokens.cream,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 6,
              fontFamily: hsTokens.mono,
              fontSize: 13,
              color: hsTokens.ink,
              fontVariantNumeric: "tabular-nums",
              outline: "none",
              minWidth: 0,
            }}
          />
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: 700,
              color: hsTokens.muted,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {unit}
          </span>
          <button
            type="button"
            onClick={commitActual}
            style={{
              padding: "6px 10px",
              background: hsTokens.hops,
              color: hsTokens.cream,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 6,
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              lineHeight: 1,
            }}
          >
            Save
          </button>
        </div>
      </div>

      {currentAdded ? (
        <button
          type="button"
          onClick={onClear}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 12px",
            background: hsTokens.cream2,
            border: "none",
            borderTop: `1px solid color-mix(in oklch, ${hsTokens.ink} 15%, transparent)`,
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          ✕ Clear (mark as not added)
        </button>
      ) : null}
    </div>
  );
}

/**
 * OG predictor tip (Brew Mode only). Appears beneath the boil numbers matrix once
 * both pre-boil gravity and pre-boil volume actuals are present. Compares the
 * predicted post-boil OG to the target and surfaces a fix:
 *   - too high → dilution water suggestion
 *   - too low  → extra boil time suggestion
 */
/**
 * Post-boil OG tip — surfaces once `postBoilVolumeHotL` + `originalGravity`
 * have been measured. Replaces the pre-boil predictor at that point: the
 * predicted-vs-target framing becomes measured-vs-target.
 *
 * Corrective options at post-boil time:
 *  - **Dilute** (OG high): add water in the kettle / chiller / fermenter to
 *    hit target. Less risky than during boil because boil hops are already
 *    utilized — dilution affects color and concentration but not bitterness.
 *  - **DME** (OG low): add dry malt extract before flameout / during whirlpool.
 *  - **Accept**: do nothing, beer will still drink; surface the predicted ABV.
 *  - **Boil longer** mentioned as a caveat — usually undesirable post-hops since
 *    additional time changes hop character (more iso for boil hops, less aroma
 *    retention from whirlpool/late additions). Surfaced only when off-target and
 *    extension is reasonable (<= 15 min), with a warning note.
 */
function PostBoilOgTip({
  actuals,
  targetOG,
  boilOffRateLPerHour,
  hops,
  onClick,
  pulse,
  morphId,
  minimized,
}: {
  actuals: SessionActuals;
  /** Realistic OG ceiling — follows grain actuals when present. */
  targetOG: number;
  /** Recipe's original OG (before grain actuals shifted it). */
  originalTargetOG?: number;
  /** Recipe's planned boil-off rate (L/hr) — used to estimate "boil longer" time. */
  boilOffRateLPerHour: number;
  /** Recipe's hop additions — used to detect late additions that would suffer
   *  from extra boil time. */
  hops: Recipe["hops"];
  /** Optional click handler — fires when the brewer clicks the flag (used
   *  to un-minimize the predictor card from the phase-box header). */
  onClick?: () => void;
  /** Brief attention-grab pulse animation. */
  pulse?: boolean;
  /** Framer-motion `layoutId` for the card-to-flag morph. */
  morphId?: string;
  /** Whether the predictor card is currently minimized. */
  minimized?: boolean;
}) {
  const measuredOG = actuals.originalGravity;
  const measuredVol = actuals.postBoilVolumeHotL;
  if (measuredOG == null || measuredVol == null || measuredOG <= 1 || measuredVol <= 0) {
    return null;
  }

  const delta = measuredOG - targetOG;
  const onTarget = Math.abs(delta) < 0.002;

  // Estimated ABV assuming typical 72% apparent attenuation.
  const estimatedFG = (og: number) => 1 + (og - 1) * (1 - 0.72);
  const estABV = (og: number) => abvFromOGFG(og, estimatedFG(og));

  // DME conversion: PPG≈45 for English DME → 375.5 ppl/kg/L.
  const DME_PPL_PER_KG_PER_L = 375.5;

  // Hop-awareness: by 30 min of boil time, alpha-acid isomerization is largely
  // plateaued, so additional boil doesn't meaningfully change those hops. But
  // anything boiling <30 min, or whirlpool hops sitting in hot wort, would
  // over-extract (more bitterness, less aroma) with extra boil time.
  const lateAdditions = hops.filter((h) => {
    if (h.type === "whirlpool") return true;
    if (h.type === "boil" && (h.timeMinutes ?? 60) < 30) return true;
    return false;
  });
  const hasLateAdditions = lateAdditions.length > 0;

  type FixOption = { kind: "water" | "dme" | "boil" | "accept"; node: ReactNode };
  const options: FixOption[] = [];

  if (!onTarget) {
    if (delta > 0) {
      // Measured OG too high → dilute. Less risky now: boil hops already used,
      // so dilution only affects color + alcohol — not bitterness.
      const addWaterL = dilutionWater(measuredVol, measuredOG, targetOG);
      if (addWaterL > 0.05) {
        options.push({
          kind: "water",
          node: (
            <>
              <strong>Add ~{addWaterL.toFixed(1)} L water</strong> to bring it
              down. Boil hops are already utilized, so dilution is safe — it
              just lowers OG and slightly lightens color.
            </>
          ),
        });
      }
      options.push({
        kind: "accept",
        node: (
          <>
            <strong>Or accept it</strong> — beer lands at ~
            {estABV(measuredOG).toFixed(1)}% ABV instead of ~
            {estABV(targetOG).toFixed(1)}%.
          </>
        ),
      });
    } else {
      // Measured OG too low → DME at flameout is the cleanest fix. Boil-longer
      // mentioned with hop-specific caveat.
      const missingPoints = (targetOG - measuredOG) * 1000;
      const dmeG = Math.max(
        0,
        Math.round((missingPoints * measuredVol) / DME_PPL_PER_KG_PER_L * 1000)
      );
      if (dmeG > 0) {
        options.push({
          kind: "dme",
          node: (
            <>
              <strong>Add ~{dmeG} g DME</strong> at flameout — cleanest fix.
              Stir in dry malt extract to bring the gravity up.
            </>
          ),
        });
      }
      // Boil-longer option, with hop-awareness:
      // - Bittering-only (no late additions) → fine, no caveat
      // - Late additions present → caveat about character; mention hop filter
      const targetVol = postBoilVolume(measuredVol, measuredOG, targetOG);
      const extraMin = Math.max(
        0,
        ((measuredVol - targetVol) / boilOffRateLPerHour) * 60
      );
      if (extraMin > 1 && extraMin <= 30) {
        if (hasLateAdditions) {
          options.push({
            kind: "boil",
            node: (
              <>
                <strong>Boil ~{Math.round(extraMin)} min longer</strong> — but
                your late hops ({lateAdditions.length}{" "}
                {lateAdditions.length === 1 ? "addition" : "additions"} in the
                kettle) will over-extract. If you have a hop filter or bag,
                remove them first, then boil.
              </>
            ),
          });
        } else {
          options.push({
            kind: "boil",
            node: (
              <>
                <strong>Boil ~{Math.round(extraMin)} min longer</strong> — your
                bittering hops are already fully utilized, so extra boil just
                concentrates the wort.
              </>
            ),
          });
        }
      }
      options.push({
        kind: "accept",
        node: (
          <>
            <strong>Or accept it</strong> — beer lands at ~
            {estABV(measuredOG).toFixed(1)}% ABV instead of ~
            {estABV(targetOG).toFixed(1)}%.{" "}
            {Math.abs(missingPoints) < 5
              ? "Within normal brew-day variance."
              : null}
          </>
        ),
      });
    }
  }

  const measuredPoints = Math.abs((measuredOG - targetOG) * 1000);
  const directionWord = delta > 0 ? "high" : "low";
  const chosen = actuals.ogFixChoices?.postBoil;
  // When a fix is chosen, the flag reads as a journal entry: what happened,
  // then the action we took. Past tense on both sides ("was … — Added …").
  const shortLabel = onTarget
    ? "on target"
    : chosen
    ? `Gravity was ${measuredPoints.toFixed(
        0
      )} pts ${directionWord} — ${toPastTense(chosen.action)}`
    : `~${measuredPoints.toFixed(0)} pts ${directionWord}`;

  return (
    <BrewTipFlag
      severity={onTarget ? "success" : "caution"}
      shortLabel={shortLabel}
      onClick={onClick}
      pulse={pulse}
      morphId={morphId}
      minimized={minimized}
    />
  );
}

function OgPredictorTip({
  actuals,
  targetOG,
  boilOffRateLPerHour,
  recipeBoilMin,
  onClick,
  pulse,
  morphId,
  minimized,
}: {
  actuals: SessionActuals;
  /** The realistic OG ceiling — follows grain actuals when present. */
  targetOG: number;
  /** Recipe's original OG (before grain actuals shifted it). Used to surface a
   *  "revised from X" note when the target has been adjusted by ingredient actuals. */
  originalTargetOG?: number;
  boilOffRateLPerHour: number;
  /** Recipe's planned boil duration (minutes). Used as the baseline when computing
   *  "total boil" suggestions — falls back to actuals.boilTimeMin if user has
   *  overridden it. */
  recipeBoilMin: number;
  /** Optional click handler — fires when the brewer clicks the flag (used
   *  to un-minimize the predictor card from the phase-box header). */
  onClick?: () => void;
  /** Brief attention-grab pulse animation. */
  pulse?: boolean;
  /** Framer-motion `layoutId` for the card-to-flag morph. */
  morphId?: string;
  /** Whether the predictor card is currently minimized. */
  minimized?: boolean;
}) {
  if (
    actuals.preBoilGravity == null ||
    actuals.preBoilVolumeL == null ||
    actuals.preBoilGravity <= 1 ||
    actuals.preBoilVolumeL <= 0
  ) {
    return null;
  }

  // Planned boil = recipe boil time, unless the brewer has explicitly set an actual.
  const plannedBoilMin = actuals.boilTimeMin ?? recipeBoilMin;
  const plannedBoilOffL = boilOffRateLPerHour * (plannedBoilMin / 60);
  const predictedPostBoilVol = Math.max(
    0.1,
    actuals.preBoilVolumeL - plannedBoilOffL
  );
  // Sugar is conserved during boil: preBoilVol × prePoints = postBoilVol × postPoints
  const predictedOG =
    1 +
    (actuals.preBoilVolumeL * (actuals.preBoilGravity - 1)) /
      predictedPostBoilVol;
  const delta = predictedOG - targetOG;
  const onTarget = Math.abs(delta) < 0.002;

  // DME conversion: PPG≈45 for English DME → 375.5 ppl/kg/L
  // (45 points × 8.345 kg/lb-per-L-per-gal).
  const DME_PPL_PER_KG_PER_L = 375.5;

  // Build the fix options — multiple paths to hit target.
  type FixOption = { kind: "boil" | "dme" | "water"; node: ReactNode };
  const options: FixOption[] = [];

  if (!onTarget) {
    if (delta > 0) {
      // Predicted OG too high → suggest dilution at flameout.
      const addWaterL = dilutionWater(predictedPostBoilVol, predictedOG, targetOG);
      const dilutionFraction = addWaterL / predictedPostBoilVol;
      if (addWaterL > 0.1 && dilutionFraction < 0.25) {
        options.push({
          kind: "water",
          node: (
            <>
              <strong>Dilute:</strong> add {addWaterL.toFixed(1)} L water at
              flameout.
            </>
          ),
        });
      } else if (addWaterL >= 0.1) {
        options.push({
          kind: "water",
          node: (
            <>
              <strong>Accept:</strong> dilution to hit target would overfill the
              kettle.
            </>
          ),
        });
      }
    } else {
      // Predicted OG too low → DME + extra-boil side-by-side, with the math shown.
      const targetVol = postBoilVolume(
        actuals.preBoilVolumeL,
        actuals.preBoilGravity,
        targetOG
      );
      const extraMin = Math.max(
        0,
        ((predictedPostBoilVol - targetVol) / boilOffRateLPerHour) * 60
      );
      const totalBoilMin = plannedBoilMin + extraMin;
      const missingPoints = (targetOG - predictedOG) * 1000;
      const dmeG = Math.max(
        0,
        Math.round(
          (missingPoints * predictedPostBoilVol) / DME_PPL_PER_KG_PER_L * 1000
        )
      );

      // DME first — usually the practical choice for missed gravity points.
      if (dmeG > 0) {
        options.push({
          kind: "dme",
          node: (
            <>
              <strong>Add DME:</strong> ~{dmeG} g dry malt extract at flameout
              (yields ~{missingPoints.toFixed(0)} extra gravity points).
            </>
          ),
        });
      }

      // Boil-longer option — labeled "impractical" when extra is more than ~25%
      // of planned boil. Small misses (≤20 min extra) are practical fixes.
      if (extraMin > 1) {
        const isImpractical = extraMin > plannedBoilMin * 0.25 || extraMin > 30;
        options.push({
          kind: "boil",
          node: (
            <>
              <strong>Boil longer:</strong> ~{Math.round(extraMin)} min extra (
              {Math.round(totalBoilMin)} min total
              {isImpractical ? " — long" : ""}). Evaporates {(predictedPostBoilVol - targetVol).toFixed(1)} L more to reach{" "}
              {targetVol.toFixed(1)} L post-boil.
            </>
          ),
        });
      }

      // Always offer the "accept it" path for misses below 6 points.
      if (Math.abs(missingPoints) > 0 && Math.abs(missingPoints) < 6) {
        options.push({
          kind: "water",
          node: (
            <>
              <strong>Accept:</strong> {Math.abs(missingPoints).toFixed(0)} points below target — the
              recipe will still hit ~{(predictedOG > 1 ? abvFromOGFG(predictedOG, 1 + (1 - 0.72) * (predictedOG - 1)) : 0).toFixed(1)}% ABV (at 72% attenuation).
            </>
          ),
        });
      }
    }
  }

  // Flag short-label — kept brief; section header already says "Pre-boil".
  // When a fix is chosen, the flag reads as a journal entry: what happened,
  // then what we did about it ("was … — Added …").
  const points = Math.abs((predictedOG - targetOG) * 1000);
  const directionWord = delta > 0 ? "high" : "low";
  const chosen = actuals.ogFixChoices?.preBoil;
  const shortLabel = onTarget
    ? "on track"
    : chosen
    ? `Gravity was ${points.toFixed(
        0
      )} pts ${directionWord} — ${toPastTense(chosen.action)}`
    : `~${points.toFixed(0)} pts ${directionWord}`;

  return (
    <BrewTipFlag
      severity={onTarget ? "success" : "caution"}
      shortLabel={shortLabel}
      onClick={onClick}
      pulse={pulse}
      morphId={morphId}
      minimized={minimized}
    />
  );
}

/**
 * Selectable fix option for an OG miss. Each fix has a stable `kind` so the
 * brewer's selection persists into the session (see `OgFixChoice` in the
 * BrewSession model). The body explains the trade-off; an optional warning
 * surfaces a caveat (e.g. whirlpool hops over-extracting on extended boil).
 */
type BrewTipFix = {
  /** Stable identifier — used to persist the user's choice. */
  kind: OgFixChoice["kind"];
  /** Small uppercase label (e.g. "CLEANEST", "OR"). */
  eyebrow: string;
  /** Optional accent color for the eyebrow (defaults to muted). */
  eyebrowColor?: string;
  /** Bold action heading — the title also becomes the persisted `action`
   *  string when this fix is selected. Pass a plain string when possible. */
  title: ReactNode;
  /** Plain-text version of the title used for persistence (falls back to
   *  String(title) if omitted). */
  titlePlain?: string;
  /** Prose explanation beneath the title. */
  body: ReactNode;
  /** Optional caveat surfaced as a small inline note beneath the body. */
  warning?: ReactNode;
};

/**
 * OG predictor card. Lives in a row of the boil matrix, paired with its
 * phase box. Two visual states:
 *  - Unresolved: roast accent strip + warning glyph — a notebook alert
 *  - Resolved (a fix is chosen): hops accent strip + check glyph
 *
 * Hover behavior: when nothing is selected, hover surfaces a subtle bg
 * highlight (no width change). Once a fix is chosen, hovering the other
 * option grows it so the brewer can peek the alternative before switching.
 *
 * Mirrors `ScheduleSection`'s accent-strip pattern so the card feels
 * native to the brew sheet's vocabulary.
 */
function BrewTipCard({
  problemLabel,
  reasoning,
  fixes,
  morphId,
  selectedKind,
  onSelect,
  onClear,
  onMinimize,
}: {
  /** Eyebrow describing the problem (e.g. "POST-BOIL OG PREDICTED TO MISS"). */
  problemLabel: string;
  /** Optional one-line reason the prediction is off (e.g. "pre-boil volume
   *  came in low"). Surfaced beneath the problem statement as a script aside. */
  reasoning?: string;
  /** Available corrective actions. */
  fixes: BrewTipFix[];
  /** Framer-motion `layoutId` — shared with the resolved note and the matrix
   *  flag glyph so transitions between those states visibly morph. */
  morphId?: string;
  /** Currently-selected fix kind, if the brewer has chosen one. */
  selectedKind?: OgFixChoice["kind"];
  /** Fires when the brewer picks a fix. */
  onSelect?: (fix: BrewTipFix) => void;
  /** Fires when the brewer toggles off the currently-selected fix. */
  onClear?: () => void;
  /** Fires when the brewer minimizes the card — parent should persist this
   *  and stop rendering the card. The matrix falls back to side-by-side. */
  onMinimize?: () => void;
}) {
  if (fixes.length === 0) return null;

  const resolved = selectedKind != null;
  const selectedFix = resolved
    ? fixes.find((f) => f.kind === selectedKind)
    : undefined;

  // Resolved state collapses to a compact "brewer's note" — no need for
  // a min-height the size of the warning card. Clicking the note reverts
  // to the option grid so the brewer can pick a different fix.
  if (resolved && selectedFix) {
    return (
      <BrewTipResolvedNote
        fix={selectedFix}
        reasoning={reasoning}
        morphId={morphId}
        onClear={onClear}
        onMinimize={onMinimize}
      />
    );
  }

  return (
    <motion.div
      layoutId={morphId}
      className="hs-print-hide"
      // Shared layout animation morphs this card → matrix flag (and back) via
      // the `layoutId`. AnimatePresence in the parent keeps this component
      // mounted during the morph; `exit` fades it out so the layoutId target
      // (the flag) has a moment to register as the new layout anchor.
      initial={false}
      exit={{ opacity: 0 }}
      transition={{
        layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.22, ease: "easeOut" },
      }}
      style={{
        position: "relative",
        // Sized to its own content range — fits inside an auto-width grid
        // column rather than forcing the column to expand. Phase boxes
        // around it claim the remaining width naturally.
        width: "fit-content",
        minWidth: 380,
        maxWidth: 520,
        minHeight: 200,
        background: hsTokens.cream,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        padding: "12px 12px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
      }}
    >
      {/* Accent strip — roast for the warning state, mirrors
          ScheduleSection's top edge. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: hsTokens.roast,
          pointerEvents: "none",
        }}
      />

      {/* Header — single row: glyph + uppercase problem label + script
          reasoning aside + minimize button. `nowrap` + `minWidth: 0` on the
          reasoning keeps everything on one line; the reasoning truncates
          with an ellipsis if the slot is narrower than its prose. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "nowrap",
          minWidth: 0,
        }}
      >
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          <WarningTriangleGlyph color={hsTokens.roast} />
        </span>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: hsTokens.roast,
            textTransform: "uppercase",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {problemLabel}
        </span>
        {reasoning ? (
          <>
            <span
              aria-hidden
              style={{
                color: hsTokens.muted,
                fontSize: 13,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ·
            </span>
            <span
              style={{
                fontFamily: hsTokens.script,
                fontSize: 14,
                color: hsTokens.muted,
                lineHeight: 1.2,
                flex: "1 1 auto",
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {reasoning}
            </span>
          </>
        ) : null}
        {onMinimize ? (
          <span style={{ marginLeft: reasoning ? 0 : "auto", flexShrink: 0 }}>
            <BrewTipMinimizeButton onClick={onMinimize} />
          </span>
        ) : null}
      </div>

      <BrewTipFixGrid
        fixes={fixes}
        selectedKind={selectedKind}
        onSelect={onSelect}
        onClear={onClear}
      />
    </motion.div>
  );
}

/**
 * Compact "brewer's note" surfaced once a fix is chosen. Strips away the
 * options grid and reads as a Problem / Solution pair — like a jotted note
 * in the margin of the brew sheet. Capped at a narrow max-width so the
 * resting state takes far less horizontal space than the warning card.
 *
 * Clicking the note re-opens the full options card so the brewer can switch
 * their pick.
 */
function BrewTipResolvedNote({
  fix,
  reasoning,
  morphId,
  onClear,
  onMinimize,
}: {
  fix: BrewTipFix;
  reasoning?: string;
  morphId?: string;
  onClear?: () => void;
  onMinimize?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const action =
    fix.titlePlain ?? (typeof fix.title === "string" ? fix.title : "your fix");
  return (
    <motion.div
      layoutId={morphId}
      className="hs-print-hide"
      initial={false}
      exit={{ opacity: 0 }}
      transition={{
        layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
        opacity: { duration: 0.22, ease: "easeOut" },
      }}
      style={{
        position: "relative",
        // Resolved state collapses horizontally — the brewer's note doesn't
        // need a full half of the matrix row. Max-width keeps it tight.
        width: "fit-content",
        maxWidth: 360,
        minWidth: 240,
        background: hsTokens.cream,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        padding: "10px 12px 10px 14px",
        overflow: "hidden",
      }}
    >
      {/* Hops accent strip — signals "warning has been resolved". */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: hsTokens.hops,
          pointerEvents: "none",
        }}
      />

      {/* Minimize button anchored top-right, floats above the note. */}
      {onMinimize ? (
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
          <BrewTipMinimizeButton onClick={onMinimize} />
        </div>
      ) : null}

      {/* The note itself — clickable to re-open the option grid. Hover
          surfaces a faint honey tint so the affordance is discoverable. */}
      <button
        type="button"
        onClick={onClear}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Change selection"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          rowGap: 6,
          columnGap: 12,
          width: "100%",
          padding: "4px 30px 4px 0",
          background: hovered
            ? `color-mix(in oklch, ${hsTokens.honey} 14%, transparent)`
            : "transparent",
          border: "none",
          borderRadius: 6,
          textAlign: "left",
          color: hsTokens.ink,
          fontFamily: hsTokens.body,
          cursor: "pointer",
          transition: "background 140ms ease",
          outline: "none",
        }}
      >
        {/* PROBLEM row: muted eyebrow + reasoning */}
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: hsTokens.muted,
            textTransform: "uppercase",
            alignSelf: "start",
            paddingTop: 3,
          }}
        >
          Problem
        </span>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            color: hsTokens.ink,
            lineHeight: 1.4,
          }}
        >
          {reasoning ?? "off-target reading"}
        </span>
        {/* SOLUTION row: hops-tinted eyebrow + script action */}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: hsTokens.display,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: hsTokens.hops,
            textTransform: "uppercase",
            alignSelf: "start",
            paddingTop: 4,
          }}
        >
          <CheckGlyph />
          <span>Solution</span>
        </span>
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 18,
            color: hsTokens.ink,
            lineHeight: 1.2,
          }}
        >
          {action}
        </span>
      </button>
    </motion.div>
  );
}

/**
 * Tiny "—" minimize affordance — top-right of the predictor card header.
 * Darkens on hover to match the brew sheet's other icon buttons (e.g.
 * print, status pill).
 */
function BrewTipMinimizeButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Hide warning"
      title="Hide warning"
      style={{
        marginLeft: "auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        padding: 0,
        background: hovered
          ? `color-mix(in oklch, ${hsTokens.ink} 14%, transparent)`
          : "transparent",
        border: "none",
        borderRadius: 4,
        color: hovered ? hsTokens.ink : hsTokens.muted,
        cursor: "pointer",
        transition: "background 140ms ease, color 140ms ease",
        lineHeight: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path
          d="M2 6 L10 6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/**
 * Renders the side-by-side fix cards with hover-driven flex growth. Pulled
 * into its own component so the hover state can live in a hook without
 * leaking into the parent `BrewTipCard`.
 */
function BrewTipFixGrid({
  fixes,
  selectedKind,
  onSelect,
  onClear,
}: {
  fixes: BrewTipFix[];
  selectedKind?: OgFixChoice["kind"];
  onSelect?: (fix: BrewTipFix) => void;
  onClear?: () => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const selectedIdx = selectedKind
    ? fixes.findIndex((f) => f.kind === selectedKind)
    : -1;
  const hasSelection = selectedIdx >= 0;

  // Flex-grow only kicks in once a fix is chosen — hover-peek the
  // alternative without overwriting the brewer's choice. Before any
  // selection, hover is a subtle bg shift inside the fix card, no width
  // changes. (User feedback: idle hover-grow felt overeager.)
  const focusedIdx = hasSelection
    ? hoveredIdx !== null
      ? hoveredIdx
      : selectedIdx
    : -1;
  const hasFocus = focusedIdx >= 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 6,
        flexWrap: "nowrap",
      }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {fixes.map((fix, i) => {
        const isSelected = selectedIdx === i;
        const isFocused = focusedIdx === i;
        // Width split:
        //  - no selection → equal halves (1 / 1), hover does NOT grow
        //  - selection exists → focused grows (2.4), other shrinks (0.8)
        const flexWeight = !hasFocus ? 1 : isFocused ? 2.4 : 0.8;
        const isDimmed = hasFocus && !isFocused;
        const isHoveredIdle = !hasSelection && hoveredIdx === i;
        return (
          <Fragment key={`${fix.kind}-${i}`}>
            {i > 0 ? (
              <div
                aria-hidden
                style={{
                  display: "flex",
                  alignItems: "center",
                  fontFamily: hsTokens.display,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: hsTokens.muted,
                  padding: "0 2px",
                }}
              >
                OR
              </div>
            ) : null}
            <div
              style={{
                flexGrow: flexWeight,
                flexShrink: 1,
                flexBasis: 0,
                minWidth: 0,
                display: "flex",
                transition: "flex-grow 240ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              onMouseEnter={() => setHoveredIdx(i)}
            >
              <BrewFixCard
                fix={fix}
                selected={isSelected}
                dimmed={isDimmed}
                idleHovered={isHoveredIdle}
                onClick={() =>
                  isSelected ? onClear?.() : onSelect?.(fix)
                }
              />
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * A single fix option rendered as a clickable card. Visual states:
 *  - Idle: paper bg, ink border
 *  - Idle + hovered: paper bg tinted toward honey (subtle, no width change)
 *  - Selected: honey background + check glyph, full opacity, expanded width
 *  - Dimmed (another card is selected): low opacity, narrow width, body
 *    text collapses to keep the eyebrow + title legible at a glance
 */
function BrewFixCard({
  fix,
  selected,
  dimmed,
  idleHovered,
  onClick,
}: {
  fix: BrewTipFix;
  selected?: boolean;
  dimmed?: boolean;
  idleHovered?: boolean;
  onClick?: () => void;
}) {
  const background = selected
    ? `color-mix(in oklch, ${hsTokens.honey} 55%, ${hsTokens.paper})`
    : idleHovered
    ? `color-mix(in oklch, ${hsTokens.honey} 18%, ${hsTokens.paper})`
    : hsTokens.paper;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
        background,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 8,
        textAlign: "left",
        color: hsTokens.ink,
        fontFamily: hsTokens.body,
        cursor: "pointer",
        opacity: dimmed ? 0.45 : 1,
        transition: "background 140ms ease, opacity 240ms ease",
        outline: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {selected ? <CheckGlyph /> : null}
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: selected ? hsTokens.ink : fix.eyebrowColor ?? hsTokens.muted,
            whiteSpace: "nowrap",
          }}
        >
          {fix.eyebrow}
        </span>
      </div>
      <div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 15,
          letterSpacing: "-0.005em",
          lineHeight: 1.2,
          // Title clamps to 2 lines so a narrow (dimmed) card can't grow
          // taller than its focused sibling — keeps the predictor's overall
          // height stable across hover/select states.
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {fix.title}
      </div>
      {/* Body always renders — we just dim its opacity when another card
          is focused. Line-clamp keeps wrapping from triggering height
          changes when the card narrows. (The previous max-height collapse
          caused matrix-row reflow flicker during hover animations.) */}
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 12,
          color: hsTokens.muted,
          lineHeight: 1.45,
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 3,
          overflow: "hidden",
          opacity: dimmed ? 0.45 : 1,
          transition: "opacity 180ms ease",
        }}
      >
        {fix.body}
      </div>
      {fix.warning ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "flex-start",
            gap: 5,
            marginTop: 2,
            fontFamily: hsTokens.script,
            fontSize: 13,
            color: hsTokens.roast,
            lineHeight: 1.25,
            opacity: dimmed ? 0.45 : 1,
            transition: "opacity 180ms ease",
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 2 }}>
            <WarningTriangleGlyph color={hsTokens.roast} />
          </span>
          <span>{fix.warning}</span>
        </div>
      ) : null}
    </button>
  );
}

/**
 * Predicate matching the early-return checks inside `OgPredictorCard`. The
 * parent layout calls this to decide whether to render the card at all — if
 * it would produce null, we skip the slot so the matrix falls back to the
 * side-by-side phase-box layout instead of leaving an empty column.
 */
function shouldShowPreBoilPredictor(
  actuals: SessionActuals,
  targetOG: number,
  boilOffRateLPerHour: number,
  plannedBoilMin: number
): boolean {
  if (
    actuals.preBoilGravity == null ||
    actuals.preBoilVolumeL == null ||
    actuals.preBoilGravity <= 1 ||
    actuals.preBoilVolumeL <= 0
  ) {
    return false;
  }
  const plannedBoilOffL = boilOffRateLPerHour * (plannedBoilMin / 60);
  const predictedPostBoilVol = Math.max(
    0.1,
    actuals.preBoilVolumeL - plannedBoilOffL
  );
  const predictedOG =
    1 +
    (actuals.preBoilVolumeL * (actuals.preBoilGravity - 1)) /
      predictedPostBoilVol;
  return Math.abs(predictedOG - targetOG) >= 0.002;
}

/** Mirror predicate for `PostBoilOgCard` — measured OG must be present and
 *  meaningfully off the target. */
function shouldShowPostBoilPredictor(
  actuals: SessionActuals,
  targetOG: number
): boolean {
  if (
    actuals.originalGravity == null ||
    actuals.postBoilVolumeHotL == null ||
    actuals.originalGravity <= 1 ||
    actuals.postBoilVolumeHotL <= 0
  ) {
    return false;
  }
  return Math.abs(actuals.originalGravity - targetOG) >= 0.002;
}

/**
 * Pre-boil OG predictor card — always-visible variant of `OgPredictorTip`.
 * Renders below the boil numbers matrix once pre-boil gravity + volume actuals
 * are entered. Hidden on-target (nothing to recommend) and once post-boil data
 * supersedes the prediction.
 */
function OgPredictorCard({
  actuals,
  targetOG,
  targetPreBoilVolumeL,
  targetPreBoilGravity,
  boilOffRateLPerHour,
  recipeBoilMin,
  hops,
  morphId,
  selectedKind,
  onSelectFix,
  onClearFix,
  onMinimize,
}: {
  actuals: SessionActuals;
  targetOG: number;
  /** Recipe's pre-boil volume target (for reasoning copy). */
  targetPreBoilVolumeL: number;
  /** Recipe's pre-boil gravity target (for reasoning copy). */
  targetPreBoilGravity: number;
  boilOffRateLPerHour: number;
  recipeBoilMin: number;
  hops: Recipe["hops"];
  /** Framer-motion `layoutId` used to morph between the card and the matrix
   *  flag glyph on minimize / restore. */
  morphId?: string;
  selectedKind?: OgFixChoice["kind"];
  onSelectFix?: (fix: BrewTipFix) => void;
  onClearFix?: () => void;
  onMinimize?: () => void;
}) {
  if (
    actuals.preBoilGravity == null ||
    actuals.preBoilVolumeL == null ||
    actuals.preBoilGravity <= 1 ||
    actuals.preBoilVolumeL <= 0
  ) {
    return null;
  }

  const plannedBoilMin = actuals.boilTimeMin ?? recipeBoilMin;
  const plannedBoilOffL = boilOffRateLPerHour * (plannedBoilMin / 60);
  const predictedPostBoilVol = Math.max(
    0.1,
    actuals.preBoilVolumeL - plannedBoilOffL
  );
  const predictedOG =
    1 +
    (actuals.preBoilVolumeL * (actuals.preBoilGravity - 1)) /
      predictedPostBoilVol;
  const delta = predictedOG - targetOG;
  const onTarget = Math.abs(delta) < 0.002;
  if (onTarget) return null;

  const estimatedFG = (og: number) => 1 + (og - 1) * (1 - 0.72);
  const estABV = (og: number) => abvFromOGFG(og, estimatedFG(og));
  const DME_PPL_PER_KG_PER_L = 375.5;

  const lateAdditions = hops.filter((h) => {
    if (h.type === "whirlpool") return true;
    if (h.type === "boil" && (h.timeMinutes ?? 60) < 30) return true;
    return false;
  });
  const hasLateAdditions = lateAdditions.length > 0;

  const fixes: BrewTipFix[] = [];

  if (delta > 0) {
    // Predicted OG too high — dilute at flameout.
    const addWaterL = dilutionWater(
      predictedPostBoilVol,
      predictedOG,
      targetOG
    );
    const dilutionFraction = addWaterL / predictedPostBoilVol;
    if (addWaterL > 0.1 && dilutionFraction < 0.25) {
      const action = `Add ~${addWaterL.toFixed(1)} L water at flameout`;
      fixes.push({
        kind: "water",
        eyebrow: "CLEANEST",
        eyebrowColor: hsTokens.hops,
        title: action,
        titlePlain: action,
        body: "Boil hops are already utilized, so dilution just lowers OG and slightly lightens color.",
      });
    }
    const acceptAction = `Accept ~${estABV(predictedOG).toFixed(1)}% ABV`;
    fixes.push({
      kind: "accept",
      eyebrow: fixes.length === 0 ? "CLEANEST" : "EASIEST",
      eyebrowColor: fixes.length === 0 ? hsTokens.hops : hsTokens.muted,
      title: acceptAction,
      titlePlain: acceptAction,
      body: `Beer lands a touch stronger than target (~${estABV(
        targetOG
      ).toFixed(1)}%). Still drinks great.`,
    });
  } else {
    // Predicted OG too low — DME + boil-longer + maybe accept.
    const targetVol = postBoilVolume(
      actuals.preBoilVolumeL,
      actuals.preBoilGravity,
      targetOG
    );
    const extraMin = Math.max(
      0,
      ((predictedPostBoilVol - targetVol) / boilOffRateLPerHour) * 60
    );
    const missingPoints = (targetOG - predictedOG) * 1000;
    const dmeG = Math.max(
      0,
      Math.round(
        ((missingPoints * predictedPostBoilVol) / DME_PPL_PER_KG_PER_L) * 1000
      )
    );

    if (dmeG > 0) {
      const action = `Add ~${dmeG} g DME at flameout`;
      fixes.push({
        kind: "dme",
        eyebrow: "CLEANEST",
        eyebrowColor: hsTokens.hops,
        title: action,
        titlePlain: action,
        body: "Brings predicted OG up to target without changing volume or kettle time.",
      });
    }

    if (extraMin > 1 && extraMin <= 30) {
      const action = `Boil ~${Math.round(extraMin)} min longer`;
      fixes.push({
        kind: "boil",
        eyebrow:
          fixes.length === 0
            ? "CLEANEST"
            : hasLateAdditions
            ? "RISKIER"
            : "MORE WORK",
        eyebrowColor: fixes.length === 0 ? hsTokens.hops : hsTokens.muted,
        title: action,
        titlePlain: action,
        body: "Concentrates the wort the same amount. Affects hop timing and volume.",
        warning: hasLateAdditions
          ? "Your whirlpool hops will over-extract. Pull them with a filter first."
          : undefined,
      });
    }

    if (Math.abs(missingPoints) < 6) {
      const action = `Accept ~${estABV(predictedOG).toFixed(1)}% ABV`;
      fixes.push({
        kind: "accept",
        eyebrow: fixes.length === 0 ? "CLEANEST" : "EASIEST",
        eyebrowColor: fixes.length === 0 ? hsTokens.hops : hsTokens.muted,
        title: action,
        titlePlain: action,
        body: `Within normal brew-day variance — beer hits ~${estABV(
          predictedOG
        ).toFixed(1)}% instead of ~${estABV(targetOG).toFixed(1)}%.`,
      });
    }
  }

  // Reasoning: explain WHY the predicted OG is off by inspecting which
  // pre-boil reading(s) drifted from target. Volume + gravity each have a
  // direction; phrase it in plain words ("pre-boil volume came in low").
  const volDelta = actuals.preBoilVolumeL - targetPreBoilVolumeL;
  const gravDelta = actuals.preBoilGravity - targetPreBoilGravity;
  const volSignificant = Math.abs(volDelta) >= 0.3;
  const gravSignificant = Math.abs(gravDelta) >= 0.002;
  let reasoning: string | undefined;
  if (volSignificant && gravSignificant) {
    reasoning = `pre-boil volume came in ${
      volDelta > 0 ? "high" : "low"
    } and gravity ran ${gravDelta > 0 ? "high" : "low"}`;
  } else if (volSignificant) {
    reasoning = `pre-boil volume came in ${volDelta > 0 ? "high" : "low"}`;
  } else if (gravSignificant) {
    reasoning = `pre-boil gravity ran ${gravDelta > 0 ? "high" : "low"}`;
  } else {
    reasoning = "small drift in both pre-boil volume and gravity";
  }

  return (
    <BrewTipCard
      morphId={morphId}
      problemLabel="Post-boil OG predicted to miss"
      reasoning={reasoning}
      fixes={fixes}
      selectedKind={selectedKind}
      onSelect={onSelectFix}
      onClear={onClearFix}
      onMinimize={onMinimize}
    />
  );
}

/**
 * Post-boil OG card — always-visible variant of `PostBoilOgTip`. Appears once
 * `originalGravity` + `postBoilVolumeHotL` actuals are present, surfacing
 * measured-vs-target framing and corrective options.
 */
function PostBoilOgCard({
  actuals,
  targetOG,
  targetPostBoilVolumeHotL,
  boilOffRateLPerHour,
  hops,
  morphId,
  selectedKind,
  onSelectFix,
  onClearFix,
  onMinimize,
}: {
  actuals: SessionActuals;
  targetOG: number;
  /** Recipe's post-boil volume target (for reasoning copy). */
  targetPostBoilVolumeHotL: number;
  boilOffRateLPerHour: number;
  hops: Recipe["hops"];
  morphId?: string;
  selectedKind?: OgFixChoice["kind"];
  onSelectFix?: (fix: BrewTipFix) => void;
  onClearFix?: () => void;
  onMinimize?: () => void;
}) {
  const measuredOG = actuals.originalGravity;
  const measuredVol = actuals.postBoilVolumeHotL;
  if (
    measuredOG == null ||
    measuredVol == null ||
    measuredOG <= 1 ||
    measuredVol <= 0
  ) {
    return null;
  }

  const delta = measuredOG - targetOG;
  const onTarget = Math.abs(delta) < 0.002;
  if (onTarget) return null;

  const estimatedFG = (og: number) => 1 + (og - 1) * (1 - 0.72);
  const estABV = (og: number) => abvFromOGFG(og, estimatedFG(og));
  const DME_PPL_PER_KG_PER_L = 375.5;

  const lateAdditions = hops.filter((h) => {
    if (h.type === "whirlpool") return true;
    if (h.type === "boil" && (h.timeMinutes ?? 60) < 30) return true;
    return false;
  });
  const hasLateAdditions = lateAdditions.length > 0;

  const fixes: BrewTipFix[] = [];

  if (delta > 0) {
    // Measured OG too high — dilute.
    const addWaterL = dilutionWater(measuredVol, measuredOG, targetOG);
    if (addWaterL > 0.05) {
      const action = `Add ~${addWaterL.toFixed(1)} L water`;
      fixes.push({
        kind: "water",
        eyebrow: "CLEANEST",
        eyebrowColor: hsTokens.hops,
        title: action,
        titlePlain: action,
        body: "Boil hops are already utilized, so dilution only affects color and alcohol — not bitterness.",
      });
    }
    const acceptAction = `Accept ~${estABV(measuredOG).toFixed(1)}% ABV`;
    fixes.push({
      kind: "accept",
      eyebrow: fixes.length === 0 ? "CLEANEST" : "EASIEST",
      eyebrowColor: fixes.length === 0 ? hsTokens.hops : hsTokens.muted,
      title: acceptAction,
      titlePlain: acceptAction,
      body: `Lands a touch stronger than target (~${estABV(targetOG).toFixed(
        1
      )}%). Still drinks great.`,
    });
  } else {
    // Measured OG too low.
    const missingPoints = (targetOG - measuredOG) * 1000;
    const dmeG = Math.max(
      0,
      Math.round(((missingPoints * measuredVol) / DME_PPL_PER_KG_PER_L) * 1000)
    );
    if (dmeG > 0) {
      const action = `Add ~${dmeG} g DME at flameout`;
      fixes.push({
        kind: "dme",
        eyebrow: "CLEANEST",
        eyebrowColor: hsTokens.hops,
        title: action,
        titlePlain: action,
        body: "Stir in dry malt extract to bring gravity up — cleanest fix at this point.",
      });
    }
    const targetVol = postBoilVolume(measuredVol, measuredOG, targetOG);
    const extraMin = Math.max(
      0,
      ((measuredVol - targetVol) / boilOffRateLPerHour) * 60
    );
    if (extraMin > 1 && extraMin <= 30) {
      const action = `Boil ~${Math.round(extraMin)} min longer`;
      fixes.push({
        kind: "boil",
        eyebrow:
          fixes.length === 0
            ? "CLEANEST"
            : hasLateAdditions
            ? "RISKIER"
            : "MORE WORK",
        eyebrowColor: fixes.length === 0 ? hsTokens.hops : hsTokens.muted,
        title: action,
        titlePlain: action,
        body: "Concentrates the wort the same amount. Affects hop timing and volume.",
        warning: hasLateAdditions
          ? "Your whirlpool hops will over-extract. Pull them with a filter first."
          : undefined,
      });
    }
    const acceptAction = `Accept ~${estABV(measuredOG).toFixed(1)}% ABV`;
    fixes.push({
      kind: "accept",
      eyebrow: fixes.length === 0 ? "CLEANEST" : "EASIEST",
      eyebrowColor: fixes.length === 0 ? hsTokens.hops : hsTokens.muted,
      title: acceptAction,
      titlePlain: acceptAction,
      body: `Lands ~${Math.abs(missingPoints).toFixed(0)} points below target — beer hits ~${estABV(
        measuredOG
      ).toFixed(1)}% instead of ~${estABV(targetOG).toFixed(1)}%.${
        Math.abs(missingPoints) < 5 ? " Within normal brew-day variance." : ""
      }`,
    });
  }

  // Reasoning: simpler than pre-boil — the brewer measured the OG directly,
  // so the only signal is whether they boiled off too much or too little.
  // Volume tells the story: low post-boil volume = boiled off too aggressively
  // (concentrating wort → OG high); high volume = under-boiled (OG low).
  const volDelta = measuredVol - targetPostBoilVolumeHotL;
  const volSignificant = Math.abs(volDelta) >= 0.4;
  let reasoning: string | undefined;
  if (volSignificant) {
    reasoning =
      volDelta > 0
        ? "post-boil volume high — boiled off less than expected"
        : "post-boil volume low — boiled off more than expected";
  } else {
    reasoning = "boiled off as expected — efficiency must have drifted";
  }

  return (
    <BrewTipCard
      morphId={morphId}
      problemLabel={delta > 0 ? "Post-boil OG landed high" : "Post-boil OG landed low"}
      reasoning={reasoning}
      fixes={fixes}
      selectedKind={selectedKind}
      onSelect={onSelectFix}
      onClear={onClearFix}
      onMinimize={onMinimize}
    />
  );
}

function BoilNumbersMatrix({
  preBoilVolumeL,
  preBoilGravity,
  boilTimeMin,
  boilOff,
  postBoilHotL,
  og,
  actualsCalculations,
  brewMode,
  preBoilFlag,
  postBoilFlag,
  preBoilCard,
  postBoilCard,
  preBoilResolved,
  postBoilResolved,
}: {
  preBoilVolumeL: number;
  preBoilGravity: number;
  boilTimeMin: number;
  boilOff: number;
  postBoilHotL: number;
  og: number;
  /** Recipe calculations after substituting actual ingredient amounts (Brew Mode).
   *  Per-cell revisions are rendered inline; the section-level "*due to X" note
   *  lives on the parent ScheduleSection's headerRight. */
  actualsCalculations: RecipeCalculations | null;
  brewMode: BrewMode | null;
  /** Optional flag nodes (small hover-tooltip indicators) for the Pre-boil and
   *  Post-boil header cells. Used in Brew Mode to surface OG predictor / actuals tips. */
  preBoilFlag?: ReactNode;
  postBoilFlag?: ReactNode;
  /** Predictor card paired with the Pre-boil row — surfaces OG fix options
   *  computed from the pre-boil actuals. When either card prop is set, the
   *  matrix switches to a layout that includes the predictor(s). */
  preBoilCard?: ReactNode;
  postBoilCard?: ReactNode;
  /** Whether each predictor is in its resolved (compact note) state. Used to
   *  pick the layout — one resolved predictor can sit in a single 3-column
   *  row, but anything in the expanded warning state needs its own row. */
  preBoilResolved?: boolean;
  postBoilResolved?: boolean;
}) {
  // Derived "with actuals" boil numbers — used to render strikethrough revisions
  // when grain weights shift them. Boil-off and boil time are equipment-driven,
  // so they don't change with ingredient swaps.
  const actualsPostBoilHot = actualsCalculations
    ? Math.max(0, actualsCalculations.preBoilVolumeL - boilOff)
    : null;
  const revisedVolumeLeft =
    actualsCalculations &&
    Math.abs(actualsCalculations.preBoilVolumeL - preBoilVolumeL) >= 0.05
      ? `${actualsCalculations.preBoilVolumeL.toFixed(1)} L · ${lToGal(
          actualsCalculations.preBoilVolumeL
        )} gal`
      : null;
  const revisedVolumeRight =
    actualsPostBoilHot != null &&
    Math.abs(actualsPostBoilHot - postBoilHotL) >= 0.05
      ? `${actualsPostBoilHot.toFixed(1)} L · ${lToGal(actualsPostBoilHot)} gal`
      : null;
  const revisedGravityLeft =
    actualsCalculations &&
    Math.abs(actualsCalculations.preBoilGravity - preBoilGravity) >= 0.001
      ? actualsCalculations.preBoilGravity.toFixed(3)
      : null;
  const revisedGravityRight =
    actualsCalculations && Math.abs(actualsCalculations.og - og) >= 0.001
      ? actualsCalculations.og.toFixed(3)
      : null;

  const preBoilMetrics: BoilMetric[] = [
    {
      label: "Volume",
      target: `${preBoilVolumeL.toFixed(1)} L · ${lToGal(preBoilVolumeL)} gal`,
      revised: revisedVolumeLeft ?? undefined,
      actual: brewMode ? (
        <CellInput
          value={brewMode.actuals.preBoilVolumeL}
          onCommit={(v) => brewMode.onActualsChange({ preBoilVolumeL: v })}
          step={0.1}
          format={(v) => v.toFixed(1)}
          suffix=" L"
        />
      ) : undefined,
    },
    {
      label: "Gravity",
      target: preBoilGravity.toFixed(3),
      revised: revisedGravityLeft ?? undefined,
      actual: brewMode ? (
        <CellInput
          value={brewMode.actuals.preBoilGravity}
          onCommit={(v) => brewMode.onActualsChange({ preBoilGravity: v })}
          step={0.001}
          format={(v) => v.toFixed(3)}
        />
      ) : undefined,
    },
  ];

  const postBoilMetrics: BoilMetric[] = [
    {
      label: "Volume (hot)",
      target: `${postBoilHotL.toFixed(1)} L · ${lToGal(postBoilHotL)} gal`,
      revised: revisedVolumeRight ?? undefined,
      actual: brewMode ? (
        <CellInput
          value={brewMode.actuals.postBoilVolumeHotL}
          onCommit={(v) => brewMode.onActualsChange({ postBoilVolumeHotL: v })}
          step={0.1}
          format={(v) => v.toFixed(1)}
          suffix=" L"
        />
      ) : undefined,
    },
    {
      label: "Gravity (OG)",
      target: <strong>{og.toFixed(3)}</strong>,
      revised: revisedGravityRight ? <strong>{revisedGravityRight}</strong> : undefined,
      actual: brewMode ? (
        <CellInput
          value={brewMode.actuals.originalGravity}
          onCommit={(v) => brewMode.onActualsChange({ originalGravity: v })}
          step={0.001}
          format={(v) => v.toFixed(3)}
        />
      ) : undefined,
    },
  ];

  const boilTimeMetric: BoilMetric = {
    label: "Boil time",
    target: `${boilTimeMin} min`,
    actual: brewMode ? (
      <CellInput
        value={brewMode.actuals.boilTimeMin}
        onCommit={(v) => brewMode.onActualsChange({ boilTimeMin: v })}
        step={1}
        format={(v) => v.toFixed(0)}
        suffix=" min"
      />
    ) : undefined,
  };

  // Layout selector — always a single row:
  //   0 cards → side-by-side pre/post boxes (existing behaviour)
  //   1+ cards → 3-col flanking layout: pre-box · stacked center · post-box
  //              Each predictor card in the center has an arrow pointing at
  //              the phase box it explains. Stacks vertically when both
  //              predictors have content.
  void preBoilResolved; // kept for API compatibility; layout no longer branches on it
  void postBoilResolved;
  const hasPreCard = preBoilCard != null;
  const hasPostCard = postBoilCard != null;
  const cardCount = (hasPreCard ? 1 : 0) + (hasPostCard ? 1 : 0);

  if (cardCount === 0) {
    return (
      <div className="hs-boil-numbers">
        <div className="hs-boil-phase-grid">
          <BoilPhaseBox
            title="Pre-boil"
            flag={preBoilFlag}
            metrics={preBoilMetrics}
          />
          <BoilPhaseBox
            title="Post-boil"
            flag={postBoilFlag}
            metrics={postBoilMetrics}
          />
        </div>
        <BoilPhaseBox
          title="Boil time"
          metrics={[boilTimeMetric]}
          compact
        />
      </div>
    );
  }

  return (
    <div className="hs-boil-numbers">
      <div className="hs-boil-phase-grid hs-boil-phase-grid-flanking">
        <BoilPhaseBox
          title="Pre-boil"
          flag={preBoilFlag}
          metrics={preBoilMetrics}
        />
        <div className="hs-boil-phase-center-stack">
          {hasPreCard ? (
            <div className="hs-boil-phase-card-row">
              <ArrowGlyph direction="left" />
              <div className="hs-boil-phase-card-slot">
                <AnimatePresence mode="popLayout" initial={false}>
                  {preBoilCard}
                </AnimatePresence>
              </div>
            </div>
          ) : null}
          {hasPostCard ? (
            <div className="hs-boil-phase-card-row hs-boil-phase-card-row-right">
              <ArrowGlyph direction="right" />
              <div className="hs-boil-phase-card-slot">
                <AnimatePresence mode="popLayout" initial={false}>
                  {postBoilCard}
                </AnimatePresence>
              </div>
            </div>
          ) : null}
        </div>
        <BoilPhaseBox
          title="Post-boil"
          flag={postBoilFlag}
          metrics={postBoilMetrics}
        />
      </div>
      <BoilPhaseBox
        title="Boil time"
        metrics={[boilTimeMetric]}
        compact
      />
    </div>
  );
}

interface BoilMetric {
  label: string;
  target: ReactNode;
  revised?: ReactNode;
  actual?: ReactNode;
}

function BoilPhaseBox({
  title,
  flag,
  metrics,
  compact,
}: {
  title: string;
  flag?: ReactNode;
  metrics: BoilMetric[];
  /** When true, single-row phase (e.g. Boil time) — render inline rather than as a card. */
  compact?: boolean;
}) {
  return (
    <section
      className={compact ? "hs-boil-phase hs-boil-phase-compact" : "hs-boil-phase"}
    >
      <header className="hs-boil-phase-header">
        <span className="hs-boil-phase-title">{title}</span>
        {flag ? <span className="hs-boil-phase-flag">{flag}</span> : null}
        <span className="hs-boil-phase-header-tags">
          <span className="hs-boil-phase-header-target">target</span>
          <span className="hs-boil-phase-header-actual">actual</span>
        </span>
      </header>
      <ul className="hs-boil-phase-metrics">
        {metrics.map((m, i) => (
          <li key={i} className="hs-boil-metric">
            <span className="hs-boil-metric-label">{m.label}</span>
            <span className="hs-boil-metric-target">
              {m.revised ? (
                <RevisedValue planned={m.target} revised={m.revised} compact />
              ) : (
                m.target
              )}
            </span>
            <span className="hs-boil-metric-actual">{m.actual ?? null}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BoilAdditionsTable({
  boilHops,
  whirlpoolHops,
  otherAdditions,
  brewMode,
}: {
  boilHops: Recipe["hops"];
  whirlpoolHops: Recipe["hops"];
  otherAdditions: Recipe["otherIngredients"];
  brewMode: BrewMode | null;
}) {
  return (
    <div className="hs-boil-additions">
      <Table>
        <THead
          columns={[
            { label: "When", width: "140px" },
            { label: "Addition", width: "auto" },
            { label: "Amount", width: "120px", align: "center" },
            { label: "Notes / AA", width: "120px", align: "center" },
            { label: "Added", width: "80px", align: "center", isActual: true },
          ]}
        />
      <tbody>
        {boilHops.length > 0 ? (
          <BoilGroupHeader label="During boil" accent={hsTokens.hops} />
        ) : null}
        {boilHops.map((h) => (
          <tr key={h.id}>
            <Td font="mono">
              {h.type === "first wort"
                ? "first wort"
                : h.type === "mash"
                ? "mash"
                : `${h.timeMinutes ?? 0} min`}
            </Td>
            <Td>
              <span style={{ fontWeight: 600 }}>{h.name || "Unnamed hop"}</span>
              <span style={hintStyle}>hop</span>
            </Td>
            <Td align="center" font="mono">
              {h.grams} g
            </Td>
            <Td align="center" font="mono">
              {h.alphaAcid.toFixed(1)}% AA
            </Td>
            <AddedCell
              id={h.id}
              plannedAmount={h.grams}
              unit="g"
              brewMode={brewMode}
              precision={1}
            />
          </tr>
        ))}
        {whirlpoolHops.length > 0 ? (
          <BoilGroupHeader label="Whirlpool" accent={hsTokens.honey} />
        ) : null}
        {whirlpoolHops.map((h) => (
          <tr key={h.id}>
            <Td font="mono">
              {h.temperatureC != null
                ? `${h.temperatureC.toFixed(0)} °C${
                    h.whirlpoolTimeMinutes != null
                      ? ` · ${h.whirlpoolTimeMinutes}′`
                      : ""
                  }`
                : "whirlpool"}
            </Td>
            <Td>
              <span style={{ fontWeight: 600 }}>{h.name || "Unnamed hop"}</span>
              <span style={hintStyle}>hop</span>
            </Td>
            <Td align="center" font="mono">
              {h.grams} g
            </Td>
            <Td align="center" font="mono">
              {h.alphaAcid.toFixed(1)}% AA
            </Td>
            <AddedCell
              id={h.id}
              plannedAmount={h.grams}
              unit="g"
              brewMode={brewMode}
              precision={1}
            />
          </tr>
        ))}
        {otherAdditions.length > 0 ? (
          <BoilGroupHeader label="Other" accent={hsTokens.muted} />
        ) : null}
        {otherAdditions.map((o) => (
          <tr key={o.id}>
            <Td font="mono">{o.timing}</Td>
            <Td>
              <span style={{ fontWeight: 600 }}>{o.name}</span>
              <span style={hintStyle}>{o.category}</span>
            </Td>
            <Td align="center" font="mono">
              {o.amount} {o.unit}
            </Td>
            <Td align="center" font="mono">
              {o.notes ?? "—"}
            </Td>
            <AddedCell
              id={o.id}
              plannedAmount={o.amount}
              unit={o.unit}
              brewMode={brewMode}
              precision={2}
            />
          </tr>
        ))}
        </tbody>
      </Table>
    </div>
  );
}

function BoilGroupHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <tr>
      <td
        colSpan={5}
        style={{
          padding: "6px 10px",
          background: hsTokens.cream2,
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: hsTokens.ink,
          borderBottom: `1px solid ${hsTokens.ink}`,
          borderTop: `1px solid ${hsTokens.ink}`,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: accent,
            border: `1px solid ${hsTokens.ink}`,
            marginRight: 8,
            verticalAlign: "middle",
          }}
        />
        {label}
      </td>
    </tr>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: "14px 12px",
        textAlign: "center",
        fontFamily: hsTokens.body,
        fontSize: 12,
        color: hsTokens.muted,
        border: `1.5px dashed ${hsTokens.muted}`,
        borderRadius: 8,
        opacity: 0.75,
      }}
    >
      {text}
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 14,
        marginBottom: 6,
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: hsTokens.muted,
      }}
    >
      {children}
    </div>
  );
}

function MashChecks({
  firstRunningsSG,
  brewMode,
}: {
  firstRunningsSG: number | null;
  brewMode: BrewMode | null;
}) {
  const checks = brewMode?.actuals.mashChecks;
  const writeCheck = (
    patch: Partial<NonNullable<SessionActuals["mashChecks"]>>
  ) => {
    if (!brewMode) return;
    brewMode.onActualsChange({
      mashChecks: { ...(brewMode.actuals.mashChecks ?? {}), ...patch },
    });
  };

  return (
    <div style={{ marginTop: 14 }}>
      <SubLabel>Mash checks</SubLabel>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: hsTokens.body,
          fontSize: 11,
          opacity: 0.92,
        }}
      >
        <tbody>
          <MashCheckRow
            label="Iodine test"
            hint="conversion check"
            expected="negative"
            actualNode={
              brewMode ? (
                <CellCheck
                  checked={Boolean(checks?.iodineNegative)}
                  onToggle={() =>
                    writeCheck({ iodineNegative: !checks?.iodineNegative })
                  }
                />
              ) : null
            }
          />
          <MashCheckRow
            label="First runnings SG"
            hint="before sparge"
            expected={firstRunningsSG != null ? firstRunningsSG.toFixed(3) : "—"}
            actualNode={
              brewMode ? (
                <CellInput
                  value={checks?.firstRunningsSG}
                  onCommit={(v) => writeCheck({ firstRunningsSG: v })}
                  step={0.001}
                  format={(v) => v.toFixed(3)}
                />
              ) : null
            }
          />
          <MashCheckRow
            label="Last runnings SG"
            hint="end of sparge"
            expected="≥ 1.010"
            actualNode={
              brewMode ? (
                <CellInput
                  value={checks?.lastRunningsSG}
                  onCommit={(v) => writeCheck({ lastRunningsSG: v })}
                  step={0.001}
                  format={(v) => v.toFixed(3)}
                />
              ) : null
            }
          />
        </tbody>
      </table>
    </div>
  );
}

function MashCheckRow({
  label,
  hint,
  expected,
  actualNode,
}: {
  label: string;
  hint?: string;
  expected: string;
  actualNode?: ReactNode;
}) {
  return (
    <tr>
      <td
        style={{
          padding: "5px 10px",
          borderBottom: `1px solid ${hsTokens.muted}`,
          fontFamily: hsTokens.body,
          fontSize: 11,
          color: hsTokens.ink,
          width: "auto",
          verticalAlign: "middle",
          lineHeight: 1.3,
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        {hint ? (
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 9,
              color: hsTokens.muted,
              marginLeft: 8,
              fontWeight: 400,
            }}
          >
            · {hint}
          </span>
        ) : null}
      </td>
      <td
        style={{
          padding: "5px 10px",
          borderBottom: `1px solid ${hsTokens.muted}`,
          fontFamily: hsTokens.mono,
          fontSize: 11,
          color: hsTokens.muted,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          width: 140,
        }}
      >
        {expected}
      </td>
      <td
        style={{
          position: "relative",
          padding: "5px 10px",
          borderBottom: `1px solid ${hsTokens.muted}`,
          borderLeft: `1px solid ${hsTokens.muted}`,
          background: hsTokens.cream,
          width: 140,
          minHeight: 26,
          height: 26,
        }}
      >
        {actualNode ?? " "}
      </td>
    </tr>
  );
}

function FermentRow({
  step,
  index,
  brewMode,
}: {
  step: FermentationStep;
  index: number;
  brewMode: BrewMode | null;
}) {
  const stepKey = step.id ?? `ferment-step-${index}`;
  const stepActual = brewMode?.actuals.fermentationStepActuals?.[stepKey];
  return (
    <tr className="hs-sched-row">
      <td className="hs-sched-title" style={mashStepCellStyle}>
        <span className="hs-sched-index" style={mashStepIndexStyle}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="hs-sched-name" style={mashStepNameStyle}>
          {step.name || formatFermentationType(step.type)}
        </span>
      </td>
      <td data-label="Type" style={mashStepCellStyle}>
        <span
          style={{
            display: "inline-block",
            padding: "3px 10px",
            borderRadius: 999,
            background: fermentationStepColor(step.type),
            color: hsTokens.paper,
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            lineHeight: 1.4,
          }}
        >
          {formatFermentationType(step.type)}
        </span>
      </td>
      <td
        data-label="Temp"
        style={{ ...mashStepCellStyle, textAlign: "center" }}
      >
        <span className="hs-sched-value" style={mashStepValueStyle}>
          {step.temperatureC.toFixed(1)} °C
        </span>
        <span className="hs-sched-hint" style={mashStepHintStyle}>{cToF(step.temperatureC)} °F</span>
      </td>
      <td
        data-label="Duration"
        style={{ ...mashStepCellStyle, textAlign: "center" }}
      >
        <span className="hs-sched-value" style={mashStepValueStyle}>{step.durationDays} d</span>
      </td>
      <td
        data-label="Actual temp"
        className="hs-sched-actual"
        style={{ ...mashStepCellStyle, ...mashStepActualStyle }}
      >
        {brewMode ? (
          <CellInput
            value={stepActual?.actualTempC}
            onCommit={(v) =>
              brewMode.onActualsChange({
                fermentationStepActuals: {
                  ...(brewMode.actuals.fermentationStepActuals ?? {}),
                  [stepKey]: { ...stepActual, actualTempC: v },
                },
              })
            }
            step={0.1}
            format={(v) => v.toFixed(1)}
            suffix=" °C"
          />
        ) : (
          " "
        )}
      </td>
      <td
        data-label="Actual days"
        className="hs-sched-actual"
        style={{ ...mashStepCellStyle, ...mashStepActualStyle }}
      >
        {brewMode ? (
          <CellInput
            value={stepActual?.actualDays}
            onCommit={(v) =>
              brewMode.onActualsChange({
                fermentationStepActuals: {
                  ...(brewMode.actuals.fermentationStepActuals ?? {}),
                  [stepKey]: { ...stepActual, actualDays: v },
                },
              })
            }
            step={1}
            format={(v) => v.toFixed(0)}
            suffix=" d"
          />
        ) : (
          " "
        )}
      </td>
    </tr>
  );
}

function PitchTempChip({ pitchTempC }: { pitchTempC: number | undefined }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        marginLeft: 48,
        marginBottom: 12,
        fontFamily: hsTokens.body,
        fontSize: 10,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          color: hsTokens.ink,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        Pitch @
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontWeight: 600,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {pitchTempC != null
          ? `${pitchTempC.toFixed(1)} °C · ${cToF(pitchTempC)} °F`
          : "—"}
      </span>
    </div>
  );
}

/* ─────────────────── print styles ─────────────────── */

function PrintStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          .hs-print-only { display: none; }

          /* Gravity-log layout: each entry is a single-row stats block
             (date / SG / pH / temp) floated left, with notes flowing
             around it. Long notes wrap onto full-width lines BELOW the
             stats block — the float lets text reflow as a shape rather
             than forcing the whole row to grow taller. */
          .hs-print-area .hs-gravity-log {
            border-top: 1.5px solid var(--hs-ink, #1a1a1a);
            border-bottom: 1.5px solid var(--hs-ink, #1a1a1a);
          }
          .hs-print-area .hs-gravity-header {
            display: grid;
            grid-template-columns: 120px 100px 90px 100px 1fr;
            background: var(--hs-cream-2);
            border-bottom: 1.5px solid var(--hs-ink, #1a1a1a);
          }
          .hs-print-area .hs-gravity-header > div {
            padding: 8px 10px;
            font-family: var(--hs-body);
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--hs-muted);
            border-left: 1px solid var(--hs-ink, #1a1a1a);
          }
          .hs-print-area .hs-gravity-header > div:first-child {
            border-left: none;
          }
          .hs-print-area .hs-gravity-header > div:nth-child(n+2):nth-child(-n+4) {
            text-align: center;
          }
          .hs-print-area .hs-gravity-entry {
            position: relative;
            border-bottom: 1px solid var(--hs-ink, #1a1a1a);
            background: #E7DFC7;
            overflow: hidden; /* clearfix for the float */
          }
          .hs-print-area .hs-gravity-entry:last-child {
            border-bottom: none;
          }
          /* Horizontal divider underneath the stats float (bottom edge) and
             vertical divider between stats and notes column (right edge).
             The horizontal sits within the float's width — doesn't cross
             through notes text below. The vertical extends the full entry
             height so it stays visible across overflow-notes rows. */
          .hs-print-area .hs-gravity-stats {
            box-shadow:
              0 1px 0 color-mix(in oklch, var(--hs-ink, #1a1a1a) 45%, transparent),
              inset -1px 0 0 color-mix(in oklch, var(--hs-ink, #1a1a1a) 45%, transparent);
          }
          /* (Vertical line between stats and notes is drawn by the
             inset -1px 0 0 box-shadow on .hs-gravity-stats above; it's
             intentionally only as tall as the stats float so it doesn't
             cross through overflow-notes text below.) */
          .hs-print-area .hs-gravity-stats {
            float: left;
            display: grid;
            grid-template-columns: 120px 100px 90px 100px;
            width: 410px;
            height: 36px;
            background: var(--hs-cream);
            position: relative;
            z-index: 1;
          }
          .hs-print-area .hs-gravity-cell {
            position: relative;
            border-left: 1px solid var(--hs-ink, #1a1a1a);
            min-height: 36px;
          }
          .hs-print-area .hs-gravity-cell:first-child {
            border-left: none;
          }
          .hs-print-area .hs-gravity-notes-display,
          .hs-print-area .hs-gravity-notes-edit {
            display: block;
            width: auto;
            min-height: 36px;
            padding: 8px 10px;
            border: none;
            outline: none;
            margin: 0;
            background: transparent;
            text-align: left;
            font-family: var(--hs-script);
            font-size: 18px;
            color: var(--hs-ink);
            line-height: 1.3;
            letter-spacing: 0.005em;
            cursor: text;
            white-space: pre-wrap;
            word-break: break-word;
          }
          .hs-print-area .hs-gravity-notes-display {
            min-height: 36px;
          }
          .hs-print-area .hs-gravity-notes-edit {
            font-family: var(--hs-body);
            font-size: 13px;
            resize: none;
            overflow: hidden;
            width: 100%;
            box-sizing: border-box;
          }

          /* Boil numbers section: phase-grouped cards (Pre-boil / Post-boil
             side-by-side on desktop, stacked on mobile). Boil time is its
             own compact row below. */
          .hs-print-area .hs-boil-numbers {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .hs-print-area .hs-boil-phase-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          /* Flanking variant — single row: phase boxes flank a center column
             holding the predictor cards. Each card row in the center has an
             arrow glyph pointing at its corresponding phase box. The center
             column is sized to the cards' natural width so the side phase
             boxes claim the remaining space — no wasted column padding. */
          .hs-print-area .hs-boil-phase-grid-flanking {
            grid-template-columns: minmax(220px, 1fr) auto minmax(220px, 1fr);
            align-items: start;
          }
          .hs-print-area .hs-boil-phase-center-stack {
            display: flex;
            flex-direction: column;
            gap: 10px;
            justify-content: center;
          }
          .hs-print-area .hs-boil-phase-card-row {
            display: flex;
            align-items: center;
            gap: 10px;
            /* Each row sizes to its own content (arrow + card). Anchored to
               the left edge of the center column for pre-boil so the arrow
               points outward at the pre-boil box. */
            width: fit-content;
            align-self: flex-start;
          }
          .hs-print-area .hs-boil-phase-card-row-right {
            /* Post-boil row anchors to the right edge of the center column;
               row-reverse puts the card on the left and the arrow on the
               right pointing at the post-boil box. */
            flex-direction: row-reverse;
            align-self: flex-end;
          }
          .hs-print-area .hs-boil-phase-card-slot {
            display: flex;
          }
          /* Predictor side container — fills its grid cell so the inner card
             can stretch to match the paired phase box height. */
          .hs-print-area .hs-boil-phase-side {
            min-width: 0;
            display: flex;
          }
          .hs-print-area .hs-boil-phase-side > * {
            flex: 1;
            min-width: 0;
          }
          .hs-print-area .hs-boil-phase {
            border: 1.5px solid color-mix(in oklch, currentColor 75%, transparent);
            border-radius: 10px;
            overflow: hidden;
            background: var(--hs-paper);
          }
          .hs-print-area .hs-boil-phase-header {
            display: grid;
            grid-template-columns: 1fr auto;
            align-items: baseline;
            padding: 10px 12px 4px;
            background: color-mix(in oklch, currentColor 4%, transparent);
            border-bottom: 1px solid color-mix(in oklch, currentColor 35%, transparent);
            gap: 8px;
          }
          .hs-print-area .hs-boil-phase-title {
            font-family: var(--hs-display);
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: var(--hs-ink);
          }
          .hs-print-area .hs-boil-phase-flag {
            grid-column: 2;
            grid-row: 1;
            justify-self: end;
          }
          .hs-print-area .hs-boil-phase-header-tags {
            grid-column: 1 / -1;
            grid-row: 2;
            display: grid;
            grid-template-columns: 1fr 96px;
            font-family: var(--hs-body);
            font-size: 7.5px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: color-mix(in oklch, currentColor 45%, transparent);
            padding-top: 4px;
          }
          .hs-print-area .hs-boil-phase-header-target {
            text-align: right;
            padding-right: 12px;
          }
          .hs-print-area .hs-boil-phase-header-actual {
            text-align: center;
            border-left: 1px solid color-mix(in oklch, currentColor 20%, transparent);
            box-sizing: border-box;
          }
          .hs-print-area .hs-boil-phase-metrics {
            list-style: none;
            margin: 0;
            padding: 0;
          }
          .hs-print-area .hs-boil-metric {
            display: grid;
            grid-template-columns: minmax(72px, auto) 1fr 96px;
            align-items: stretch;
            border-top: 1px dotted color-mix(in oklch, currentColor 25%, transparent);
            min-height: 38px;
          }
          .hs-print-area .hs-boil-metric:first-child {
            border-top: none;
          }
          .hs-print-area .hs-boil-metric-label {
            padding: 8px 12px;
            font-family: var(--hs-body);
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: color-mix(in oklch, currentColor 55%, transparent);
            display: flex;
            align-items: center;
          }
          .hs-print-area .hs-boil-metric-target {
            padding: 8px 12px;
            font-family: var(--hs-mono);
            font-size: 13px;
            color: var(--hs-ink);
            font-variant-numeric: tabular-nums;
            display: flex;
            align-items: center;
            justify-content: flex-end;
            text-align: right;
          }
          .hs-print-area .hs-boil-metric-actual {
            position: relative;
            background: color-mix(in oklch, currentColor 4%, transparent);
            border-left: 1px solid color-mix(in oklch, currentColor 35%, transparent);
            min-height: 38px;
          }
          /* Compact phase (Boil time): single-row, no card grid */
          .hs-print-area .hs-boil-phase-compact .hs-boil-phase-header-tags {
            display: none;
          }
          .hs-print-area .hs-boil-phase-compact .hs-boil-phase-header {
            border-bottom: 1px solid color-mix(in oklch, currentColor 35%, transparent);
            padding-bottom: 8px;
          }

          /* Mobile pass — smaller fonts + tighter padding on narrow viewports.
             Wide tables (Water matrix, Boil 6-col, schedules) scroll
             horizontally via the ScheduleSection's overflow-x: auto wrapper. */
          @media (max-width: 640px) {
            .hs-print-area {
              padding: 12px !important;
              gap: 12px !important;
            }
            .hs-print-area .hs-print-block header {
              padding: 12px 12px 8px !important;
              gap: 8px !important;
            }
            /* Top strip + Ingredients grid gap */
            .hs-print-area .hs-print-cols-3,
            .hs-print-area .hs-print-cols-2 {
              gap: 10px !important;
            }

            /* Schedule cells: smaller fonts + tighter padding */
            .hs-print-area .hs-mash-schedule td,
            .hs-print-area .hs-ferment-schedule td {
              padding: 7px 7px !important;
              font-size: 11px !important;
            }
            .hs-print-area .hs-sched-index {
              font-size: 13px !important;
              margin-right: 6px !important;
            }
            .hs-print-area .hs-sched-name {
              font-size: 12px !important;
            }
            .hs-print-area .hs-sched-value {
              font-size: 13px !important;
            }
            .hs-print-area .hs-sched-hint {
              font-size: 9px !important;
              margin-top: 2px !important;
            }

            /* Hop list: allow variety names to wrap on mobile instead of
               truncating with ellipsis. */
            .hs-print-area .hs-hop-data-cell {
              white-space: normal !important;
              overflow: visible !important;
              text-overflow: clip !important;
              padding: 6px 7px !important;
              font-size: 11px !important;
            }
            /* Hide the AA% column on mobile and shrink the grid template
               to reclaim that ~60px for the variety name column. The 4th
               grid cell (AA%) is hidden via display:none. The 5th cell —
               "Added" — only exists in brew mode. */
            .hs-print-area .hs-hops-list[data-brew="false"] > div {
              grid-template-columns: minmax(82px, 100px) 1fr minmax(48px, 60px) !important;
            }
            .hs-print-area .hs-hops-list[data-brew="true"] > div {
              grid-template-columns: minmax(82px, 100px) 1fr minmax(48px, 60px) minmax(50px, 64px) !important;
            }
            .hs-print-area .hs-hops-list > div > :nth-child(4) {
              display: none !important;
            }
            /* Group-header rows have only one child cell, so nth-child(4)
               doesn't match. The single child should still span the row. */
            .hs-print-area .hs-hops-list > div > :only-child {
              grid-column: 1 / -1;
            }

            /* Water matrix + Boil numbers matrix + generic Td: shrink */
            .hs-print-area table {
              font-size: 11px !important;
            }
            .hs-print-area table td,
            .hs-print-area table th {
              padding: 6px 7px !important;
            }

            /* MiniTable cards: smaller title + labels on mobile so paired
               cells don't clip in single-column stacked top strip */
            .hs-print-area .hs-mini-title {
              font-size: 12px !important;
              padding: 10px 10px 6px !important;
            }
            .hs-print-area .hs-mini-label-cell {
              font-size: 9px !important;
              padding: 4px 8px !important;
              letter-spacing: 0.06em !important;
            }
            .hs-print-area .hs-mini-value-cell {
              font-size: 11px !important;
              padding: 4px 8px !important;
            }
            .hs-print-area .hs-mini-actual {
              width: 76px !important;
            }

            /* Schedule tables → card-per-step on mobile.
               Hide thead and flatten table/tbody to block-level. Each row
               becomes a bordered card with the title cell on top and the
               other cells stacked vertically below with their label on the
               left (via data-label ::before). */
            .hs-print-area .hs-mash-schedule,
            .hs-print-area .hs-mash-schedule table,
            .hs-print-area .hs-mash-schedule tbody,
            .hs-print-area .hs-ferment-schedule,
            .hs-print-area .hs-ferment-schedule table,
            .hs-print-area .hs-ferment-schedule tbody {
              display: block !important;
              width: 100% !important;
            }
            .hs-print-area .hs-mash-schedule thead,
            .hs-print-area .hs-ferment-schedule thead {
              display: none !important;
            }
            .hs-print-area .hs-mash-schedule .hs-sched-row {
              display: grid !important;
              grid-template-columns: 1fr 96px !important;
              grid-template-areas:
                "title title"
                "temp  atemp"
                "dur   atime" !important;
              border: 1.5px solid color-mix(in oklch, currentColor 75%, transparent) !important;
              border-radius: 8px !important;
              margin-bottom: 10px !important;
              overflow: hidden !important;
            }
            .hs-print-area .hs-ferment-schedule .hs-sched-row {
              display: grid !important;
              grid-template-columns: 1fr 96px !important;
              grid-template-areas:
                "title title"
                "temp  atemp"
                "dur   adays" !important;
              border: 1.5px solid color-mix(in oklch, currentColor 75%, transparent) !important;
              border-radius: 8px !important;
              margin-bottom: 10px !important;
              overflow: hidden !important;
            }
            /* Type pill (PRIMARY/CONDITIONING) is redundant with the step
               name title (e.g. "01 Primary Fermentation") — hide on mobile. */
            .hs-print-area .hs-ferment-schedule td[data-label="Type"] {
              display: none !important;
            }
            .hs-print-area .hs-ferment-schedule .hs-sched-fg-row {
              grid-template-areas:
                "title title"
                "fg-tgt fg-tgt"
                "fg    afg" !important;
            }
            /* The FG-row's "Actual days" cell duplicates the per-step
               actual-days inputs above on mobile; hide it so the card ends
               cleanly at the FG/Actual FG row. */
            .hs-print-area .hs-ferment-schedule .hs-sched-fg-row > td[data-label="Actual days"] {
              display: none !important;
            }

            /* Hops list + flavor radar: stack vertically on mobile (the
               radar takes a significant chunk of the row otherwise and
               squeezes the hop names into 3-line wraps). */
            .hs-print-area .hs-print-stack {
              grid-template-columns: 1fr !important;
            }

            /* Gravity log on mobile: shrink the stats block columns + the
               header columns to match, so the cards fit narrow viewports
               without overflowing. The notes column doesn't need explicit
               width — it flows naturally around the stats float. */
            .hs-print-area .hs-gravity-header {
              grid-template-columns: 78px 56px 44px 56px 1fr !important;
            }
            .hs-print-area .hs-gravity-header > div {
              padding: 6px 7px !important;
              font-size: 9px !important;
            }
            .hs-print-area .hs-gravity-stats {
              grid-template-columns: 78px 56px 44px 56px !important;
              width: 234px !important;
            }
            .hs-print-area .hs-gravity-notes-display,
            .hs-print-area .hs-gravity-notes-edit {
              font-size: 15px !important;
              padding: 6px 8px !important;
            }
            .hs-print-area .hs-gravity-notes-edit {
              font-size: 12px !important;
            }

            /* Centre the "actual" column heading above its narrow column —
               aligns with the centred CellInput value below (handwritten
               script font is also centred), unlike the planned-target value
               which is right-aligned and so its heading is too. */
            .hs-print-area .hs-water-matrix .hs-matrix-label::after,
            .hs-print-area .hs-boil-numbers .hs-boil-title::after,
            .hs-print-area .hs-mash-schedule .hs-sched-title::after,
            .hs-print-area .hs-ferment-schedule .hs-sched-title::after {
              text-align: center !important;
              padding-right: 0 !important;
            }
            .hs-print-area .hs-mash-schedule .hs-sched-title,
            .hs-print-area .hs-ferment-schedule .hs-sched-title {
              grid-area: title !important;
              padding: 10px 12px !important;
              background: color-mix(in oklch, currentColor 4%, transparent) !important;
              border-bottom: 1px solid color-mix(in oklch, currentColor 35%, transparent) !important;
              text-align: left !important;
            }
            .hs-print-area .hs-mash-schedule td[data-label="Temp"],
            .hs-print-area .hs-ferment-schedule td[data-label="Temp"] {
              grid-area: temp !important;
            }
            .hs-print-area .hs-mash-schedule td[data-label="Actual temp"],
            .hs-print-area .hs-ferment-schedule td[data-label="Actual temp"] {
              grid-area: atemp !important;
            }
            .hs-print-area .hs-mash-schedule td[data-label="Duration"],
            .hs-print-area .hs-ferment-schedule td[data-label="Duration"] {
              grid-area: dur !important;
            }
            .hs-print-area .hs-mash-schedule td[data-label="Time hit"] {
              grid-area: atime !important;
            }
            .hs-print-area .hs-ferment-schedule td[data-label="Actual days"] {
              grid-area: adays !important;
            }
            .hs-print-area .hs-ferment-schedule td[data-label="Type"] {
              grid-area: type !important;
            }
            .hs-print-area .hs-ferment-schedule td[data-label="FG target"] {
              grid-area: fg-tgt !important;
            }
            .hs-print-area .hs-ferment-schedule td[data-label="FG"] {
              grid-area: fg !important;
            }
            .hs-print-area .hs-ferment-schedule td[data-label="Actual FG"] {
              grid-area: afg !important;
            }
            .hs-print-area .hs-mash-schedule td[data-label],
            .hs-print-area .hs-ferment-schedule td[data-label] {
              position: relative;
              padding: 8px 12px 8px 80px !important;
              border-left: none !important;
              border-bottom: 1px dotted color-mix(in oklch, currentColor 25%, transparent) !important;
              text-align: left !important;
              min-height: 40px;
              height: auto !important;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
            }
            /* Actual cells: cream background + left border to visually separate
               them from the planned values. */
            .hs-print-area .hs-mash-schedule td.hs-sched-actual,
            .hs-print-area .hs-ferment-schedule td.hs-sched-actual {
              background: color-mix(in oklch, currentColor 4%, transparent) !important;
              border-left: 1px solid color-mix(in oklch, currentColor 35%, transparent) !important;
              padding: 8px 12px 8px 64px !important;
            }
            .hs-print-area .hs-mash-schedule td[data-label]::before,
            .hs-print-area .hs-ferment-schedule td[data-label]::before {
              content: attr(data-label);
              position: absolute;
              left: 12px;
              top: 50%;
              transform: translateY(-50%);
              font-family: inherit;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: color-mix(in oklch, currentColor 55%, transparent);
              white-space: nowrap;
            }
            /* Hide the "Actual" data-label prefix on actual cells — the cream
               background + left border already conveys "this is the actual",
               and showing both the planned label AND "Actual X" is redundant. */
            .hs-print-area .hs-mash-schedule td.hs-sched-actual::before,
            .hs-print-area .hs-ferment-schedule td.hs-sched-actual::before {
              display: none !important;
            }
            .hs-print-area .hs-mash-schedule td.hs-sched-actual,
            .hs-print-area .hs-ferment-schedule td.hs-sched-actual {
              padding-left: 12px !important;
            }
            /* Override CellInput's inline absolute inset:0 so the input fills
               just the actual cell rather than the whole card. The cell
               itself is the positioned ancestor (position: relative inline). */
            /* Drop bottom border on the last grid row's cells. */
            .hs-print-area .hs-mash-schedule .hs-sched-row > td[data-label="Duration"],
            .hs-print-area .hs-mash-schedule .hs-sched-row > td[data-label="Time hit"],
            .hs-print-area .hs-ferment-schedule .hs-sched-row > td[data-label="Duration"],
            .hs-print-area .hs-ferment-schedule .hs-sched-row > td[data-label="Actual days"] {
              border-bottom: none !important;
            }
            /* Fermentation FG-target footer: drop the colSpan=2 spacer cell
               (it's just whitespace) so the card starts cleanly with the
               "FG target" row. */
            .hs-print-area .hs-ferment-schedule .hs-sched-fg-spacer {
              display: none !important;
            }
            .hs-print-area .hs-ferment-schedule .hs-sched-fg-row {
              background: color-mix(in oklch, currentColor 3%, transparent);
            }
            /* Right-align planned values so they sit close to the actual
               column, mirroring the boil section pattern. */
            .hs-print-area .hs-mash-schedule td[data-label]:not(.hs-sched-actual),
            .hs-print-area .hs-ferment-schedule td[data-label]:not(.hs-sched-actual) {
              align-items: flex-end !important;
              text-align: right !important;
            }
            /* "Target" + "Actual" column subheaders on the title row —
               small uppercase tags at the bottom of the title row, centered
               above their respective columns, divided by a thin border. */
            .hs-print-area .hs-mash-schedule .hs-sched-title,
            .hs-print-area .hs-ferment-schedule .hs-sched-title {
              position: relative;
              padding-bottom: 14px !important;
            }
            .hs-print-area .hs-mash-schedule .hs-sched-row .hs-sched-title::before,
            .hs-print-area .hs-ferment-schedule .hs-sched-row:not(.hs-sched-fg-row) .hs-sched-title::before {
              content: "target";
              position: absolute;
              left: 0;
              right: 96px;
              bottom: 1px;
              font-family: inherit;
              font-size: 7.5px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: color-mix(in oklch, currentColor 45%, transparent);
              text-align: right;
              padding-right: 12px;
              pointer-events: none;
            }
            .hs-print-area .hs-mash-schedule .hs-sched-row .hs-sched-title::after,
            .hs-print-area .hs-ferment-schedule .hs-sched-row:not(.hs-sched-fg-row) .hs-sched-title::after {
              content: "actual";
              position: absolute;
              right: 0;
              width: 96px;
              bottom: 1px;
              font-family: inherit;
              font-size: 7.5px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: color-mix(in oklch, currentColor 45%, transparent);
              text-align: right;
              padding-right: 12px;
              pointer-events: none;
              border-left: 1px solid color-mix(in oklch, currentColor 20%, transparent);
              box-sizing: border-box;
            }

            /* Boil additions: drop the Notes/AA column on mobile —
               AA% isn't critical brew-day info; freeing the column lets
               When/Addition/Amount/Added fit the viewport. */
            .hs-print-area .hs-boil-additions thead th:nth-child(4),
            .hs-print-area .hs-boil-additions tbody tr > td:nth-child(4) {
              display: none !important;
            }

            /* Water matrix → card-per-measurement on mobile.
               Each row becomes a 2-col grid (target | actual) with the
               measurement label spanning both columns, then mash and sparge
               sub-rows underneath. Phase label is injected via ::before. */
            .hs-print-area .hs-water-matrix,
            .hs-print-area .hs-water-matrix tbody {
              display: block !important;
              width: 100% !important;
            }
            .hs-print-area .hs-water-matrix thead {
              display: none !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-row {
              display: grid !important;
              grid-template-columns: 1fr 84px !important;
              grid-template-areas:
                "label label"
                "mtgt mact"
                "stgt sact" !important;
              border: 1.5px solid color-mix(in oklch, currentColor 75%, transparent) !important;
              border-radius: 8px !important;
              margin-bottom: 8px !important;
              overflow: hidden !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-label {
              grid-area: label !important;
              padding: 8px 12px 14px !important;
              background: color-mix(in oklch, currentColor 4%, transparent) !important;
              border-bottom: 1px solid color-mix(in oklch, currentColor 35%, transparent) !important;
              position: relative;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-label::before {
              content: "target";
              position: absolute;
              left: 0;
              right: 84px;
              bottom: 1px;
              font-family: inherit;
              font-size: 7.5px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: color-mix(in oklch, currentColor 45%, transparent);
              text-align: right;
              padding-right: 12px;
              pointer-events: none;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-label::after {
              content: "actual";
              position: absolute;
              right: 0;
              width: 84px;
              bottom: 1px;
              font-family: inherit;
              font-size: 7.5px;
              font-weight: 700;
              letter-spacing: 0.16em;
              text-transform: uppercase;
              color: color-mix(in oklch, currentColor 45%, transparent);
              text-align: right;
              padding-right: 12px;
              pointer-events: none;
              border-left: 1px solid color-mix(in oklch, currentColor 20%, transparent);
              box-sizing: border-box;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-target {
              position: relative;
              padding: 8px 12px 8px 80px !important;
              border-left: none !important;
              border-bottom: 1px dotted color-mix(in oklch, currentColor 25%, transparent) !important;
              text-align: left !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-target[data-phase="Mash"] {
              grid-area: mtgt !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-target[data-phase="Sparge"] {
              grid-area: stgt !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-actual[data-phase="Mash"] {
              grid-area: mact !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-actual[data-phase="Sparge"] {
              grid-area: sact !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-target[data-phase]::before {
              content: attr(data-phase);
              position: absolute;
              left: 12px;
              top: 50%;
              transform: translateY(-50%);
              font-family: inherit;
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: color-mix(in oklch, currentColor 55%, transparent);
              white-space: nowrap;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-actual {
              border-left: 1px solid color-mix(in oklch, currentColor 35%, transparent) !important;
              border-bottom: 1px dotted color-mix(in oklch, currentColor 25%, transparent) !important;
              min-height: 40px !important;
              height: auto !important;
              background: color-mix(in oklch, currentColor 4%, transparent) !important;
            }
            /* Make target cells stretch to grid row height too so the actual
               cell next to them looks balanced rather than truncated.
               Right-align the value text so it sits close to the actual cell. */
            .hs-print-area .hs-water-matrix .hs-matrix-target {
              min-height: 40px;
              height: auto !important;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: flex-end !important;
              text-align: right !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-row > .hs-matrix-target[data-phase="Sparge"],
            .hs-print-area .hs-water-matrix .hs-matrix-row > .hs-matrix-actual[data-phase="Sparge"] {
              border-bottom: none !important;
            }
            /* For mash-only rows (lactic acid, pH adjustment, est. mash pH), the
               Sparge cells are placeholder dashes — hide them entirely on mobile. */
            .hs-print-area .hs-water-matrix .hs-matrix-row:has(.hs-matrix-omit) > .hs-matrix-target[data-phase="Sparge"],
            .hs-print-area .hs-water-matrix .hs-matrix-row:has(.hs-matrix-omit) > .hs-matrix-actual[data-phase="Sparge"] {
              display: none !important;
            }
            .hs-print-area .hs-water-matrix .hs-matrix-row:has(.hs-matrix-omit) > .hs-matrix-target[data-phase="Mash"],
            .hs-print-area .hs-water-matrix .hs-matrix-row:has(.hs-matrix-omit) > .hs-matrix-actual[data-phase="Mash"] {
              border-bottom: none !important;
            }
            /* Water section's final-profile summary row: stack the label on
               one line and the values on the next, with smaller values font
               so the full Ca/Mg/Na/Cl/SO4/HCO3 line fits without wrapping. */
            .hs-print-area .hs-final-profile-label {
              display: block !important;
              margin-right: 0 !important;
              margin-bottom: 2px !important;
              font-size: 10px !important;
            }
            .hs-print-area .hs-final-profile-values {
              font-size: 9.5px !important;
              white-space: nowrap !important;
            }
            .hs-print-area .hs-water-final-row {
              flex-direction: column !important;
              align-items: stretch !important;
              gap: 8px !important;
            }
            /* Make the summary tr/td block-level so the inner row spans
               the full table width (table-row inside block tbody doesn't
               stretch — it shrinks to a default anonymous-table width). */
            .hs-print-area .hs-water-matrix .hs-water-final-tr,
            .hs-print-area .hs-water-matrix .hs-water-final-td {
              display: block !important;
              width: 100% !important;
              box-sizing: border-box;
            }
            /* Total water line: also shrink so the full "29.8 L · 7.87 gal"
               doesn't overflow the card edge. */
            .hs-print-area .hs-water-final-row > div:last-child {
              font-size: 11px !important;
            }
            .hs-print-area .hs-water-final-row > div:last-child > span:last-child {
              font-size: 12px !important;
            }

            /* Boil numbers: stack pre/post-boil phase cards vertically on
               mobile (they sit side-by-side on desktop via the grid above).
               Tighten the metric row's column widths so the target value
               (e.g. "22.4 L · 5.92 gal") fits without wrapping. */
            .hs-print-area .hs-boil-phase-grid,
            .hs-print-area .hs-boil-phase-grid-flanking {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }
            .hs-print-area .hs-boil-phase-card-row {
              flex-direction: column !important;
              align-items: stretch !important;
            }
            .hs-print-area .hs-boil-phase-card-row-right {
              flex-direction: column !important;
            }
            .hs-print-area .hs-boil-metric {
              grid-template-columns: minmax(0, max-content) 1fr 84px !important;
            }
            .hs-print-area .hs-boil-metric-label {
              padding: 6px 10px !important;
              font-size: 10px !important;
              line-height: 1.15 !important;
            }
            .hs-print-area .hs-boil-metric-target {
              padding: 6px 10px !important;
              font-size: 12px !important;
              white-space: nowrap !important;
            }
            .hs-print-area .hs-boil-phase-header-tags {
              grid-template-columns: 1fr 84px !important;
            }
          }
          @keyframes hsBrewPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%      { opacity: 0.45; transform: scale(0.85); }
          }
          @keyframes hsTipFlagPulse {
            0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, currentColor 35%, transparent); }
            50%      { box-shadow: 0 0 0 4px color-mix(in oklch, currentColor 0%, transparent); }
          }
          @media print {
            @page { size: A4 portrait; margin: 10mm; }

            /* Reset html/body so they don't carry pre-print height */
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              background: #ffffff !important;
              color: #000000 !important;
            }

            /* Hide only elements that are NOT in the print-area path.
               An element is "in the path" if it contains the print area
               as a descendant, IS the print area, or descends from it.
               This preserves the inline display values (grid/flex/table)
               on the print path. */
            body *:not(:has(.hs-print-area)):not(.hs-print-area):not(.hs-print-area *) {
              display: none !important;
            }

            /* Strip chrome from the revealed ancestors (don't touch display). */
            body *:has(.hs-print-area) {
              margin: 0 !important;
              padding: 0 !important;
              background: transparent !important;
              border: none !important;
              box-shadow: none !important;
              transform: none !important;
              animation: none !important;
              max-width: none !important;
              width: auto !important;
              height: auto !important;
              min-height: 0 !important;
              position: static !important;
            }

            /* Print area: clean container, no chrome, full width of page. */
            .hs-print-area {
              width: 100% !important;
              max-width: none !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              font-size: 10pt !important;
              border: none !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }

            /* Force grid column counts on print — auto-fit minmax collapses
               on narrower print-page widths. */
            .hs-print-area .hs-print-cols-3 {
              grid-template-columns: repeat(3, 1fr) !important;
            }
            .hs-print-area .hs-print-cols-2 {
              grid-template-columns: repeat(2, 1fr) !important;
            }

            /* Stack nested 2-col grids vertically on print — they don't have
               room when their parent is already a half-page column. */
            .hs-print-area .hs-print-stack {
              grid-template-columns: 1fr !important;
            }
            /* Shrink the flavor radar so the stacked vertical version
               doesn't dominate the printed hops sub-card. */
            .hs-print-area .hs-print-stack svg {
              max-width: 140px !important;
              height: auto !important;
            }

            /* Allow value cells in MiniTable cards to wrap on spaces so
               paired Yeast rows and split-right Brew Data cells don't clip.
               Labels stay nowrap so "STRAIN", "ATTENUATION", etc. don't get
               broken mid-word. */
            .hs-print-area .hs-mini-value-cell {
              white-space: normal !important;
              font-size: 8pt !important;
              padding: 2px 6px !important;
            }
            /* Force label columns to shrink to content width — width: 1% with
               table-layout: auto + nowrap = column fits the label text only,
               giving the value cell the rest of the row. */
            .hs-print-area .hs-mini-label-cell {
              white-space: nowrap !important;
              font-size: 6pt !important;
              padding: 2px 4px !important;
              letter-spacing: 0.04em !important;
              width: 1% !important;
            }
            .hs-print-area .hs-mini-title {
              font-size: 10pt !important;
              padding: 6px 6px 4px !important;
              letter-spacing: 0.1em !important;
            }
            /* Tighter gap between the three top-strip cards */
            .hs-print-area .hs-print-cols-3 {
              gap: 6px !important;
            }
            /* Hop variety wraps on spaces (no mid-word break — that produced
               "East Kent..." or worse). */
            .hs-print-area .hs-hop-data-cell {
              white-space: normal !important;
              overflow: visible !important;
              text-overflow: clip !important;
            }

            /* Re-hide the explicit "hide on print" elements */
            .hs-print-hide { display: none !important; }
            /* Reveal print-only annotations */
            .hs-print-only { display: block !important; }

            /* Keep each section together on the page */
            .hs-print-area .hs-print-block {
              box-shadow: none !important;
              break-inside: avoid;
              page-break-inside: avoid;
              margin-bottom: 8px;
            }

            /* Tighter tables for paper */
            .hs-print-area table {
              font-size: 9pt !important;
              table-layout: auto !important;
            }
            .hs-print-area th, .hs-print-area td {
              padding: 4px 6px !important;
              overflow-wrap: break-word !important;
            }
            /* Drop fixed pixel widths on schedule tables — they sum past the
               printable A4 width and squeeze the Step column to nothing. */
            .hs-print-area .hs-mash-schedule th,
            .hs-print-area .hs-mash-schedule td,
            .hs-print-area .hs-ferment-schedule th,
            .hs-print-area .hs-ferment-schedule td {
              width: auto !important;
            }
          }
        `,
      }}
    />
  );
}

/* ─────────────────── helpers ─────────────────── */

function formatFermentationType(type: FermentationStepType): string {
  switch (type) {
    case "primary":
      return "Primary";
    case "secondary":
      return "Secondary";
    case "conditioning":
      return "Conditioning";
    case "cold-crash":
      return "Cold crash";
    case "diacetyl-rest":
      return "Diacetyl rest";
  }
}

function fermentationStepColor(type: FermentationStepType): string {
  switch (type) {
    case "primary":
      return hsTokens.yeast;
    case "secondary":
      return hsTokens.honey;
    case "conditioning":
      return hsTokens.malt;
    case "cold-crash":
      return hsTokens.water;
    case "diacetyl-rest":
      return hsTokens.roast;
  }
}

function formatYeastType(t: string): string {
  switch (t) {
    case "liquid-100":
      return "Liquid (100B)";
    case "liquid-200":
      return "Liquid (200B)";
    case "dry":
      return "Dry";
    case "slurry":
      return "Slurry";
    default:
      return t;
  }
}

function buildYeastRows(
  recipe: Recipe,
  pitchTempC: number | undefined,
): MiniRowEntry[] {
  if (recipe.yeasts.length === 0) {
    return [{ label: "Strain", target: "—" }];
  }

  const primaryLab = recipe.yeasts.find((y) => y.laboratory)?.laboratory;
  const labFavicon = getYeastLabFavicon(primaryLab);
  const labNames =
    recipe.yeasts
      .map((y) => y.laboratory)
      .filter(Boolean)
      .join(" / ") || "—";

  const rows: MiniRowEntry[] = [
    [
      {
        label: "Strain",
        target: recipe.yeasts.map((y) => y.name).join(" + "),
      },
      {
        label: "Lab",
        target: labFavicon ? (
          <span
            style={{
              position: "relative",
              display: "inline-block",
              paddingLeft: 0,
            }}
          >
            <img
              src={labFavicon}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                top: -24,
                left: -28,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: `2.5px solid ${hsTokens.paper}`,
                background: hsTokens.paper,
                objectFit: "cover",
                boxShadow:
                  "0 2px 4px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.12)",
                transform: "rotate(-6deg)",
                pointerEvents: "none",
              }}
            />
            {labNames}
          </span>
        ) : (
          labNames
        ),
      },
    ],
    [
      {
        label: "Attenuation",
        target: `${Math.round((recipe.yeasts[0]?.attenuation ?? 0) * 100)} %`,
      },
      {
        label: "Pitch Temp",
        target:
          pitchTempC != null
            ? `${pitchTempC.toFixed(1)} °C / ${cToF(pitchTempC)} °F`
            : "—",
        actualSlot: true,
      },
    ],
    [
      { label: "Pitch Date", actualSlot: true },
      { label: "Count", actualSlot: true },
    ],
  ];

  // Starter info from the primary yeast (if configured)
  const primary = recipe.yeasts[0];
  const starter = primary?.starter;
  if (starter && (starter.packs > 0 || starter.steps.length > 0)) {
    const packsRow: MiniRow =
      starter.packs > 0
        ? {
            label: "Pack(s)",
            target: `${starter.packs} × ${formatYeastType(starter.yeastType)}`,
          }
        : { label: "Pack(s)", target: "—" };
    const mfgRow: MiniRow = starter.mfgDate
      ? { label: "Mfg Date", target: starter.mfgDate }
      : { label: "Mfg Date", actualSlot: true };
    rows.push([packsRow, mfgRow]);

    if (starter.yeastType === "slurry" && starter.slurryLiters != null) {
      rows.push({
        label: "Slurry",
        target: `${starter.slurryLiters.toFixed(2)} L${
          starter.slurryBillionPerMl != null
            ? ` @ ${starter.slurryBillionPerMl}B/mL`
            : ""
        }`,
      });
    }
    starter.steps.forEach((step, i) => {
      rows.push({
        label: `Starter ${i + 1}`,
        target: `${step.liters.toFixed(1)} L @ ${step.gravity.toFixed(3)}`,
        hint:
          step.model.kind === "white"
            ? `White / ${step.model.aeration}`
            : "Braukaiser",
      });
    });
  }

  return rows;
}

/* ─────────────────── hop flavor aggregate + mini radar ─────────────────── */

const HOP_FLAVOR_KEYS = [
  "citrus",
  "tropicalFruit",
  "stoneFruit",
  "berry",
  "floral",
  "grassy",
  "herbal",
  "spice",
  "resinPine",
] as const;

const HOP_FLAVOR_LABELS: Record<(typeof HOP_FLAVOR_KEYS)[number], string> = {
  citrus: "Citrus",
  tropicalFruit: "Tropical",
  stoneFruit: "Stone",
  berry: "Berry",
  floral: "Floral",
  grassy: "Grassy",
  herbal: "Herbal",
  spice: "Spice",
  resinPine: "Pine",
};

type HopFlavorVector = Record<(typeof HOP_FLAVOR_KEYS)[number], number>;

function computeAggregateHopFlavor(hops: Recipe["hops"]): HopFlavorVector | null {
  let totalGrams = 0;
  const sums: HopFlavorVector = {
    citrus: 0,
    tropicalFruit: 0,
    stoneFruit: 0,
    berry: 0,
    floral: 0,
    grassy: 0,
    herbal: 0,
    spice: 0,
    resinPine: 0,
  };
  let anyFlavored = false;
  for (const h of hops) {
    if (!h.flavor) continue;
    anyFlavored = true;
    const w = Math.max(0, h.grams);
    if (w === 0) continue;
    totalGrams += w;
    for (const k of HOP_FLAVOR_KEYS) {
      sums[k] += (h.flavor[k] ?? 0) * w;
    }
  }
  if (!anyFlavored || totalGrams === 0) return null;
  const out: HopFlavorVector = { ...sums };
  for (const k of HOP_FLAVOR_KEYS) {
    out[k] = sums[k] / totalGrams;
  }
  return out;
}

function HopFlavorMini({
  flavor,
  size = 180,
}: {
  flavor: HopFlavorVector;
  size?: number;
}) {
  const axes = HOP_FLAVOR_KEYS.length;
  const max = 5;
  const pad = 28;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  const dataPoints = HOP_FLAVOR_KEYS.map((k, i) => pointAt(i, flavor[k] ?? 0));
  const dataPolyPoints = dataPoints.map((p) => p.join(",")).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: size, display: "block", margin: "0 auto" }}
      aria-label="Estimated hop flavor profile"
    >
      {/* rings */}
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
      {/* axes */}
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
      {/* data polygon */}
      <polygon
        points={dataPolyPoints}
        fill={hsTokens.hops}
        fillOpacity={0.32}
        stroke={hsTokens.hops}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {/* data dots */}
      {dataPoints.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={1.8}
          fill={hsTokens.hops}
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
        />
      ))}
      {/* axis labels */}
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
        const lx = cx + (radius + 12) * Math.cos(angle);
        const ly = cy + (radius + 12) * Math.sin(angle);
        return (
          <text
            key={k}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily={hsTokens.body}
            fontSize={7}
            fontWeight={700}
            fill="var(--hs-muted)"
            style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {HOP_FLAVOR_LABELS[k]}
          </text>
        );
      })}
    </svg>
  );
}



