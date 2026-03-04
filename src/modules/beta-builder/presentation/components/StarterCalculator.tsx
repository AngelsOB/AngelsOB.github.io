/**
 * Starter Calculator Component
 *
 * Calculates yeast cell counts and starter requirements for pitching.
 * Supports multiple yeast types (liquid, dry, slurry) and multi-step starters.
 * Uses White and Braukaiser models for cell growth calculations.
 *
 * Layout (always visible, no collapse):
 *  1. Yeast source controls (Type, Packs, Mfg Date) — attached to yeast card
 *  2. Pitch rate metrics (Available, Required, Diff) — always visible
 *  3. Starter steps + "+ Add Starter" button — like mash schedule
 */

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import type { YeastType, StarterStep, StarterInfo } from "../../domain/models/Recipe";
import { starterCalculationService } from "../../domain/services/StarterCalculationService";

interface StarterCalculatorProps {
  starterInfo?: StarterInfo;
  batchVolumeL: number;
  og: number;
  onStarterChange: (info: StarterInfo) => void;
}

/* ---- Datum-card helpers (equipment-style cards) ---- */

function StarterDatum({
  label,
  value,
  onChange,
  step,
  min,
  type = "number",
  options,
  unit,
  stepper,
}: {
  label: string;
  value: number | string;
  onChange: (v: any) => void;
  step?: string;
  min?: string;
  type?: "number" | "date" | "select";
  options?: { value: string; label: string }[];
  unit?: string;
  stepper?: boolean;
}) {
  const stepNum = step ? parseFloat(step) : 1;
  const minNum = min !== undefined ? parseFloat(min) : -Infinity;
  // Determine decimal places from step for clean rounding
  const decimals = step ? (step.split(".")[1]?.length ?? 0) : 0;

  const nudge = (dir: 1 | -1) => {
    const next = parseFloat(String(value)) + dir * stepNum;
    const rounded = parseFloat(next.toFixed(decimals));
    if (rounded >= minNum) onChange(rounded);
  };

  return (
    <div className="equip-datum is-small">
      <span className="equip-datum-label">{label}</span>
      <div className="equip-datum-value">
        {type === "select" && options ? (
          <select
            className="equip-datum-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : stepper ? (
          <div className="starter-stepper">
            <button type="button" className="starter-stepper-btn" onClick={() => nudge(-1)} aria-label={`Decrease ${label}`}>−</button>
            <div className="starter-stepper-center">
              <input
                type="number"
                className="equip-datum-input starter-stepper-input"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                step={step}
                min={min}
              />
              {unit && <span className="equip-datum-unit starter-stepper-unit">{unit}</span>}
            </div>
            <button type="button" className="starter-stepper-btn" onClick={() => nudge(1)} aria-label={`Increase ${label}`}>+</button>
          </div>
        ) : (
          <input
            type={type}
            className="equip-datum-input"
            value={value}
            onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
            step={step}
            min={min}
          />
        )}
        {!stepper && unit && <span className="equip-datum-unit">{unit}</span>}
      </div>
    </div>
  );
}

function StarterReadout({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="equip-datum is-small starter-readout">
      <span className="equip-datum-label">{label}</span>
      <div className="equip-datum-value">
        <span className="starter-readout-value">{value}</span>
        <span className="equip-datum-unit">{unit}</span>
      </div>
    </div>
  );
}

