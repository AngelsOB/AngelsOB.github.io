'use client';

/**
 * Yeast Section Component
 *
 * Displays yeast selection with:
 * - Preset picker modal for selecting yeast
 * - Display of selected yeast with attenuation
 * - Inline editing of attenuation
 * - Integrated starter calculator
 * - Clear button to remove yeast
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRecipeStore } from "../stores/recipeStore";
import { usePresetStore } from "../stores/presetStore";
import EmptyState from "../../../../components/EmptyState";
import { useRecipeCalculations } from "../hooks/useRecipeCalculations";
import type { Yeast, StarterInfo } from "../../domain/models/Recipe";
import type { YeastPreset } from "../../domain/models/Presets";
import CustomYeastModal from "./CustomYeastModal";
import PresetPickerModal from "./PresetPickerModal";
import YeastDisplay from "./YeastDisplay";
import YeastLabBadge from "./YeastLabBadge";
import StarterCalculator from "./StarterCalculator";

export default function YeastSection() {
  const { currentRecipe, addYeast, updateYeast, removeYeast } = useRecipeStore();

  // Get the first yeast (for backward compatibility with single-yeast UI)
  const currentYeast = currentRecipe?.yeasts?.[0] ?? null;

  // Adapter functions for single-yeast operations
  const setYeast = (yeast: Yeast) => {
    if (currentYeast) {
      // Replace existing yeast by removing old and adding new
      removeYeast(currentYeast.id);
    }
    addYeast(yeast);
  };

  const clearYeast = () => {
    if (currentYeast) {
      removeYeast(currentYeast.id);
    }
  };

  const { yeastPresetsGrouped, loadYeastPresets, saveYeastPreset, isLoading: presetsLoading } =
    usePresetStore();
  const calculations = useRecipeCalculations(currentRecipe);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    categories: [] as string[],
    attenuation: [] as string[], // 'low', 'med', 'high'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load presets on mount
  useEffect(() => {
    loadYeastPresets();
  }, [loadYeastPresets]);

  // Handle selecting a yeast from preset
  const handleSelectFromPreset = (preset: YeastPreset) => {
    const newYeast: Yeast = {
      id: crypto.randomUUID(),
      name: preset.name,
      // attenuationPercent in presets is percentage (75 for 75%), convert to decimal
      attenuation: (preset.attenuationPercent || 75) / 100,
      laboratory: preset.category,
    };
    setYeast(newYeast);
    setIsPickerOpen(false);
    setSearchQuery("");
  };

  // Handle saving a custom yeast preset
  const handleSaveCustomPreset = (preset: YeastPreset) => {
    saveYeastPreset(preset);
  };

  // Handle updating yeast attenuation
  const handleUpdateAttenuation = (attenuation: number) => {
    if (!currentYeast) return;
    updateYeast(currentYeast.id, { attenuation });
  };

  // Handle starter info changes from StarterCalculator
  const handleStarterChange = useCallback(
    (starterInfo: StarterInfo) => {
      if (!currentYeast) return;
      updateYeast(currentYeast.id, { starter: starterInfo });
    },
    [currentYeast, updateYeast]
  );

  // Get available categories
  const availableCategories = useMemo(() => {
    return yeastPresetsGrouped.map((g) => g.label).sort();
  }, [yeastPresetsGrouped]);

  // Filter presets by search query and active filters
  const filteredGrouped = useMemo(() => {
    return yeastPresetsGrouped
      .map((group) => ({
        ...group,
        items: group.items.filter((preset) => {
          // 1. Search Query
          const matchesSearch = preset.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

          // 2. Category Filter (Brand)
          const matchesCategory =
            activeFilters.categories.length === 0 ||
            activeFilters.categories.includes(group.label);

          // 3. Attenuation Filter
          // low < 72%, med 72-76%, high > 76%
          let attCat = "unknown";
          if (preset.attenuationPercent) {
            const att = preset.attenuationPercent * 100;
            if (att < 72) attCat = "low";
            else if (att >= 72 && att <= 76) attCat = "med";
            else if (att > 76) attCat = "high";
          }

          const matchesAttenuation =
            activeFilters.attenuation.length === 0 ||
            activeFilters.attenuation.includes(attCat);

          return matchesSearch && matchesCategory && matchesAttenuation;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [yeastPresetsGrouped, searchQuery, activeFilters]);

  const toggleFilter = (category: keyof typeof activeFilters, value: string) => {
    setActiveFilters((prev) => {
      const current = prev[category];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  return (
    <div className="brew-section brew-animate-in brew-stagger-5" data-accent="yeast">
      <div className="flex justify-between items-center mb-4">
        <h2 className="brew-section-title">Yeast</h2>
        {!currentYeast ? (
          <button
            onClick={() => setIsPickerOpen(true)}
            className="brew-btn-primary"
          >
            Select Yeast
          </button>
        ) : (
          <button
            onClick={clearYeast}
            className="brew-btn-ghost brew-danger-text"
          >
            Clear Yeast
          </button>
        )}
      </div>

      {/* Yeast Display */}
      {!currentYeast ? (
        <EmptyState
          message="No yeast selected"
          actionLabel="Select a yeast strain"
          onAction={() => setIsPickerOpen(true)}
        />
      ) : (
        <div className="yeast-stack">
          <YeastDisplay
            yeast={currentYeast}
            onChangeYeast={() => setIsPickerOpen(true)}
            onUpdateAttenuation={handleUpdateAttenuation}
          />

          {/* Starter Calculator */}
          {calculations && (
            <StarterCalculator
              starterInfo={currentYeast.starter}
              batchVolumeL={currentRecipe?.batchVolumeL || 20}
              og={calculations.og}
              onStarterChange={handleStarterChange}
            />
          )}
        </div>
      )}

      {/* Preset Picker Modal */}
      <PresetPickerModal<YeastPreset>
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setSearchQuery("");
        }}
        title="Select Yeast"
        searchPlaceholder="Search yeasts..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterContent={
          <>
            {/* Attenuation Filters */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="brew-chip-label">
                Attenuation:
              </span>
              {[
                { id: "low", label: "Low (<72%)" },
                { id: "med", label: "Med (72-76%)" },
                { id: "high", label: "High (>76%)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleFilter("attenuation", opt.id)}
                  className={activeFilters.attenuation.includes(opt.id) ? "brew-chip-active" : "brew-chip"}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide text-xs">
              <span className="brew-chip-label whitespace-nowrap">
                Brand:
              </span>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleFilter("categories", cat)}
                  className={`whitespace-nowrap ${activeFilters.categories.includes(cat) ? "brew-chip-active" : "brew-chip"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </>
        }
        groups={filteredGrouped}
        isLoading={presetsLoading}
        emptyMessage="No yeasts found"
        renderItem={(preset) => (
          <button
            key={preset.name}
            onClick={() => handleSelectFromPreset(preset)}
            className="brew-picker-row flex justify-between items-center group"
          >
            <div className="flex items-center gap-3">
              <YeastLabBadge
                laboratory={preset.category}
                size="sm"
                className="group-hover:scale-110 transition-transform"
              />
              <span className="font-medium">{preset.name}</span>
            </div>
            <span className="text-sm font-medium text-muted">
              {preset.attenuationPercent
                ? `${(preset.attenuationPercent * 100).toFixed(0)}%`
                : "–"}
            </span>
          </button>
        )}
        totalCount={yeastPresetsGrouped.reduce(
          (sum, group) => sum + group.items.length,
          0
        )}
        countLabel="yeast strains available"
        onCreateCustom={() => setIsCustomModalOpen(true)}
        colorScheme="amber"
      />

      {/* Custom Yeast Modal */}
      <CustomYeastModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={handleSaveCustomPreset}
      />
    </div>
  );
}
