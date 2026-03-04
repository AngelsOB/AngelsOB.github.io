'use client';

/**
 * CustomHopModal Component
 *
 * Modal for creating custom hop presets.
 * Allows users to define their own hops with:
 * - Name
 * - Alpha Acid %
 * - Category (optional)
 * - Flavor profile (optional - can be added later if desired)
 */

import { useState } from "react";
import type { HopPreset } from "../../domain/models/Presets";
import Input from "@components/Input";
import Button from "@components/Button";
import { toast } from "../../../../stores/toastStore";
import ModalOverlay from "./ModalOverlay";

interface CustomHopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: HopPreset) => void;
}

export default function CustomHopModal({
  isOpen,
  onClose,
  onSave,
}: CustomHopModalProps) {
  const [name, setName] = useState("");
  const [alphaAcidPercent, setAlphaAcidPercent] = useState(10);
  const [category, setCategory] = useState("Custom");

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please enter a hop name");
      return;
    }

    const newPreset: HopPreset = {
      name: name.trim(),
      alphaAcidPercent,
      category,
      // Flavor profile can be added in a future enhancement
    };

    onSave(newPreset);
    handleClose();
  };

  const handleClose = () => {
    setName("");
    setAlphaAcidPercent(10);
    setCategory("Custom");
    onClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-6">
        <h3 id="modal-title" className="text-xl font-semibold mb-4">Create Custom Hop</h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="custom-hop-name" className="block text-sm font-semibold mb-2">
              Hop Name *
            </label>
            <Input
              id="custom-hop-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Custom Hop Blend"
              fullWidth
              autoFocus
            />
          </div>

          {/* Alpha Acid */}
          <div>
            <label htmlFor="custom-hop-alpha-acid" className="block text-sm font-semibold mb-2">
              Alpha Acid %
            </label>
            <Input
              id="custom-hop-alpha-acid"
              type="number"
              value={alphaAcidPercent}
              onChange={(e) => setAlphaAcidPercent(parseFloat(e.target.value) || 0)}
              fullWidth
              step={0.1}
              min={0}
              max={25}
            />
            <p className="text-xs mt-1">
              Typical range: Aroma hops 3-6%, Dual-purpose 6-12%, Bittering 12-18%
            </p>
          </div>

          {/* Category */}
          <div>
            <label htmlFor="custom-hop-category" className="block text-sm font-semibold mb-2">
              Category
            </label>
            <Input
              id="custom-hop-category"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Custom, Bittering, Aroma, Dual-Purpose"
              fullWidth
            />
          </div>

          <div className="bg-[rgb(var(--brew-card-inset)/0.4)] border border-[rgb(var(--brew-border-subtle))] rounded-md p-3">
            <p className="text-xs">
              Note: Custom hops won't have flavor profile data. You can still use them for
              calculations and scheduling.
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
