/**
 * Starter Calculator Component
 *
 * Calculates yeast cell counts and starter requirements for pitching.
 * Supports multiple yeast types (liquid, dry, slurry) and multi-step starters.
 * Uses White and Braukaiser models for cell growth calculations.
 */

import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import type { YeastType, StarterStep, StarterInfo } from "../../domain/models/Recipe";
import { starterCalculationService } from "../../domain/services/StarterCalculationService";

interface StarterCalculatorProps {
  /** Current starter info from yeast (for hydration) */
  starterInfo?: StarterInfo;
  /** Batch volume in liters */
  batchVolumeL: number;
  /** Original gravity for cell requirement calculation */
  og: number;
  /** Whether the calculator is expanded */
  isOpen: boolean;
  /** Toggle open/closed state */
  onToggle: () => void;
  /** Callback when starter info changes */
  onStarterChange: (info: StarterInfo) => void;
}

export default function StarterCalculator({
  starterInfo,
  batchVolumeL,
  og,
  isOpen,
  onToggle,
  onStarterChange,
}: StarterCalculatorProps) {
  // Starter state
  const [yeastType, setYeastType] = useState<YeastType>(starterInfo?.yeastType ?? "liquid-100");
  const [packs, setPacks] = useState<number>(starterInfo?.packs ?? 1);
  const [mfgDate, setMfgDate] = useState<string>(starterInfo?.mfgDate ?? "");
  const [slurryLiters, setSlurryLiters] = useState<number>(starterInfo?.slurryLiters ?? 0);
  const [slurryBillionPerMl, setSlurryBillionPerMl] = useState<number>(starterInfo?.slurryBillionPerMl ?? 1);
  const [steps, setSteps] = useState<StarterStep[]>(starterInfo?.steps ?? []);

  // Track whether we're hydrating from prop to avoid re-notifying parent
  const isHydrating = useRef(false);

  // Hydrate state from starterInfo prop (only on initial mount or when prop identity truly changes from outside)
  const prevStarterInfoRef = useRef(starterInfo);
  useEffect(() => {
    // Skip if starterInfo hasn't actually changed from outside
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
      // Reset hydrating flag after React processes the state updates
      queueMicrotask(() => { isHydrating.current = false; });
    }
  }, [starterInfo]);

  // Stable ref to onStarterChange to avoid effect re-fires
  const onStarterChangeRef = useRef(onStarterChange);
  onStarterChangeRef.current = onStarterChange;

  // Notify parent when starter info changes (but not during hydration from prop)
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

  useEffect(() => {
    if (isOpen) {
      notifyParent();
    }
  }, [notifyParent, isOpen]);

  // Calculate starter results
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

  const diffB = starterResults.cellsAvailableB - starterResults.requiredCellsB;
  const finalDiffB = starterResults.finalEndB - starterResults.requiredCellsB;

  // Summary text for collapsed state
  const summaryText = useMemo(() => {
    if (isOpen) return "";

    const yeastInfo = (() => {
      if (yeastType === "slurry") {
        return `Slurry ${slurryLiters.toFixed(1)} L @ ${slurryBillionPerMl.toFixed(1)} B/mL`;
      }
      if (yeastType === "dry") {
        const n = Math.max(0, Math.floor(packs));
        return `Dry ${n}×11g`;
      }
      const label = yeastType === "liquid-200" ? "Liquid (200B)" : "Liquid (100B)";
      const n = Math.max(0, Math.floor(packs));
      const mfgPart = mfgDate ? `(Mfg ${mfgDate})` : "";
      return `${n} pack${n === 1 ? "" : "s"} of ${label} ${mfgPart}`;
    })();

    if (starterResults.totalStarterL > 0 && steps.length > 0) {
      const last = steps[steps.length - 1];
      const starterInfo = `${last.liters.toFixed(1)}L @ ${Number(last.gravity).toFixed(3)}`;
      return `${yeastInfo} in a ${starterInfo} starter`;
    }

    return yeastInfo;
  }, [isOpen, starterResults, steps, yeastType, packs, slurryLiters, slurryBillionPerMl, mfgDate]);

  const handleAddStep = () => {
    if (steps.length >= 3) return;
    setSteps((xs) => [
      ...xs,
      {
        id: crypto.randomUUID(),
        liters: 2,
        gravity: 1.036,
        model: { kind: "white", aeration: "shaking" },
      },
    ]);
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps((xs) => xs.filter((x) => x.id !== stepId));
  };

  const handleUpdateStep = (stepId: string, updates: Partial<StarterStep>) => {
    setSteps((xs) =>
      xs.map((x) => (x.id === stepId ? { ...x, ...updates } : x))
    );
  };

  return (
    <div className="rounded-lg" style={{ border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))' }}>
      <div className="flex items-center justify-between p-4 rounded-t-lg" style={{ background: 'color-mix(in oklch, var(--brew-accent-900) 15%, rgb(var(--brew-card-inset) / 0.25))', borderBottom: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))' }}>
        <div className="flex items-center gap-3">
          <span className="font-medium" style={{ color: 'var(--fg-strong)' }}>Pitch Rate & Starter</span>
          {!isOpen && summaryText && (
            <span className="text-xs font-medium text-muted">{summaryText}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="brew-btn-ghost text-xs"
        >
          {isOpen ? "Hide Calculator" : "Show Calculator"}
        </button>
      </div>

      {isOpen && (
        <div className="p-4 space-y-4">
          {/* Part 1: Cells */}
          <div className="rounded-lg p-4 space-y-3" style={{ background: 'color-mix(in oklch, var(--brew-accent-900) 15%, rgb(var(--brew-card-inset) / 0.25))', border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--fg-strong)' }}>Part 1: Cells</div>

            {/* Package inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <label className="block">
                <div className="text-xs font-semibold mb-1">Package Type</div>
                <select
                  className="brew-input w-full"
                  value={yeastType}
                  onChange={(e) => setYeastType(e.target.value as YeastType)}
                >
                  <option value="liquid-100">Liquid (100B)</option>
                  <option value="liquid-200">Liquid (200B)</option>
                  <option value="dry">Dry (11g pkt)</option>
                  <option value="slurry">Slurry</option>
                </select>
              </label>

              {yeastType === "slurry" ? (
                <>
                  <label className="block">
                    <div className="text-xs font-semibold mb-1">
                      Slurry Amount (L)
                    </div>
                    <input
                      className="brew-input w-full"
                      type="number"
                      step={0.1}
                      min={0}
                      value={slurryLiters}
                      onChange={(e) => setSlurryLiters(Number(e.target.value))}
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold mb-1">
                      Density (B/mL)
                    </div>
                    <input
                      className="brew-input w-full"
                      type="number"
                      step={0.1}
                      min={0}
                      value={slurryBillionPerMl}
                      onChange={(e) =>
                        setSlurryBillionPerMl(Number(e.target.value))
                      }
                    />
                  </label>
                </>
              ) : yeastType === "dry" ? (
                <label className="block">
                  <div className="text-xs font-semibold mb-1">Packs</div>
                  <input
                    className="brew-input w-full"
                    type="number"
                    step={1}
                    min={0}
                    value={packs}
                    onChange={(e) => setPacks(Number(e.target.value))}
                  />
                </label>
              ) : (
                <>
                  <label className="block">
                    <div className="text-xs font-semibold mb-1">Packs</div>
                    <input
                      className="brew-input w-full"
                      type="number"
                      step={1}
                      min={0}
                      value={packs}
                      onChange={(e) => setPacks(Number(e.target.value))}
                    />
                  </label>
                  <label className="block">
                    <div className="text-xs font-semibold mb-1">Mfg Date</div>
                    <input
                      className="brew-input w-full"
                      type="date"
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>

            {/* Cell counts */}
            <div className="text-sm flex flex-wrap gap-x-6 gap-y-2">
              <span>
                <span className="text-muted">Available:</span>{" "}
                <span className="font-semibold">
                  {starterResults.cellsAvailableB.toFixed(0)} B
                </span>
              </span>
              <span>
                <span className="text-muted">Required:</span>{" "}
                <span className="font-semibold">
                  {starterResults.requiredCellsB.toFixed(0)} B
                </span>
              </span>
              <span>
                <span className="text-muted">Diff:</span>{" "}
                <span
                  className={`font-semibold ${diffB < 0 ? "brew-danger-text" : ""}`}
                  style={diffB >= 0 ? { color: 'var(--brew-success)' } : undefined}
                >
                  {(diffB >= 0 ? "+" : "") + diffB.toFixed(0)} B
                </span>
              </span>
            </div>
          </div>

          {/* Part 2: Starter Steps */}
          <div className="rounded-lg p-4 space-y-3" style={{ background: 'color-mix(in oklch, var(--brew-accent-900) 15%, rgb(var(--brew-card-inset) / 0.25))', border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)' }}>
            <div className="text-sm font-semibold" style={{ color: 'var(--fg-strong)' }}>
              Part 2: Starter (up to 3 steps)
            </div>

            <div className="space-y-3">
              {steps.map((s, i) => {
                const res = starterResults.stepResults[i];
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-1 gap-3 items-end sm:grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto]"
                  >
                    <div className="text-xs font-semibold">Step {i + 1}</div>

                    <label className="block">
                      <div className="text-xs font-semibold mb-1">Size (L)</div>
                      <input
                        className="brew-input w-full"
                        type="number"
                        step={0.1}
                        value={s.liters}
                        onChange={(e) =>
                          handleUpdateStep(s.id, {
                            liters: Number(e.target.value),
                          })
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="text-xs font-semibold mb-1">
                        Gravity (SG)
                      </div>
                      <input
                        className="brew-input w-full"
                        type="number"
                        step={0.001}
                        value={s.gravity}
                        onChange={(e) =>
                          handleUpdateStep(s.id, {
                            gravity: Number(e.target.value),
                          })
                        }
                      />
                    </label>

                    <label className="block">
                      <div className="text-xs font-semibold mb-1">Model</div>
                      <select
                        className="brew-input w-full"
                        value={
                          s.model.kind === "white"
                            ? `white-${s.model.aeration}`
                            : "braukaiser"
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          const newModel = v.startsWith("white-")
                            ? {
                                kind: "white" as const,
                                aeration: v.replace("white-", "") as
                                  | "none"
                                  | "shaking",
                              }
                            : { kind: "braukaiser" as const };
                          handleUpdateStep(s.id, { model: newModel });
                        }}
                      >
                        <option value="white-none">No agitation</option>
                        <option value="white-shaking">Shaking</option>
                        <option value="braukaiser">Stir Plate</option>
                      </select>
                    </label>

                    <div className="rounded-md px-3 py-2" style={{ background: 'color-mix(in oklch, var(--brew-accent-900) 15%, rgb(var(--brew-card-inset) / 0.35))', border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))' }}>
                      <div className="text-[11px] text-muted">DME (g)</div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--fg-strong)' }}>
                        {res?.dmeGrams.toFixed(0) ?? "–"}
                      </div>
                    </div>

                    <div className="rounded-md px-3 py-2" style={{ background: 'color-mix(in oklch, var(--brew-accent-900) 15%, rgb(var(--brew-card-inset) / 0.35))', border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))' }}>
                      <div className="text-[11px] text-muted">End (B)</div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--fg-strong)' }}>
                        {res?.endBillion.toFixed(0) ?? "–"}
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove step ${i + 1}`}
                      className="p-2 brew-danger-text opacity-60 hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveStep(s.id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              {steps.length > 0 && (
                <div className="text-sm flex justify-end gap-x-6">
                  <span>
                    <span className="text-muted">Final:</span>{" "}
                    <span className="font-semibold">
                      {starterResults.finalEndB.toFixed(0)} B
                    </span>
                  </span>
                  <span>
                    <span className="text-muted">Diff:</span>{" "}
                    <span
                      className={`font-semibold ${finalDiffB < 0 ? "brew-danger-text" : ""}`}
                      style={finalDiffB >= 0 ? { color: 'var(--brew-success)' } : undefined}
                    >
                      {(finalDiffB >= 0 ? "+" : "") + finalDiffB.toFixed(0)} B
                    </span>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-start">
                <button
                  type="button"
                  className="brew-btn-ghost text-xs"
                  onClick={handleAddStep}
                  disabled={steps.length >= 3}
                >
                  + Add Step
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
