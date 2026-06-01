"use client";

/**
 * Water Section — HopSkip substrate
 *
 * Phase 2.7 migration of WaterSection into the HS substrate.
 *
 * Layout: substrate section frame + SectionTitle + 2-col grid.
 *   Left column blocks:
 *     1. Source → Target picker (HSPills)
 *     2. Salt additions (5 inline-editable salt cells + Auto-Calc + NaHCO₃ toggle)
 *     3. pH adjustments card
 *     4. Other ingredients ledger
 *   Right sidebar:
 *     - Ion Visualizer card (6 proximity-colored, draggable bars)
 *     - Brewer's notes card
 *
 * Reused services (no domain changes):
 *   - WaterChemistryService.calculateFinalProfileFromTotalSalts / splitSaltsProportionally
 *   - WaterSaltOptimizer.optimizeSaltAdditions (auto-calc)
 *   - MashPhCalculationService (via calculations.estimatedMashPh + mashPhAdjustment)
 *   - useRecipeStore (updateRecipe, addOtherIngredient, updateOtherIngredient, removeOtherIngredient)
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import HSActionMenu from "../HSActionMenu";

import SourceWaterPresetModal from "../modals/SourceWaterPresetModal";
import CustomSourceWaterModal from "../modals/CustomSourceWaterModal";
import TargetStylePresetModal from "../modals/TargetStylePresetModal";
import CustomTargetStyleModal from "../modals/CustomTargetStyleModal";
import WaterIngredientPickerModal from "../modals/WaterIngredientPickerModal";
import CustomWaterIngredientModal from "../modals/CustomWaterIngredientModal";

import type {
  OtherIngredient,
  OtherIngredientCategory,
  Recipe,
  RecipeCalculations,
} from "@/modules/beta-builder/domain/models/Recipe";
import {
  BEER_STYLE_TARGETS,
  COMMON_WATER_PROFILES,
  getWaterTargetForBjcpStyle,
  waterChemistryService,
  type SaltAdditions,
  type WaterProfile,
} from "@/modules/beta-builder/domain/services/WaterChemistryService";
import { optimizeSaltAdditions } from "@/modules/beta-builder/domain/services/WaterSaltOptimizer";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { useRecipeCalculations } from "@/modules/beta-builder/presentation/hooks/useRecipeCalculations";
// TODO: Re-enable premium gating once Stripe is live (mirrors classic)
// import { useUserTier } from "@/modules/auth/useUserTier";
// import { canAccess } from "@/modules/auth/tierAccess";
import UpgradeModal from "@/modules/auth/components/UpgradeModal";
import { uid } from "@/utils/uid";

// ─── Constants ────────────────────────────────────────────────────

const ION_KEYS: Array<keyof WaterProfile> = ["Ca", "Mg", "Na", "Cl", "SO4", "HCO3"];
const ION_DISPLAY: Record<keyof WaterProfile, string> = {
  Ca: "Ca",
  Mg: "Mg",
  Na: "Na",
  Cl: "Cl",
  SO4: "SO₄",
  HCO3: "HCO₃",
};

/**
 * Hard ceiling per ion — chosen to comfortably cover real brewing water
 * (Burton has Ca 275, SO₄ 470, HCO₃ 300) and the most extreme BJCP style
 * targets (West Coast IPA SO₄ 250) with reasonable headroom, while
 * preventing the bar from growing past values that have no brewing meaning.
 * The target can never be dragged past this; the domain ceiling never
 * exceeds it either.
 */
const ION_HARD_MAX: Record<keyof WaterProfile, number> = {
  Ca: 400,
  Mg: 100,
  Na: 300,
  Cl: 500,
  SO4: 600,
  HCO3: 500,
};

/**
 * The peak across an entire ion profile — used to size the SHARED domain for
 * all six bars so that same-value targets sit at the same visual position
 * across ions (a Cl target of 75 ppm and a Ca target of 75 ppm look identical).
 */
function globalIonPeak(
  source: WaterProfile,
  target: WaterProfile,
  final: WaterProfile
): number {
  let max = 0;
  for (const ion of ION_KEYS) {
    if (source[ion] > max) max = source[ion];
    if (target[ion] > max) max = target[ion];
    if (final[ion] > max) max = final[ion];
  }
  return max;
}

/**
 * Brewing-realistic hard ceiling for the SHARED visualizer scale. Picked at
 * 600 ppm — the highest of any single-ion hard cap (SO₄), so the scale can
 * accommodate a Burton source without clipping.
 */
const ION_SHARED_HARD_MAX = 600;

/**
 * Fully-rested shared domain ceiling, capped at the brewing-realistic max.
 * 25% headroom (min +10 ppm) keeps markers off the right wall.
 */
function restingDomain(peak: number): number {
  return Math.min(ION_SHARED_HARD_MAX, peak + Math.max(peak * 0.25, 10));
}

const SALT_ORDER: Array<keyof SaltAdditions> = [
  "gypsum_g",
  "cacl2_g",
  "epsom_g",
  "nacl_g",
  "nahco3_g",
];

const SALT_LABELS: Record<keyof SaltAdditions, string> = {
  gypsum_g: "GYPSUM",
  cacl2_g: "CACL₂",
  epsom_g: "EPSOM",
  nacl_g: "NACL",
  nahco3_g: "NAHCO₃",
};

const SALT_LONG_LABEL: Record<keyof SaltAdditions, string> = {
  gypsum_g: "Gypsum (CaSO₄)",
  cacl2_g: "Calcium chloride (CaCl₂)",
  epsom_g: "Epsom salt (MgSO₄)",
  nacl_g: "Table salt (NaCl)",
  nahco3_g: "Baking soda (NaHCO₃)",
};

const CATEGORY_LABELS: Record<OtherIngredientCategory, string> = {
  "water-agent": "Water Agent",
  fining: "Fining",
  spice: "Spice",
  flavor: "Flavor",
  herb: "Herb",
  other: "Other",
};

const CATEGORY_COLOR: Record<OtherIngredientCategory, string> = {
  "water-agent": hsTokens.water,
  fining: hsTokens.yeast,
  spice: hsTokens.honey,
  flavor: hsTokens.malt,
  herb: hsTokens.hops,
  other: hsTokens.muted,
};

const TIMINGS: OtherIngredient["timing"][] = [
  "mash",
  "boil",
  "whirlpool",
  "secondary",
  "kegging",
  "bottling",
];

const TIMING_LABELS: Record<OtherIngredient["timing"], string> = {
  mash: "Mash",
  boil: "Boil",
  whirlpool: "Whirlpool",
  secondary: "Secondary",
  kegging: "Kegging",
  bottling: "Bottling",
};

const UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "oz",
  "lb",
  "drops",
  "capsule",
  "tablet",
  "packet",
];

const DISCRETE_UNITS = new Set(["tablet", "packet", "capsule"]);

function getDefaultUnit(category: OtherIngredientCategory): string {
  switch (category) {
    case "water-agent":
      return "ml";
    case "fining":
      return "tablet";
    case "spice":
      return "g";
    case "flavor":
      return "g";
    case "herb":
      return "g";
    default:
      return "g";
  }
}

function getDefaultTiming(category: OtherIngredientCategory): OtherIngredient["timing"] {
  switch (category) {
    case "water-agent":
      return "mash";
    case "fining":
      return "boil";
    case "spice":
      return "boil";
    case "flavor":
      return "secondary";
    case "herb":
      return "boil";
    default:
      return "boil";
  }
}

// ─── Section frame + title ────────────────────────────────────────

const sectionFrameStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: 22,
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: "0 0 14px 14px",
  boxShadow: hsTokens.sh3,
  position: "relative",
};

