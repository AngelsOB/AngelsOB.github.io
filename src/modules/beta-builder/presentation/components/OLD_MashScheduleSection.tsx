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
import ScalableText from "../../../../components/ScalableText";
import OLD_MashStepModal from "./OLD_MashStepModal";
import type { MashStep } from "../../domain/models/Recipe";
import { useHoldToRepeat } from "../../../../hooks/useHoldToRepeat";
import AnimatedNumberInput from "../../../../components/AnimatedNumberInput";

/* ── Inline stepper helper ─────────────────────────────── */
const chevronUp = <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5 5 1 9 5"/></svg>;
const chevronDown = <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1 5 5 9 1"/></svg>;

function MashDatum({
  label, value, unit, onChange, step, min, max, ariaLabel,
}: {
  label: string; value: number; unit: string;
  onChange: (v: number) => void;
  step: number; min: number; max?: number; ariaLabel: string;
}) {
  const decimals = String(step).split('.')[1]?.length ?? 0;
  const nudge = (dir: 1 | -1) => {
    const next = parseFloat((value + dir * step).toFixed(decimals));
    if (next < min) return;
    if (max !== undefined && next > max) return;
    onChange(next);
  };

  const holdUp = useHoldToRepeat(() => nudge(1));
  const holdDown = useHoldToRepeat(() => nudge(-1));

  return (
    <div className="mash-step-datum">
      <span className="mash-step-datum-label">{label}</span>
      <div className="mash-step-datum-value">
        <AnimatedNumberInput
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="mash-step-datum-input"
          step={step}
          min={min}
          max={max}
          aria-label={ariaLabel}
        />
        <span className="mash-step-datum-unit">{unit}</span>
        <div className="mash-stepper">
          <button type="button" className="mash-stepper-btn" {...holdUp} aria-label={`Increase ${label}`} tabIndex={-1}>{chevronUp}</button>
          <button type="button" className="mash-stepper-btn" {...holdDown} aria-label={`Decrease ${label}`} tabIndex={-1}>{chevronDown}</button>
        </div>
      </div>
    </div>
  );
}

function MashStepRow({ step, index, onUpdate, onEdit, onRemove }: {
  step: MashStep; index: number;
  onUpdate: (id: string, updates: Partial<MashStep>) => void;
  onEdit: () => void; onRemove: () => void;
}) {
  return (
    <div className="brew-ingredient-row flex items-center gap-2">
      <span className="mash-step-index">{index + 1}</span>
      <ScalableText className="font-semibold min-w-[5rem]" minScale={0.55}>
        {step.name}
      </ScalableText>
      <div className="flex-1" />
      <MashDatum
        label="Temp"
        value={step.temperatureC}
        unit="°C"
        onChange={(v) => onUpdate(step.id, { temperatureC: v })}
        step={0.5}
        min={0}
        max={100}
        ariaLabel="Temperature in Celsius"
      />
      <MashDatum
        label="Time"
        value={step.durationMinutes}
        unit="min"
        onChange={(v) => onUpdate(step.id, { durationMinutes: v })}
        step={5}
        min={1}
        ariaLabel="Duration in minutes"
      />
      <div className="brew-row-actions">
        <button onClick={onEdit} className="brew-row-action-btn brew-link" aria-label={`Edit ${step.name}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
        </button>
        <button onClick={onRemove} className="brew-row-action-btn brew-danger-text" aria-label={`Remove ${step.name}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  );
}

export default function OLD_MashScheduleSection() {
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
  const replaceSchedule = (steps: MashStep[]) => {
    if (currentRecipe.mashSteps.length > 0) {
      if (!confirm("This will replace your current mash schedule. Continue?")) {
        return;
      }
      currentRecipe.mashSteps.forEach(step => removeMashStep(step.id));
    }
    steps.forEach(step => addMashStep(step));
  };

  const handleGenerateSingleInfusion = () => {
    replaceSchedule([mashScheduleService.generateDefaultSingleInfusion()]);
  };

  const handleGenerateStepMash = () => {
    replaceSchedule(mashScheduleService.generateStepMash());
  };

  const handleGenerateDecoction = () => {
    replaceSchedule(mashScheduleService.generateDecoction());
  };

  return (
    <div className="brew-section brew-animate-in brew-stagger-3 space-y-4" data-accent="mash">
      {/* Header */}
      <div className="mash-section-header">
        <h3 className="brew-section-title">Mash Schedule</h3>
        <div className="mash-generate-buttons">
          <button onClick={handleGenerateSingleInfusion} className="brew-btn-ghost text-xs px-3 py-1">
            Single Infusion
          </button>
          <button onClick={handleGenerateStepMash} className="brew-btn-ghost text-xs px-3 py-1">
            Step Mash
          </button>
          <button onClick={handleGenerateDecoction} className="brew-btn-ghost text-xs px-3 py-1">
            Decoction
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
            <MashStepRow
              key={step.id}
              step={step}
              index={index}
              onUpdate={updateMashStep}
              onEdit={() => handleOpenEditModal(step)}
              onRemove={() => removeMashStep(step.id)}
            />
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
      <OLD_MashStepModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStep}
        recipe={currentRecipe}
        existingStep={editingStep}
      />
    </div>
  );
}
