/**
 * Fermentation Section Component
 *
 * Manages fermentation steps similar to mash schedule
 */

import { useState } from 'react';
import { useRecipeStore } from '../stores/recipeStore';
import EmptyState from '../../../../components/EmptyState';
import FermentationStepModal from './FermentationStepModal';
import type { FermentationStep } from '../../domain/models/Recipe';

const STEP_TYPE_LABELS: Record<string, string> = {
  'primary': 'Primary',
  'secondary': 'Secondary',
  'conditioning': 'Conditioning',
  'cold-crash': 'Cold Crash',
  'diacetyl-rest': 'Diacetyl Rest',
};

export default function FermentationSection() {
  const { currentRecipe, updateRecipe } = useRecipeStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<FermentationStep | null>(null);

  if (!currentRecipe) return null;

  const steps = currentRecipe.fermentationSteps || [];

  const handleAddStep = () => {
    setEditingStep(null);
    setIsModalOpen(true);
  };

  const handleEditStep = (step: FermentationStep) => {
    setEditingStep(step);
    setIsModalOpen(true);
  };

  const handleSaveStep = (step: FermentationStep) => {
    if (editingStep) {
      updateRecipe({
        fermentationSteps: steps.map((s) => (s.id === step.id ? step : s)),
      });
    } else {
      updateRecipe({
        fermentationSteps: [...steps, step],
      });
    }
  };

  const handleRemoveStep = (stepId: string) => {
    updateRecipe({
      fermentationSteps: steps.filter((s) => s.id !== stepId),
    });
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    updateRecipe({ fermentationSteps: newSteps });
  };

  const totalDays = steps.reduce((sum, step) => sum + step.durationDays, 0);

  return (
    <div className="brew-section brew-animate-in brew-stagger-7" data-accent="fermentation">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="brew-section-title">Fermentation Schedule</h2>
          {totalDays > 0 && (
            <p className="text-sm text-muted mt-1">
              Total time: {totalDays} days
            </p>
          )}
        </div>
        <button
          onClick={handleAddStep}
          className="brew-btn-primary"
        >
          + Add Step
        </button>
      </div>

      {steps.length === 0 ? (
        <EmptyState
          message="No fermentation steps yet"
          actionLabel="Add your first step"
          onAction={handleAddStep}
        />
      ) : (
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="brew-ingredient-row p-4 flex items-start"
            >
              <div className="flex-1 min-w-0">
                {/* Header row with badge, name, duration, and temperature */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="brew-chip-active text-xs font-semibold px-2 py-1">
                    {STEP_TYPE_LABELS[step.type] || step.type}
                  </span>
                  <span className="text-sm font-bold">{step.name}</span>

                  {/* Duration and Temperature */}
                  <div className="flex gap-2 ml-auto">
                    <div className="px-3 py-1.5 rounded-md" style={{ background: 'rgb(var(--brew-card-inset))', border: '1px solid rgb(var(--brew-border-subtle))' }}>
                      <div className="text-xs text-muted">Duration</div>
                      <div className="text-base font-bold whitespace-nowrap" style={{ color: 'var(--fg-strong)' }}>
                        {step.durationDays} <span className="text-sm font-normal">days</span>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-md" style={{ background: 'rgb(var(--brew-card-inset))', border: '1px solid rgb(var(--brew-border-subtle))' }}>
                      <div className="text-xs text-muted">Temperature</div>
                      <div className="text-base font-bold whitespace-nowrap" style={{ color: 'var(--fg-strong)' }}>
                        {step.temperatureC}<span className="text-sm font-normal">°C</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {step.notes && (
                  <div className="text-xs italic p-2 rounded" style={{ background: 'rgb(var(--brew-card-inset))', border: '1px solid rgb(var(--brew-border-subtle))' }}>
                    {step.notes}
                  </div>
                )}
              </div>

              {/* Hover-reveal actions — direct child for CSS selector */}
              <div className="brew-row-actions">
                {/* Move up/down */}
                <button
                  onClick={() => handleMoveStep(index, 'up')}
                  disabled={index === 0}
                  className="brew-row-action-btn disabled:opacity-20 disabled:cursor-not-allowed"
                  style={{ color: 'var(--fg-muted)' }}
                  aria-label="Move up"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                </button>
                <button
                  onClick={() => handleMoveStep(index, 'down')}
                  disabled={index === steps.length - 1}
                  className="brew-row-action-btn disabled:opacity-20 disabled:cursor-not-allowed"
                  style={{ color: 'var(--fg-muted)' }}
                  aria-label="Move down"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {/* Edit */}
                <button
                  onClick={() => handleEditStep(step)}
                  className="brew-row-action-btn brew-link"
                  aria-label={`Edit ${step.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleRemoveStep(step.id)}
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

      {/* Modal */}
      <FermentationStepModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStep(null);
        }}
        onSave={handleSaveStep}
        editingStep={editingStep}
      />
    </div>
  );
}
