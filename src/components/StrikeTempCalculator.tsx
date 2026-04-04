"use client";

import { useMemo, useState } from "react";
import {
  calculateStrikeTemp,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from "../calculators/strikeTemp";

function parseNum(input: string): number | null {
  const v = input.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

type Unit = "C" | "F";

export default function StrikeTempCalculator() {
  const [unit, setUnit] = useState<Unit>("C");
  const [targetInput, setTargetInput] = useState("67");
  const [grainTempInput, setGrainTempInput] = useState("20");
  const [thicknessInput, setThicknessInput] = useState("3.0");

  const calc = useMemo(() => {
    const targetRaw = parseNum(targetInput);
    const grainRaw = parseNum(grainTempInput);
    const thickness = parseNum(thicknessInput);

    if (targetRaw == null || grainRaw == null || thickness == null)
      return { error: "Fill in all three fields" };

    const targetC = unit === "F" ? fahrenheitToCelsius(targetRaw) : targetRaw;
    const grainC = unit === "F" ? fahrenheitToCelsius(grainRaw) : grainRaw;

    if (targetC < 50 || targetC > 80)
      return { error: "Mash temp out of range (50–80°C)" };
    if (grainC < -10 || grainC > 40)
      return { error: "Grain temp out of range" };
    if (thickness < 1 || thickness > 8)
      return { error: "Thickness out of range (1–8 L/kg)" };

    const strikeC = calculateStrikeTemp(targetC, grainC, thickness);
    const strikeF = celsiusToFahrenheit(strikeC);

    return { error: null, strikeC, strikeF, targetC, grainC, thickness };
  }, [targetInput, grainTempInput, thicknessInput, unit]);

  const tempLabel = unit === "C" ? "°C" : "°F";

  function handleUnitToggle(newUnit: Unit) {
    if (newUnit === unit) return;
    const convert = newUnit === "F" ? celsiusToFahrenheit : fahrenheitToCelsius;
    const t = parseNum(targetInput);
    const g = parseNum(grainTempInput);
    if (t != null) setTargetInput(String(convert(t)));
    if (g != null) setGrainTempInput(String(convert(g)));
    setUnit(newUnit);
  }

  return (
    <div className="brew-section" data-accent="mash">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="brew-section-title">Strike Water Temp</h2>
          <span className="text-muted text-xs">heat balance</span>
        </div>

        {/* Unit toggle */}
        <div
          className="flex rounded-lg overflow-hidden text-xs font-semibold"
          style={{ border: "1px solid color-mix(in oklch, var(--fg-strong) 12%, transparent)" }}
        >
          {(["C", "F"] as Unit[]).map((u) => (
            <button
              key={u}
              onClick={() => handleUnitToggle(u)}
              className="px-3 py-1.5 transition-colors"
              style={{
                background: unit === u ? "var(--fg-strong)" : "transparent",
                color: unit === u ? "var(--bg)" : "var(--fg-muted)",
              }}
            >
              °{u}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted mb-5 text-sm leading-relaxed">
        Enter your target mash temperature, grain temperature, and mash
        thickness to find the strike water temperature.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="block">
          <div className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wider">
            Target Mash Temp
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              className="brew-input w-full tabular-nums"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder={unit === "C" ? "67" : "153"}
            />
            <span className="text-muted pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] opacity-50">
              {tempLabel}
            </span>
          </div>
        </label>

        <label className="block">
          <div className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wider">
            Grain Temp
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              className="brew-input w-full tabular-nums"
              value={grainTempInput}
              onChange={(e) => setGrainTempInput(e.target.value)}
              placeholder={unit === "C" ? "20" : "68"}
            />
            <span className="text-muted pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] opacity-50">
              {tempLabel}
            </span>
          </div>
        </label>

        <label className="col-span-2 block sm:col-span-1">
          <div className="text-muted mb-1.5 text-xs font-semibold uppercase tracking-wider">
            Mash Thickness
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="1"
              max="8"
              className="brew-input w-full tabular-nums"
              value={thicknessInput}
              onChange={(e) => setThicknessInput(e.target.value)}
              placeholder="3.0"
            />
            <span className="text-muted pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] opacity-50">
              L/kg
            </span>
          </div>
        </label>
      </div>

      {calc.error ? (
        <div className="text-muted text-sm">{calc.error}</div>
      ) : (
        <div className="space-y-3">
          <div className="brew-gauge !p-4">
            <div className="brew-gauge-label">Strike Water Temperature</div>
            <div className="brew-gauge-value text-4xl tabular-nums">
              {unit === "C"
                ? `${calc.strikeC!.toFixed(1)}°C`
                : `${calc.strikeF!.toFixed(1)}°F`}
            </div>
            <div className="text-muted mt-1 text-xs tabular-nums opacity-60">
              {unit === "C"
                ? `${calc.strikeF!.toFixed(1)}°F`
                : `${calc.strikeC!.toFixed(1)}°C`}
            </div>
          </div>

          <div className="text-muted font-mono text-[11px] tabular-nums opacity-50">
            {calc.strikeC!.toFixed(1)}°C = {calc.targetC!.toFixed(1)} + (0.41 ÷{" "}
            {calc.thickness!.toFixed(1)}) × ({calc.targetC!.toFixed(1)} − {calc.grainC!.toFixed(1)})
          </div>
        </div>
      )}
    </div>
  );
}
