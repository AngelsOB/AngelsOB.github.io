/**
 * Mash Schedule Section Component
 *
 * Displays the mash schedule with:
 * - Step list with inline editing
 * - Modal for adding/editing mash steps
 * - Quick generators for common schedules
 * - Total mash time and volume display
 */

import { useState } from "react";
import { useRecipeStore } from "../stores/recipeStore";
import { mashScheduleService } from "../../domain/services/MashScheduleService";
import EmptyState from "../../../../components/EmptyState";
import MashStepModal from "./MashStepModal";
import type { MashStep } from "../../domain/models/Recipe";

export default function MashScheduleSection() {
  const {
    currentRecipe,
    addMashStep,
    updateMashStep,
    removeMashStep,
  } = useRecipeStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<MashStep | undefined>(undefined);

  if (!currentRecipe) return null;

  const totalGrainKg = currentRecipe.fermentables.reduce((sum, f) => sum + f.weightKg, 0);
  const grainAbsorption = currentRecipe.equipment.grainAbsorptionLPerKg;

  // Calculate total mash time
  const totalMashTime = mashScheduleService.calculateTotalMashTime(currentRecipe.mashSteps);

  // Calculate total infusion water
  const totalInfusionWater = mashScheduleService.calculateTotalInfusionWater(currentRecipe.mashSteps);

  // Calculate mash volume after all steps
  const finalMashVolume = mashScheduleService.calculateMashVolumeAtStep(
    currentRecipe.mashSteps,
    totalGrainKg,
    grainAbsorption
  );

  // Handle opening modal for new step
  const handleOpenAddModal = () => {
    setEditingStep(undefined);
    setIsModalOpen(true);
  };

  // Handle opening modal for editing step
  const handleOpenEditModal = (step: MashStep) => {
    setEditingStep(step);
    setIsModalOpen(true);
  };

  // Handle saving step from modal
  const handleSaveStep = (step: MashStep) => {
    if (editingStep) {
      // Update existing step
      updateMashStep(step.id, step);
    } else {
      // Add new step
      addMashStep(step);
    }
  };

  // Handle generating default schedules
  const handleGenerateSingleInfusion = () => {
    if (currentRecipe.mashSteps.length > 0) {
      if (!confirm("This will replace your current mash schedule. Continue?")) {
        return;
      }
      // Clear existing steps
      currentRecipe.mashSteps.forEach(step => removeMashStep(step.id));
    }

    const defaultStep = mashScheduleService.generateDefaultSingleInfusion(currentRecipe);
    addMashStep(defaultStep);
  };

  const handleGenerateMultiStep = () => {
    if (currentRecipe.mashSteps.length > 0) {
      if (!confirm("This will replace your current mash schedule. Continue?")) {
        return;
      }
      // Clear existing steps
      currentRecipe.mashSteps.forEach(step => removeMashStep(step.id));
    }

    const defaultSteps = mashScheduleService.generateDefaultMultiStep(currentRecipe);
    defaultSteps.forEach(step => addMashStep(step));
  };

  return (
    <div className="brew-section brew-animate-in brew-stagger-3 space-y-4" data-accent="mash">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="brew-section-title">Mash Schedule</h3>
          <p className="text-sm">
            Total Time: {totalMashTime} min | Water: {totalInfusionWater.toFixed(1)} L | Final Volume: {finalMashVolume.toFixed(1)} L
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateSingleInfusion}
            className="brew-btn-ghost text-xs px-3 py-1"
          >
            Single Infusion
          </button>
          <button
            onClick={handleGenerateMultiStep}
            className="brew-btn-ghost text-xs px-3 py-1"
          >
            Multi-Step
          </button>
        </div>
      </div>

      {/* Mash Steps List */}
      {currentRecipe.mashSteps.length === 0 ? (
        <EmptyState
          message="No mash steps added yet"
          hint="Use the buttons above to generate a schedule, or add steps manually"
        />
      ) : (
        <div className="space-y-2">
          {currentRecipe.mashSteps.map((step, index) => (
            <div
              key={step.id}
              className="brew-ingredient-row flex items-center gap-3"
            >
              {/* Step Number */}
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-semibold" style={{ background: 'color-mix(in oklch, var(--brew-accent-200) 40%, transparent)', color: 'var(--brew-accent-800)' }}>
                {index + 1}
              </div>

              {/* Step Details */}
              <div className="flex-1 grid grid-cols-5 gap-3 items-center">
                {/* Name & Type */}
                <div className="col-span-2">
                  <div className="font-semibold">{step.name}</div>
                  <div className="text-xs capitalize">{step.type}</div>
                </div>

                {/* Temperature */}
                <div>
                  <div className="text-xs">Target Temp</div>
                  <div className="font-semibold">{step.temperatureC}°C</div>
                </div>

                {/* Duration */}
                <div>
                  <div className="text-xs">Duration</div>
                  <div className="font-semibold">{step.durationMinutes} min</div>
                </div>

                {/* Infusion Info (for infusion steps) */}
                <div>
                  {step.type === "infusion" && step.infusionVolumeLiters && step.infusionTempC && (
                    <div>
                      <div className="text-xs">Infusion</div>
                      <div className="text-sm font-semibold brew-link">
                        {step.infusionVolumeLiters.toFixed(1)} L @ {step.infusionTempC.toFixed(1)}°C
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenEditModal(step)}
                  className="px-3 py-1 text-sm brew-link rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeMashStep(step.id)}
                  className="px-3 py-1 text-sm brew-danger-text rounded transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Step Button */}
      <button
        onClick={handleOpenAddModal}
        className="brew-btn-primary w-full"
      >
        + Add Mash Step
      </button>

      {/* Warning if no grains */}
      {totalGrainKg === 0 && (
        <div className="brew-alert-warning">
          Add fermentables first to enable mash calculations
        </div>
      )}

      {/* Mash Step Modal */}
      <MashStepModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStep}
        recipe={currentRecipe}
        existingStep={editingStep}
      />
    </div>
  );
}
