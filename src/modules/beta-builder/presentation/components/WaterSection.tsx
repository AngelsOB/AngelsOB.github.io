'use client';

/**
 * Water Chemistry Section
 *
 * Shows:
 * 1. Estimated mash pH with adjustment suggestions
 * 2. Water chemistry — source/target profiles, salt additions, ion comparison
 * 3. Other ingredients (finings, spices, water agents, etc.)
 */

import { useCallback, useMemo, useState } from "react";
import { uid } from "@/utils/uid";
import type { RecipeCalculations, OtherIngredientCategory } from "../../domain/models/Recipe";
import type { Recipe } from "../../domain/models/Recipe";
import {
  waterChemistryService,
  COMMON_WATER_PROFILES,
  BEER_STYLE_TARGETS,
  getWaterTargetForBjcpStyle,
  type WaterProfile,
  type SaltAdditions,
} from "../../domain/services/WaterChemistryService";
import { useRecipeStore } from "../stores/recipeStore";
import SourceWaterModal from "./SourceWaterModal";
import CustomTargetStyleModal from "./CustomTargetStyleModal";
import {
  PhAdjustmentsSection,
  WaterChemistrySection,
  OtherIngredientsPanel,
  WaterIngredientPickerModal,
  CustomWaterIngredientModal,
  getDefaultUnit,
  getDefaultTiming,
  ION_LABELS,
} from "./water-section";

type Props = {
  calculations: RecipeCalculations | null;
  recipe: Recipe;
};

