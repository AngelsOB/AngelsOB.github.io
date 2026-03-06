'use client';

/**
 * Custom Equipment Modal Component
 *
 * Modal for creating custom equipment profiles from current recipe settings.
 */

import { useState } from 'react';
import type { EquipmentProfile } from '../../domain/models/Equipment';
import Input from '@components/Input';
import Textarea from '@components/Textarea';
import Button from '@components/Button';
import ModalOverlay from './ModalOverlay';

interface CustomEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: EquipmentProfile) => void;
  currentSettings: {
    batchVolumeL: number;
    boilTimeMin: number;
    boilOffRateLPerHour: number;
    mashEfficiencyPercent: number;
    mashThicknessLPerKg: number;
    grainAbsorptionLPerKg: number;
    mashTunDeadspaceLiters: number;
    mashTunLossLiters: number;
    kettleLossLiters: number;
    chillerLossLiters: number;
    fermenterLossLiters: number;
    coolingShrinkagePercent: number;
    hopsAbsorptionLPerKg: number;
  };
}

export const CustomEquipmentModal = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
}: CustomEquipmentModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;

    const newProfile: EquipmentProfile = {
      name: name.trim(),
      description: description.trim() || undefined,
      batchSizeL: currentSettings.batchVolumeL,
      boilTimeMin: currentSettings.boilTimeMin,
      boilOffRateL_hr: currentSettings.boilOffRateLPerHour,
      mashThicknessL_kg: currentSettings.mashThicknessLPerKg,
      mashTunDeadspaceL: currentSettings.mashTunDeadspaceLiters,
      mashTunLossL: currentSettings.mashTunLossLiters,
      kettleDeadspaceL: currentSettings.kettleLossLiters,
      chillerLossL: currentSettings.chillerLossLiters,
      fermenterLossL: currentSettings.fermenterLossLiters,
      coolingShrinkagePercent: currentSettings.coolingShrinkagePercent,
      grainAbsorptionL_kg: currentSettings.grainAbsorptionLPerKg,
      hopAbsorptionL_kg: currentSettings.hopsAbsorptionLPerKg,
      mashEfficiency: currentSettings.mashEfficiencyPercent,
      brewhouseEfficiency: currentSettings.mashEfficiencyPercent, // Use mash efficiency as default
      isCustom: true,
    };

    onSave(newProfile);

    // Reset and close
    setName('');
    setDescription('');
    onClose();
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleCancel} size="md">
      <div className="p-6">
        <h3 id="modal-title" className="text-lg font-bold mb-4">
          Save Equipment Profile
        </h3>

        <p className="text-sm text-muted mb-4">
          Save your current equipment settings as a reusable profile.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="equipment-profile-name" className="block text-sm font-semibold mb-2">
              Profile Name *
            </label>
            <Input
              id="equipment-profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Custom Setup"
              fullWidth
              autoFocus
              data-autofocus
            />
          </div>

          <div>
            <label htmlFor="equipment-profile-description" className="block text-sm font-semibold mb-2">
              Description (optional)
            </label>
            <Textarea
              id="equipment-profile-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your equipment setup..."
              rows={3}
              fullWidth
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={handleCancel} fullWidth>
            Cancel
          </Button>
          <Button
            variant="neon"
            onClick={handleSave}
            disabled={!name.trim()}
            fullWidth
          >
            Save Profile
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
};
