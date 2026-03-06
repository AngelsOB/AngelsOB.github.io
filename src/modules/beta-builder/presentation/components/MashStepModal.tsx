'use client';

/**
 * Mash Step Modal Component
 *
 * Modal for adding/editing mash steps with form fields for:
 * - Step name
 * - Temperature target
 * - Duration
 * - Decoction volume (optional)
 */

import { useState, useEffect } from "react";
import { uid } from "@/utils/uid";
import type { MashStep, Recipe } from "../../domain/models/Recipe";
import { mashScheduleService } from "../../domain/services/MashScheduleService";
import ModalOverlay from "./ModalOverlay";
import Input from "@components/Input";
import Button from "@components/Button";
import { toast } from "../../../../stores/toastStore";

type MashStepModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: MashStep) => void;
  recipe: Recipe;
  existingStep?: MashStep; // For editing existing steps
};

export default function MashStepModal({
  isOpen,
  onClose,
  onSave,
  recipe,
  existingStep,
}: MashStepModalProps) {
  // Form state
  const [stepName, setStepName] = useState("");
  const [temperature, setTemperature] = useState(67);
  const [duration, setDuration] = useState(60);
  const [decoctionVolume, setDecoctionVolume] = useState<number | null>(null);

  // Calculate total grain weight
  const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + f.weightKg, 0);

  // Load existing step data when editing
  useEffect(() => {
    if (existingStep) {
      setStepName(existingStep.name);
      setTemperature(existingStep.temperatureC);
      setDuration(existingStep.durationMinutes);
      setDecoctionVolume(existingStep.decoctionVolumeLiters ?? null);
    } else {
      // Reset form for new step
      setStepName("");
      setTemperature(67);
      setDuration(60);
      setDecoctionVolume(null);
    }
  }, [existingStep, isOpen]);

  const handleSave = () => {
    if (!stepName.trim()) {
      toast.warning("Please enter a step name");
      return;
    }

    const newStep: MashStep = {
      id: existingStep?.id ?? uid(),
      name: stepName.trim(),
      temperatureC: temperature,
      durationMinutes: duration,
      ...(decoctionVolume != null && decoctionVolume > 0 ? { decoctionVolumeLiters: decoctionVolume } : {}),
    };

    // Validate
    const errors = mashScheduleService.validateMashStep(newStep);
    if (errors.length > 0) {
      toast.error(errors.join(". "));
      return;
    }

    onSave(newStep);
    handleClose();
  };

  const handleClose = () => {
    onClose();
    // Reset form
    setStepName("");
    setTemperature(67);
    setDuration(60);
    setDecoctionVolume(null);
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="2xl">
        {/* Header */}
        <div className="border-b border-[rgb(var(--brew-border-subtle))] px-6 py-4">
          <h2 className="text-xl font-semibold">
            {existingStep ? "Edit Mash Step" : "Add Mash Step"}
          </h2>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-4">
          {/* Step Name */}
          <div>
            <label htmlFor="mash-step-name" className="block text-sm font-semibold mb-2">
              Step Name *
            </label>
            <Input
              id="mash-step-name"
              type="text"
              value={stepName}
              onChange={(e) => setStepName(e.target.value)}
              placeholder="e.g., Saccharification, Protein Rest, Mash Out"
              fullWidth
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Temperature */}
            <div>
              <label htmlFor="mash-step-temperature" className="block text-sm font-semibold mb-2">
                Temperature (°C) *
              </label>
              <Input
                id="mash-step-temperature"
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                fullWidth
                step={0.5}
                min={0}
                max={100}
              />
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="mash-step-duration" className="block text-sm font-semibold mb-2">
                Duration (minutes) *
              </label>
              <Input
                id="mash-step-duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                fullWidth
                step={1}
                min={1}
              />
            </div>
          </div>

          {/* Decoction Volume (optional) */}
          <div>
            <label htmlFor="mash-step-decoction-volume" className="block text-sm font-semibold mb-2">
              Decoction Volume (Liters) - Optional
            </label>
            <Input
              id="mash-step-decoction-volume"
              type="number"
              value={decoctionVolume ?? ""}
              onChange={(e) => setDecoctionVolume(e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="Only for decoction steps"
              fullWidth
              step={0.1}
              min={0}
            />
          </div>

          {/* Warning if no grains */}
          {totalGrainKg === 0 && (
            <div className="brew-alert-warning">
              <p className="text-sm">
                Add fermentables first to enable mash calculations
              </p>
            </div>
          )}

          {/* Common Presets */}
          <div className="border-t border-[rgb(var(--brew-border-subtle))] pt-4">
            <p className="text-sm font-semibold mb-2">Common Mash Steps:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setStepName("Acid Rest");
                  setTemperature(40);
                  setDuration(15);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Acid Rest (40°C, 15 min)
              </button>
              <button
                onClick={() => {
                  setStepName("Protein Rest");
                  setTemperature(52);
                  setDuration(15);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Protein Rest (52°C, 15 min)
              </button>
              <button
                onClick={() => {
                  setStepName("Beta Rest");
                  setTemperature(63);
                  setDuration(30);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Beta Rest (63°C, 30 min)
              </button>
              <button
                onClick={() => {
                  setStepName("Alpha Rest");
                  setTemperature(70);
                  setDuration(15);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Alpha Rest (70°C, 15 min)
              </button>
              <button
                onClick={() => {
                  setStepName("Mash Out");
                  setTemperature(76);
                  setDuration(10);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Mash Out (76°C, 10 min)
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[rgb(var(--brew-border-subtle))] px-6 py-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="neon" onClick={handleSave}>
            {existingStep ? "Update Step" : "Add Step"}
          </Button>
        </div>
    </ModalOverlay>
  );
}
