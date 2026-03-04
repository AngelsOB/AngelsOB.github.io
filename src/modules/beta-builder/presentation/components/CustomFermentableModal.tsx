'use client';

/**
 * CustomFermentableModal Component
 *
 * Modal for creating custom fermentable presets.
 * Allows users to define their own grains/fermentables with:
 * - Name
 * - PPG (Points Per Pound Per Gallon)
 * - Color (Lovibond)
 * - Category
 */

import { useState } from "react";
import type { FermentablePreset } from "../../domain/models/Presets";
import Input from "@components/Input";
import Select from "@components/Select";
import Button from "@components/Button";
import { toast } from "../../../../stores/toastStore";
import ModalOverlay from "./ModalOverlay";

interface CustomFermentableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: FermentablePreset) => void;
}

export default function CustomFermentableModal({
  isOpen,
  onClose,
  onSave,
}: CustomFermentableModalProps) {
  const [name, setName] = useState("");
  const [potentialGu, setPotentialGu] = useState(37);
  const [colorLovibond, setColorLovibond] = useState(2);
  const [type, setType] = useState<FermentablePreset["type"]>("grain");
  const [fermentabilityPct, setFermentabilityPct] = useState(100);

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please enter a fermentable name");
      return;
    }

    const newPreset: FermentablePreset = {
      name: name.trim(),
      potentialGu,
      colorLovibond,
      type,
      fermentability: fermentabilityPct / 100,
    };

    onSave(newPreset);
    handleClose();
  };

  const handleClose = () => {
    setName("");
    setPotentialGu(37);
    setColorLovibond(2);
    setType("grain");
    setFermentabilityPct(100);
    onClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-6">
        <h3 id="modal-title" className="text-xl font-semibold mb-4">Create Custom Fermentable</h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="custom-fermentable-name" className="block text-sm font-semibold mb-2">
              Fermentable Name *
            </label>
            <Input
              id="custom-fermentable-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Custom Pale Malt"
              fullWidth
              autoFocus
            />
          </div>

          {/* PPG */}
          <div>
            <label htmlFor="custom-fermentable-potential-gu" className="block text-sm font-semibold mb-2">
              Potential GU (Gravity Units / PPG)
            </label>
            <Input
              id="custom-fermentable-potential-gu"
              type="number"
              value={potentialGu}
              onChange={(e) => setPotentialGu(parseFloat(e.target.value) || 0)}
              fullWidth
              step={1}
              min={0}
              max={50}
            />
            <p className="text-xs mt-1">
              Typical range: Base malts 35-38, Crystal malts 33-35, Sugars 46
            </p>
          </div>

          {/* Color */}
          <div>
            <label htmlFor="custom-fermentable-color" className="block text-sm font-semibold mb-2">
              Color (°Lovibond)
            </label>
            <Input
              id="custom-fermentable-color"
              type="number"
              value={colorLovibond}
              onChange={(e) => setColorLovibond(parseFloat(e.target.value) || 0)}
              fullWidth
              step={1}
              min={0}
              max={600}
            />
            <p className="text-xs mt-1">
              Pale malt ~2°L, Crystal 20-120°L, Roasted 300-600°L
            </p>
          </div>

          {/* Type */}
          <div>
            <label htmlFor="custom-fermentable-type" className="block text-sm font-semibold mb-2">
              Type
            </label>
            <Select
              id="custom-fermentable-type"
              value={type}
              onChange={(e) => {
                const newType = e.target.value as FermentablePreset["type"];
                setType(newType);
                // Update fermentability default for the new type
                const defaults: Record<FermentablePreset["type"], number> = {
                  grain: 100, adjunct_mashable: 100, extract: 78, sugar: 100,
                };
                setFermentabilityPct(defaults[newType]);
              }}
              fullWidth
            >
              <option value="grain">Grain (Malt)</option>
              <option value="adjunct_mashable">Adjunct (Mashable)</option>
              <option value="extract">Extract</option>
              <option value="sugar">Sugar</option>
            </Select>
          </div>

          {/* Fermentability */}
          <div>
            <label htmlFor="custom-fermentable-fermentability" className="block text-sm font-semibold mb-2">
              Fermentability (%)
            </label>
            <Input
              id="custom-fermentable-fermentability"
              type="number"
              value={fermentabilityPct}
              onChange={(e) => setFermentabilityPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              fullWidth
              step={1}
              min={0}
              max={100}
            />
            <p className="text-xs mt-1">
              Base malts 100%, Crystal ~50%, Sugar 100%, Lactose 0%
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={handleClose} fullWidth>
            Cancel
          </Button>
          <Button variant="neon" onClick={handleSave} fullWidth>
            Create Preset
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
