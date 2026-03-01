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
              className="brew-ingredient-row p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
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

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {/* Move up/down */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveStep(index, 'up')}
                      disabled={index === 0}
                      className="p-1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      style={{ color: 'var(--fg-muted)' }}
                      title="Move up"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveStep(index, 'down')}
                      disabled={index === steps.length - 1}
                      className="p-1 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      style={{ color: 'var(--fg-muted)' }}
                      title="Move down"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  {/* Edit */}
                  <button
                    onClick={() => handleEditStep(step)}
                    className="p-2 rounded transition-colors brew-link"
                    title="Edit step"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleRemoveStep(step.id)}
                    className="p-2 rounded transition-colors brew-danger-text"
                    title="Delete step"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
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
