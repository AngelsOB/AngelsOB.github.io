'use client';

/**
 * Fermentable Preset Modal Component
 *
 * Modal for selecting fermentable presets with:
 * - Search functionality
 * - Advanced filtering by type, color, origin
 * - Grouped display by category
 * - Create custom preset option
 */

import { useState, useMemo } from "react";
import type { FermentablePreset } from "../../domain/models/Presets";
import ModalOverlay from "./ModalOverlay";
import CustomFermentableModal from "./CustomFermentableModal";
import { getCountryFlag, BREWING_ORIGINS } from "../../../../utils/flags";

interface FermentablePresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (preset: FermentablePreset) => void;
  presetsGrouped: Array<{ label: string; items: FermentablePreset[] }>;
  isLoading?: boolean;
  onSaveCustomPreset: (preset: FermentablePreset) => void;
}

export default function FermentablePresetModal({
  isOpen,
  onClose,
  onSelect,
  presetsGrouped,
  isLoading = false,
  onSaveCustomPreset,
}: FermentablePresetModalProps) {
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    origins: [] as string[],
    types: [] as string[], // 'grain', 'extract', 'sugar', 'adjunct'
    colors: [] as string[], // 'light', 'amber', 'dark', 'roasted'
  });

  // Get unique origins for filter
  const availableOrigins = useMemo(() => {
    const origins = new Set<string>();
    presetsGrouped.forEach((group) => {
      group.items.forEach((item) => {
        if (item.originCode) origins.add(item.originCode);
      });
    });
    return Array.from(origins).sort();
  }, [presetsGrouped]);

  // Filter presets by search query and active filters
  const filteredGrouped = useMemo(() => {
    return presetsGrouped
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
          let presetType: string = preset.type;
          if (
            preset.type === "grain" &&
            (preset.name.toLowerCase().includes("adjunct") ||
              preset.name.toLowerCase().includes("flak") ||
              preset.name.toLowerCase().includes("torrified"))
          ) {
            presetType = "adjunct_mashable";
          }

          const matchesType =
            activeFilters.types.length === 0 ||
            activeFilters.types.includes(presetType);

          // 4. Color Filter
          let colorCategory = "light";
          if (preset.colorLovibond >= 10 && preset.colorLovibond < 50)
            colorCategory = "amber";
          else if (preset.colorLovibond >= 50 && preset.colorLovibond < 200)
            colorCategory = "dark";
          else if (preset.colorLovibond >= 200) colorCategory = "roasted";

          const matchesColor =
            activeFilters.colors.length === 0 ||
            activeFilters.colors.includes(colorCategory);

          return matchesSearch && matchesOrigin && matchesType && matchesColor;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [presetsGrouped, searchQuery, activeFilters]);

  const toggleFilter = (
    category: keyof typeof activeFilters,
    value: string
  ) => {
    setActiveFilters((prev) => {
      const current = prev[category];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [category]: next };
    });
  };

  const handleClose = () => {
    setSearchQuery("");
    setActiveFilters({ origins: [], types: [], colors: [] });
    setShowFilters(false);
    onClose();
  };

  const handleSelect = (preset: FermentablePreset) => {
    onSelect(preset);
    handleClose();
  };

  return (
    <>
      <ModalOverlay isOpen={isOpen} onClose={handleClose} size="3xl">
          {/* Modal Header */}
          <div className="p-6 border-b border-[rgb(var(--brew-border-subtle))]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="brew-section-title">Select Fermentable</h3>
              <button
                onClick={handleClose}
                className="text-[var(--fg-muted)] hover:text-[var(--fg-strong)] text-2xl transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Search */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="Search fermentables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="brew-input flex-1"
                autoFocus
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? "brew-chip-active px-3 py-2 rounded-lg" : "brew-chip px-3 py-2 rounded-lg"}
                title="Toggle Filters"
                aria-expanded={showFilters}
                aria-label="Toggle filters"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="space-y-3 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                {/* Type Filters */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="py-1 px-2 font-semibold text-muted uppercase" style={{ letterSpacing: 'var(--brew-tracking-wide)' }}>
                    Type:
                  </span>
                  {["grain", "extract", "sugar", "adjunct_mashable"].map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() => toggleFilter("types", type)}
                        className={activeFilters.types.includes(type) ? "brew-chip-active px-3 py-1" : "brew-chip px-3 py-1"}
                      >
                        {type === "adjunct_mashable"
                          ? "Adjunct"
                          : type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    )
                  )}
                </div>

                {/* Color Filters */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="py-1 px-2 font-semibold text-muted uppercase" style={{ letterSpacing: 'var(--brew-tracking-wide)' }}>
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
                      className={activeFilters.colors.includes(opt.id) ? "brew-chip-active px-3 py-1" : "brew-chip px-3 py-1"}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Origin Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide text-xs">
                  <span className="py-1 px-2 font-semibold text-muted uppercase whitespace-nowrap" style={{ letterSpacing: 'var(--brew-tracking-wide)' }}>
                    Origin:
                  </span>
                  {availableOrigins.map((code) => (
                    <button
                      key={code}
                      onClick={() => toggleFilter("origins", code)}
                      className={`${activeFilters.origins.includes(code) ? "brew-chip-active" : "brew-chip"} px-3 py-1 whitespace-nowrap flex items-center gap-1`}
                    >
                      <span>{getCountryFlag(code)}</span>
                      {BREWING_ORIGINS[code] || code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Modal Body - Scrollable List */}
          <div className="flex-1 overflow-y-auto pb-4">
            {isLoading ? (
              <p className="text-muted px-6 py-8 text-center">
                Loading presets...
              </p>
            ) : filteredGrouped.length === 0 ? (
              <p className="text-muted px-6 py-8 text-center">
                No fermentables found
              </p>
            ) : (
              <div className="space-y-6">
                {filteredGrouped.map((group) => (
                  <div key={group.label}>
                    <h4 className="text-sm font-bold uppercase sticky top-0 z-10 backdrop-blur-md px-6 py-2 border-b border-[rgb(var(--brew-border-subtle))]" style={{ letterSpacing: 'var(--brew-tracking-wide)', background: 'color-mix(in oklch, var(--brew-accent-200) 55%, rgb(var(--brew-card) / 0.9))' }}>
                      {group.label}
                    </h4>
                    <div className="grid gap-1.5 px-6 pt-2 pb-1">
                      {group.items.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => handleSelect(preset)}
                          className="brew-picker-row flex justify-between items-center"
                        >
                          <span className="font-medium flex items-center gap-2">
                            {preset.originCode && (
                              <span
                                className="text-xl"
                                title={BREWING_ORIGINS[preset.originCode]}
                              >
                                {getCountryFlag(preset.originCode)}
                              </span>
                            )}
                            {preset.name}
                          </span>
                          <span className="text-sm font-medium text-muted">
                            {preset.colorLovibond}°L | {preset.potentialGu} PPG
                            {preset.originCode && ` | ${preset.originCode}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-[rgb(var(--brew-border-subtle))] flex justify-between items-center">
            <div className="text-sm text-muted">
              {presetsGrouped.reduce((sum, group) => sum + group.items.length, 0)}{" "}
              presets available
            </div>
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="brew-btn-primary text-sm"
            >
              + Create Custom
            </button>
          </div>
      </ModalOverlay>

      {/* Custom Fermentable Modal */}
      <CustomFermentableModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={onSaveCustomPreset}
      />
    </>
  );
}