export default function WaterSection({ calculations, recipe }: Props) {
  const { updateRecipe, addOtherIngredient, updateOtherIngredient, removeOtherIngredient } =
    useRecipeStore();
  const [isCustomTargetModalOpen, setIsCustomTargetModalOpen] = useState(false);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isIngredientPickerOpen, setIsIngredientPickerOpen] = useState(false);
  const [isCustomIngredientModalOpen, setIsCustomIngredientModalOpen] = useState(false);

  // Initialize water chemistry if not present
  const waterChem = recipe.waterChemistry || {
    sourceProfile: COMMON_WATER_PROFILES.RO,
    saltAdditions: {},
    sourceProfileName: "RO",
    targetStyleName: "Balanced",
  };

  const otherIngredients = recipe.otherIngredients || [];

  // Calculate final water profile from total salts
  const finalProfile = useMemo(() => {
    if (!calculations) return waterChem.sourceProfile;
    return waterChemistryService.calculateFinalProfileFromTotalSalts(
      waterChem.sourceProfile,
      waterChem.saltAdditions,
      calculations.mashWaterL,
      calculations.spargeWaterL
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to water chemistry changes
  }, [
    waterChem.sourceProfile,
    waterChem.saltAdditions,
    calculations?.mashWaterL,
    calculations?.spargeWaterL,
  ]);

  // Calculate mash and sparge split for display
  const { mashSalts, spargeSalts } = useMemo(() => {
    if (!calculations) return { mashSalts: {}, spargeSalts: {} };
    return waterChemistryService.splitSaltsProportionally(
      waterChem.saltAdditions,
      calculations.mashWaterL,
      calculations.spargeWaterL
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to water chemistry changes
  }, [waterChem.saltAdditions, calculations?.mashWaterL, calculations?.spargeWaterL]);

  const handleSourceProfileChange = (profile: WaterProfile, profileName: string) => {
    updateRecipe({
      waterChemistry: {
        ...waterChem,
        sourceProfile: profile,
        sourceProfileName: profileName,
      },
    });
  };

  const handleCustomTargetChange = (profile: WaterProfile, name: string) => {
    updateRecipe({
      waterChemistry: {
        ...waterChem,
        targetStyleName: name,
        customTargetProfile: profile,
      },
    });
  };

  const handleSwitchToBjcp = () => {
    updateRecipe({
      waterChemistry: {
        ...waterChem,
        targetStyleName: undefined,
        customTargetProfile: undefined,
      },
    });
  };

  const handleTargetDrag = useCallback((ion: keyof WaterProfile, value: number) => {
    const wc = recipe.waterChemistry || {
      sourceProfile: COMMON_WATER_PROFILES.RO,
      saltAdditions: {},
      sourceProfileName: "RO",
    };
    const isCurrentlyCustom = !!wc.customTargetProfile;

    let baseProfile: WaterProfile;
    let baseName: string;

    if (isCurrentlyCustom && wc.customTargetProfile) {
      baseProfile = wc.customTargetProfile;
      baseName = wc.targetStyleName || "Custom Target";
    } else {
      // Snapshot current BJCP target and switch to custom
      const bjcpKey = getWaterTargetForBjcpStyle(recipe.style || "");
      const bjcpTarget = BEER_STYLE_TARGETS[bjcpKey] || BEER_STYLE_TARGETS["Balanced"];
      baseProfile = { ...bjcpTarget.profile };
      baseName = `${bjcpKey} (adjusted)`;
    }

    updateRecipe({
      waterChemistry: {
        ...wc,
        targetStyleName: baseName,
        customTargetProfile: { ...baseProfile, [ion]: value },
      },
    });
  }, [recipe.waterChemistry, recipe.style, updateRecipe]);

  const handleSaltChange = (saltKey: keyof SaltAdditions, value: number) => {
    updateRecipe({
      waterChemistry: {
        ...waterChem,
        saltAdditions: {
          ...waterChem.saltAdditions,
          [saltKey]: value || undefined,
        },
      },
    });
  };

  const handleAddFromPreset = (name: string, category: OtherIngredientCategory) => {
    addOtherIngredient({
      id: uid(),
      name,
      category,
      amount: 1,
      unit: getDefaultUnit(category),
      timing: getDefaultTiming(category),
    });
  };

  const handleAddCustomIngredient = (name: string, category: OtherIngredientCategory) => {
    addOtherIngredient({
      id: uid(),
      name,
      category,
      amount: 1,
      unit: getDefaultUnit(category),
      timing: getDefaultTiming(category),
    });
  };

  const handleAddPhAdjustment = (name: string, amount: number, unit: string) => {
    // Check if this ingredient already exists in otherIngredients (match by name, case-insensitive)
    const existing = otherIngredients.find(
      (ing) => ing.name.toLowerCase() === name.toLowerCase() && ing.timing === "mash"
    );

    if (existing) {
      // Update the existing ingredient's amount
      updateOtherIngredient(existing.id, { amount });
    } else {
      // Add as a new water-agent ingredient
      addOtherIngredient({
        id: uid(),
        name,
        category: "water-agent",
        amount,
        unit,
        timing: "mash",
      });
    }
  };

  if (!calculations) {
    return null;
  }

  // Auto-detect water target from recipe's BJCP style
  const isCustomTarget = !!waterChem.customTargetProfile;
  const bjcpWaterTarget = getWaterTargetForBjcpStyle(recipe.style || "");

  const targetStyle = isCustomTarget && waterChem.customTargetProfile
    ? {
        profile: waterChem.customTargetProfile,
        clToSo4Ratio: `${waterChem.customTargetProfile.SO4 > 0 ? (waterChem.customTargetProfile.Cl / waterChem.customTargetProfile.SO4).toFixed(1) : "∞"}:1`,
      }
    : BEER_STYLE_TARGETS[bjcpWaterTarget] || BEER_STYLE_TARGETS["Balanced"];

  const effectiveTargetName = isCustomTarget
    ? (waterChem.targetStyleName || "Custom Target")
    : bjcpWaterTarget;

  return (
    <div className="brew-section brew-animate-in brew-stagger-6" data-accent="water">
      <h2 className="brew-section-title mb-4">Water Chemistry</h2>

      {/* Water Chemistry */}
      <WaterChemistrySection
        sourceProfile={waterChem.sourceProfile}
        sourceProfileName={waterChem.sourceProfileName}
        targetStyle={targetStyle}
        targetStyleName={effectiveTargetName}
        isCustomTarget={isCustomTarget}
        finalProfile={finalProfile}
        saltAdditions={waterChem.saltAdditions}
        mashSalts={mashSalts}
        spargeSalts={spargeSalts}
        onOpenSourceModal={() => setIsSourceModalOpen(true)}
        onSwitchToBjcp={handleSwitchToBjcp}
        onOpenCustomTarget={() => setIsCustomTargetModalOpen(true)}
        onSaltChange={handleSaltChange}
        onTargetDrag={handleTargetDrag}
      />

      {/* Final Ion Profile + Mash pH */}
      <h3 className="text-sm font-semibold mb-3 mt-4" style={{ color: 'var(--fg-strong)' }}>
        Final Ion Profile
      </h3>
      <div className="flex items-stretch gap-2">
        {/* Ion grid — 3 cols × 2 rows */}
        <div className="flex-1 min-w-0 grid grid-cols-3 gap-2">
          {ION_LABELS.map((ion) => {
            const finalValue = Math.round(finalProfile[ion]);
            return (
              <div key={ion} className="equip-datum" style={{ padding: '8px 10px' }}>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {ion === 'SO4' ? 'SO₄' : ion === 'HCO3' ? 'HCO₃' : ion}
                </div>
                <div className="text-lg font-bold tabular-nums" style={{ color: 'var(--fg-strong)' }}>
                  {finalValue}
                </div>
                <div className="text-[9px] text-muted">ppm</div>
              </div>
            );
          })}
        </div>

        {/* Mash pH — stretches to match ion grid height */}
        <PhAdjustmentsSection
          calculations={calculations}
          onAddPhAdjustment={handleAddPhAdjustment}
        />
      </div>

      {/* Other Ingredients */}
      <OtherIngredientsPanel
        ingredients={otherIngredients}
        onOpenPicker={() => setIsIngredientPickerOpen(true)}
        onUpdate={updateOtherIngredient}
        onRemove={removeOtherIngredient}
      />

      {/* Source Water Modal */}
      <SourceWaterModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onSelect={handleSourceProfileChange}
        currentProfile={waterChem.sourceProfile}
        currentProfileName={waterChem.sourceProfileName}
      />

      {/* Custom Target Style Modal */}
      <CustomTargetStyleModal
        isOpen={isCustomTargetModalOpen}
        onClose={() => setIsCustomTargetModalOpen(false)}
        onSave={handleCustomTargetChange}
        initialProfile={waterChem.customTargetProfile}
        initialName={isCustomTarget ? waterChem.targetStyleName : undefined}
      />

      {/* Other Ingredient Picker Modal */}
      <WaterIngredientPickerModal
        isOpen={isIngredientPickerOpen}
        onClose={() => setIsIngredientPickerOpen(false)}
        onSelect={handleAddFromPreset}
        onOpenCustomModal={() => setIsCustomIngredientModalOpen(true)}
      />

      {/* Custom Ingredient Modal */}
      <CustomWaterIngredientModal
        isOpen={isCustomIngredientModalOpen}
        onClose={() => setIsCustomIngredientModalOpen(false)}
        onAdd={handleAddCustomIngredient}
      />
    </div>
  );
}
