'use client';

/**
 * Custom Target Style Modal
 *
 * Allows users to create a custom water target profile by specifying
 * target ion concentrations. Similar pattern to CustomSourceWaterModal.
 */

import { useState, useRef } from "react";
import { BEER_STYLE_TARGETS, type WaterProfile } from "../../domain/services/WaterChemistryService";
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

const DEFAULT_PROFILE: WaterProfile = { Ca: 75, Mg: 15, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: WaterProfile, name: string) => void;
  initialProfile?: WaterProfile;
  initialName?: string;
};

export default function CustomTargetStyleModal({ isOpen, onClose, onSave, initialProfile, initialName }: Props) {
  const [name, setName] = useState(initialName || "");
  const [profile, setProfile] = useState<WaterProfile>(initialProfile || DEFAULT_PROFILE);

  // Reset to initial values when modal opens
  const prevOpen = useRef(false);
  if (isOpen && !prevOpen.current) {
    // Transition from closed → open: reset state
    if (initialProfile) setProfile(initialProfile);
    else setProfile(DEFAULT_PROFILE);
    setName(initialName || "");
  }
  prevOpen.current = isOpen;

  const handleSave = () => {
    onSave(profile, name.trim() || "Custom Target");
    handleClose();
  };

  const handleClose = () => {
    setName("");
    setProfile(DEFAULT_PROFILE);
    onClose();
  };

  const handleIonChange = (ion: keyof WaterProfile, value: number) => {
    setProfile({ ...profile, [ion]: value });
  };

  const clToSo4 = profile.SO4 > 0 ? (profile.Cl / profile.SO4).toFixed(1) : "∞";
  const ratioLabel =
    profile.Cl / (profile.SO4 || 1) > 1.5
      ? "Malty"
      : profile.Cl / (profile.SO4 || 1) < 0.7
        ? "Hoppy"
        : "Balanced";

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-6">
        <h3 id="modal-title" className="text-xl font-semibold mb-4">Create Custom Target</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="custom-target-name" className="block text-sm font-semibold mb-2">
              Target Name
            </label>
            <input
              id="custom-target-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Hoppy Target"
              className="brew-input w-full"
              autoFocus
              data-autofocus
            />
          </div>

          {/* Quick start from existing style */}
          <div>
            <span className="block text-xs text-muted mb-2">Quick start from style:</span>
            <div className="flex flex-wrap gap-2">
              {["Balanced", "American IPA", "NEIPA / Hazy IPA", "Pilsner", "Stout / Porter"].map(
                (styleName) => {
                  const target = BEER_STYLE_TARGETS[styleName];
                  if (!target) return null;
                  return (
                    <button
                      key={styleName}
                      onClick={() => {
                        setProfile(target.profile);
                        setName(styleName);
                      }}
                      className="brew-chip px-3 py-1 text-xs rounded-lg"
                    >
                      {styleName}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Ion inputs */}
          <div className="grid grid-cols-2 gap-3">
            {ION_FIELDS.map(({ key, label, hint }) => (
              <div key={key}>
                <label htmlFor={`target-ion-${key}`} className="block text-xs font-semibold mb-1">
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={`target-ion-${key}`}
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

          {/* Cl:SO4 ratio preview */}
          <div
            className="text-sm p-3 rounded-lg"
            style={{
              background:
                'color-mix(in oklch, var(--brew-accent-900) 15%, color-mix(in oklch, var(--brew-card-inset) 35%, transparent))',
              border:
                '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))',
            }}
          >
            Cl:SO₄ ratio: <strong>{clToSo4}:1</strong> ({ratioLabel})
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={handleClose} fullWidth>
            Cancel
          </Button>
          <Button variant="neon" onClick={handleSave} fullWidth>
            Use Target
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
