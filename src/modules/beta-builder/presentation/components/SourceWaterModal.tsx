'use client';

/**
 * Source Water Modal Component
 *
 * Modal for selecting or customizing source water profiles
 * Follows the same pattern as other modals in the app
 */

import { useState } from "react";
import { COMMON_WATER_PROFILES, type WaterProfile } from "../../domain/services/WaterChemistryService";
import ModalOverlay from "./ModalOverlay";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profile: WaterProfile, profileName: string) => void;
  currentProfile: WaterProfile;
  currentProfileName?: string;
};

const ION_LABELS: Array<{ key: keyof WaterProfile; label: string; unit: string }> = [
  { key: "Ca", label: "Calcium (Ca)", unit: "ppm" },
  { key: "Mg", label: "Magnesium (Mg)", unit: "ppm" },
  { key: "Na", label: "Sodium (Na)", unit: "ppm" },
  { key: "Cl", label: "Chloride (Cl)", unit: "ppm" },
  { key: "SO4", label: "Sulfate (SO\u2084)", unit: "ppm" },
  { key: "HCO3", label: "Bicarbonate (HCO\u2083)", unit: "ppm" },
];

export default function SourceWaterModal({
  isOpen,
  onClose,
  onSelect,
  currentProfile,
  currentProfileName,
}: Props) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customProfile, setCustomProfile] = useState<WaterProfile>(currentProfile);
  const [customName, setCustomName] = useState(
    currentProfileName && !COMMON_WATER_PROFILES[currentProfileName]
      ? currentProfileName
      : "Custom"
  );

  if (!isOpen) return null;

  const handlePresetSelect = (profileName: string) => {
    const profile = COMMON_WATER_PROFILES[profileName];
    if (!profile) return;
    onSelect(profile, profileName);
    onClose();
  };

  const handleCustomSave = () => {
    onSelect(customProfile, customName);
    onClose();
  };

  const handleIonChange = (ion: keyof WaterProfile, value: number) => {
    setCustomProfile({
      ...customProfile,
      [ion]: value,
    });
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="3xl">
        {/* Header */}
        <div className="border-b border-[rgb(var(--brew-border-subtle))] px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Select Source Water Profile</h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-[var(--fg-muted)] hover:text-[var(--fg-strong)] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-muted mt-2">
            Choose a common water profile or create a custom one
          </p>
        </div>

        <div className="px-6 py-4">
          {/* Toggle between Preset and Custom */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsCustomMode(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-150 ${
                !isCustomMode
                  ? "brew-chip-active"
                  : "brew-chip"
              }`}
            >
              Common Profiles
            </button>
            <button
              onClick={() => {
                setIsCustomMode(true);
                setCustomProfile(currentProfile);
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-150 ${
                isCustomMode
                  ? "brew-chip-active"
                  : "brew-chip"
              }`}
            >
              Custom Profile
            </button>
          </div>

          {/* Common Profiles View */}
          {!isCustomMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(COMMON_WATER_PROFILES).map(([name, profile]) => {
                const isSelected = currentProfileName === name;

                return (
                  <button
                    key={name}
                    onClick={() => handlePresetSelect(name)}
                    className={`text-left p-4 rounded-lg transition-all duration-150 group relative ${
                      isSelected
                        ? "brew-chip-active"
                        : "brew-ingredient-row"
                    }`}
                    title={`Ca: ${profile.Ca} | Mg: ${profile.Mg} | Na: ${profile.Na} | Cl: ${profile.Cl} | SO4: ${profile.SO4} | HCO3: ${profile.HCO3}`}
                  >
                    <div className="font-semibold mb-3">
                      {name}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="brew-gauge p-2 rounded-lg">
                        <div className="text-muted text-[10px]">Ca</div>
                        <div className="font-semibold">{profile.Ca}</div>
                      </div>
                      <div className="brew-gauge p-2 rounded-lg">
                        <div className="text-muted text-[10px]">Cl</div>
                        <div className="font-semibold">{profile.Cl}</div>
                      </div>
                      <div className="brew-gauge p-2 rounded-lg">
                        <div className="text-muted text-[10px]">SO4</div>
                        <div className="font-semibold">{profile.SO4}</div>
                      </div>
                    </div>

                    {/* Hover tooltip with all ions */}
                    <div className="absolute left-0 right-0 top-full mt-1 p-3 text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 pointer-events-none" style={{ background: 'rgb(var(--brew-card) / 0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgb(var(--brew-border) / 0.5)' }}>
                      <div className="grid grid-cols-3 gap-2">
                        <div>Ca: {profile.Ca}</div>
                        <div>Mg: {profile.Mg}</div>
                        <div>Na: {profile.Na}</div>
                        <div>Cl: {profile.Cl}</div>
                        <div>SO4: {profile.SO4}</div>
                        <div>HCO3: {profile.HCO3}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Custom Profile View */}
          {isCustomMode && (
            <div className="space-y-4">
              {/* Profile Name Input */}
              <div>
                <label htmlFor="water-profile-name" className="block text-sm font-semibold mb-2">
                  Profile Name
                </label>
                <input
                  id="water-profile-name"
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g., My Well Water"
                  className="brew-input w-full"
                />
              </div>

              {/* Ion Inputs */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Ion Concentrations (ppm)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ION_LABELS.map(({ key, label, unit }) => (
                    <div key={key}>
                      <label htmlFor={`water-ion-${key}`} className="block text-xs mb-1 text-muted">
                        {label}
                      </label>
                      <div className="relative">
                        <input
                          id={`water-ion-${key}`}
                          type="number"
                          value={customProfile[key] || ""}
                          onChange={(e) =>
                            handleIonChange(key, parseFloat(e.target.value) || 0)
                          }
                          placeholder="0"
                          step="1"
                          min="0"
                          className="brew-input w-full pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                          {unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Start from Preset */}
              <div className="border-t border-[rgb(var(--brew-border-subtle))] pt-4">
                <h4 className="text-sm font-semibold mb-2">Quick Start from Preset</h4>
                <p className="text-xs text-muted mb-2">
                  Load a common profile as a starting point
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COMMON_WATER_PROFILES).map(([name, profile]) => (
                    <button
                      key={name}
                      onClick={() => {
                        setCustomProfile(profile);
                        setCustomName(name);
                      }}
                      className="brew-chip px-3 py-1 text-sm rounded-lg"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[rgb(var(--brew-border-subtle))]">
                <button onClick={onClose} className="brew-btn-ghost">
                  Cancel
                </button>
                <button onClick={handleCustomSave} className="brew-btn-primary">
                  Use Custom Profile
                </button>
              </div>
            </div>
          )}
        </div>
    </ModalOverlay>
  );
}
