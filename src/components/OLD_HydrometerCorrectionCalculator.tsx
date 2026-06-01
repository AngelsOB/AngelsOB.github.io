'use client';

import { useMemo, useState } from "react";
import { correctHydrometer } from "../calculators/hydrometerCorrection";

function parseNum(input: string): number | null {
  const v = input.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}

function fToC(f: number): number {
  return ((f - 32) * 5) / 9;
}

type TempUnit = "C" | "F";
type CalPreset = "15" | "20";

export default function OLD_HydrometerCorrectionCalculator() {
  const [sgInput, setSgInput] = useState("1.050");
  const [tempInput, setTempInput] = useState("30");
  const [tempUnit, setTempUnit] = useState<TempUnit>("C");
  const [calPreset, setCalPreset] = useState<CalPreset>("20");

  const calTempC = calPreset === "15" ? 15 : 20;

  const calc = useMemo(() => {
    const sg = parseNum(sgInput);
    const temp = parseNum(tempInput);

    if (sg == null || temp == null)
      return { error: "Enter a gravity reading and temperature" };
    if (sg < 0.98 || sg > 1.2)
      return { error: "Gravity reading out of range" };

    const sampleC = tempUnit === "C" ? temp : fToC(temp);

    if (sampleC < 0 || sampleC > 100)
      return { error: "Temperature out of range (0–100 °C)" };

    const corrected = correctHydrometer(sg, sampleC, calTempC);
    const correction = corrected - sg;

    return { error: null, corrected, correction, sampleC };
  }, [sgInput, tempInput, tempUnit, calTempC]);

  return (
    <div className="brew-section" data-accent="yeast">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="brew-section-title">Hydrometer Correction</h2>
        <span className="text-xs text-muted">temperature adjust</span>
      </div>

      <p className="text-sm text-muted mb-5 leading-relaxed">
        Correct your hydrometer reading for the sample temperature.
        Warm wort reads lower than the true gravity &mdash; this fixes that.
      </p>

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Reading
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="0.98"
            max="1.2"
            className="brew-input w-full tabular-nums"
            value={sgInput}
            onChange={(e) => setSgInput(e.target.value)}
            placeholder="1.050"
          />
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Sample Temp
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={tempUnit === "C" ? 0 : 32}
              max={tempUnit === "C" ? 100 : 212}
              className="brew-input w-full tabular-nums !pr-14"
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
              placeholder={tempUnit === "C" ? "30" : "86"}
            />
            <button
              type="button"
              onClick={() => {
                const current = parseNum(tempInput);
                if (current != null) {
                  if (tempUnit === "C") {
                    setTempInput(cToF(current).toFixed(1));
                  } else {
                    setTempInput(fToC(current).toFixed(1));
                  }
                }
                setTempUnit(tempUnit === "C" ? "F" : "C");
              }}
              className="absolute inset-y-0 right-0 flex items-center px-2.5 text-[10px] font-semibold text-muted opacity-60 hover:opacity-100 transition-opacity"
            >
              °{tempUnit}
            </button>
          </div>
        </label>

        <label className="col-span-2 sm:col-span-1 block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Calibrated At
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCalPreset("20")}
              className={`brew-input flex-1 text-center text-xs font-medium transition-colors ${
                calPreset === "20"
                  ? "!bg-[var(--brew-accent-200)] !text-[var(--brew-accent-900)] dark:!bg-[var(--brew-accent-800)] dark:!text-[var(--brew-accent-100)]"
                  : "opacity-60"
              }`}
            >
              20°C / 68°F
            </button>
            <button
              type="button"
              onClick={() => setCalPreset("15")}
              className={`brew-input flex-1 text-center text-xs font-medium transition-colors ${
                calPreset === "15"
                  ? "!bg-[var(--brew-accent-200)] !text-[var(--brew-accent-900)] dark:!bg-[var(--brew-accent-800)] dark:!text-[var(--brew-accent-100)]"
                  : "opacity-60"
              }`}
            >
              15°C / 59°F
            </button>
          </div>
        </label>
      </div>

      {/* Results */}
      {calc.error ? (
        <div className="text-sm text-muted">{calc.error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="brew-gauge">
              <div className="brew-gauge-label">Corrected SG</div>
              <div className="brew-gauge-value text-3xl tabular-nums">
                {calc.corrected!.toFixed(3)}
              </div>
            </div>

            <div className="brew-gauge">
              <div className="brew-gauge-label">Correction</div>
              <div className="brew-gauge-value tabular-nums">
                {calc.correction! >= 0 ? "+" : ""}
                {calc.correction!.toFixed(3)}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-muted opacity-50 font-mono tabular-nums">
            {parseNum(sgInput)!.toFixed(3)} @ {calc.sampleC!.toFixed(1)}°C → calibrated {calTempC}°C
          </div>
        </div>
      )}
    </div>
  );
}
