'use client';

/**
 * Source Water Modal Component
 *
 * Uses PresetPickerModal (same as grains/hops/yeast) for consistent UX.
 */

import { useState, useMemo } from "react";
import { COMMON_WATER_PROFILES, type WaterProfile } from "../../domain/services/WaterChemistryService";
import PresetPickerModal from "./PresetPickerModal";
import OLD_CustomSourceWaterModal from "./OLD_CustomSourceWaterModal";

type WaterProfilePreset = {
  name: string;
  profile: WaterProfile;
};

const ALL_PRESETS: WaterProfilePreset[] = Object.entries(COMMON_WATER_PROFILES).map(
  ([name, profile]) => ({ name, profile })
);

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profile: WaterProfile, profileName: string) => void;
  currentProfile: WaterProfile;
  currentProfileName?: string;
};

export default function OLD_SourceWaterModal({
  isOpen,
  onClose,
  onSelect,
  currentProfile,
  currentProfileName,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const items = q
      ? ALL_PRESETS.filter((p) => p.name.toLowerCase().includes(q))
      : ALL_PRESETS;
    if (items.length === 0) return [];
    return [{ label: "Water Profiles", items }];
  }, [searchQuery]);

  const handleSelect = (preset: WaterProfilePreset) => {
    onSelect(preset.profile, preset.name);
    onClose();
    setSearchQuery("");
  };

  const handleCustomSave = (profile: WaterProfile, name: string) => {
    onSelect(profile, name);
    onClose();
    setIsCustomModalOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      <PresetPickerModal<WaterProfilePreset>
        isOpen={isOpen}
        onClose={() => {
          onClose();
          setSearchQuery("");
        }}
        title="Select Source Water"
        searchPlaceholder="Search water profiles..."
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showFilters={false}
        onToggleFilters={() => {}}
        groups={filteredGroups}
        isLoading={false}
        emptyMessage="No water profiles found"
        renderItem={(preset) => (
            <button
              key={preset.name}
              onClick={() => handleSelect(preset)}
              className="brew-picker-row flex flex-col gap-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{preset.name}</span>
                <span className="text-xs text-muted">
                  Ca {preset.profile.Ca} · Cl {preset.profile.Cl} · SO₄ {preset.profile.SO4}
                </span>
              </div>
              <div className="text-xs text-muted mt-1">
                Mg {preset.profile.Mg} · Na {preset.profile.Na} · HCO₃ {preset.profile.HCO3}
              </div>
            </button>
        )}
        totalCount={ALL_PRESETS.length}
        countLabel="profiles available"
        onCreateCustom={() => setIsCustomModalOpen(true)}
      />

      <OLD_CustomSourceWaterModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={handleCustomSave}
        initialProfile={currentProfile}
        initialName={
          currentProfileName && !COMMON_WATER_PROFILES[currentProfileName]
            ? currentProfileName
            : "Custom"
        }
      />
    </>
  );
}
