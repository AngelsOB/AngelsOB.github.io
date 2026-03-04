/**
 * Equipment Section Component
 *
 * Displays equipment settings with profile selection.
 * All values are directly editable via machined datum readouts.
 */

import React, { useState, useEffect } from 'react';
import { useRecipeStore } from '../stores/recipeStore';
import { useEquipmentStore } from '../stores/equipmentStore';
import type { EquipmentProfile } from '../../domain/models/Equipment';
import { EquipmentProfileModal } from './EquipmentProfileModal';
import { CustomEquipmentModal } from './CustomEquipmentModal';

function EquipDatum({
  id,
  label,
  unit,
  value,
  onChange,
  step,
  small,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  step: string;
  small?: boolean;
}) {
  return (
    <div className={"equip-datum" + (small ? " is-small" : "")}>
      <label htmlFor={id} className="equip-datum-label">{label}</label>
      <div className="equip-datum-value">
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="equip-datum-input"
          step={step}
          min="0"
        />
        <span className="equip-datum-unit">{unit}</span>
      </div>
    </div>
  );
}

export const EquipmentSection: React.FC = () => {
  const recipe = useRecipeStore((state) => state.currentRecipe);
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const { profiles, loadProfiles, saveCustomProfile } = useEquipmentStore();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Load equipment profiles on mount
  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  if (!recipe) return null;

  // Find the current profile by name
  const currentProfile = recipe.equipmentProfileName
    ? profiles.find(p => p.name === recipe.equipmentProfileName)
    : null;

  // Check if current values differ from the selected profile
  const hasUnsavedChanges = currentProfile && (
    recipe.batchVolumeL !== currentProfile.batchSizeL ||
    recipe.equipment.boilTimeMin !== currentProfile.boilTimeMin ||
    recipe.equipment.boilOffRateLPerHour !== currentProfile.boilOffRateL_hr ||
    recipe.equipment.mashEfficiencyPercent !== currentProfile.mashEfficiency ||
    recipe.equipment.mashThicknessLPerKg !== currentProfile.mashThicknessL_kg ||
    recipe.equipment.grainAbsorptionLPerKg !== currentProfile.grainAbsorptionL_kg ||
    recipe.equipment.mashTunDeadspaceLiters !== currentProfile.mashTunDeadspaceL ||
    recipe.equipment.mashTunLossLiters !== currentProfile.mashTunLossL ||
    recipe.equipment.kettleLossLiters !== currentProfile.kettleDeadspaceL ||
    recipe.equipment.chillerLossLiters !== currentProfile.chillerLossL ||
    recipe.equipment.fermenterLossLiters !== currentProfile.fermenterLossL ||
    recipe.equipment.coolingShrinkagePercent !== currentProfile.coolingShrinkagePercent ||
    Math.abs(recipe.equipment.hopsAbsorptionLPerKg - currentProfile.hopAbsorptionL_kg) > 0.01
  );

  const handleSelectProfile = (profile: EquipmentProfile) => {
    updateRecipe({
      equipmentProfileName: profile.name,
      batchVolumeL: profile.batchSizeL,
      equipment: {
        ...recipe.equipment,
        boilTimeMin: profile.boilTimeMin,
        boilOffRateLPerHour: profile.boilOffRateL_hr,
        mashEfficiencyPercent: profile.mashEfficiency,
        mashThicknessLPerKg: profile.mashThicknessL_kg,
        grainAbsorptionLPerKg: profile.grainAbsorptionL_kg,
        mashTunDeadspaceLiters: profile.mashTunDeadspaceL,
        mashTunLossLiters: profile.mashTunLossL,
        kettleLossLiters: profile.kettleDeadspaceL,
        chillerLossLiters: profile.chillerLossL,
        fermenterLossLiters: profile.fermenterLossL,
        coolingShrinkagePercent: profile.coolingShrinkagePercent,
        hopsAbsorptionLPerKg: profile.hopAbsorptionL_kg,
      },
    });
    setIsPickerOpen(false);
  };

  const handleSaveCustomProfile = async (profile: EquipmentProfile) => {
    await saveCustomProfile(profile);
    updateRecipe({
      equipmentProfileName: profile.name,
    });
  };

  const updateEquip = (field: string, value: number) => {
    updateRecipe({
      equipment: { ...recipe.equipment, [field]: value },
    });
  };

  return (
    <div className="brew-section brew-animate-in brew-stagger-1" data-accent="equipment">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="brew-section-title">Equipment & Volumes</h3>
        <div className="flex gap-2">
          {hasUnsavedChanges && (
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="brew-btn-ghost text-xs px-3 py-1"
            >
              Save as Custom
            </button>
          )}
          <button
            onClick={() => setIsPickerOpen(true)}
            className="brew-btn-ghost text-xs px-3 py-1"
          >
            {currentProfile ? currentProfile.name : 'Select Profile'}
          </button>
        </div>
      </div>

      {/* Hero readouts */}
      <div className="equip-hero-grid">
        <EquipDatum
          id="equipment-batch-volume"
          label="Batch Volume"
          unit="L"
          value={recipe.batchVolumeL}
          onChange={(v) => updateRecipe({ batchVolumeL: v })}
          step="0.1"
        />
        <EquipDatum
          id="equipment-mash-efficiency"
          label="Efficiency"
          unit="%"
          value={recipe.equipment.mashEfficiencyPercent}
          onChange={(v) => updateEquip('mashEfficiencyPercent', v)}
          step="1"
        />
        <EquipDatum
          id="equipment-boil-time"
          label="Boil Time"
          unit="min"
          value={recipe.equipment.boilTimeMin}
          onChange={(v) => updateEquip('boilTimeMin', v)}
          step="1"
        />
      </div>

      {/* Advanced Settings */}
      <details className="equip-advanced">
        <summary className="equip-advanced-toggle">
          <svg className="equip-advanced-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
          Advanced Settings
        </summary>

        {/* Mash System */}
        <div className="equip-group">
          <span className="equip-group-label">Mash System</span>
          <div className="equip-detail-grid">
            <EquipDatum
              id="equipment-mash-thickness"
              label="Thickness"
              unit="L/kg"
              value={recipe.equipment.mashThicknessLPerKg}
              onChange={(v) => updateEquip('mashThicknessLPerKg', v)}
              step="0.1"
              small
            />
            <EquipDatum
              id="equipment-grain-absorption"
              label="Grain Absorb."
              unit="L/kg"
              value={recipe.equipment.grainAbsorptionLPerKg}
              onChange={(v) => updateEquip('grainAbsorptionLPerKg', v)}
              step="0.01"
              small
            />
            <EquipDatum
              id="equipment-mash-tun-deadspace"
              label="Tun Deadspace"
              unit="L"
              value={recipe.equipment.mashTunDeadspaceLiters}
              onChange={(v) => updateEquip('mashTunDeadspaceLiters', v)}
              step="0.1"
              small
            />
            <EquipDatum
              id="equipment-mash-tun-loss"
              label="Tun Loss"
              unit="L"
              value={recipe.equipment.mashTunLossLiters ?? 0}
              onChange={(v) => updateEquip('mashTunLossLiters', v)}
              step="0.1"
              small
            />
          </div>
        </div>

        {/* Kettle */}
        <div className="equip-group">
          <span className="equip-group-label">Kettle</span>
          <div className="equip-detail-grid">
            <EquipDatum
              id="equipment-boil-off-rate"
              label="Boil-Off"
              unit="L/hr"
              value={recipe.equipment.boilOffRateLPerHour}
              onChange={(v) => updateEquip('boilOffRateLPerHour', v)}
              step="0.1"
              small
            />
            <EquipDatum
              id="equipment-kettle-loss"
              label="Kettle Loss"
              unit="L"
              value={recipe.equipment.kettleLossLiters}
              onChange={(v) => updateEquip('kettleLossLiters', v)}
              step="0.1"
              small
            />
            <EquipDatum
              id="equipment-hop-absorption"
              label="Hop Absorb."
              unit="L/kg"
              value={recipe.equipment.hopsAbsorptionLPerKg}
              onChange={(v) => updateEquip('hopsAbsorptionLPerKg', v)}
              step="0.1"
              small
            />
          </div>
        </div>

        {/* Cooling & Fermenter */}
        <div className="equip-group">
          <span className="equip-group-label">Cooling & Fermenter</span>
          <div className="equip-detail-grid">
            <EquipDatum
              id="equipment-chiller-loss"
              label="Chiller Loss"
              unit="L"
              value={recipe.equipment.chillerLossLiters}
              onChange={(v) => updateEquip('chillerLossLiters', v)}
              step="0.1"
              small
            />
            <EquipDatum
              id="equipment-fermenter-loss"
              label="Fermenter Loss"
              unit="L"
              value={recipe.equipment.fermenterLossLiters}
              onChange={(v) => updateEquip('fermenterLossLiters', v)}
              step="0.1"
              small
            />
            <EquipDatum
              id="equipment-cooling-shrinkage"
              label="Shrinkage"
              unit="%"
              value={recipe.equipment.coolingShrinkagePercent}
              onChange={(v) => updateEquip('coolingShrinkagePercent', v)}
              step="0.1"
              small
            />
          </div>
        </div>
      </details>

      {/* Equipment Profile Picker Modal */}
      <EquipmentProfileModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSelectProfile}
        onCreateCustom={() => {
          setIsPickerOpen(false);
          setIsCustomModalOpen(true);
        }}
      />

      {/* Custom Equipment Modal */}
      <CustomEquipmentModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={handleSaveCustomProfile}
        currentSettings={{
          batchVolumeL: recipe.batchVolumeL,
          boilTimeMin: recipe.equipment.boilTimeMin,
          boilOffRateLPerHour: recipe.equipment.boilOffRateLPerHour,
          mashEfficiencyPercent: recipe.equipment.mashEfficiencyPercent,
          mashThicknessLPerKg: recipe.equipment.mashThicknessLPerKg,
          grainAbsorptionLPerKg: recipe.equipment.grainAbsorptionLPerKg,
          mashTunDeadspaceLiters: recipe.equipment.mashTunDeadspaceLiters,
          mashTunLossLiters: recipe.equipment.mashTunLossLiters ?? 0,
          kettleLossLiters: recipe.equipment.kettleLossLiters,
          chillerLossLiters: recipe.equipment.chillerLossLiters,
          fermenterLossLiters: recipe.equipment.fermenterLossLiters,
          coolingShrinkagePercent: recipe.equipment.coolingShrinkagePercent,
          hopsAbsorptionLPerKg: recipe.equipment.hopsAbsorptionLPerKg,
        }}
      />
    </div>
  );
};
