'use client';

/**
 * Fermentable Section Component
 *
 * Displays the grain bill with:
 * - Preset picker modal for adding fermentables
 * - Inline editing of fermentable properties
 * - Per-grain contribution display
 * - Remove buttons
 */

import { useEffect, useState, useMemo } from "react";
import { uid } from "@/utils/uid";
import { useRecipeStore } from "../stores/recipeStore";
import { usePresetStore } from "../stores/presetStore";
import EmptyState from "../../../../components/EmptyState";
import { fermentableCalculationService } from "../../domain/services/FermentableCalculationService";
import type { Fermentable } from "../../domain/models/Recipe";
import type { FermentablePreset } from "../../domain/models/Presets";
import { getFermentability } from "../../data/fermentablePresets";
import CustomFermentableModal from "./CustomFermentableModal";
import PresetPickerModal from "./PresetPickerModal";
import { getCountryFlag, BREWING_ORIGINS } from "../../../../utils/flags";
import { srmToRgb } from "../../utils/srmColorUtils";

export default function FermentableSection() {
  const { currentRecipe, addFermentable, updateFermentable, removeFermentable } =
    useRecipeStore();
  const {
    fermentablePresetsGrouped,
    loadFermentablePresets,
    saveFermentablePreset,
    isLoading: presetsLoading,
  } = usePresetStore();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingFermentableId, setEditingFermentableId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Advanced Filters State
  const [activeFilters, setActiveFilters] = useState({
    origins: [] as string[],
    types: [] as string[], // 'grain', 'extract', 'sugar', 'adjunct'
    colors: [] as string[], // 'light', 'amber', 'dark', 'roasted'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [mode, setMode] = useState<"amount" | "percent">("amount");
  const [targetABV, setTargetABV] = useState(5.0);
  const [percentById, setPercentById] = useState<Record<string, number>>({});

  // Load presets on mount
  useEffect(() => {
    loadFermentablePresets();
  }, [loadFermentablePresets]);

  // Handle adding or swapping a fermentable from preset
  const handleSelectPreset = (preset: FermentablePreset) => {
    if (editingFermentableId) {
      // Swap: keep the weight, update everything else
      updateFermentable(editingFermentableId, {
        name: preset.name,
        colorLovibond: preset.colorLovibond,
        ppg: preset.potentialGu,
        efficiencyPercent:
          preset.type === "extract" || preset.type === "sugar" ? 100 : 75,
        originCode: preset.originCode,
        fermentability: getFermentability(preset),
      });
    } else {
      const newFermentable: Fermentable = {
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
      addFermentable(newFermentable);
    }
    setEditingFermentableId(null);
    setIsPickerOpen(false);
    setSearchQuery("");
  };

  // Open picker to edit/swap a fermentable
  const handleEditFermentable = (id: string) => {
    setEditingFermentableId(id);
    setIsPickerOpen(true);
  };

  // Handle saving a custom fermentable preset
  const handleSaveCustomPreset = (preset: FermentablePreset) => {
    saveFermentablePreset(preset);
  };

  // Filter presets by search query
  // Get unique origins for filter
  const availableOrigins = useMemo(() => {
    const origins = new Set<string>();
    fermentablePresetsGrouped.forEach((group) => {
      group.items.forEach((item) => {
        if (item.originCode) origins.add(item.originCode);
      });
    });
    return Array.from(origins).sort();
  }, [fermentablePresetsGrouped]);

  // Filter presets by search query and active filters
  const filteredGrouped = useMemo(() => {
    return fermentablePresetsGrouped
      .map((group) => ({
        ...group,
        items: group.items.filter((preset) => {
          // 1. Search Query
          const matchesSearch = preset.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

          // 2. Origin Filter (OR logic within origins)
          const matchesOrigin =
            activeFilters.origins.length === 0 ||
            (preset.originCode && activeFilters.origins.includes(preset.originCode));

          // 3. Type Filter
          // Map preset properties to filter types
          let presetType: string = preset.type;
          // Heuristic: grain with "adjunct" or "flake" or "torrified" in name is practically an adjunct
          if (preset.type === 'grain' && 
              (preset.name.toLowerCase().includes('adjunct') || 
               preset.name.toLowerCase().includes('flak') || 
               preset.name.toLowerCase().includes('torrified'))) {
             presetType = 'adjunct_mashable';
          }
          
          const matchesType =
            activeFilters.types.length === 0 ||
            activeFilters.types.includes(presetType);

          // 4. Color Filter
          // 'light' < 10, 'amber' 10-50, 'dark' 50-200, 'roasted' > 200
          let colorCategory = "light";
          if (preset.colorLovibond >= 10 && preset.colorLovibond < 50) colorCategory = "amber";
          else if (preset.colorLovibond >= 50 && preset.colorLovibond < 200) colorCategory = "dark";
          else if (preset.colorLovibond >= 200) colorCategory = "roasted";

          const matchesColor =
            activeFilters.colors.length === 0 ||
            activeFilters.colors.includes(colorCategory);

          return matchesSearch && matchesOrigin && matchesType && matchesColor;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [fermentablePresetsGrouped, searchQuery, activeFilters]);

  const toggleFilter = (category: keyof typeof activeFilters, value: string) => {
    setActiveFilters(prev => {
      const current = prev[category];
      const next = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  // Calculate total grain weight
  const totalGrainKg =
    currentRecipe?.fermentables.reduce((sum, f) => sum + f.weightKg, 0) || 0;

  // Initialize percentages from current weights when switching to percent mode
  useEffect(() => {
    if (mode !== "percent" || !currentRecipe) return;
    const percents = fermentableCalculationService.calculatePercentsFromWeights(
      currentRecipe.fermentables
    );
    setPercentById((prev) => ({ ...percents, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to fermentables changes
  }, [mode, currentRecipe?.fermentables]);

  // Calculate weights from percentages and target ABV
  const recalcWeightsFromPercents = useMemo(() => {
    return () => {
      if (mode !== "percent" || !currentRecipe) return;

      const updatedFermentables = fermentableCalculationService.calculateWeightsFromPercentsAndABV(
        currentRecipe.fermentables,
        percentById,
        targetABV,
        currentRecipe.batchVolumeL,
        currentRecipe.equipment.mashEfficiencyPercent || 75,
        currentRecipe.yeasts?.[0]?.attenuation || 0.75
      );

      // Update weights if they changed
      updatedFermentables.forEach((f) => {
        const current = currentRecipe.fermentables.find((cf) => cf.id === f.id);
        if (current && Math.abs(f.weightKg - current.weightKg) > 0.001) {
          updateFermentable(f.id, { weightKg: f.weightKg });
        }
      });
    };
  }, [mode, currentRecipe, percentById, targetABV, updateFermentable]);

  // Recalculate when inputs change in percent mode
  useEffect(() => {
    recalcWeightsFromPercents();
  }, [recalcWeightsFromPercents]);

  // Calculate total percentage
  const totalPercent = useMemo(() => {
    if (mode !== "percent" || !currentRecipe) return 0;
    return fermentableCalculationService.calculateTotalPercent(
      currentRecipe.fermentables,
      percentById
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to fermentables changes
  }, [mode, currentRecipe?.fermentables, percentById]);

  return (
    <div className="brew-section brew-animate-in brew-stagger-2" data-accent="grain">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h2 className="brew-section-title">Fermentables</h2>
          {/* Mode Toggle */}
          <div className="flex items-center rounded-lg border border-[rgb(var(--brew-border-subtle))] overflow-hidden text-xs">
            <button
              type="button"
              className={`px-3 py-1.5 transition-colors ${
                mode === "amount" ? "font-semibold" : ""
              }`}
              style={mode === "amount" ? { background: 'color-mix(in oklch, var(--brew-accent-200) 40%, transparent)', color: 'var(--brew-accent-800)' } : { background: 'rgb(var(--brew-card-inset))' }}
              onClick={() => setMode("amount")}
            >
              Amount
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 transition-colors ${
                mode === "percent" ? "font-semibold" : ""
              }`}
              style={mode === "percent" ? { background: 'color-mix(in oklch, var(--brew-accent-200) 40%, transparent)', color: 'var(--brew-accent-800)' } : { background: 'rgb(var(--brew-card-inset))' }}
              onClick={() => setMode("percent")}
            >
              %
            </button>
          </div>
          {/* Target ABV input (percent mode only) */}
          {mode === "percent" && (
            <div className="flex items-center gap-2">
              <label htmlFor="fermentable-target-abv" className="text-xs font-semibold">Target ABV</label>
              <input
                id="fermentable-target-abv"
                type="number"
                value={targetABV}
                onChange={(e) => setTargetABV(parseFloat(e.target.value) || 0)}
                className="brew-input w-20 py-1 px-2"
                step="0.1"
                min="0"
              />
              <span className="text-xs">%</span>
              <span className="text-xs">
                (sum: {totalPercent.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsPickerOpen(true)}
          className="brew-btn-primary"
        >
          Add Fermentable
        </button>
      </div>

      {/* Fermentable List */}
      {!currentRecipe?.fermentables.length ? (
        <EmptyState
          message="No fermentables yet"
          actionLabel="Add your first fermentable"
          onAction={() => setIsPickerOpen(true)}
        />
      ) : (
        <div className="space-y-2">
          {currentRecipe.fermentables.map((fermentable) => {
            const percentage = totalGrainKg > 0
              ? (fermentable.weightKg / totalGrainKg) * 100
              : 0;

            return (
              <div
                key={fermentable.id}
                className="brew-ingredient-row flex items-center"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-11 gap-2 lg:gap-2 items-center flex-1 min-w-0">
                {/* Name - full width on mobile, 4 cols on desktop */}
                <div className="col-span-2 sm:col-span-4 lg:col-span-4 flex items-center">
                  <span className="font-medium flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10"
                      style={{ background: srmToRgb(fermentable.colorLovibond) }}
                      title={`${fermentable.colorLovibond}°L`}
                    />
                    {fermentable.name}
                    {fermentable.originCode && (
                      <span className="text-xs text-muted font-normal">
                        {getCountryFlag(fermentable.originCode)}
                      </span>
                    )}
                  </span>
                </div>

                {/* Weight/Percent - Inline Editable */}
                <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                  <label htmlFor={`fermentable-weight-${fermentable.id}`} className="text-xs font-medium block mb-1 lg:hidden">
                    {mode === "amount" ? "Weight" : "Percent"}
                  </label>
                  {mode === "amount" ? (
                    <div className="flex items-center gap-1">
                      <input
                        id={`fermentable-weight-${fermentable.id}`}
                        type="number"
                        value={fermentable.weightKg}
                        onChange={(e) =>
                          updateFermentable(fermentable.id, {
                            weightKg: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="brew-input w-full py-1 px-2"
                        step="0.1"
                        min="0"
                      />
                      <span className="text-xs font-medium">kg</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        id={`fermentable-weight-${fermentable.id}`}
                        type="number"
                        value={percentById[fermentable.id] ?? 0}
                        onChange={(e) =>
                          setPercentById((prev) => ({
                            ...prev,
                            [fermentable.id]: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="brew-input w-full py-1 px-2"
                        step="0.1"
                        min="0"
                        max="100"
                      />
                      <span className="text-xs font-medium">%</span>
                    </div>
                  )}
                </div>

                {/* Color - Inline Editable */}
                <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                  <label htmlFor={`fermentable-color-${fermentable.id}`} className="text-xs font-medium block mb-1 lg:hidden">Color</label>
                  <div className="flex items-center gap-1">
                    <input
                      id={`fermentable-color-${fermentable.id}`}
                      type="number"
                      value={fermentable.colorLovibond}
                      onChange={(e) =>
                        updateFermentable(fermentable.id, {
                          colorLovibond: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="brew-input w-full py-1 px-2"
                      step="1"
                      min="0"
                    />
                    <span className="text-xs font-medium">°L</span>
                  </div>
                </div>

                {/* PPG - Inline Editable */}
                <div className="col-span-1 sm:col-span-1 lg:col-span-2">
                  <label htmlFor={`fermentable-ppg-${fermentable.id}`} className="text-xs font-medium block mb-1 lg:hidden">PPG</label>
                  <div className="flex items-center gap-1">
                    <input
                      id={`fermentable-ppg-${fermentable.id}`}
                      type="number"
                      value={fermentable.ppg}
                      onChange={(e) =>
                        updateFermentable(fermentable.id, {
                          ppg: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="brew-input w-full py-1 px-2"
                      step="0.1"
                      min="0"
                    />
                    <span className="text-xs font-medium whitespace-nowrap">PPG</span>
                  </div>
                </div>

                {/* Percentage or Weight display (depends on mode) */}
                <div className="col-span-1 sm:col-span-1 lg:col-span-1 text-right">
                  <span className="text-xs font-medium block mb-1 lg:hidden">
                    {mode === "amount" ? "%" : "Weight"}
                  </span>
                  {mode === "amount" ? (
                    <span className="text-sm font-medium">
                      {percentage.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-sm font-medium whitespace-nowrap">
                      {fermentable.weightKg.toFixed(2)} kg
                    </span>
                  )}
                </div>
                </div>{/* end grid */}

                {/* Hover-reveal actions — morphs inline */}
                <div className="brew-row-actions">
                  <button
                    onClick={() => handleEditFermentable(fermentable.id)}
                    className="brew-row-action-btn brew-link"
                    aria-label={`Change ${fermentable.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  <button
                    onClick={() => removeFermentable(fermentable.id)}
                    className="brew-row-action-btn brew-danger-text"
                    aria-label={`Remove ${fermentable.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="flex justify-between items-center pt-2 border-t border-[rgb(var(--brew-border-subtle))] mt-2">
            <span className="font-semibold text-strong">Total</span>
            <span className="font-semibold text-strong">{totalGrainKg.toFixed(2)} kg</span>
          </div>
        </div>
      )}

      {/* Preset Picker Modal */}
      <PresetPickerModal<FermentablePreset>
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setEditingFermentableId(null);
          setSearchQuery("");
        }}
        title={editingFermentableId ? "Swap Fermentable" : "Select Fermentable"}
        searchPlaceholder="Search fermentables..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterContent={
          <>
            {/* Type Filters */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="py-1 px-2 font-semibold brew-chip-label">
                Type:
              </span>
              {["grain", "extract", "sugar", "adjunct_mashable"].map((type) => (
                <button
                  key={type}
                  onClick={() => toggleFilter("types", type)}
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    activeFilters.types.includes(type)
                      ? "brew-chip-active"
                      : "brew-chip"
                  }`}
                >
                  {type === "adjunct_mashable"
                    ? "Adjunct"
                    : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Color Filters */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="py-1 px-2 font-semibold brew-chip-label">
                Color:
              </span>
              {[
                { id: "light", label: "Light (<10°L)" },
                { id: "amber", label: "Amber (10-50°L)" },
                { id: "dark", label: "Dark (50-200°L)" },
                { id: "roasted", label: "Roasted (>200°L)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleFilter("colors", opt.id)}
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    activeFilters.colors.includes(opt.id)
                      ? "brew-chip-active"
                      : "brew-chip"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Origin Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide text-xs">
              <span className="py-1 px-2 font-semibold brew-chip-label whitespace-nowrap">
                Origin:
              </span>
              {availableOrigins.map((code) => (
                <button
                  key={code}
                  onClick={() => toggleFilter("origins", code)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors border flex items-center gap-1 ${
                    activeFilters.origins.includes(code)
                      ? "brew-chip-active"
                      : "brew-chip"
                  }`}
                >
                  <span>{getCountryFlag(code)}</span>
                  {BREWING_ORIGINS[code] || code}
                </button>
              ))}
            </div>
          </>
        }
        groups={filteredGrouped}
        isLoading={presetsLoading}
        emptyMessage="No fermentables found"
        renderItem={(preset) => (
          <button
            key={preset.name}
            onClick={() => handleSelectPreset(preset)}
            className="brew-picker-row flex justify-between items-center"
          >
            <span className="font-medium flex items-center gap-2">
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-black/10"
                style={{ background: srmToRgb(preset.colorLovibond) }}
                title={`${preset.colorLovibond}°L`}
              />
              {preset.name}
              {preset.originCode && (
                <span className="text-xs text-muted font-normal">
                  {getCountryFlag(preset.originCode)}
                </span>
              )}
            </span>
            <span className="text-sm font-medium">
              {preset.colorLovibond}°L | {preset.potentialGu} PPG
              {preset.originCode && ` | ${preset.originCode}`}
            </span>
          </button>
        )}
        totalCount={fermentablePresetsGrouped.reduce(
          (sum, group) => sum + group.items.length,
          0
        )}
        countLabel="presets available"
        onCreateCustom={() => setIsCustomModalOpen(true)}
        colorScheme="blue"
      />

      {/* Custom Fermentable Modal */}
      <CustomFermentableModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={handleSaveCustomPreset}
      />
    </div>
  );
}
