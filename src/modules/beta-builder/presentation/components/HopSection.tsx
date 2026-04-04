/**
 * Hop Section Component
 *
 * Displays the hop schedule with:
 * - Preset picker modal for adding hops
 * - Timing controls (boil, whirlpool, dry hop, first wort, mash)
 * - Inline editing of hop properties
 * - Per-hop IBU contribution and g/L display
 * - Remove buttons
 */

import { useEffect, useState, useMemo } from "react";
import { uid } from "@/utils/uid";
import { createPortal } from "react-dom";
import { useRecipeStore } from "../stores/recipeStore";
import { usePresetStore } from "../stores/presetStore";
import EmptyState from "../../../../components/EmptyState";
import { useRecipeCalculations } from "../hooks/useRecipeCalculations";
import { useHopGroups } from "../hooks/useHopGroups";
import type { Hop } from "../../domain/models/Recipe";
import type { HopPreset, HopFlavorProfile } from "../../domain/models/Presets";
import { hopFlavorCalculationService } from "../../domain/services/HopFlavorCalculationService";
import {
  getBjcpFlavorProfile,
  getBjcpFlavorLabel,
  getBjcpHopNote,
} from "@/data/bjcpFlavorProfiles";
import HopFlavorMini from "./HopFlavorMini";
import HopFlavorRadar from "./HopFlavorRadar";
import HopVarietyCard from "./HopVarietyCard";
import { toast } from "../../../../stores/toastStore";
import CustomHopModal from "./CustomHopModal";
import PresetPickerModal from "./PresetPickerModal";

