'use client';

import { useMemo, useState } from "react";

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

/**
 * Empirical fit for CO₂ equilibrium pressure.
 * P(psi) = -16.6999 - 0.0101059·T + 0.00116512·T² + 0.173354·T·V + 4.24267·V - 0.0684226·V²
 * where T = °F, V = target volumes CO₂.
 */
function calculatePsi(tempF: number, volumes: number): number {
  const t = tempF;
  const v = volumes;
  return Math.max(
    0,
    -16.6999 -
      0.0101059 * t +
      0.00116512 * t * t +
      0.173354 * t * v +
      4.24267 * v -
      0.0684226 * v * v
  );
}

/** Convert PSI to bar. */
function psiToBar(psi: number): number {
  return psi * 0.0689476;
}

type TempUnit = "C" | "F";

export default function OLD_CarbonationCalculator() {
  const [volumesInput, setVolumesInput] = useState("2.4");
  const [tempInput, setTempInput] = useState("4");
  const [tempUnit, setTempUnit] = useState<TempUnit>("C");

  const calc = useMemo(() => {
    const volumes = parseNum(volumesInput);
    const temp = parseNum(tempInput);

    if (volumes == null || temp == null)
      return { error: "Enter CO₂ volumes and temperature" };
    if (volumes < 0.5 || volumes > 5)
      return { error: "CO₂ volumes out of range (0.5–5.0)" };

    const tempF = tempUnit === "C" ? cToF(temp) : temp;
    const tempC = tempUnit === "F" ? fToC(temp) : temp;

    if (tempC < -2 || tempC > 30)
      return { error: "Temperature out of range" };

    const psi = calculatePsi(tempF, volumes);
    const bar = psiToBar(psi);

    return { error: null, psi, bar, tempF, tempC };
  }, [volumesInput, tempInput, tempUnit]);

  return (
    <div className="brew-section" data-accent="water">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="brew-section-title">Carbonation</h2>
        <span className="text-xs text-muted">forced CO₂</span>
      </div>

      <p className="text-sm text-muted mb-5 leading-relaxed">
        Set your target CO₂ volumes and serving temperature to find the
        regulator pressure for force-carbonating kegs.
      </p>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Target CO₂
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.5"
              max="5"
              className="brew-input w-full tabular-nums !pr-14"
              value={volumesInput}
              onChange={(e) => setVolumesInput(e.target.value)}
              placeholder="2.4"
            />
            <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[10px] text-muted opacity-50">
              vols
            </span>
          </div>
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Beer Temp
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={tempUnit === "C" ? -2 : 28}
              max={tempUnit === "C" ? 30 : 86}
              className="brew-input w-full tabular-nums !pr-14"
              value={tempInput}
              onChange={(e) => setTempInput(e.target.value)}
              placeholder={tempUnit === "C" ? "4" : "39"}
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
      </div>

      {/* Results */}
      {calc.error ? (
        <div className="text-sm text-muted">{calc.error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="brew-gauge">
              <div className="brew-gauge-label">Regulator Pressure</div>
              <div className="brew-gauge-value text-3xl tabular-nums">
                {calc.psi!.toFixed(1)}
                <span className="text-sm font-normal text-muted ml-1">psi</span>
              </div>
            </div>

            <div className="brew-gauge">
              <div className="brew-gauge-label">Pressure (metric)</div>
              <div className="brew-gauge-value tabular-nums">
                {calc.bar!.toFixed(2)}
                <span className="text-sm font-normal text-muted ml-1">bar</span>
              </div>
            </div>
          </div>

          {/* Quick-reference hint */}
          <div className="text-[11px] text-muted opacity-50 font-mono tabular-nums">
            {parseNum(volumesInput)!.toFixed(1)} vols @{" "}
            {calc.tempC!.toFixed(1)}°C / {calc.tempF!.toFixed(1)}°F
          </div>
        </div>
      )}
    </div>
  );
}