export default function StarterCalculator({
  starterInfo,
  batchVolumeL,
  og,
  onStarterChange,
}: StarterCalculatorProps) {
  const [yeastType, setYeastType] = useState<YeastType>(starterInfo?.yeastType ?? "liquid-100");
  const [packs, setPacks] = useState<number>(starterInfo?.packs ?? 1);
  const [mfgDate, setMfgDate] = useState<string>(starterInfo?.mfgDate ?? "");
  const [slurryLiters, setSlurryLiters] = useState<number>(starterInfo?.slurryLiters ?? 0);
  const [slurryBillionPerMl, setSlurryBillionPerMl] = useState<number>(
    starterInfo?.slurryBillionPerMl ?? 1
  );
  const [steps, setSteps] = useState<StarterStep[]>(starterInfo?.steps ?? []);

  const isHydrating = useRef(false);
  const prevStarterInfoRef = useRef(starterInfo);

  useEffect(() => {
    if (starterInfo === prevStarterInfoRef.current) return;
    prevStarterInfoRef.current = starterInfo;

    if (starterInfo) {
      isHydrating.current = true;
      setYeastType(starterInfo.yeastType);
      setPacks(starterInfo.packs);
      setMfgDate(starterInfo.mfgDate || "");
      setSlurryLiters(starterInfo.slurryLiters || 0);
      setSlurryBillionPerMl(starterInfo.slurryBillionPerMl || 1);
      setSteps(starterInfo.steps);
      queueMicrotask(() => {
        isHydrating.current = false;
      });
    }
  }, [starterInfo]);

  const onStarterChangeRef = useRef(onStarterChange);
  onStarterChangeRef.current = onStarterChange;

  const notifyParent = useCallback(() => {
    if (isHydrating.current) return;
    onStarterChangeRef.current({
      yeastType,
      packs,
      mfgDate,
      slurryLiters,
      slurryBillionPerMl,
      steps,
    });
  }, [yeastType, packs, mfgDate, slurryLiters, slurryBillionPerMl, steps]);

  /* Always notify parent when anything changes */
  useEffect(() => {
    notifyParent();
  }, [notifyParent]);

  const starterResults = useMemo(() => {
    return starterCalculationService.calculateStarter(
      batchVolumeL,
      og,
      yeastType,
      packs,
      mfgDate,
      slurryLiters,
      slurryBillionPerMl,
      steps
    );
  }, [batchVolumeL, og, yeastType, packs, mfgDate, slurryLiters, slurryBillionPerMl, steps]);

  const hasSteps = steps.length > 0;
  const availB = hasSteps ? starterResults.finalEndB : starterResults.cellsAvailableB;
  const cellDiff = availB - starterResults.requiredCellsB;
  const underpitched = cellDiff < 0;

  /* Flash metrics when underlying values change (skip first render) */
  const [metricFlash, setMetricFlash] = useState(false);
  const prevMetricKey = useRef("");
  useEffect(() => {
    const key = `${starterResults.cellsAvailableB}|${starterResults.requiredCellsB}|${starterResults.finalEndB}`;
    if (prevMetricKey.current && prevMetricKey.current !== key) {
      setMetricFlash(true);
      const timer = setTimeout(() => setMetricFlash(false), 500);
      return () => clearTimeout(timer);
    }
    prevMetricKey.current = key;
  }, [starterResults]);

  /* Shared model for all steps — derived from first step or default */
  const modelToStr = (m: StarterStep["model"]) =>
    m.kind === "white" ? `white-${m.aeration}` : "braukaiser";
  const strToModel = (v: string): StarterStep["model"] =>
    v.startsWith("white-")
      ? { kind: "white" as const, aeration: v.replace("white-", "") as "none" | "shaking" }
      : { kind: "braukaiser" as const };

  const starterModelStr = steps.length > 0 ? modelToStr(steps[0].model) : "white-shaking";

  const handleModelChange = (v: string) => {
    const newModel = strToModel(v);
    setSteps((xs) => xs.map((x) => ({ ...x, model: newModel })));
  };

  const handleAddStep = () => {
    if (steps.length >= 3) return;
    setSteps((xs) => [
      ...xs,
      {
        id: crypto.randomUUID(),
        liters: 2,
        gravity: 1.036,
        model: strToModel(starterModelStr),
      },
    ]);
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps((xs) => xs.filter((x) => x.id !== stepId));
  };

  const handleUpdateStep = (stepId: string, updates: Partial<StarterStep>) => {
    setSteps((xs) => xs.map((x) => (x.id === stepId ? { ...x, ...updates } : x)));
  };

  const mc = "starter-metric" + (metricFlash ? " is-flash" : "");

  return (
    <>
      {/* ① Yeast source — always visible, fused into yeast card */}
      <div className="starter-source-bar">
        <div className="starter-input-grid">
          <StarterDatum
            label="Type"
            type="select"
            value={yeastType}
            onChange={(v) => setYeastType(v as YeastType)}
            options={[
              { value: "liquid-100", label: "Liquid 100B" },
              { value: "liquid-200", label: "Liquid 200B" },
              { value: "dry", label: "Dry 11g" },
              { value: "slurry", label: "Slurry" },
            ]}
          />

          {yeastType === "slurry" ? (
            <>
              <StarterDatum
                label="Amount"
                unit="L"
                value={slurryLiters}
                onChange={setSlurryLiters}
                step="0.1"
                min="0"
              />
              <StarterDatum
                label="Density"
                unit="B/mL"
                value={slurryBillionPerMl}
                onChange={setSlurryBillionPerMl}
                step="0.1"
                min="0"
              />
            </>
          ) : yeastType === "dry" ? (
            <StarterDatum label="Packs" value={packs} onChange={setPacks} step="1" min="0" />
          ) : (
            <>
              <StarterDatum label="Packs" value={packs} onChange={setPacks} step="1" min="0" />
              <StarterDatum label="Mfg Date" type="date" value={mfgDate} onChange={setMfgDate} />
            </>
          )}
        </div>
      </div>

      {/* ② Pitch rate metrics — always visible */}
      <div className="starter-dashboard">
        <div className={mc}>
          <span className="starter-metric-label">Cells Available</span>
          <span className="starter-metric-value">
            {availB.toFixed(0)}
            <span className="starter-metric-unit"> B</span>
          </span>
        </div>
        <div className={mc}>
          <span className="starter-metric-label">Cells Required</span>
          <span className="starter-metric-value">
            {starterResults.requiredCellsB.toFixed(0)}
            <span className="starter-metric-unit"> B</span>
          </span>
        </div>
        <div className={mc + (underpitched ? " is-danger" : "")}>
          <span className="starter-metric-label">Diff</span>
          <span
            className="starter-metric-value"
            style={{ color: cellDiff >= 0 ? "var(--brew-success)" : undefined }}
          >
            <span className={underpitched ? "brew-danger-text" : ""}>
              {(cellDiff >= 0 ? "+" : "") + cellDiff.toFixed(0)}
              <span className="starter-metric-unit"> B</span>
            </span>
          </span>
          {underpitched && <span className="starter-warning">Need a starter!</span>}
        </div>
      </div>

      {/* ③ Starter steps — always visible, like mash schedule */}
      <div className="starter-steps-section">
        {hasSteps && (
          <div className="starter-sub-label starter-sub-header">
            <span>Starter</span>
            <span className="starter-sub-sep">–</span>
            <select
              className="starter-model-select"
              value={starterModelStr}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              <option value="white-none">No Agitation</option>
              <option value="white-shaking">Shaking</option>
              <option value="braukaiser">Stir Plate</option>
            </select>
          </div>
        )}

        <div className="space-y-3">
          {steps.map((s, i) => {
            const res = starterResults.stepResults[i];
            return (
              <div key={s.id} className="starter-step-row">
                <span className="starter-step-num">{i + 1}</span>

                <StarterDatum
                  label="Size"
                  unit="L"
                  value={s.liters}
                  onChange={(v) => handleUpdateStep(s.id, { liters: v })}
                  step="0.1"
                  min="0.1"
                  stepper
                />

                <StarterDatum
                  label="Gravity"
                  value={s.gravity}
                  onChange={(v) => handleUpdateStep(s.id, { gravity: v })}
                  step="0.001"
                  min="1.000"
                  stepper
                />

                <StarterReadout label="DME" value={res?.dmeGrams.toFixed(0) ?? "–"} unit="g" />

                <div className="brew-row-actions">
                  <button
                    type="button"
                    aria-label={`Remove step ${i + 1}`}
                    className="brew-row-action-btn brew-danger-text"
                    onClick={() => handleRemoveStep(s.id)}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className={
              "brew-btn-primary w-full" + (!underpitched ? " starter-add-faded" : "")
            }
            onClick={handleAddStep}
            disabled={steps.length >= 3}
          >
            + Add Starter Step
          </button>
        </div>
      </div>
    </>
  );
}
