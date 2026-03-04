'use client';

/**
 * Fermentation Step Modal Component
 *
 * Modal for adding or editing a fermentation step
 */

import { useState, useEffect } from 'react';
import type { FermentationStep, FermentationStepType } from '../../domain/models/Recipe';
import ModalOverlay from './ModalOverlay';
import Input from '@components/Input';
import Select from '@components/Select';
import Button from '@components/Button';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: FermentationStep) => void;
  editingStep?: FermentationStep | null;
};

const STEP_TYPE_OPTIONS: Array<{ value: FermentationStepType; label: string; defaultName: string; defaultTemp: number; defaultDays: number }> = [
  { value: 'primary', label: 'Primary Fermentation', defaultName: 'Primary Fermentation', defaultTemp: 19, defaultDays: 14 },
  { value: 'secondary', label: 'Secondary Fermentation', defaultName: 'Secondary Fermentation', defaultTemp: 19, defaultDays: 7 },
  { value: 'diacetyl-rest', label: 'Diacetyl Rest', defaultName: 'Diacetyl Rest', defaultTemp: 21, defaultDays: 2 },
  { value: 'cold-crash', label: 'Cold Crash', defaultName: 'Cold Crash', defaultTemp: 2, defaultDays: 3 },
  { value: 'conditioning', label: 'Conditioning / Aging', defaultName: 'Conditioning', defaultTemp: 4, defaultDays: 14 },
];

export default function FermentationStepModal({ isOpen, onClose, onSave, editingStep }: Props) {
  const [stepType, setStepType] = useState<FermentationStepType>('primary');
  const [name, setName] = useState('');
  const [durationDays, setDurationDays] = useState(14);
  const [temperatureC, setTemperatureC] = useState(19);
  const [notes, setNotes] = useState('');

  // Initialize form when editing or opening
  useEffect(() => {
    if (editingStep) {
      setStepType(editingStep.type);
      setName(editingStep.name);
      setDurationDays(editingStep.durationDays);
      setTemperatureC(editingStep.temperatureC);
      setNotes(editingStep.notes || '');
    } else {
      // Reset to defaults when adding new
      const defaultOption = STEP_TYPE_OPTIONS[0];
      setStepType(defaultOption.value);
      setName(defaultOption.defaultName);
      setDurationDays(defaultOption.defaultDays);
      setTemperatureC(defaultOption.defaultTemp);
      setNotes('');
    }
  }, [editingStep, isOpen]);

  const handleTypeChange = (newType: FermentationStepType) => {
    setStepType(newType);
    const option = STEP_TYPE_OPTIONS.find(opt => opt.value === newType);
    if (option && !editingStep) {
      // Only auto-fill if creating new (not editing)
      setName(option.defaultName);
      setDurationDays(option.defaultDays);
      setTemperatureC(option.defaultTemp);
    }
  };

  const handleSave = () => {
    const step: FermentationStep = {
      id: editingStep?.id || crypto.randomUUID(),
      name,
      type: stepType,
      durationDays,
      temperatureC,
      notes: notes.trim() || undefined,
    };
    onSave(step);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="2xl">
        {/* Header */}
        <div className="border-b border-[rgb(var(--brew-border-subtle))] px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">
              {editingStep ? 'Edit Fermentation Step' : 'Add Fermentation Step'}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="text-[var(--fg-muted)] hover:text-[var(--fg-strong)] transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Step Type */}
          <div>
            <label htmlFor="fermentation-step-type" className="block text-sm font-semibold mb-2">Step Type</label>
            <Select
              id="fermentation-step-type"
              value={stepType}
              onChange={(e) => handleTypeChange(e.target.value as FermentationStepType)}
              fullWidth
            >
              {STEP_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Step Name */}
          <div>
            <label htmlFor="fermentation-step-name" className="block text-sm font-semibold mb-2">Step Name</label>
            <Input
              id="fermentation-step-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Primary Fermentation, Dry Hop"
              fullWidth
            />
          </div>

          {/* Duration and Temperature */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="fermentation-step-duration" className="block text-sm font-semibold mb-2">Duration (days)</label>
              <Input
                id="fermentation-step-duration"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(parseFloat(e.target.value) || 0)}
                min="0"
                step="1"
                fullWidth
              />
            </div>

            <div>
              <label htmlFor="fermentation-step-temperature" className="block text-sm font-semibold mb-2">Temperature (°C)</label>
              <Input
                id="fermentation-step-temperature"
                type="number"
                value={temperatureC}
                onChange={(e) => setTemperatureC(parseFloat(e.target.value) || 0)}
                step="0.5"
                fullWidth
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="fermentation-step-notes" className="block text-sm font-semibold mb-2">Notes (optional)</label>
            <textarea
              id="fermentation-step-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Add dry hops on day 7, Cold crash before packaging"
              rows={3}
              className="brew-journal"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[rgb(var(--brew-border-subtle))] px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="neon" onClick={handleSave}>
            {editingStep ? 'Save Changes' : 'Add Step'}
          </Button>
        </div>
    </ModalOverlay>
  );
}