function SectionTitle() {
  return (
    <header
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${hsTokens.water}`,
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
        Water.
      </h2>
    </header>
  );
}

// ─── Props ────────────────────────────────────────────────────────

interface Props {
  recipe: Recipe;
  calculations: RecipeCalculations | null;
}

// ─── Main section ─────────────────────────────────────────────────

export default function WaterSection({ recipe, calculations }: Props) {
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const addOtherIngredient = useRecipeStore((s) => s.addOtherIngredient);
  const updateOtherIngredient = useRecipeStore((s) => s.updateOtherIngredient);
  const removeOtherIngredient = useRecipeStore((s) => s.removeOtherIngredient);

  // TODO: Re-enable premium gating once Stripe is live (mirrors classic)
  // const { userState } = useUserTier();
  // const canAutoCalc = canAccess('auto_water_calc', userState);
  const canAutoCalc = true;

  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isCustomSourceModalOpen, setIsCustomSourceModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [isCustomTargetModalOpen, setIsCustomTargetModalOpen] = useState(false);
  const [isIngredientPickerOpen, setIsIngredientPickerOpen] = useState(false);
  const [isCustomIngredientModalOpen, setIsCustomIngredientModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [includeBakingSoda, setIncludeBakingSoda] = useState(false);

  const waterChem = useMemo(
    () =>
      recipe.waterChemistry ?? {
        sourceProfile: COMMON_WATER_PROFILES.RO,
        saltAdditions: {} as Partial<SaltAdditions>,
        sourceProfileName: "RO",
        targetStyleName: undefined as string | undefined,
        customTargetProfile: undefined as WaterProfile | undefined,
      },
    [recipe.waterChemistry]
  );

  const otherIngredients = useMemo(
    () => recipe.otherIngredients ?? [],
    [recipe.otherIngredients]
  );
  const isCustomTarget = !!waterChem.customTargetProfile;
  const bjcpKey = getWaterTargetForBjcpStyle(recipe.style || "");
  const bjcpTarget =
    BEER_STYLE_TARGETS[bjcpKey] ?? BEER_STYLE_TARGETS["Balanced"];

  // Resolve the effective target. Three states:
  //   1. Custom-profile target (user dragged an ion or edited via modal) — overrides everything
  //   2. Explicit BJCP pick — targetStyleName is set, customTargetProfile is unset → look up profile
  //   3. Auto-detect — both unset, fall back to BJCP auto-detection from recipe.style
  const explicitBjcpName =
    !waterChem.customTargetProfile && waterChem.targetStyleName
      ? waterChem.targetStyleName
      : null;
  const explicitBjcpTarget = explicitBjcpName
    ? BEER_STYLE_TARGETS[explicitBjcpName]
    : null;

  const effectiveTargetName = isCustomTarget
    ? (waterChem.targetStyleName ?? "Custom Target")
    : (explicitBjcpName ?? bjcpKey);
  const effectiveTargetProfile: WaterProfile = isCustomTarget && waterChem.customTargetProfile
    ? waterChem.customTargetProfile
    : explicitBjcpTarget
      ? explicitBjcpTarget.profile
      : bjcpTarget.profile;

  // Mash/sparge split for caption display under each salt cell
  const { mashSalts, spargeSalts } = useMemo(() => {
    if (!calculations) return { mashSalts: {}, spargeSalts: {} };
    return waterChemistryService.splitSaltsProportionally(
      waterChem.saltAdditions,
      calculations.mashWaterL,
      calculations.spargeWaterL
    );
  }, [waterChem.saltAdditions, calculations]);

  // ─── Handlers ──────────────────────────────────────────────────

  const handleSourceSelect = useCallback(
    (profile: WaterProfile, name: string) => {
      updateRecipe({
        waterChemistry: {
          ...waterChem,
          sourceProfile: profile,
          sourceProfileName: name,
        },
      });
    },
    [updateRecipe, waterChem]
  );

  const handleSwitchToBjcp = useCallback(() => {
    updateRecipe({
      waterChemistry: {
        ...waterChem,
        targetStyleName: undefined,
        customTargetProfile: undefined,
      },
    });
  }, [updateRecipe, waterChem]);

  const handleSelectBjcpStyle = useCallback(
    (styleName: string) => {
      // Pinning a BJCP target by name keeps the resolved profile stable across
      // recipe-style edits without flagging the target as "custom" (no badge).
      // The custom flag only flips when the user drags an ion or saves a
      // CustomTargetStyleModal — both paths set customTargetProfile.
      if (!BEER_STYLE_TARGETS[styleName]) return;
      updateRecipe({
        waterChemistry: {
          ...waterChem,
          targetStyleName: styleName,
          customTargetProfile: undefined,
        },
      });
    },
    [updateRecipe, waterChem]
  );

  const handleCustomTargetSave = useCallback(
    (profile: WaterProfile, name: string) => {
      updateRecipe({
        waterChemistry: {
          ...waterChem,
          targetStyleName: name,
          customTargetProfile: profile,
        },
      });
    },
    [updateRecipe, waterChem]
  );

  const handleSaltChange = useCallback(
    (saltKey: keyof SaltAdditions, value: number) => {
      updateRecipe({
        waterChemistry: {
          ...waterChem,
          saltAdditions: {
            ...waterChem.saltAdditions,
            [saltKey]: value > 0 ? value : undefined,
          },
        },
      });
    },
    [updateRecipe, waterChem]
  );

  const handleAutoCalculate = useCallback(() => {
    if (!canAutoCalc) {
      setIsUpgradeModalOpen(true);
      return;
    }
    if (!calculations) return;
    const totalWaterL = calculations.mashWaterL + calculations.spargeWaterL;
    if (totalWaterL <= 0) return;

    const { salts } = optimizeSaltAdditions(
      waterChem.sourceProfile,
      effectiveTargetProfile,
      totalWaterL,
      { includeBakingSoda }
    );

    updateRecipe({
      waterChemistry: {
        ...waterChem,
        saltAdditions: salts,
      },
    });
  }, [
    canAutoCalc,
    calculations,
    effectiveTargetProfile,
    includeBakingSoda,
    updateRecipe,
    waterChem,
  ]);

  const handleAddIngredient = useCallback(
    (name: string, category: OtherIngredientCategory) => {
      addOtherIngredient({
        id: uid(),
        name,
        category,
        amount: 1,
        unit: getDefaultUnit(category),
        timing: getDefaultTiming(category),
      });
    },
    [addOtherIngredient]
  );

  /** Lactic acid stays an additional water-agent ingredient (it's not a salt). */
  const handleAddLacticAcid = useCallback(
    (ml: number) => {
      const name = "Lactic acid (88%)";
      const existing = otherIngredients.find(
        (ing) =>
          ing.name.toLowerCase() === name.toLowerCase() && ing.timing === "mash"
      );
      if (existing) {
        updateOtherIngredient(existing.id, { amount: ml });
      } else {
        addOtherIngredient({
          id: uid(),
          name,
          category: "water-agent",
          amount: ml,
          unit: "ml",
          timing: "mash",
        });
      }
    },
    [addOtherIngredient, otherIngredients, updateOtherIngredient]
  );

  /** Baking soda IS NaHCO₃ — route it to the NaHCO₃ salt addition cell
      rather than creating a separate "Baking soda" ingredient. The pH
      adjustment value gets ADDED to whatever the user already has there;
      subsequent clicks of the CTA will reflect the now-improved pH. */
  const handleAddBakingSoda = useCallback(
    (grams: number) => {
      const current = waterChem.saltAdditions.nahco3_g ?? 0;
      const next = parseFloat((current + grams).toFixed(2));
      updateRecipe({
        waterChemistry: {
          ...waterChem,
          saltAdditions: {
            ...waterChem.saltAdditions,
            nahco3_g: next > 0 ? next : undefined,
          },
        },
      });
    },
    [updateRecipe, waterChem]
  );

  // ─── Render ────────────────────────────────────────────────────

  return (
    <section className="hs-water-section" style={sectionFrameStyle}>
      <WaterSectionStyles />
      <SectionTitle />

      <div className="hs-water-grid">
        {/* Row 1: water plan header — left column only, stops at the column
            boundary so its hairline + AutoCalc don't extend over the aside. */}
        <div className="hs-water-grid-plan">
          <WaterPlanHeaderRow
            sourceName={waterChem.sourceProfileName ?? "Custom"}
            targetName={effectiveTargetName}
            isCustomTarget={isCustomTarget}
            onOpenSourceModal={() => setIsSourceModalOpen(true)}
            onOpenTargetModal={() => setIsTargetModalOpen(true)}
            onAutoCalculate={handleAutoCalculate}
            canAutoCalc={canAutoCalc}
            includeBakingSoda={includeBakingSoda}
            onToggleBakingSoda={setIncludeBakingSoda}
          />
        </div>

        {/* Row 2 left: salts + pH + other — flex column owns its own gap. */}
        <div className="hs-water-grid-main">
          <SaltAdditionsRow
            saltAdditions={waterChem.saltAdditions}
            mashSalts={mashSalts}
            spargeSalts={spargeSalts}
            onSaltChange={handleSaltChange}
          />
          <PhAdjustmentsBlock
            calculations={calculations}
            onAddLacticAcid={handleAddLacticAcid}
            onAddBakingSoda={handleAddBakingSoda}
          />
          <OtherIngredientsBlock
            ingredients={otherIngredients}
            onOpenPicker={() => setIsIngredientPickerOpen(true)}
            onUpdate={updateOtherIngredient}
            onRemove={removeOtherIngredient}
          />
        </div>

      </div>

      {/* Modals */}
      <SourceWaterPresetModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onSelect={handleSourceSelect}
        onCreateCustom={() => setIsCustomSourceModalOpen(true)}
        currentName={waterChem.sourceProfileName}
      />
      <CustomSourceWaterModal
        isOpen={isCustomSourceModalOpen}
        onClose={() => setIsCustomSourceModalOpen(false)}
        onSave={handleSourceSelect}
        initialProfile={waterChem.sourceProfile}
        initialName={
          waterChem.sourceProfileName &&
          !COMMON_WATER_PROFILES[waterChem.sourceProfileName]
            ? waterChem.sourceProfileName
            : "Custom"
        }
      />
      <TargetStylePresetModal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        onSelect={handleSelectBjcpStyle}
        onCreateCustom={() => setIsCustomTargetModalOpen(true)}
        bjcpAutoDetectName={isCustomTarget ? bjcpKey : undefined}
        onUseAutoDetect={handleSwitchToBjcp}
        currentName={!isCustomTarget ? bjcpKey : waterChem.targetStyleName}
      />
      <CustomTargetStyleModal
        isOpen={isCustomTargetModalOpen}
        onClose={() => setIsCustomTargetModalOpen(false)}
        onSave={handleCustomTargetSave}
        initialProfile={waterChem.customTargetProfile}
        initialName={isCustomTarget ? waterChem.targetStyleName : undefined}
      />
      <WaterIngredientPickerModal
        isOpen={isIngredientPickerOpen}
        onClose={() => setIsIngredientPickerOpen(false)}
        onSelect={handleAddIngredient}
        onCreateCustom={() => setIsCustomIngredientModalOpen(true)}
      />
      <CustomWaterIngredientModal
        isOpen={isCustomIngredientModalOpen}
        onClose={() => setIsCustomIngredientModalOpen(false)}
        onAdd={handleAddIngredient}
      />
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        reason="Auto water salt calculation is a Premium feature. Upgrade to automatically optimize your salt additions to match any target water profile."
      />
    </section>
  );
}

// ─── Water plan header row (eyebrow left, controls right) ─────────

function WaterPlanHeaderRow({
  sourceName,
  targetName,
  isCustomTarget,
  onOpenSourceModal,
  onOpenTargetModal,
  onAutoCalculate,
  canAutoCalc,
  includeBakingSoda,
  onToggleBakingSoda,
}: {
  sourceName: string;
  targetName: string;
  isCustomTarget: boolean;
  onOpenSourceModal: () => void;
  onOpenTargetModal: () => void;
  onAutoCalculate: () => void;
  canAutoCalc: boolean;
  includeBakingSoda: boolean;
  onToggleBakingSoda: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <Eyebrow size={11}>The water plan</Eyebrow>
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
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <SourcePill name={sourceName} onClick={onOpenSourceModal} />
        <span aria-hidden style={{ fontFamily: hsTokens.body, fontSize: 16, color: hsTokens.muted, lineHeight: 1 }}>
          →
        </span>
        <TargetPill name={targetName} isCustom={isCustomTarget} onClick={onOpenTargetModal} />
      </div>
      <span
        aria-hidden
        style={{
          width: 1,
          alignSelf: "stretch",
          background: hsTokens.ink,
          opacity: 0.22,
          marginLeft: 4,
          marginRight: 4,
        }}
      />
      <AutoCalcCompoundButton
        onAutoCalculate={onAutoCalculate}
        canAutoCalc={canAutoCalc}
        includeBakingSoda={includeBakingSoda}
        onToggleBakingSoda={onToggleBakingSoda}
      />
    </div>
  );
}

/**
 * Compound auto-calc button: the right half ("Auto-Calc") fires the optimizer,
 * the left half is an embedded NaHCO₃ checkbox that controls whether baking
 * soda is included in the solve. Single visual pill, two distinct actions.
 */
function AutoCalcCompoundButton({
  onAutoCalculate,
  canAutoCalc,
  includeBakingSoda,
  onToggleBakingSoda,
}: {
  onAutoCalculate: () => void;
  canAutoCalc: boolean;
  includeBakingSoda: boolean;
  onToggleBakingSoda: (v: boolean) => void;
}) {
  const dividerColor = `color-mix(in srgb, ${hsTokens.cream} 35%, transparent)`;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        background: hsTokens.ink,
        color: hsTokens.cream,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        boxShadow: hsTokens.sh1,
        overflow: "hidden",
        opacity: canAutoCalc ? 1 : 0.6,
      }}
    >
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 9px 5px 10px",
          cursor: "pointer",
          userSelect: "none",
          borderRight: `1.5px solid ${dividerColor}`,
        }}
        title="Include baking soda (NaHCO₃) when auto-calculating salts"
      >
        <input
          type="checkbox"
          checked={includeBakingSoda}
          onChange={(e) => onToggleBakingSoda(e.target.checked)}
          aria-label="Include baking soda (NaHCO₃)"
          style={{
            accentColor: hsTokens.water,
            width: 11,
            height: 11,
            margin: 0,
            cursor: "pointer",
          }}
        />
        NaHCO₃
      </label>
      <button
        type="button"
        onClick={onAutoCalculate}
        aria-label="Auto-calculate optimal salt additions"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 11px",
          background: "transparent",
          border: "none",
          color: "inherit",
          fontFamily: "inherit",
          fontWeight: "inherit",
          fontSize: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          cursor: "pointer",
        }}
      >
        {!canAutoCalc ? <LockGlyph /> : null}
        Auto-Calc
      </button>
    </span>
  );
}

function SourcePill({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hs-water-source-pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        background: hsTokens.cream2,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        color: hsTokens.ink,
        cursor: "pointer",
        boxShadow: hsTokens.sh1,
        transition: "background 90ms ease",
      }}
    >
      <DropletGlyph color={hsTokens.water} />
      {name}
    </button>
  );
}

function TargetPill({
  name,
  isCustom,
  onClick,
}: {
  name: string;
  isCustom: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hs-water-target-pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 11px",
        background: hsTokens.water,
        color: hsTokens.cream,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        cursor: "pointer",
        boxShadow: hsTokens.sh1,
        transition: "background 90ms ease",
      }}
    >
      <TargetGlyph />
      {name}
      {isCustom ? (
        <span
          aria-hidden
          style={{
            fontFamily: hsTokens.body,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: hsTokens.cream,
            color: hsTokens.water,
            padding: "1px 6px",
            borderRadius: 6,
          }}
        >
          custom
        </span>
      ) : null}
    </button>
  );
}

function DropletGlyph({ color = hsTokens.water }: { color?: string }) {
  return (
    <svg
      width="12"
      height="14"
      viewBox="0 0 24 24"
      fill={color}
      stroke={hsTokens.ink}
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M12 2.5c-3 4.2-7 8-7 12.2a7 7 0 0 0 14 0c0-4.2-4-8-7-12.2z" />
    </svg>
  );
}

function TargetGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

// ─── Salt additions row (no header — just the cells) ──────────────

function SaltAdditionsRow({
  saltAdditions,
  mashSalts,
  spargeSalts,
  onSaltChange,
}: {
  saltAdditions: Partial<SaltAdditions>;
  mashSalts: Partial<SaltAdditions>;
  spargeSalts: Partial<SaltAdditions>;
  onSaltChange: (k: keyof SaltAdditions, v: number) => void;
}) {
  return (
    <div className="hs-water-salt-row">
      {SALT_ORDER.map((saltKey) => (
        <SaltCell
          key={saltKey}
          label={SALT_LABELS[saltKey]}
          longLabel={SALT_LONG_LABEL[saltKey]}
          totalAmount={saltAdditions[saltKey] || 0}
          mashAmount={mashSalts[saltKey] || 0}
          spargeAmount={spargeSalts[saltKey] || 0}
          onChange={(v) => onSaltChange(saltKey, v)}
        />
      ))}
    </div>
  );
}

function SaltCell({
  label,
  longLabel,
  totalAmount,
  mashAmount,
  spargeAmount,
  onChange,
}: {
  label: string;
  longLabel: string;
  totalAmount: number;
  mashAmount: number;
  spargeAmount: number;
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(totalAmount || ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      const parsed = parseFloat(trimmed);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed !== totalAmount) {
        onChange(Math.max(0, parseFloat(parsed.toFixed(1))));
      }
    } else if (totalAmount !== 0) {
      onChange(0);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(totalAmount || ""));
    setEditing(false);
  };

  const nudge = (dir: 1 | -1) => {
    const next = Math.max(0, parseFloat((totalAmount + dir * 0.1).toFixed(1)));
    if (next !== totalAmount) onChange(next);
  };

  const hasValue = totalAmount > 0;
  const hasSplit = hasValue && (mashAmount > 0 || spargeAmount > 0);

  return (
    <div
      className="hs-water-salt-cell"
      style={{
        flex: 1,
        minWidth: 96,
        position: "relative",
        // HSStatCard-style frame per design system §05.4: 2px ink border,
        // hard offset shadow (sh1 — chips/dense rows), 12px radius, paper bg,
        // 4px water-blue accent strip at the top. All five salt cells share
        // the same water accent because they're all water-chemistry adjusters.
        // No-value cells fade back so the cards with actual additions stand
        // out as the active ones.
        padding: "10px 10px 9px",
        paddingTop: 14,
        background: hasValue ? hsTokens.paper : hsTokens.cream2,
        border: hasValue
          ? `2px solid ${hsTokens.ink}`
          : `2px solid color-mix(in srgb, ${hsTokens.ink} 35%, transparent)`,
        borderRadius: 12,
        boxShadow: hasValue ? hsTokens.sh1 : "none",
        textAlign: "center",
        cursor: editing ? "text" : "pointer",
        overflow: "hidden",
        opacity: hasValue ? 1 : 0.7,
      }}
      title={longLabel}
    >
      {/* Accent strip — top edge, water-blue (these are water-chem additions) */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: hsTokens.water,
          opacity: hasValue ? 1 : 0.18,
        }}
      />
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      {/* [−] [number/input] [+]  — horizontal flank, always visible.
          Matches the classic SaltAdditionsPanel's starter-stepper pattern. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <SaltStepperBtn
          onClick={() => nudge(-1)}
          glyph="minus"
          label={`Decrease ${longLabel}`}
          disabled={totalAmount <= 0}
        />
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              else if (e.key === "Escape") cancel();
            }}
            step={0.1}
            min={0}
            aria-label={`${longLabel} grams`}
            style={{
              flex: 1,
              minWidth: 0,
              background: hsTokens.cream,
              border: `1.5px solid ${hsTokens.water}`,
              borderRadius: 6,
              fontFamily: hsTokens.display,
              fontSize: 18,
              color: hsTokens.ink,
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
              outline: "none",
              padding: "1px 4px",
              appearance: "textfield",
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(totalAmount || ""));
              setEditing(true);
            }}
            aria-label={`Edit ${longLabel} (${totalAmount.toFixed(1)} grams)`}
            style={{
              flex: 1,
              minWidth: 0,
              display: "inline-flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: 2,
              background: "transparent",
              border: "none",
              borderBottom: hasValue
                ? `1.5px dotted ${hsTokens.ink}55`
                : `1.5px dotted ${hsTokens.ink}22`,
              padding: "0 2px",
              cursor: "text",
              color: hasValue ? hsTokens.ink : hsTokens.muted,
              fontFamily: hsTokens.display,
              fontSize: 18,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}
          >
            <span>{hasValue ? totalAmount.toFixed(1) : "—"}</span>
            <span
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 400,
                fontSize: 10,
                color: hsTokens.muted,
              }}
            >
              g
            </span>
          </button>
        )}
        <SaltStepperBtn
          onClick={() => nudge(1)}
          glyph="plus"
          label={`Increase ${longLabel}`}
        />
      </div>
      {hasSplit ? (
        <div
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 9,
            color: hsTokens.muted,
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1.2,
          }}
        >
          mash {mashAmount.toFixed(1)} · sparge {spargeAmount.toFixed(1)}
        </div>
      ) : null}
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
      className="hs-water-steppers"
      aria-hidden={!visible}
      style={{
        position: "absolute",
        right: 4,
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
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
        height: 12,
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
        e.currentTarget.style.background = hsTokens.water;
        e.currentTarget.style.color = hsTokens.cream;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.muted;
      }}
    >
      <svg
        width="8"
        height="5"
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

/**
 * Larger stepper button used by the salt cells. Renders a literal − / +
 * glyph (vs. the chevron used by HoverSteppers), supports a disabled state,
 * and flanks the salt-amount input horizontally — classic SaltAdditionsPanel
 * "starter-stepper" pattern.
 */
function SaltStepperBtn({
  onClick,
  glyph,
  label,
  disabled,
}: {
  onClick: () => void;
  glyph: "minus" | "plus";
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      disabled={disabled}
      style={{
        width: 22,
        height: 22,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? `${hsTokens.muted}` : hsTokens.ink,
        opacity: disabled ? 0.35 : 1,
        padding: 0,
        lineHeight: 1,
        fontFamily: hsTokens.body,
        fontSize: 16,
        fontWeight: 700,
        userSelect: "none",
        transition: "background 90ms ease, color 90ms ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = hsTokens.water;
        e.currentTarget.style.color = hsTokens.cream;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.ink;
      }}
    >
      {glyph === "minus" ? "−" : "+"}
    </button>
  );
}

function LockGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 7H6V5a2 2 0 1 1 4 0v3z" />
    </svg>
  );
}

// ─── pH adjustments block ─────────────────────────────────────────

function PhAdjustmentsBlock({
  calculations,
  onAddLacticAcid,
  onAddBakingSoda,
}: {
  calculations: RecipeCalculations | null;
  onAddLacticAcid: (ml: number) => void;
  onAddBakingSoda: (grams: number) => void;
}) {
  const ph = calculations?.estimatedMashPh ?? null;
  const adj = calculations?.mashPhAdjustment ?? null;

  if (ph == null) {
    return (
      <div
        style={{
          padding: "14px 16px",
          background: `color-mix(in srgb, ${hsTokens.cream} 50%, ${hsTokens.cream2})`,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 12,
          boxShadow: hsTokens.sh2,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Eyebrow size={11}>Mash pH</Eyebrow>
        <span style={{ fontFamily: hsTokens.body, fontSize: 12, color: hsTokens.muted }}>
          Add fermentables to estimate.
        </span>
      </div>
    );
  }

  const displayed = Math.round(ph * 100) / 100;
  const inIdeal = displayed >= 5.2 && displayed <= 5.4;
  const inRange = displayed >= 5.2 && displayed <= 5.6;
  const statusColor = inIdeal
    ? hsTokens.hops
    : inRange
      ? hsTokens.honey
      : hsTokens.roast;
  const statusBg = inIdeal
    ? `color-mix(in srgb, ${hsTokens.hops} 14%, ${hsTokens.cream2})`
    : inRange
      ? `color-mix(in srgb, ${hsTokens.honey} 22%, ${hsTokens.cream2})`
      : `color-mix(in srgb, ${hsTokens.roast} 12%, ${hsTokens.cream2})`;

  const needsLactic = adj != null && adj.lacticAcid88Ml > 0;
  const needsBaking = adj != null && adj.bakingSodaG > 0;
  const needsAdjustment = needsLactic || needsBaking;

  const handleClick = () => {
    if (!adj) return;
    if (needsLactic) {
      onAddLacticAcid(adj.lacticAcid88Ml);
    } else if (needsBaking) {
      onAddBakingSoda(adj.bakingSodaG);
    }
  };

  const ctaText = needsLactic
    ? `+ ${adj!.lacticAcid88Ml} mL lactic acid (88%)`
    : needsBaking
      ? `+ ${adj!.bakingSodaG} g baking soda`
      : null;

  const Tag = needsAdjustment ? "button" : "div";

  return (
    <Tag
      type={needsAdjustment ? "button" : undefined}
      onClick={needsAdjustment ? handleClick : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        background: statusBg,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh2,
        cursor: needsAdjustment ? "pointer" : "default",
        textAlign: "left",
        width: "100%",
        fontFamily: hsTokens.body,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
        <Eyebrow size={10}>Mash pH</Eyebrow>
        <span style={{ fontFamily: hsTokens.body, fontSize: 9, color: hsTokens.muted, letterSpacing: "0.04em" }}>
          target 5.2–5.4
        </span>
      </div>
      <div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 30,
          color: statusColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.025em",
          lineHeight: 1,
        }}
      >
        {ph.toFixed(2)}
      </div>
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
      {ctaText ? (
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 700,
            color: statusColor,
            letterSpacing: "0.02em",
            textAlign: "right",
          }}
        >
          click to add
          <br />
          <span style={{ color: hsTokens.ink, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {ctaText}
          </span>
        </span>
      ) : (
        <span style={{ fontFamily: hsTokens.body, fontSize: 11, color: hsTokens.muted, fontWeight: 600 }}>
          {inIdeal ? "ideal." : inRange ? "in range." : "—"}
        </span>
      )}
    </Tag>
  );
}

// ─── Other ingredients block ──────────────────────────────────────

function OtherIngredientsBlock({
  ingredients,
  onOpenPicker,
  onUpdate,
  onRemove,
}: {
  ingredients: OtherIngredient[];
  onOpenPicker: () => void;
  onUpdate: (id: string, updates: Partial<OtherIngredient>) => void;
  onRemove: (id: string) => void;
}) {
  const count = ingredients.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        className="hs-water-other-head"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Eyebrow size={11}>Additional items</Eyebrow>
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
          {count} entr{count === 1 ? "y" : "ies"}
        </HSScriptNote>
        <HSButton onClick={onOpenPicker} color={hsTokens.water} size="sm">
          + Add
        </HSButton>
      </div>

      {count === 0 ? (
        <EmptyOtherIngredients onAdd={onOpenPicker} />
      ) : (
        <div
          className="hs-water-other-ledger"
          style={{
            background: hsTokens.paper,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 14,
            boxShadow: hsTokens.sh3,
            overflow: "hidden",
          }}
        >
          {ingredients.map((ing, idx) => (
            <OtherIngredientRow
              key={ing.id}
              ingredient={ing}
              isLast={idx === ingredients.length - 1}
              onUpdate={(updates) => onUpdate(ing.id, updates)}
              onRemove={() => onRemove(ing.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyOtherIngredients({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "26px 16px",
        background: hsTokens.cream2,
        backgroundImage: dashedBorderBg(hsTokens.ink, {
          dash: 10,
          gap: 7,
          strokeWidth: 1.5,
          radius: 14,
        }),
        backgroundRepeat: "no-repeat",
        border: "none",
        borderRadius: 14,
        textAlign: "center",
      }}
    >
      <HSScriptNote color={hsTokens.water} size={18} rotate={-3}>
        additional items —
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 13,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 360,
          lineHeight: 1.4,
        }}
      >
        Finings, spices, water agents, oak — anything beyond grain, hops, yeast, and salts.
      </p>
      <HSButton onClick={onAdd} color={hsTokens.water} size="sm">
        + Add an ingredient
      </HSButton>
    </div>
  );
}

function OtherIngredientRow({
  ingredient,
  isLast,
  onUpdate,
  onRemove,
}: {
  ingredient: OtherIngredient;
  isLast: boolean;
  onUpdate: (updates: Partial<OtherIngredient>) => void;
  onRemove: () => void;
}) {
  const dotColor = CATEGORY_COLOR[ingredient.category] ?? hsTokens.muted;
  const isDiscrete = DISCRETE_UNITS.has(ingredient.unit);

  return (
    <div
      className="hs-water-other-row"
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto auto auto auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderBottom: isLast ? "none" : `1px solid ${hsTokens.ink}22`,
        background: "transparent",
        transition: "background 90ms ease",
      }}
    >
      <CategoryBadge category={ingredient.category} color={dotColor} />
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 14,
          fontWeight: 600,
          color: hsTokens.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={ingredient.name}
      >
        {ingredient.name}
      </span>
      <TimingPicker
        timing={ingredient.timing}
        onChange={(t) => onUpdate({ timing: t })}
      />
      <NumericCell
        value={ingredient.amount}
        onChange={(v) => onUpdate({ amount: isDiscrete ? Math.round(v) : v })}
        step={isDiscrete ? 1 : 0.1}
        precision={isDiscrete ? 0 : 1}
        ariaLabel={`${ingredient.name} amount`}
      />
      <UnitPicker
        unit={ingredient.unit}
        onChange={(unit) => {
          const becameDiscrete = DISCRETE_UNITS.has(unit);
          onUpdate({
            unit,
            amount: becameDiscrete
              ? Math.round(ingredient.amount || 0)
              : ingredient.amount,
          });
        }}
      />
      <IconBtn
        onClick={onRemove}
        ariaLabel={`Remove ${ingredient.name}`}
        danger
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </IconBtn>
    </div>
  );
}

function CategoryBadge({
  category,
  color,
}: {
  category: OtherIngredientCategory;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        background: `color-mix(in srgb, ${color} 22%, ${hsTokens.cream2})`,
        border: `1px solid ${color}`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          flexShrink: 0,
        }}
      />
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function TimingPicker({
  timing,
  onChange,
}: {
  timing: OtherIngredient["timing"];
  onChange: (t: OtherIngredient["timing"]) => void;
}) {
  const items = TIMINGS.map((t) => ({
    label: TIMING_LABELS[t],
    onClick: () => onChange(t),
  }));

  return (
    <HSActionMenu
      align="right"
      triggerStyle={{
        width: "auto",
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        background: hsTokens.cream2,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: hsTokens.ink,
      }}
      triggerAriaLabel={`Change timing (current: ${TIMING_LABELS[timing]})`}
      trigger={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {TIMING_LABELS[timing]}
          <svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M1 1 4.5 5 8 1" />
          </svg>
        </span>
      }
      items={items}
    />
  );
}

function UnitPicker({
  unit,
  onChange,
}: {
  unit: string;
  onChange: (u: string) => void;
}) {
  const items = UNITS.map((u) => ({
    label: u,
    onClick: () => onChange(u),
  }));
  return (
    <HSActionMenu
      align="right"
      triggerStyle={{
        width: "auto",
        height: 26,
        padding: "0 10px",
        borderRadius: 999,
        background: hsTokens.cream2,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        color: hsTokens.ink,
      }}
      triggerAriaLabel={`Change unit (current: ${unit})`}
      trigger={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {unit}
          <svg width="9" height="6" viewBox="0 0 9 6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path d="M1 1 4.5 5 8 1" />
          </svg>
        </span>
      }
      items={items}
    />
  );
}

function NumericCell({
  value,
  onChange,
  step,
  precision,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  precision: number;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [draft, setDraft] = useState(String(value || ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      const parsed = parseFloat(trimmed);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed !== value) {
        onChange(parseFloat(parsed.toFixed(precision)));
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value || ""));
    setEditing(false);
  };

  const nudge = (dir: 1 | -1) => {
    const next = Math.max(0, parseFloat((value + dir * step).toFixed(precision)));
    if (next !== value) onChange(next);
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "baseline",
        minWidth: 56,
        justifyContent: "flex-end",
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          step={step}
          min={0}
          aria-label={ariaLabel}
          style={{
            width: 64,
            background: hsTokens.cream,
            border: `1.5px solid ${hsTokens.water}`,
            borderRadius: 6,
            fontFamily: hsTokens.script,
            fontSize: 22,
            color: hsTokens.ink,
            textAlign: "right",
            outline: "none",
            padding: "1px 24px 1px 6px",
            appearance: "textfield",
            fontVariantNumeric: "tabular-nums",
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(value || ""));
            setEditing(true);
          }}
          aria-label={`Edit ${ariaLabel}`}
          style={{
            background: "transparent",
            border: "none",
            borderBottom: `1.5px dotted ${hsTokens.ink}55`,
            padding: "1px 24px 1px 4px",
            cursor: "text",
            fontFamily: hsTokens.script,
            fontSize: 22,
            color: hsTokens.ink,
            lineHeight: 1.05,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value > 0 ? value.toFixed(precision).replace(/\.0$/, "") : "—"}
        </button>
      )}
      <HoverSteppers
        visible={hovered && !editing}
        onUp={() => nudge(1)}
        onDown={() => nudge(-1)}
      />
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  ariaLabel,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
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

// ─── Ion visualizer (right sidebar) ───────────────────────────────

function IonVisualizerCard({
  sourceProfile,
  targetProfile,
  finalProfile,
  clToSo4Display,
  clToSo4Color,
  onTargetDrag,
}: {
  sourceProfile: WaterProfile;
  targetProfile: WaterProfile;
  bjcpTargetProfile: WaterProfile;
  isCustomTarget: boolean;
  finalProfile: WaterProfile;
  clToSo4Display: string;
  clToSo4Color: string;
  onTargetDrag: (ion: keyof WaterProfile, value: number) => void;
}) {
  // Shared domain across all six bars — the cross-ion comparison reference
  // the user wants. Same-value targets land at the same visual position in
  // every bar. Debounced with the same grow-on-edge / shrink-on-slack logic
  // as before, but operating on the GLOBAL peak across all ions.
  const peak = globalIonPeak(sourceProfile, targetProfile, finalProfile);
  const [sharedDomain, setSharedDomain] = useState(() => restingDomain(peak));
  const [draggingIons, setDraggingIons] = useState(0);
  const draggingRef = useRef(0);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = useCallback(() => {
    draggingRef.current += 1;
    setDraggingIons((n) => n + 1);
  }, []);
  const handleDragEnd = useCallback(() => {
    draggingRef.current = Math.max(0, draggingRef.current - 1);
    setDraggingIons((n) => Math.max(0, n - 1));
  }, []);

  useEffect(() => {
    const ratio = sharedDomain > 0 ? peak / sharedDomain : 1;
    if (ratio > ION_GROW_THRESHOLD && sharedDomain < ION_SHARED_HARD_MAX) {
      // A marker is at the right edge — grow immediately.
      if (shrinkTimer.current) {
        clearTimeout(shrinkTimer.current);
        shrinkTimer.current = null;
      }
      setSharedDomain(restingDomain(peak));
    } else if (ratio < ION_SHRINK_THRESHOLD) {
      // Plenty of slack — schedule a shrink. Pauses while ANY bar is being
      // dragged. `draggingIons` is in the deps so the effect re-runs when a
      // drag ends, scheduling the post-drag settle.
      if (draggingIons > 0) return;
      if (shrinkTimer.current) clearTimeout(shrinkTimer.current);
      shrinkTimer.current = setTimeout(() => {
        shrinkTimer.current = null;
        if (draggingRef.current > 0) return;
        setSharedDomain(restingDomain(peak));
      }, ION_DOMAIN_SHRINK_DELAY);
    } else if (shrinkTimer.current) {
      clearTimeout(shrinkTimer.current);
      shrinkTimer.current = null;
    }
  }, [peak, sharedDomain, draggingIons]);

  return (
    <div
      className="hs-water-ions-card"
      style={{
        // Subtle ingredient tint: ~5% water-blue in the bg AND ~15%
        // water-blue mixed into the ink border. Compound signal — neither
        // dimension is loud on its own.
        background:
          "color-mix(in srgb, color-mix(in srgb, var(--hs-cream), var(--hs-cream-2)) 95%, var(--hs-water))",
        border: `2px solid color-mix(in srgb, ${hsTokens.ink} 85%, var(--hs-water))`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: `1px solid ${hsTokens.ink}22`,
          paddingBottom: 8,
        }}
      >
        <Eyebrow size={11}>Ion profile</Eyebrow>
        <span
          aria-hidden
          style={{
            flex: 1,
            minWidth: 8,
            height: 1,
            background: hsTokens.ink,
            opacity: 0.18,
          }}
        />
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 10,
            color: clToSo4Color,
            fontWeight: 700,
            letterSpacing: "0.02em",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
          title={`Chloride-to-sulfate ratio: ${clToSo4Display}`}
        >
          {clToSo4Display}
        </span>
      </div>

      {/* Mini legend — clarifies the three markers (HS-script style) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "0 2px",
        }}
      >
        <LegendChip>
          <SourceRingGlyph />
          <span>source</span>
        </LegendChip>
        <LegendChip>
          <span
            aria-hidden
            style={{
              width: 16,
              height: 8,
              background: hsTokens.hops,
              border: `1px solid ${hsTokens.ink}`,
              borderRadius: 999,
              display: "inline-block",
              opacity: 0.7,
            }}
          />
          <span>current</span>
        </LegendChip>
        <LegendChip>
          <span
            aria-hidden
            style={{
              width: 3,
              height: 12,
              background: hsTokens.ink,
              borderRadius: 1,
              display: "inline-block",
            }}
          />
          <span>target (drag)</span>
        </LegendChip>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {ION_KEYS.map((ion) => (
          <IonRangeStrip
            key={ion}
            ion={ion}
            label={ION_DISPLAY[ion]}
            source={sourceProfile[ion]}
            target={targetProfile[ion]}
            final={finalProfile[ion]}
            domainMax={sharedDomain}
            onTargetDrag={onTargetDrag}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Final profile readout — 3×2 grid of compact datum cells */}
      <FinalProfileReadout finalProfile={finalProfile} targetProfile={targetProfile} />
    </div>
  );
}

function LegendChip({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: hsTokens.body,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: hsTokens.muted,
      }}
    >
      {children}
    </span>
  );
}

function SourceRingGlyph() {
  return (
    <span
      aria-hidden
      style={{
        width: 9,
        height: 9,
        borderRadius: 999,
        background: "transparent",
        border: `1.5px solid ${hsTokens.ink}`,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Discrete proximity status — drives both the bar fill color and the
 * numeric readouts in the visualizer.
 */
function proximityStatus(final: number, target: number): "ideal" | "low" | "high" | "neutral" {
  if (target <= 0) return "neutral";
  const ratio = final / target;
  if (ratio >= 0.9 && ratio <= 1.1) return "ideal";
  return ratio < 0.9 ? "low" : "high";
}

/**
 * Map proximity status to the HopSkip palette. Stays inside the design
 * system rather than synthesizing arbitrary mid-hues — keeps the chart
 * readable and consistent with the rest of HS.
 */
function proximityColor(status: ReturnType<typeof proximityStatus>): string {
  switch (status) {
    case "ideal": return hsTokens.hops;
    case "low":   return hsTokens.water;
    case "high":  return hsTokens.roast;
    default:      return hsTokens.muted;
  }
}

const ION_DOMAIN_SHRINK_DELAY = 1200;
/** Grow when peak/domain exceeds this fraction (marker near right edge). */
const ION_GROW_THRESHOLD = 0.95;
/** Shrink only when peak/domain is below this — i.e., domain is much too big. */
const ION_SHRINK_THRESHOLD = 0.5;

/**
 * Visual gamma for ion bar positions. Mapping value → position uses
 * `(value / domain) ^ ION_VISUAL_GAMMA`, so smaller values get amplified
 * (the low end of the scale stretches) while larger values compress
 * smoothly toward the right edge. A gamma of 0.6 makes a 75 ppm marker
 * visibly different from a 200 ppm marker without making a 15 ppm marker
 * invisible. Set to 1.0 for a strictly-linear scale.
 */
const ION_VISUAL_GAMMA = 0.6;

/** Map a value (0..domainMax) to a fraction of the bar (0..1) using gamma. */
function gammaPct(value: number, domainMax: number): number {
  if (domainMax <= 0 || value <= 0) return 0;
  const ratio = Math.min(1, value / domainMax);
  return Math.pow(ratio, ION_VISUAL_GAMMA);
}

/** Inverse of `gammaPct` — convert a bar fraction (0..1) back to a ppm value. */
function invGammaPpm(pct: number, domainMax: number): number {
  const clamped = Math.max(0, Math.min(1, pct));
  return Math.pow(clamped, 1 / ION_VISUAL_GAMMA) * domainMax;
}

function IonRangeStrip({
  ion,
  label,
  source,
  target,
  final,
  domainMax,
  onTargetDrag,
  onDragStart,
  onDragEnd,
}: {
  ion: keyof WaterProfile;
  label: string;
  source: number;
  target: number;
  final: number;
  domainMax: number;
  onTargetDrag: (ion: keyof WaterProfile, value: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const labelId = useId();
  const hardMax = ION_HARD_MAX[ion];
  // domainMax is owned by the parent (IonVisualizerCard) so all six bars
  // share a single scale.

  const xPct = (v: number) => gammaPct(Math.max(0, v), domainMax) * 100;

  const setTargetFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      // Drag fraction → ppm via gamma inverse, then clamped at the ion's
      // brewing-realistic hard max.
      const ppm = Math.min(hardMax, Math.round(invGammaPpm(pct, domainMax)));
      onTargetDrag(ion, ppm);
    },
    [domainMax, hardMax, ion, onTargetDrag]
  );

  useEffect(() => {
    if (!isDragging) return;
    onDragStart();
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      setTargetFromClientX(e.clientX);
    };
    const onUp = () => {
      setIsDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      onDragEnd();
    };
  }, [isDragging, setTargetFromClientX, onDragStart, onDragEnd]);

  const onPointerDownTrack = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setTargetFromClientX(e.clientX);
  };

  const onPointerDownFlag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setTargetFromClientX(e.clientX);
  };

  const status = proximityStatus(final, target);
  // All ion-bar chrome pulls from the HS palette — no synthesized mid-hues.
  // Discrete: hops-green (on target), water-blue (low), roast-red (high).
  const barColor = proximityColor(status);
  const statusReadoutColor = barColor;

  const sourcePct = xPct(source);
  const finalPct = xPct(final);
  const targetPct = xPct(target);

  // Journey: the band stretches between source and final, signalling
  // "where you started → where you are now". Proximity-colored.
  const journeyLeft = Math.min(sourcePct, finalPct);
  const journeyRight = Math.max(sourcePct, finalPct);
  const journeyWidth = journeyRight - journeyLeft;

  // Cross-hatch overlay marks the "already there from source water" portion
  // (0 → source). Tinted with a transparent version of the row's accent so
  // it reads as a muted echo of the journey fill — same pattern shape as
  // FermentationSection's carb segment.
  const hatchStripe = `color-mix(in srgb, ${barColor} 55%, transparent)`;
  const hatchBgTint = `color-mix(in srgb, ${barColor} 18%, transparent)`;
  const HATCH = `repeating-linear-gradient(135deg, transparent 0 4px, ${hatchStripe} 4px 6px)`;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "34px minmax(0, 1fr) 66px",
        alignItems: "center",
        columnGap: 10,
      }}
    >
      {/* Col 1 — ion label (eyebrow style, mono) */}
      <span
        id={labelId}
        style={{
          fontFamily: hsTokens.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.ink,
          lineHeight: 1,
        }}
      >
        {label}
      </span>

      {/* Col 2 — track (flag handle is absolutely positioned above) */}
      <div
        ref={trackRef}
        role="slider"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={hardMax}
        aria-valuenow={Math.round(target)}
        tabIndex={0}
        onPointerDown={onPointerDownTrack}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onTargetDrag(ion, Math.min(hardMax, target + 5));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onTargetDrag(ion, Math.max(0, target - 5));
          }
        }}
        style={{
          position: "relative",
          height: 12,
          background: hsTokens.cream,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 999,
          cursor: "ew-resize",
          touchAction: "none",
          overflow: "visible",
        }}
      >
        {/* Source-water hatch — fills 0 → source. Tinted with this row's
            proximity color so the hatch reads as "muted accent". */}
        {sourcePct > 0 ? (
          <span
            aria-hidden
            title={`Source: ${Math.round(source)} ppm`}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: `${sourcePct}%`,
              backgroundImage: HATCH,
              backgroundColor: hatchBgTint,
              borderRadius: "999px 0 0 999px",
              zIndex: 1,
            }}
          />
        ) : null}

        {/* Current capsule — proximity-colored fill from source → final.
            The growing end of this capsule IS the current value. */}
        {journeyWidth > 0 ? (
          <span
            aria-hidden
            title={`Current: ${Math.round(final)} ppm`}
            style={{
              position: "absolute",
              top: 1,
              bottom: 1,
              left: `${journeyLeft}%`,
              width: `${journeyWidth}%`,
              background: barColor,
              opacity: 0.7,
              borderRadius: 999,
              transition: "left 140ms ease, width 140ms ease, background 140ms ease",
              zIndex: 2,
            }}
          />
        ) : null}

        {/* Source ring — sits on top of the hatch boundary, "you started here" */}
        <span
          aria-hidden
          title={`Source: ${Math.round(source)} ppm`}
          style={{
            position: "absolute",
            top: "50%",
            left: `${sourcePct}%`,
            transform: "translate(-50%, -50%)",
            width: 9,
            height: 9,
            borderRadius: 999,
            background: hsTokens.paper,
            border: `1.5px solid ${hsTokens.ink}`,
            zIndex: 3,
            pointerEvents: "none",
          }}
        />

        {/* Target line — draggable vertical ink bar at target position.
            "The goal you set." Drag horizontally to retarget. */}
        <button
          type="button"
          onPointerDown={onPointerDownFlag}
          aria-label={`Drag ${label} target — currently ${Math.round(target)} ppm`}
          title={`Target: ${Math.round(target)} ppm — drag to edit`}
          style={{
            position: "absolute",
            top: -5,
            bottom: -5,
            left: `${targetPct}%`,
            transform: "translateX(-50%)",
            width: 14,
            padding: 0,
            background: "transparent",
            border: "none",
            cursor: "ew-resize",
            zIndex: 5,
            display: "inline-flex",
            alignItems: "stretch",
            justifyContent: "center",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 3,
              background: hsTokens.ink,
              borderRadius: 1,
              pointerEvents: "none",
            }}
          />
        </button>
      </div>

      {/* Col 3 — compact readout: final / target */}
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 11,
          fontVariantNumeric: "tabular-nums",
          color: hsTokens.muted,
          textAlign: "right",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        <span style={{ color: statusReadoutColor, fontWeight: 700 }}>{Math.round(final)}</span>
        <span style={{ opacity: 0.6, padding: "0 3px" }}>/</span>
        <span>{Math.round(target)}</span>
      </span>
    </div>
  );
}

function FinalProfileReadout({
  finalProfile,
  targetProfile,
}: {
  finalProfile: WaterProfile;
  targetProfile: WaterProfile;
}) {
  return (
    <div
      style={{
        marginTop: 4,
        paddingTop: 10,
        borderTop: `1.5px dashed ${hsTokens.ink}55`,
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <Eyebrow size={10}>Final</Eyebrow>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: hsTokens.mono,
          fontSize: 11,
          color: hsTokens.muted,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.4,
          letterSpacing: "0.01em",
        }}
      >
        {ION_KEYS.map((ion, idx) => {
          const final = finalProfile[ion];
          const target = targetProfile[ion];
          const status = proximityStatus(final, target);
          const color =
            status === "ideal"
              ? hsTokens.hops
              : status === "high"
                ? hsTokens.roast
                : status === "low"
                  ? hsTokens.water
                  : hsTokens.muted;
          return (
            <span key={ion} style={{ whiteSpace: "nowrap" }}>
              {idx > 0 ? (
                <span aria-hidden style={{ opacity: 0.4, padding: "0 6px" }}>
                  ·
                </span>
              ) : null}
              <span style={{ color: hsTokens.muted, marginRight: 4 }}>{ION_DISPLAY[ion]}</span>
              <span style={{ color, fontWeight: 700 }}>{Math.round(final)}</span>
            </span>
          );
        })}
      </span>
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        ppm
      </span>
    </div>
  );
}


// ─── Shared utilities ─────────────────────────────────────────────

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

function dashedBorderBg(
  color: string,
  opts: { dash: number; gap: number; strokeWidth: number; radius: number }
) {
  const { dash, gap, strokeWidth, radius } = opts;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><rect width='100%' height='100%' rx='${radius}' ry='${radius}' fill='none' stroke='${color}' stroke-width='${strokeWidth}' stroke-dasharray='${dash} ${gap}'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

// ─── Section CSS ──────────────────────────────────────────────────

function WaterSectionStyles() {
  return (
    <style>{`
      /* Desktop: 2-col grid. Source row spans the full left column with empty
         right slot; aside (ion visualizer + notes) starts at row 2 aligned with
         the salts block — matches HopSection's "aside top aligns with the
         ledger TABLE, not the header" pattern. */
      /* Single-column layout — the aside (ion visualizer + notes) has
         been hoisted to the parent HopSkipBuilder grid so it can morph
         between tabs. */
      .hs-water-section .hs-water-grid {
        display: flex;
        flex-direction: column;
        row-gap: 10px;
        min-width: 0;
      }
      .hs-water-section .hs-water-grid-plan { min-width: 0; }
      .hs-water-section .hs-water-grid-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .hs-water-section .hs-water-salt-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      @media (min-width: 641px) and (hover: hover) {
        .hs-water-section .hs-water-other-row { transition: background 90ms ease; }
        .hs-water-section .hs-water-other-row:hover {
          /* Section-tinted hover: ~2% water mixed into a paper/cream-2 base —
             lighter overall than pure cream-2 so the hover lifts. */
          background: color-mix(in srgb, color-mix(in srgb, var(--hs-paper) 20%, var(--hs-cream-2)) 98%, var(--hs-water));
        }
        .hs-water-section .hs-water-source-pill:hover,
        .hs-water-section .hs-water-target-pill:hover {
          transform: translateY(-1px);
          box-shadow: ${hsTokens.sh2};
        }
        .hs-water-section .hs-water-salt-cell {
          transition: transform 90ms ease, box-shadow 90ms ease, background 90ms ease;
        }
        .hs-water-section .hs-water-salt-cell:hover {
          transform: translateY(-1px);
          box-shadow: ${hsTokens.sh2};
          background: ${hsTokens.cream2};
        }
      }

      @media (max-width: 640px) {
        .hs-water-section { padding: 18px 14px !important; }
        .hs-water-section .hs-water-salt-row { gap: 6px; }
        .hs-water-section .hs-water-salt-cell { min-width: calc(50% - 3px); }
        .hs-water-section .hs-water-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        .hs-water-section .hs-water-other-row {
          grid-template-columns: auto minmax(0, 1fr) auto !important;
          grid-template-areas:
            "badge name remove"
            "timing amount unit" !important;
          column-gap: 8px !important;
          row-gap: 8px !important;
        }
        .hs-water-section .hs-water-other-row > :nth-child(1) { grid-area: badge; }
        .hs-water-section .hs-water-other-row > :nth-child(2) { grid-area: name; }
        .hs-water-section .hs-water-other-row > :nth-child(3) { grid-area: timing; justify-self: start; }
        .hs-water-section .hs-water-other-row > :nth-child(4) { grid-area: amount; justify-self: end; }
        .hs-water-section .hs-water-other-row > :nth-child(5) { grid-area: unit; justify-self: end; }
        .hs-water-section .hs-water-other-row > :nth-child(6) { grid-area: remove; justify-self: end; }
      }
    `}</style>
  );
}

// ─── Helper-card container (mounted by HelperCardMorph) ───────────

export function WaterHelperCard() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const calculations = useRecipeCalculations(currentRecipe);

  const waterChem = useMemo(
    () =>
      currentRecipe?.waterChemistry ?? {
        sourceProfile: COMMON_WATER_PROFILES.RO,
        saltAdditions: {} as Partial<SaltAdditions>,
        sourceProfileName: "RO",
        targetStyleName: undefined as string | undefined,
        customTargetProfile: undefined as WaterProfile | undefined,
      },
    [currentRecipe?.waterChemistry]
  );

  const isCustomTarget = !!waterChem.customTargetProfile;
  const bjcpKey = getWaterTargetForBjcpStyle(currentRecipe?.style || "");
  const bjcpTarget =
    BEER_STYLE_TARGETS[bjcpKey] ?? BEER_STYLE_TARGETS["Balanced"];

  const explicitBjcpName =
    !waterChem.customTargetProfile && waterChem.targetStyleName
      ? waterChem.targetStyleName
      : null;
  const explicitBjcpTarget = explicitBjcpName
    ? BEER_STYLE_TARGETS[explicitBjcpName]
    : null;

  const effectiveTargetProfile: WaterProfile =
    isCustomTarget && waterChem.customTargetProfile
      ? waterChem.customTargetProfile
      : explicitBjcpTarget
        ? explicitBjcpTarget.profile
        : bjcpTarget.profile;

  const finalProfile = useMemo(() => {
    if (!calculations) return waterChem.sourceProfile;
    return waterChemistryService.calculateFinalProfileFromTotalSalts(
      waterChem.sourceProfile,
      waterChem.saltAdditions,
      calculations.mashWaterL,
      calculations.spargeWaterL
    );
  }, [waterChem.sourceProfile, waterChem.saltAdditions, calculations]);

  const clSo4 = useMemo(
    () => waterChemistryService.chlorideToSulfateRatio(effectiveTargetProfile),
    [effectiveTargetProfile]
  );
  const clSo4Label =
    clSo4 == null ? "—" : clSo4 > 1.5 ? "Malty" : clSo4 < 0.7 ? "Hoppy" : "Balanced";
  const clSo4Color =
    clSo4 == null
      ? hsTokens.muted
      : clSo4 > 1.5
        ? hsTokens.honey
        : clSo4 < 0.7
          ? hsTokens.hops
          : hsTokens.water;

  const handleTargetDrag = useCallback(
    (ion: keyof WaterProfile, value: number) => {
      const wc = currentRecipe?.waterChemistry ?? {
        sourceProfile: COMMON_WATER_PROFILES.RO,
        saltAdditions: {},
        sourceProfileName: "RO",
      };
      const isCustom = !!wc.customTargetProfile;
      let baseProfile: WaterProfile;
      let baseName: string;
      if (isCustom && wc.customTargetProfile) {
        baseProfile = wc.customTargetProfile;
        baseName = wc.targetStyleName ?? "Custom Target";
      } else {
        const key = getWaterTargetForBjcpStyle(currentRecipe?.style || "");
        const t = BEER_STYLE_TARGETS[key] ?? BEER_STYLE_TARGETS["Balanced"];
        baseProfile = { ...t.profile };
        baseName = `${key} (adjusted)`;
      }
      updateRecipe({
        waterChemistry: {
          ...wc,
          targetStyleName: baseName,
          customTargetProfile: { ...baseProfile, [ion]: value },
        },
      });
    },
    [currentRecipe?.waterChemistry, currentRecipe?.style, updateRecipe]
  );

  if (!currentRecipe) return null;
  return (
    <IonVisualizerCard
      sourceProfile={waterChem.sourceProfile}
      targetProfile={effectiveTargetProfile}
      bjcpTargetProfile={bjcpTarget.profile}
      isCustomTarget={isCustomTarget}
      finalProfile={finalProfile}
      clToSo4Display={
        clSo4 == null ? "Cl:SO₄ —" : `Cl:SO₄ ${clSo4.toFixed(1)}:1 (${clSo4Label})`
      }
      clToSo4Color={clSo4Color}
      onTargetDrag={handleTargetDrag}
    />
  );
}
