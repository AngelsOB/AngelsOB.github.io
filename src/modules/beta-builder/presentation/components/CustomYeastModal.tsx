'use client';

/**
 * CustomYeastModal Component
 *
 * Modal for creating custom yeast presets.
 * Allows users to define their own yeast strains with:
 * - Name
 * - Lab/Manufacturer
 * - Product ID
 * - Attenuation %
 * - Type (Ale/Lager/Other)
 */

import { useState } from "react";
import type { YeastPreset } from "../../domain/models/Presets";
import Input from "@components/Input";
import Button from "@components/Button";
import { toast } from "../../../../stores/toastStore";
import ModalOverlay from "./ModalOverlay";

interface CustomYeastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: YeastPreset) => void;
}

export default function CustomYeastModal({
  isOpen,
  onClose,
  onSave,
}: CustomYeastModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Custom");
  const [attenuationPercent, setAttenuationPercent] = useState(75);

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please enter a yeast name");
      return;
    }

    const newPreset: YeastPreset = {
      name: name.trim(),
      category: category.trim(),
      attenuationPercent: attenuationPercent / 100,
    };

    onSave(newPreset);
    handleClose();
  };

  const handleClose = () => {
    setName("");
    setCategory("Custom");
    setAttenuationPercent(75);
    onClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-6">
        <h3 id="modal-title" className="text-xl font-semibold mb-4">Create Custom Yeast</h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="custom-yeast-name" className="block text-sm font-semibold mb-2">
              Yeast Name *
            </label>
            <Input
              id="custom-yeast-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Custom House Blend"
              fullWidth
              autoFocus
            />
          </div>

          {/* Category */}
          <div>
            <label htmlFor="custom-yeast-category" className="block text-sm font-semibold mb-2">
              Category
            </label>
            <Input
              id="custom-yeast-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Custom, Homebrew, House Blend"
              fullWidth
            />
          </div>

          {/* Attenuation */}
          <div>
            <label htmlFor="custom-yeast-attenuation" className="block text-sm font-semibold mb-2">
              Attenuation %
            </label>
            <Input
              id="custom-yeast-attenuation"
              type="number"
              value={attenuationPercent}
              onChange={(e) => setAttenuationPercent(parseFloat(e.target.value) || 0)}
              fullWidth
              step={1}
              min={50}
              max={90}
            />
            <p className="text-xs mt-1">
              Typical range: Low 65-70%, Medium 70-75%, High 75-85%
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
