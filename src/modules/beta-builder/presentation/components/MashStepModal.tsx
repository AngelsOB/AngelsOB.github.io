'use client';

/**
 * Mash Step Modal Component
 *
 * Modal for adding/editing mash steps with form fields for:
 * - Step name
 * - Step type (infusion, temperature, decoction)
 * - Temperature target
 * - Duration
 * - Infusion volume (for infusion steps)
 */

import { useState, useEffect } from "react";
import { uid } from "@/utils/uid";
import type { MashStep, MashStepType, Recipe } from "../../domain/models/Recipe";
import { mashScheduleService } from "../../domain/services/MashScheduleService";
import ModalOverlay from "./ModalOverlay";
import Input from "@components/Input";
import Select from "@components/Select";
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
  const [stepType, setStepType] = useState<MashStepType>("infusion");
  const [temperature, setTemperature] = useState(66);
  const [duration, setDuration] = useState(60);
  const [infusionVolume, setInfusionVolume] = useState<number | null>(null);

  // Calculate total grain weight
  const totalGrainKg = recipe.fermentables.reduce((sum, f) => sum + f.weightKg, 0);
  const mashThickness = recipe.equipment.mashThicknessLPerKg;
  const grainAbsorption = recipe.equipment.grainAbsorptionLPerKg;

  // Load existing step data when editing
  useEffect(() => {
    if (existingStep) {
      setStepName(existingStep.name);
      setStepType(existingStep.type);
      setTemperature(existingStep.temperatureC);
      setDuration(existingStep.durationMinutes);
      setInfusionVolume(existingStep.infusionVolumeLiters ?? null);
    } else {
      // Reset form for new step
      setStepName("");
      setStepType("infusion");
      setTemperature(66);
      setDuration(60);
      setInfusionVolume(null);
    }
  }, [existingStep, isOpen]);

  // Calculate default infusion volume
  const defaultInfusionVolume = totalGrainKg * mashThickness;

  // Calculate strike/infusion temperature
  const calculatedInfusionTemp = () => {
    if (stepType !== "infusion" || totalGrainKg === 0) return null;

    const volume = infusionVolume ?? defaultInfusionVolume;

    if (recipe.mashSteps.length === 0 && !existingStep) {
      // First step = strike water
      return mashScheduleService.calculateStrikeTemp(
        temperature,
        mashThickness,
        20,
        totalGrainKg
      );
    } else {
      // Subsequent infusion
      const currentVolume = mashScheduleService.calculateMashVolumeAtStep(
        recipe.mashSteps,
        totalGrainKg,
        grainAbsorption
      );
      const lastStep = recipe.mashSteps[recipe.mashSteps.length - 1];
      const currentTemp = lastStep?.temperatureC ?? 20;

      return mashScheduleService.calculateInfusionTemp(
        currentTemp,
        temperature,
        currentVolume,
        volume,
        totalGrainKg
      );
    }
  };

  const handleSave = () => {
    if (!stepName.trim()) {
      toast.warning("Please enter a step name");
      return;
    }

    // Calculate infusion temp for infusion steps
    let infusionTemp: number | undefined;
    let finalInfusionVolume: number | undefined;

    if (stepType === "infusion") {
      finalInfusionVolume = infusionVolume ?? defaultInfusionVolume;
      infusionTemp = calculatedInfusionTemp() ?? undefined;
    }

    const newStep: MashStep = {
      id: existingStep?.id ?? uid(),
      name: stepName.trim(),
      type: stepType,
      temperatureC: temperature,
      durationMinutes: duration,
      infusionVolumeLiters: finalInfusionVolume,
      infusionTempC: infusionTemp,
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
    setStepType("infusion");
    setTemperature(66);
    setDuration(60);
    setInfusionVolume(null);
  };

  const infusionTempDisplay = calculatedInfusionTemp();

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

          {/* Step Type */}
          <div>
            <label htmlFor="mash-step-type" className="block text-sm font-semibold mb-2">
              Step Type *
            </label>
            <Select
              id="mash-step-type"
              value={stepType}
              onChange={(e) => setStepType(e.target.value as MashStepType)}
              fullWidth
            >
              <option value="infusion">Infusion - Add hot water (changes volume)</option>
              <option value="temperature">Temperature - Rest at temp (no water added)</option>
              <option value="decoction">Decoction - Boil portion of mash</option>
            </Select>
            <p className="text-xs mt-1">
              {stepType === "infusion" && "Adds hot water to raise mash temperature. Water volume auto-calculated based on your grain bill."}
              {stepType === "temperature" && "Rests at target temperature using direct heat or insulation. No water added."}
              {stepType === "decoction" && "Remove portion of mash, boil it, return to raise temperature."}
            </p>
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

          {/* Infusion Volume (for infusion steps only) */}
          {stepType === "infusion" && (
            <div>
              <label htmlFor="mash-step-infusion-volume" className="block text-sm font-semibold mb-2">
                Infusion Volume (Liters) - Optional
              </label>
              <Input
                id="mash-step-infusion-volume"
                type="number"
                value={infusionVolume ?? ""}
                onChange={(e) => setInfusionVolume(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder={`Auto: ${defaultInfusionVolume.toFixed(1)} L (based on mash thickness)`}
                fullWidth
                step={0.1}
                min={0}
              />
              <p className="text-xs mt-1">
                Leave empty for auto-calculation. Only override if you're doing a specific step mash regimen.
              </p>
            </div>
          )}

          {/* Calculated Infusion Temperature Display */}
          {stepType === "infusion" && totalGrainKg > 0 && infusionTempDisplay && (
            <div className="p-4 rounded-lg backdrop-blur-sm" style={{ background: 'color-mix(in oklch, var(--brew-info) 10%, rgb(var(--brew-card) / 0.5))', border: '1px solid color-mix(in oklch, var(--brew-info) 25%, transparent)' }}>
              <p className="font-semibold mb-1" style={{ color: 'var(--fg-strong)' }}>Calculated Infusion Temperature:</p>
              <p className="text-lg font-bold" style={{ color: 'var(--brew-info)' }}>{infusionTempDisplay.toFixed(1)}°C</p>
              <p className="text-sm mt-2" style={{ color: 'var(--brew-info)' }}>
                {recipe.mashSteps.length === 0 && !existingStep
                  ? "Strike water temperature for initial infusion"
                  : "Infusion water temperature to reach target mash temp"}
              </p>
            </div>
          )}

          {/* Warning if no grains */}
          {totalGrainKg === 0 && (
            <div className="brew-alert-warning">
              <p className="text-sm">
                Add fermentables first to enable infusion temperature calculations
              </p>
            </div>
          )}

          {/* Common Presets */}
          <div className="border-t border-[rgb(var(--brew-border-subtle))] pt-4">
            <p className="text-sm font-semibold mb-2">Common Mash Steps:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setStepName("Protein Rest");
                  setStepType("infusion");
                  setTemperature(50);
                  setDuration(15);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Protein Rest (50°C, 15 min)
              </button>
              <button
                onClick={() => {
                  setStepName("Saccharification");
                  setStepType("infusion");
                  setTemperature(66);
                  setDuration(60);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Saccharification (66°C, 60 min)
              </button>
              <button
                onClick={() => {
                  setStepName("Mash Out");
                  setStepType("temperature");
                  setTemperature(76);
                  setDuration(10);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Mash Out (76°C, 10 min)
              </button>
              <button
                onClick={() => {
                  setStepName("Beta Rest");
                  setStepType("temperature");
                  setTemperature(63);
                  setDuration(30);
                }}
                className="brew-chip px-3 py-2 text-sm rounded-lg text-left"
              >
                Beta Rest (63°C, 30 min)
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
