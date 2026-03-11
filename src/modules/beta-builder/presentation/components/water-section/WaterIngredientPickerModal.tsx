'use client';

/**
 * Water Ingredient Picker Modal Component
 *
 * Modal for selecting preset ingredients to add to the recipe.
 * Supports search filtering and category-based filtering.
 */

import { useMemo, useState } from "react";
import type { OtherIngredientCategory } from "../../../domain/models/Recipe";
import { OTHER_INGREDIENT_PRESETS } from "../../../../../utils/presets";
import ModalOverlay from "../ModalOverlay";
import { CATEGORY_LABELS } from "./constants";

type Props = {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal closes */
  onClose: () => void;
  /** Callback when a preset ingredient is selected */
  onSelect: (name: string, category: OtherIngredientCategory) => void;
  /** Callback to open the custom ingredient modal */
  onOpenCustomModal: () => void;
};

export default function WaterIngredientPickerModal({
  isOpen,
  onClose,
  onSelect,
  onOpenCustomModal,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<OtherIngredientCategory | "all">("all");

  const filteredPresets = useMemo(() => {
    const categories = Object.entries(OTHER_INGREDIENT_PRESETS) as [
      OtherIngredientCategory,
      readonly string[],
    ][];
    return categories
      .filter(([cat]) => activeCategory === "all" || cat === activeCategory)
      .map(([cat, items]) => ({
        category: cat as OtherIngredientCategory,
        label: CATEGORY_LABELS[cat as OtherIngredientCategory],
        items: items.filter((name) =>
          name.toLowerCase().includes(search.toLowerCase())
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [search, activeCategory]);

  const handleClose = () => {
    setSearch("");
    setActiveCategory("all");
    onClose();
  };

  const handleSelect = (name: string, category: OtherIngredientCategory) => {
    onSelect(name, category);
    handleClose();
  };

  const handleOpenCustom = () => {
    handleClose();
    onOpenCustomModal();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="p-4 border-b border-[rgb(var(--brew-border-subtle))]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="brew-section-title">Add Ingredient</h3>
          <button
            onClick={handleClose}
            className="p-1 transition-colors" style={{ color: 'var(--fg-muted)' }}
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ingredients..."
          autoFocus
          data-autofocus
          className="brew-input w-full mb-3"
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory("all")}
            className={activeCategory === "all" ? "brew-chip-active text-xs px-2.5 py-1" : "brew-chip text-xs px-2.5 py-1"}
          >
            All
          </button>
          {(Object.keys(CATEGORY_LABELS) as OtherIngredientCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={activeCategory === cat ? "brew-chip-active text-xs px-2.5 py-1" : "brew-chip text-xs px-2.5 py-1"}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[50vh] p-2">
        {filteredPresets.length === 0 ? (
          <div className="text-sm text-muted text-center py-8">
            No ingredients match your search
          </div>
        ) : (
          filteredPresets.map((group) => (
            <div key={group.category} className="mb-2">
              <div className="sticky top-0 backdrop-blur-md px-2 py-1.5 text-xs font-semibold text-muted uppercase" style={{ letterSpacing: 'var(--brew-tracking-wide)', background: 'color-mix(in oklch, var(--brew-accent-200) 55%, color-mix(in oklch, var(--brew-card) 90%, transparent))' }}>
                {group.label}
              </div>
              <div className="grid gap-1.5 pt-1.5 pb-1">
                {group.items.map((name) => (
                  <button
                    key={name}
                    onClick={() => handleSelect(name, group.category)}
                    className="brew-picker-row text-sm"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-[rgb(var(--brew-border-subtle))] flex items-center justify-between">
        <span className="text-xs text-muted">
          {filteredPresets.reduce((sum, g) => sum + g.items.length, 0)} ingredients
        </span>
        <button
          onClick={handleOpenCustom}
          className="brew-btn-primary text-sm"
        >
          + Create Custom
        </button>
      </div>
    </ModalOverlay>
  );
}
