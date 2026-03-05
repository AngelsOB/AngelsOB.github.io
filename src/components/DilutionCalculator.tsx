"use client";

import { useMemo, useState } from "react";
import { dilutionWater, gravityPoints } from "../calculators/dilution";

function parseNum(input: string): number | null {
  const v = input.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function DilutionCalculator() {
  const [volumeInput, setVolumeInput] = useState("20");
  const [currentSGInput, setCurrentSGInput] = useState("1.060");
  const [targetSGInput, setTargetSGInput] = useState("1.050");

  const calc = useMemo(() => {
    const vol = parseNum(volumeInput);
    const currentSG = parseNum(currentSGInput);
    const targetSG = parseNum(targetSGInput);

    if (vol == null || currentSG == null || targetSG == null)
      return { error: "Fill in all three fields" };

    if (vol <= 0) return { error: "Current volume must be > 0" };
    if (currentSG < 1.0 || currentSG > 1.2) return { error: "Current gravity out of range" };
    if (targetSG < 1.0 || targetSG > 1.2) return { error: "Target gravity out of range" };
    if (targetSG >= currentSG) return { error: "Target OG must be lower than current gravity" };

    const water = dilutionWater(vol, currentSG, targetSG);
    const totalVol = vol + water;

    if (!Number.isFinite(water) || water <= 0) return { error: "Invalid result" };

    return {
      error: null,
      water,
      totalVol,
      currentPts: gravityPoints(currentSG),
      targetPts: gravityPoints(targetSG),
    };
  }, [volumeInput, currentSGInput, targetSGInput]);

  return (
    <div className="brew-section" data-accent="water">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="brew-section-title">Sparge / Dilution</h2>
        <span className="text-muted text-xs">water addition</span>
      </div>

      <p className="text-muted mb-5 text-sm leading-relaxed">
        Hit your target OG every time. <br />
        Use pre-boil for sparge adjustments, or just before knockout for absolute precision.
      </p>

      {/* Inputs — 3 across on desktop, stacked on mobile */}
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <label className="block">
          <div className="text-muted mb-1.5 text-xs font-semibold tracking-wider uppercase">
            Current Vol
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              className="brew-input w-full tabular-nums"
              value={volumeInput}
              onChange={(e) => setVolumeInput(e.target.value)}
              placeholder="20"
            />
            <span className="text-muted pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] opacity-50">
              L
            </span>
          </div>
        </label>

        <label className="block">
          <div className="text-muted mb-1.5 text-xs font-semibold tracking-wider uppercase">
            Current SG
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="1.000"
            max="1.200"
            className="brew-input w-full tabular-nums"
            value={currentSGInput}
            onChange={(e) => setCurrentSGInput(e.target.value)}
            placeholder="1.060"
          />
        </label>

        <label className="col-span-2 block sm:col-span-1">
          <div className="text-muted mb-1.5 text-xs font-semibold tracking-wider uppercase">
            Target OG
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.001"
            min="1.000"
            max="1.200"
            className="brew-input w-full tabular-nums"
            value={targetSGInput}
            onChange={(e) => setTargetSGInput(e.target.value)}
            placeholder="1.050"
          />
        </label>
      </div>

      {/* Results */}
      {calc.error ? (
        <div className="text-muted text-sm">{calc.error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="brew-gauge">
              <div className="brew-gauge-label">Water to Add</div>
              <div className="brew-gauge-value text-3xl tabular-nums">
                {calc.water!.toFixed(2)}
                <span className="text-muted ml-1 text-sm font-normal">L</span>
              </div>
            </div>

            <div className="brew-gauge">
              <div className="brew-gauge-label">Total Volume</div>
              <div className="brew-gauge-value tabular-nums">
                {calc.totalVol!.toFixed(2)}
                <span className="text-muted ml-1 text-sm font-normal">L</span>
              </div>
            </div>
          </div>

          {/* Formula breakdown */}
          <div className="text-muted font-mono text-[11px] tabular-nums opacity-50">
            {calc.currentPts!.toFixed(1)} pts &times; {parseNum(volumeInput)!} L ={" "}
            {calc.targetPts!.toFixed(1)} pts &times; {calc.totalVol!.toFixed(2)} L
          </div>
        </div>
      )}
    </div>
  );
}
