'use client';

import { useMemo, useState } from "react";
import { abvFromOGFG } from "../calculators/abv";

function parseGravity(input: string): number | null {
  const value = input.trim();
  if (value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export default function OLD_AbvCalculator() {
  const [ogInput, setOgInput] = useState<string>("1.050");
  const [fgInput, setFgInput] = useState<string>("1.010");

  const { abv, error } = useMemo(() => {
    const ogVal = parseGravity(ogInput);
    const fgVal = parseGravity(fgInput);
    if (ogVal == null || fgVal == null) {
      return { abv: null as number | null, error: "Enter OG and FG" };
    }
    if (ogVal < 0.99 || ogVal > 1.2)
      return { abv: null, error: "OG out of range" };
    if (fgVal < 0.99 || fgVal > 1.2)
      return { abv: null, error: "FG out of range" };
    if (fgVal > ogVal) return { abv: null, error: "FG must be <= OG" };
    const abv = abvFromOGFG(ogVal, fgVal);
    return { abv, error: null as string | null };
  }, [ogInput, fgInput]);

  return (
    <div className="brew-section" data-accent="grain">
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="brew-section-title">ABV</h2>
        <span className="text-xs text-muted">from OG / FG</span>
      </div>

      <p className="text-sm text-muted mb-5 leading-relaxed">
        Enter your original and final gravity readings to estimate alcohol
        by volume.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="flex gap-3 flex-1 min-w-0">
          <label className="block flex-1 min-w-0">
            <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              OG
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0.99"
              max="1.2"
              className="brew-input w-full tabular-nums"
              value={ogInput}
              onChange={(e) => setOgInput(e.target.value)}
              placeholder="1.050"
            />
          </label>

          <label className="block flex-1 min-w-0">
            <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              FG
            </div>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0.99"
              max="1.2"
              className="brew-input w-full tabular-nums"
              value={fgInput}
              onChange={(e) => setFgInput(e.target.value)}
              placeholder="1.010"
            />
          </label>
        </div>

        <div className="sm:w-40 shrink-0">
          {error ? (
            <div className="text-xs text-muted py-2">{error}</div>
          ) : (
            <div className="brew-gauge !p-3">
              <div className="brew-gauge-label">Estimated ABV</div>
              <div className="brew-gauge-value tabular-nums">
                {abv != null ? `${abv.toFixed(2)}%` : "—"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
