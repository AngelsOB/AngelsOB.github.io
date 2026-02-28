/**
 * Equipment Section Component
 *
 * Displays equipment settings with profile selection.
 * All values are directly editable.
 */

import React, { useState, useEffect } from 'react';
import { useRecipeStore } from '../stores/recipeStore';
import { useEquipmentStore } from '../stores/equipmentStore';
import type { EquipmentProfile } from '../../domain/models/Equipment';
import { EquipmentProfileModal } from './EquipmentProfileModal';
import { CustomEquipmentModal } from './CustomEquipmentModal';

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
    // Apply the profile to the recipe
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
    // Update recipe to reference the new profile
    updateRecipe({
      equipmentProfileName: profile.name,
    });
  };

  return (
    <div className="brew-section brew-animate-in brew-stagger-1" data-accent="equipment">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="brew-section-title">
          Equipment & Volumes
        </h2>
        <div className="flex gap-2">
          {hasUnsavedChanges && (
            <button
              onClick={() => setIsCustomModalOpen(true)}
              className="brew-btn-ghost text-xs px-3 py-1.5"
              style={{ borderColor: 'var(--brew-accent-400)', color: 'var(--brew-accent-700)' }}
            >
              Save as Custom
            </button>
          )}
          <button
            onClick={() => setIsPickerOpen(true)}
            className="brew-btn-primary text-xs px-3 py-1.5"
          >
            {currentProfile ? currentProfile.name : 'Select Profile'}
          </button>
        </div>
      </div>

      {/* Basic Settings */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="equipment-batch-volume" className="block text-sm font-semibold mb-2">
            Batch Volume (L)
          </label>
          <input
            id="equipment-batch-volume"
            type="number"
            value={recipe.batchVolumeL}
            onChange={(e) =>
              updateRecipe({ batchVolumeL: parseFloat(e.target.value) || 0 })
            }
            className="brew-input w-full"
            step="0.1"
          />
        </div>
        <div>
          <label htmlFor="equipment-mash-efficiency" className="block text-sm font-semibold mb-2">
            Mash Efficiency (%)
          </label>
          <input
            id="equipment-mash-efficiency"
            type="number"
            value={recipe.equipment.mashEfficiencyPercent}
            onChange={(e) =>
              updateRecipe({
                equipment: {
                  ...recipe.equipment,
                  mashEfficiencyPercent: parseFloat(e.target.value) || 0,
                },
              })
            }
            className="brew-input w-full"
            step="1"
          />
        </div>
        <div>
          <label htmlFor="equipment-boil-time" className="block text-sm font-semibold mb-2">
            Boil Time (min)
          </label>
          <input
            id="equipment-boil-time"
            type="number"
            value={recipe.equipment.boilTimeMin}
            onChange={(e) =>
              updateRecipe({
                equipment: {
                  ...recipe.equipment,
                  boilTimeMin: parseFloat(e.target.value) || 0,
                },
              })
            }
            className="brew-input w-full"
            step="1"
          />
        </div>
      </div>

      {/* Advanced Settings - Collapsible */}
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium mb-4 transition-colors brew-link">
          Advanced Equipment Settings
        </summary>

        <div className="grid grid-cols-3 gap-4 pl-4 border-l-2" style={{ borderColor: 'var(--brew-accent-300)' }}>
          <div>
            <label htmlFor="equipment-boil-off-rate" className="block text-xs font-semibold mb-2">
              Boil-Off Rate (L/hr)
            </label>
            <input
              id="equipment-boil-off-rate"
              type="number"
              value={recipe.equipment.boilOffRateLPerHour}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    boilOffRateLPerHour: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-mash-thickness" className="block text-xs font-semibold mb-2">
              Mash Thickness (L/kg)
            </label>
            <input
              id="equipment-mash-thickness"
              type="number"
              value={recipe.equipment.mashThicknessLPerKg}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    mashThicknessLPerKg: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-grain-absorption" className="block text-xs font-semibold mb-2">
              Grain Absorption (L/kg)
            </label>
            <input
              id="equipment-grain-absorption"
              type="number"
              value={recipe.equipment.grainAbsorptionLPerKg}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    grainAbsorptionLPerKg: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.01"
            />
          </div>
          <div>
            <label htmlFor="equipment-mash-tun-deadspace" className="block text-xs font-semibold mb-2">
              Mash Tun Deadspace (L)
            </label>
            <input
              id="equipment-mash-tun-deadspace"
              type="number"
              value={recipe.equipment.mashTunDeadspaceLiters}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    mashTunDeadspaceLiters: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-mash-tun-loss" className="block text-xs font-semibold mb-2">
              Mash Tun Loss (L)
            </label>
            <input
              id="equipment-mash-tun-loss"
              type="number"
              value={recipe.equipment.mashTunLossLiters ?? 0}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    mashTunLossLiters: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-kettle-loss" className="block text-xs font-semibold mb-2">
              Kettle Loss (L)
            </label>
            <input
              id="equipment-kettle-loss"
              type="number"
              value={recipe.equipment.kettleLossLiters}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    kettleLossLiters: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-hop-absorption" className="block text-xs font-semibold mb-2">
              Hop Absorption (L/kg)
            </label>
            <input
              id="equipment-hop-absorption"
              type="number"
              value={recipe.equipment.hopsAbsorptionLPerKg}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    hopsAbsorptionLPerKg: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-chiller-loss" className="block text-xs font-semibold mb-2">
              Chiller Loss (L)
            </label>
            <input
              id="equipment-chiller-loss"
              type="number"
              value={recipe.equipment.chillerLossLiters}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    chillerLossLiters: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-fermenter-loss" className="block text-xs font-semibold mb-2">
              Fermenter Loss (L)
            </label>
            <input
              id="equipment-fermenter-loss"
              type="number"
              value={recipe.equipment.fermenterLossLiters}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    fermenterLossLiters: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
            />
          </div>
          <div>
            <label htmlFor="equipment-cooling-shrinkage" className="block text-xs font-semibold mb-2">
              Cooling Shrinkage (%)
            </label>
            <input
              id="equipment-cooling-shrinkage"
              type="number"
              value={recipe.equipment.coolingShrinkagePercent}
              onChange={(e) =>
                updateRecipe({
                  equipment: {
                    ...recipe.equipment,
                    coolingShrinkagePercent: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="brew-input w-full py-1 px-2"
              step="0.1"
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