export default function HopSection() {
  const { currentRecipe, addHop, updateHop, removeHop } = useRecipeStore();
  const { hopPresetsGrouped, hopPresets, loadHopPresets, saveHopPreset, isLoading: presetsLoading } =
    usePresetStore();
  const calculations = useRecipeCalculations(currentRecipe);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState({
    origins: [] as string[],
    flavors: [] as string[],
    alphas: [] as string[], // 'low', 'med', 'high', 'super'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [hoveredHopName, setHoveredHopName] = useState<string | null>(null);
  const [hoveredHopPosition, setHoveredHopPosition] = useState<{
    x: number;
    y: number;
    placement: "right" | "left";
  } | null>(null);
  const [flavorViewMode, setFlavorViewMode] = useState<"combined" | "individual">("individual");

  // Load presets on mount
  useEffect(() => {
    loadHopPresets();
  }, [loadHopPresets]);

  // Handle adding a hop from preset
  const handleAddFromPreset = (preset: HopPreset) => {
    const newHop: Hop = {
      id: uid(),
      name: preset.name,
      alphaAcid: preset.alphaAcidPercent,
      grams: 30, // Default weight
      type: "boil", // Default to boil
      timeMinutes: 60, // Default to 60 min boil
      flavor: preset.flavor,
    };
    addHop(newHop);
    setIsPickerOpen(false);
    setSearchQuery("");
    // Clear hover state when closing modal
    setHoveredHopName(null);
    setHoveredHopPosition(null);
  };

  // Handle hover with position tracking and viewport edge detection
  const handleHopHover = (preset: HopPreset, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipWidth = 280; // 240px radar + 32px padding + 8px margin
    const tooltipHeight = 320; // 240px radar + ~80px for title/padding
    const margin = 8;

    // Calculate available space on each side
    const spaceRight = window.innerWidth - rect.right - margin;
    const spaceLeft = rect.left - margin;

    // Determine horizontal placement
    const placement: "right" | "left" =
      spaceRight >= tooltipWidth ? "right" : spaceLeft >= tooltipWidth ? "left" : "right";

    // Calculate x position based on placement
    const x = placement === "right" ? rect.right + margin : rect.left - tooltipWidth - margin;

    // Calculate y position with edge detection
    // Prefer aligning top of tooltip with trigger, but clamp to viewport
    let y = rect.top;
    if (y + tooltipHeight > window.innerHeight - margin) {
      // Would overflow bottom, shift up
      y = Math.max(margin, window.innerHeight - tooltipHeight - margin);
    }

    setHoveredHopName(preset.name);
    setHoveredHopPosition({ x, y, placement });
  };

  const handleHopLeave = () => {
    setHoveredHopName(null);
    setHoveredHopPosition(null);
  };

  // Filter presets by search query
  // Get available categories
  const availableCategories = useMemo(() => {
    return hopPresetsGrouped.map((g) => g.label).sort();
  }, [hopPresetsGrouped]);

  // Filter presets by search query and active filters
  const filteredGrouped = useMemo(() => {
    return hopPresetsGrouped
      .map((group) => ({
        ...group,
        items: group.items.filter((preset) => {
          // 1. Search Query
          const matchesSearch = preset.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase());

          // 2. Origin Filter (matches group label usually, or explicit logic if we had country codes)
          // Using group.label as proxy for Category/Origin
          const matchesOrigin =
            activeFilters.origins.length === 0 ||
            activeFilters.origins.includes(group.label);

          // 3. Alpha Filter
          // low < 5, med 5-10, high 10-15, super > 15
          let alphaCat = "low";
          if (preset.alphaAcidPercent >= 5 && preset.alphaAcidPercent < 10) alphaCat = "med";
          else if (preset.alphaAcidPercent >= 10 && preset.alphaAcidPercent < 15) alphaCat = "high";
          else if (preset.alphaAcidPercent >= 15) alphaCat = "super";

          const matchesAlpha =
            activeFilters.alphas.length === 0 ||
            activeFilters.alphas.includes(alphaCat);

          // 4. Flavor Filter
          // Match if ANY of the selected flavors has a value > 0 (or threshold > 2?)
          // Let's say threshold 3 for "dominant"
          const matchesFlavor =
            activeFilters.flavors.length === 0 ||
            (preset.flavor && activeFilters.flavors.some(f => (preset.flavor as Record<string, number>)[f] >= 3));

          return matchesSearch && matchesOrigin && matchesAlpha && matchesFlavor;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [hopPresetsGrouped, searchQuery, activeFilters]);

  const toggleFilter = (category: keyof typeof activeFilters, value: string) => {
    setActiveFilters(prev => {
      const current = prev[category];
      const next = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  // Get the hovered hop preset for tooltip
  const hoveredPreset = hoveredHopName
    ? hopPresets.find((p) => p.name === hoveredHopName)
    : null;

  // Calculate total hop weight
  const totalHopGrams =
    currentRecipe?.hops.reduce((sum, h) => sum + h.grams, 0) || 0;

  // Build flavor map from presets (memoized for performance)
  const hopFlavorMap = useMemo(() => {
    const map = new Map<string, HopFlavorProfile>();
    for (const preset of hopPresets) {
      if (preset.flavor) {
        map.set(preset.name, preset.flavor);
      }
    }
    return map;
  }, [hopPresets]);

  // Calculate combined flavor profile using domain service
  const combinedFlavor = useMemo(() => {
    if (!currentRecipe || currentRecipe.hops.length === 0) {
      return null;
    }
    return hopFlavorCalculationService.calculateCombinedFlavor(
      currentRecipe.hops,
      hopFlavorMap,
      currentRecipe.batchVolumeL
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to hops/volume changes
  }, [currentRecipe?.hops, currentRecipe?.batchVolumeL, hopFlavorMap]);

  // Group hops by variety for compact rendering
  const hopGroups = useHopGroups(
    currentRecipe?.hops || [],
    currentRecipe?.batchVolumeL || 1,
    calculations?.og || 1.050
  );

  // Handle adding another addition of an existing variety
  const handleAddAddition = (
    varietyName: string,
    alphaAcid: number,
    flavor?: HopFlavorProfile
  ) => {
    const newHop: Hop = {
      id: uid(),
      name: varietyName,
      alphaAcid,
      grams: 30,
      type: "dry hop",
      dryHopStartDay: 3,
      dryHopDays: 3,
      flavor,
    };
    addHop(newHop);
  };

  // Handle saving a custom hop preset
  const handleSaveCustomPreset = (preset: HopPreset) => {
    saveHopPreset(preset);
    toast.success(`"${preset.name}" saved — select it from the list to add`);
  };

  return (
    <div className="brew-section brew-animate-in brew-stagger-4" data-accent="hops">
      <div className="flex justify-between items-center mb-4">
        <h2 className="brew-section-title">Hops</h2>
        <button
          onClick={() => setIsPickerOpen(true)}
          className="brew-btn-primary"
        >
          Add Hop
        </button>
      </div>

      {/* Hop List */}
      {!currentRecipe?.hops.length ? (
        <EmptyState
          message="No hops added yet"
          actionLabel="Add your first hop"
          onAction={() => setIsPickerOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {/* Variety cards in 2-column grid on desktop */}
          <div className={`grid grid-cols-1 ${hopGroups.length >= 2 ? 'lg:grid-cols-2' : ''} gap-3 items-start`}>
            {hopGroups.map((group) => (
              <HopVarietyCard
                key={group.varietyName}
                group={group}
                onUpdateHop={updateHop}
                onRemoveHop={removeHop}
                onAddAddition={handleAddAddition}
              />
            ))}
          </div>

          {/* Total */}
          <div className="flex justify-between items-baseline pt-2 border-t border-[rgb(var(--brew-border-subtle))] mt-2">
            <span className="font-semibold text-strong">Total Hops</span>
            <span className="hop-total-value">{totalHopGrams} <span className="hop-total-unit">g</span></span>
          </div>

          {/* Hop Flavor Visualizer */}
          {currentRecipe.hops.length > 0 && (
            <div className="hop-flavor-panel relative">
              {/* Overlay header — sits on top of chart */}
              <div className="absolute top-3 left-4 right-4 flex justify-between items-center z-10 pointer-events-none">
                <h3 className="text-sm font-semibold pointer-events-auto">
                  {flavorViewMode === "combined"
                    ? "Estimated Recipe Aroma Profile"
                    : "Individual Hop Flavor Profiles"}
                </h3>
                <div className="brew-segmented-toggle pointer-events-auto">
                  <button
                    onClick={() => setFlavorViewMode("individual")}
                    className={flavorViewMode === "individual" ? "is-active" : ""}
                  >
                    By Hop
                  </button>
                  <button
                    onClick={() => setFlavorViewMode("combined")}
                    className={flavorViewMode === "combined" ? "is-active" : ""}
                  >
                    Recipe
                  </button>
                </div>
              </div>
              <HopFlavorRadar
                series={(() => {
                  const recipeSeries: { name: string; flavor: HopFlavorProfile; isTarget?: boolean }[] =
                    flavorViewMode === "combined" && combinedFlavor
                      ? [{ name: "Your Recipe", flavor: combinedFlavor }]
                      : currentRecipe.hops
                          .map((hop) => {
                            const preset = hopPresets.find((p) => p.name === hop.name);
                            return preset?.flavor
                              ? { name: hop.name, flavor: preset.flavor }
                              : null;
                          })
                          .filter((s): s is { name: string; flavor: HopFlavorProfile } => s !== null)
                          .filter((s, i, arr) => arr.findIndex((x) => x.name === s.name) === i);

                  const styleTarget = currentRecipe.style
                    ? getBjcpFlavorProfile(currentRecipe.style)
                    : null;
                  if (styleTarget && flavorViewMode === "combined") {
                    recipeSeries.push({
                      name: getBjcpFlavorLabel(currentRecipe.style!),
                      flavor: styleTarget,
                      isTarget: true,
                    });
                  }
                  return recipeSeries;
                })()}
                maxValue={5}
                emptyHint="No flavor data available"
                colorStrategy={flavorViewMode === "combined" ? "index" : "index"}
                showLegend={flavorViewMode === "individual" || !!getBjcpFlavorProfile(currentRecipe.style)}
                legendPosition="side"
                labelColorize={true}
                responsive
              />
              {/* BJCP hop guideline note */}
              {flavorViewMode === "combined" && (() => {
                const note = getBjcpHopNote(currentRecipe.style);
                if (!note) return null;
                const styleName = currentRecipe.style?.split(".").slice(1).join(".").trim();
                return (
                  <p className="bjcp-hop-note">
                    <span className="bjcp-hop-note-label">BJCP — {styleName}:</span>{" "}
                    {note}
                  </p>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Preset Picker Modal */}
      <PresetPickerModal<HopPreset>
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setSearchQuery("");
          setHoveredHopName(null);
          setHoveredHopPosition(null);
        }}
        title="Select Hop"
        searchPlaceholder="Search hops..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        filterContent={
          <>
            {/* Alpha Filters */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="brew-chip-label">
                Alpha:
              </span>
              {[
                { id: "low", label: "Low (<5%)" },
                { id: "med", label: "Med (5-10%)" },
                { id: "high", label: "High (10-15%)" },
                { id: "super", label: "Super (>15%)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => toggleFilter("alphas", opt.id)}
                  className={`px-3 py-1 rounded-full border transition-colors ${
                    activeFilters.alphas.includes(opt.id)
                      ? "brew-chip-active"
                      : "brew-chip"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Flavor Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide text-xs">
              <span className="brew-chip-label whitespace-nowrap">
                Flavor:
              </span>
              {[
                "citrus",
                "tropicalFruit",
                "stoneFruit",
                "berry",
                "floral",
                "resinPine",
                "spice",
                "herbal",
                "grassy",
              ].map((flavor) => {
                const color =
                  {
                    citrus: "#facc15",
                    tropicalFruit: "#fb923c",
                    stoneFruit: "#f97316",
                    berry: "#a855f7",
                    floral: "#f472b6",
                    resinPine: "#16a34a",
                    spice: "#ef4444",
                    herbal: "#22c55e",
                    grassy: "#84cc16",
                  }[flavor] || "#6b7280";

                const isActive = activeFilters.flavors.includes(flavor);

                return (
                  <button
                    key={flavor}
                    onClick={() => toggleFilter("flavors", flavor)}
                    style={
                      isActive
                        ? {
                            backgroundColor: color,
                            borderColor: color,
                            color: flavor === "citrus" ? "#000" : "#fff",
                          }
                        : {}
                    }
                    className={`px-3 py-1 rounded-full border whitespace-nowrap transition-colors ${
                      isActive
                        ? ""
                        : "brew-chip"
                    }`}
                  >
                    {flavor === "resinPine"
                      ? "Resin/Pine"
                      : flavor === "tropicalFruit"
                        ? "Tropical"
                        : flavor === "stoneFruit"
                          ? "Stone Fruit"
                          : flavor.charAt(0).toUpperCase() + flavor.slice(1)}
                  </button>
                );
              })}
            </div>

            {/* Origin/Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide text-xs">
              <span className="brew-chip-label whitespace-nowrap">
                Region:
              </span>
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleFilter("origins", cat)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors border ${
                    activeFilters.origins.includes(cat)
                      ? "brew-chip-active"
                      : "brew-chip"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </>
        }
        groups={filteredGrouped}
        isLoading={presetsLoading}
        emptyMessage="No hops found"
        renderItem={(preset) => (
          <button
            key={preset.name}
            onClick={() => handleAddFromPreset(preset)}
            onMouseEnter={(e) => handleHopHover(preset, e)}
            onMouseLeave={handleHopLeave}
            className="brew-picker-row flex justify-between items-center"
          >
            <div className="flex items-center gap-3">
              {preset.flavor && <HopFlavorMini flavor={preset.flavor} size={24} />}
              <span className="font-medium">{preset.name}</span>
            </div>
            <span className="text-sm font-medium">
              {preset.alphaAcidPercent.toFixed(1)}% AA
            </span>
          </button>
        )}
        totalCount={hopPresetsGrouped.reduce(
          (sum, group) => sum + group.items.length,
          0
        )}
        countLabel="hop varieties available"
        onCreateCustom={() => setIsCustomModalOpen(true)}
        colorScheme="green"
        portalContent={
          hoveredPreset &&
          hoveredPreset.flavor &&
          hoveredHopPosition &&
          createPortal(
            <div
              style={{
                position: "fixed",
                left: `${hoveredHopPosition.x}px`,
                top: `${hoveredHopPosition.y}px`,
                zIndex: 9999,
                maxWidth: "calc(100vw - 16px)",
                maxHeight: "calc(100vh - 16px)",
              }}
              className="bg-[var(--card)] border-2 border-[var(--brew-accent-400)] rounded-lg shadow-2xl p-4 pointer-events-none"
            >
              <div className="text-sm font-semibold mb-2 text-center">
                {hoveredPreset.name}
              </div>
              <HopFlavorRadar
                series={[{ name: hoveredPreset.name, flavor: hoveredPreset.flavor }]}
                maxValue={5}
                size={240}
                showLegend={false}
                labelColorize={true}
                outerPadding={50}
                ringRadius={70}
                colorStrategy="dominant"
              />
            </div>,
            document.body
          )
        }
      />

      {/* Custom Hop Modal */}
      <CustomHopModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={handleSaveCustomPreset}
      />
    </div>
  );
}
