'use client';

/**
 * Target Style Modal Component
 *
 * Uses PresetPickerModal (same as grains/hops/yeast) for consistent UX.
 */

import { useState, useMemo } from "react";
import { BEER_STYLE_TARGETS } from "../../domain/services/WaterChemistryService";
import PresetPickerModal from "./PresetPickerModal";

type StylePreset = {
  name: string;
  description: string;
  clToSo4Ratio: string;
  ca: number;
  cl: number;
  so4: number;
};

const STYLE_CATEGORIES: Record<string, string[]> = {
  "Hoppy Ales": ["West Coast IPA", "American IPA", "American Pale Ale", "NEIPA / Hazy IPA", "English IPA"],
  Lagers: ["Pilsner", "German Pilsner", "Munich Helles"],
  "Dark Ales": ["Stout / Porter", "Irish Stout", "Brown Ale"],
  "Belgian & Other": ["Belgian Ale", "Blonde / Cream Ale", "Balanced"],
};

function buildPresets(): { groups: { label: string; items: StylePreset[] }[]; all: StylePreset[] } {
  const groups: { label: string; items: StylePreset[] }[] = [];
  const all: StylePreset[] = [];
  for (const [category, styles] of Object.entries(STYLE_CATEGORIES)) {
    const items: StylePreset[] = [];
    for (const name of styles) {
      const t = BEER_STYLE_TARGETS[name];
      if (!t) continue;
      const preset: StylePreset = {
        name,
        description: t.description,
        clToSo4Ratio: t.clToSo4Ratio,
        ca: t.profile.Ca,
        cl: t.profile.Cl,
        so4: t.profile.SO4,
      };
      items.push(preset);
      all.push(preset);
    }
    groups.push({ label: category, items });
  }
  return { groups, all };
}

const { groups: ALL_GROUPS, all: ALL_PRESETS } = buildPresets();

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (styleName: string) => void;
  currentStyleName?: string;
};

export default function TargetStyleModal({
  isOpen,
  onClose,
  onSelect,
  currentStyleName,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return ALL_GROUPS;
    const q = searchQuery.toLowerCase();
    return ALL_GROUPS
      .map((g) => ({
        label: g.label,
        items: g.items.filter(
          (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [searchQuery]);

  const handleSelect = (preset: StylePreset) => {
    onSelect(preset.name);
    onClose();
    setSearchQuery("");
  };

  return (
    <PresetPickerModal<StylePreset>
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setSearchQuery("");
      }}
      title="Select Target Water Style"
      searchPlaceholder="Search styles..."
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      showFilters={false}
      onToggleFilters={() => {}}
      groups={filteredGroups}
      isLoading={false}
      emptyMessage="No styles found"
      renderItem={(preset) => (
          <button
            key={preset.name}
            onClick={() => handleSelect(preset)}
            className="brew-picker-row flex flex-col gap-1"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">{preset.name}</span>
              <span className="brew-tag text-[10px] ml-2 shrink-0">
                {preset.clToSo4Ratio}
              </span>
            </div>
            <p className="text-xs text-muted mb-2">{preset.description}</p>
            <div className="flex gap-4 text-xs text-muted">
              <span>Ca <strong className="text-[var(--fg-strong)]">{preset.ca}</strong></span>
              <span>Cl <strong className="text-[var(--fg-strong)]">{preset.cl}</strong></span>
              <span>SO₄ <strong className="text-[var(--fg-strong)]">{preset.so4}</strong></span>
            </div>
          </button>
      )}
      totalCount={ALL_PRESETS.length}
      countLabel="styles available"
      onCreateCustom={() => {
        // No custom creation for target styles — just close
        onClose();
      }}
    />
  );
}
