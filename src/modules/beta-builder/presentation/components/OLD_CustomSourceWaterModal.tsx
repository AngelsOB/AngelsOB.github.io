'use client';

/**
 * Custom Source Water Modal
 *
 * Small form modal for creating a custom water profile.
 * Follows the same pattern as CustomFermentableModal, CustomHopModal, etc.
 */

import { useState } from "react";
import { COMMON_WATER_PROFILES, type WaterProfile } from "../../domain/services/WaterChemistryService";
import Button from "@components/Button";
import ModalOverlay from "./ModalOverlay";

const ION_FIELDS: Array<{ key: keyof WaterProfile; label: string; hint: string }> = [
  { key: "Ca", label: "Calcium (Ca)", hint: "50–200 ppm typical" },
  { key: "Mg", label: "Magnesium (Mg)", hint: "15–30 ppm typical" },
  { key: "Na", label: "Sodium (Na)", hint: "<100 ppm typical" },
  { key: "Cl", label: "Chloride (Cl)", hint: "50–200 ppm typical" },
  { key: "SO4", label: "Sulfate (SO₄)", hint: "0–500 ppm (style dependent)" },
  { key: "HCO3", label: "Bicarbonate (HCO₃)", hint: "0–300 ppm typical" },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: WaterProfile, name: string) => void;
  initialProfile: WaterProfile;
  initialName: string;
};

export default function OLD_CustomSourceWaterModal({
  isOpen,
  onClose,
  onSave,
  initialProfile,
  initialName,
}: Props) {
  const [name, setName] = useState(initialName);
  const [profile, setProfile] = useState<WaterProfile>(initialProfile);

  const handleSave = () => {
    onSave(profile, name.trim() || "Custom");
    handleClose();
  };

  const handleClose = () => {
    setName(initialName);
    setProfile(initialProfile);
    onClose();
  };

  const handleIonChange = (ion: keyof WaterProfile, value: number) => {
    setProfile({ ...profile, [ion]: value });
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-6">
        <h3 className="text-xl font-semibold mb-4">Create Custom Water Profile</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="custom-water-name" className="block text-sm font-semibold mb-2">
              Profile Name *
            </label>
            <input
              id="custom-water-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Well Water"
              className="brew-input w-full"
              autoFocus
              data-autofocus
            />
          </div>

          {/* Quick start */}
          <div>
            <span className="block text-xs text-muted mb-2">Quick start from preset:</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(COMMON_WATER_PROFILES).map(([n, p]) => (
                <button
                  key={n}
                  onClick={() => { setProfile(p); setName(n); }}
                  className="brew-chip px-3 py-1 text-xs rounded-lg"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Ion inputs */}
          <div className="grid grid-cols-2 gap-3">
            {ION_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <label htmlFor={`water-ion-${key}`} className="block text-xs font-semibold mb-1">
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={`water-ion-${key}`}
                    type="number"
                    value={profile[key] || ""}
                    onChange={(e) => handleIonChange(key, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    step="1"
                    min="0"
                    className="brew-input w-full pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                    ppm
                  </span>
                </div>
                <p className="text-[10px] text-muted mt-0.5">{hint}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={handleClose} fullWidth>
            Cancel
          </Button>
          <Button variant="neon" onClick={handleSave} fullWidth>
            Use Profile
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
