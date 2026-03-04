'use client';

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
        <h3 className="brew-section-title">Mash Schedule</h3>
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
        <div className="mash-step-list">
          {currentRecipe.mashSteps.map((step, index) => (
            <div key={step.id} className="mash-step-card">
              {/* Step index */}
              <span className="mash-step-index">{index + 1}</span>

              {/* Name & Type */}
              <div className="mash-step-name">
                <span className="font-semibold">{step.name}</span>
                <span className="mash-step-type">{step.type}</span>
              </div>

              {/* Temperature */}
              <div className="mash-step-datum">
                <span className="mash-step-datum-label">Temp</span>
                <span className="mash-step-datum-value">{step.temperatureC}°C</span>
              </div>

              {/* Duration */}
              <div className="mash-step-datum">
                <span className="mash-step-datum-label">Time</span>
                <span className="mash-step-datum-value">{step.durationMinutes} min</span>
              </div>

              {/* Infusion Info (only for infusion steps) */}
              {step.type === "infusion" && step.infusionVolumeLiters && step.infusionTempC && (
                <div className="mash-step-datum">
                  <span className="mash-step-datum-label">Infusion</span>
                  <span className="mash-step-datum-value mash-step-datum-accent">
                    {step.infusionVolumeLiters.toFixed(1)}L @ {step.infusionTempC.toFixed(0)}°
                  </span>
                </div>
              )}

              {/* Actions — hover-reveal */}
              <div className="brew-row-actions">
                <button
                  onClick={() => handleOpenEditModal(step)}
                  className="brew-row-action-btn brew-link"
                  aria-label={`Edit ${step.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                <button
                  onClick={() => removeMashStep(step.id)}
                  className="brew-row-action-btn brew-danger-text"
                  aria-label={`Remove ${step.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
