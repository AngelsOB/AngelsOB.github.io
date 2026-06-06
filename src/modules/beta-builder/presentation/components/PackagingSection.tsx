'use client';

/**
 * Packaging Section Component
 *
 * Bottling and kegging calculators using the equip-datum pattern
 * consistent with Equipment, Water Chemistry, and Starter sections.
 */

import { useMemo } from 'react';
import { useRecipeStore } from '../stores/recipeStore';
import { packagingCalculationService as calc } from '../../domain/services/PackagingCalculationService';
import { useHoldToRepeat } from '../../../../hooks/useHoldToRepeat';
import AnimatedNumberInput from '../../../../components/AnimatedNumberInput';
import type {
  Packaging,
  PackagingMethod,
  PrimingSugarType,
  BottleSize,
  BottleEntry,
} from '../../domain/models/Recipe';

const DEFAULT_PACKAGING: Packaging = {
  methods: ['bottle'],
  targetCo2Volumes: 2.4,
  primingSugarType: 'corn-sugar',
  conditioningTempC: 20,
  bottles: [{ size: '330ml', count: 58 }],
  servingTempC: 4,
  carbonationMethod: 'set-and-forget',
};

const SUGAR_OPTIONS: { value: PrimingSugarType; label: string }[] = [
  { value: 'corn-sugar', label: 'Corn Sugar (Dextrose)' },
  { value: 'table-sugar', label: 'Table Sugar (Sucrose)' },
  { value: 'dme', label: 'Dry Malt Extract' },
  { value: 'honey', label: 'Honey' },
];

const BOTTLE_OPTIONS: { value: BottleSize; label: string }[] = [
  { value: '330ml', label: '330 ml (12 oz)' },
  { value: '500ml', label: '500 ml (16.9 oz)' },
  { value: '650ml', label: '650 ml (22 oz)' },
  { value: '750ml', label: '750 ml (25.4 oz)' },
];

// ── Reusable datum components ─────────────────────────────────────────────

function PackagingDatum({
  id,
  label,
  unit,
  value,
  onChange,
  step,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  step: string;
}) {
  const stepNum = parseFloat(step);
  const decimals = step.split('.')[1]?.length ?? 0;

  const nudge = (dir: 1 | -1) => {
    const next = value + dir * stepNum;
    const rounded = parseFloat(next.toFixed(decimals));
    if (rounded >= 0) onChange(rounded);
  };

  const holdDown = useHoldToRepeat(() => nudge(-1));
  const holdUp = useHoldToRepeat(() => nudge(1));

  return (
    <div className="equip-datum is-small">
      <label htmlFor={id} className="equip-datum-label">{label}</label>
      <div className="equip-datum-value">
        <div className="starter-stepper">
          <button type="button" className="starter-stepper-btn" {...holdDown} aria-label={`Decrease ${label}`}>−</button>
          <div className="starter-stepper-center">
            <AnimatedNumberInput
              id={id}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
              className="equip-datum-input starter-stepper-input"
              step={step}
              min="0"
            />
            <span className="equip-datum-unit starter-stepper-unit">{unit}</span>
          </div>
          <button type="button" className="starter-stepper-btn" {...holdUp} aria-label={`Increase ${label}`}>+</button>
        </div>
      </div>
    </div>
  );
}

function PackagingReadout({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <div className="equip-datum is-small starter-readout">
      <span className="equip-datum-label">{label}</span>
      <div className="equip-datum-value">
        <span className="starter-readout-value">{value}</span>
        <span className="equip-datum-unit">{unit}</span>
      </div>
      {sub && <p className="text-[10px] text-muted mt-1 text-center">{sub}</p>}
    </div>
  );
}

function PackagingSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="equip-datum is-small">
      <label htmlFor={id} className="equip-datum-label">{label}</label>
      <div className="equip-datum-value">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="equip-datum-input"
          style={{ width: '100%', cursor: 'pointer' }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Bottle datum card ─────────────────────────────────────────────────────

/** Editable bottle card — user sets the count, remainder adjusts. */
function BottleDatumEditable({
  entry,
  index,
  volumeL,
  sugarPerBottle,
  onChangeSize,
  onChangeCount,
  onRemove,
}: {
  entry: BottleEntry;
  index: number;
  volumeL: number;
  sugarPerBottle: number;
  onChangeSize: (size: BottleSize) => void;
  onChangeCount: (count: number) => void;
  onRemove: () => void;
}) {
  const nudge = (dir: 1 | -1) => {
    const next = entry.count + dir;
    if (next >= 0) onChangeCount(next);
  };

  const holdDown = useHoldToRepeat(() => nudge(-1));
  const holdUp = useHoldToRepeat(() => nudge(1));

  return (
    <div className="equip-datum" style={{ position: 'relative' }}>
      {/* Size selector as label */}
      <select
        id={`pkg-bottle-size-${index}`}
        value={entry.size}
        onChange={(e) => onChangeSize(e.target.value as BottleSize)}
        className="equip-datum-label"
        style={{ cursor: 'pointer', background: 'transparent', border: 'none', textAlign: 'center', color: 'var(--fg-muted)' }}
      >
        {BOTTLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Count stepper */}
      <div className="equip-datum-value">
        <div className="starter-stepper">
          <button type="button" className="starter-stepper-btn" {...holdDown} aria-label="Decrease count">−</button>
          <div className="starter-stepper-center">
            <AnimatedNumberInput
              id={`pkg-bottle-count-${index}`}
              value={entry.count}
              onChange={(e) => onChangeCount(parseInt(e.target.value) || 0)}
              className="equip-datum-input starter-stepper-input"
              step="1"
              min="0"
            />
            <span className="equip-datum-unit starter-stepper-unit">btl</span>
          </div>
          <button type="button" className="starter-stepper-btn" {...holdUp} aria-label="Increase count">+</button>
        </div>
      </div>

      {/* Sub-text */}
      <p className="text-[10px] text-muted mt-1 text-center">
        {volumeL.toFixed(1)}L{sugarPerBottle > 0 ? ` · ${sugarPerBottle.toFixed(1)}g ea` : ''}
      </p>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="brew-row-action-btn brew-danger-text"
        aria-label="Remove bottle size"
        style={{ position: 'absolute', top: 6, right: 6 }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
}


/**
 * Auto-fill the last row's count to cover remaining batch volume.
 * All rows are still editable — this just provides a reactive default
 * for the last entry so totals stay sensible.
 */
function rebalanceLastRow(rows: BottleEntry[], batchML: number): BottleEntry[] {
  if (rows.length === 0) return rows;
  if (rows.length === 1) {
    // Single row: fill to batch
    const sizeML = calc.bottleSizeML(rows[0].size);
    return [{ ...rows[0], count: Math.max(0, Math.ceil(batchML / sizeML)) }];
  }
  // Multi-row: sum all rows except last, give remainder to last
  const allButLast = rows.slice(0, -1);
  const usedML = allButLast.reduce((sum, r) => sum + r.count * calc.bottleSizeML(r.size), 0);
  const lastRow = rows[rows.length - 1];
  const remainingML = Math.max(0, batchML - usedML);
  const lastCount = Math.ceil(remainingML / calc.bottleSizeML(lastRow.size));
  return [...allButLast, { ...lastRow, count: lastCount }];
}

// ── Main Component ────────────────────────────────────────────────────────

export default function PackagingSection() {
  const { currentRecipe, updateRecipe } = useRecipeStore();

  // Hook must run unconditionally — keep it above the early return below.
  const styleSuggestion = useMemo(() => {
    if (!currentRecipe?.style) return null;
    return calc.styleCo2Range(currentRecipe.style);
  }, [currentRecipe?.style]);

  if (!currentRecipe) return null;

  const pkg = currentRecipe.packaging;

  const highTemp = calc.highestFermTemp(currentRecipe.fermentationSteps);
  const residual = calc.residualCo2(highTemp);

  // Derived calculations
  const primingSugarG = pkg
    ? calc.primingSugarGrams(
        pkg.targetCo2Volumes,
        residual,
        currentRecipe.batchVolumeL,
        pkg.primingSugarType ?? 'corn-sugar'
      )
    : 0;

  const forcedPsi =
    pkg && pkg.servingTempC != null
      ? calc.forcedCarbonationPsi(pkg.servingTempC, pkg.targetCo2Volumes)
      : 0;

  const burstSchedule = calc.burstCarbonationSchedule(forcedPsi);

  // Bottle calculations — last row auto-fills to cover remainder
  const batchML = currentRecipe.batchVolumeL * 1000;
  const rawBottles: BottleEntry[] = pkg?.bottles
    ?? (pkg?.bottleSize
      ? [{ size: pkg.bottleSize, count: 0 }]
      : [{ size: '330ml', count: 0 }]);
  const bottles = rawBottles;

  const totalBottles = calc.totalBottleCount(bottles);
  const totalBottleVolumeL = calc.totalBottleVolumeL(bottles);

  const conditioningDays =
    pkg && pkg.conditioningTempC != null
      ? calc.estimatedConditioningDays(pkg.conditioningTempC)
      : 14;

  // ── Handlers ────────────────────────────────────────────────────────────

  const update = (partial: Partial<Packaging>) => {
    updateRecipe({ packaging: { ...DEFAULT_PACKAGING, ...pkg, ...partial } });
  };

  const updateBottles = (newBottles: BottleEntry[]) => {
    update({ bottles: rebalanceLastRow(newBottles, batchML), bottleSize: undefined });
  };

  const handleBottleSizeChange = (index: number, size: BottleSize) => {
    const newBottles = [...bottles];
    newBottles[index] = { ...newBottles[index], size };
    // Always rebalance — changing any size should recalculate the last row
    updateBottles(newBottles);
  };

  const handleBottleCountChange = (index: number, count: number) => {
    const newBottles = [...bottles];
    newBottles[index] = { ...newBottles[index], count: Math.max(0, count) };
    if (index === bottles.length - 1) {
      // Editing the last row directly — store as-is, don't rebalance it away
      update({ bottles: newBottles, bottleSize: undefined });
    } else {
      // Editing a non-last row — rebalance last row to cover remainder
      updateBottles(newBottles);
    }
  };

  const handleRemoveBottle = (index: number) => {
    updateBottles(bottles.filter((_, i) => i !== index));
  };

  const handleAddBottle = () => {
    const usedSizes = new Set(bottles.map((b) => b.size));
    const available = BOTTLE_OPTIONS.find((o) => !usedSizes.has(o.value));
    const size = (available?.value ?? '500ml') as BottleSize;
    updateBottles([...bottles, { size, count: 0 }]);
  };

  const toggleMethod = (method: PackagingMethod) => {
    const current = pkg?.methods ?? ['bottle'];
    const has = current.includes(method);
    let next: PackagingMethod[];
    if (has && current.length > 1) {
      next = current.filter((m) => m !== method);
    } else if (!has) {
      next = [...current, method];
    } else {
      return;
    }
    update({ methods: next });
  };

  const handleInit = () => {
    const initial: Packaging = {
      ...DEFAULT_PACKAGING,
      bottles: [{ size: '330ml', count: calc.numberOfBottles(currentRecipe.batchVolumeL, '330ml') }],
    };
    if (styleSuggestion) {
      initial.targetCo2Volumes = styleSuggestion.typical;
    }
    updateRecipe({ packaging: initial });
  };

  // ── Empty state ─────────────────────────────────────────────────────────

  if (!pkg) {
    return (
      <div className="brew-section brew-animate-in brew-stagger-8" data-accent="packaging">
        <h2 className="brew-section-title">Packaging</h2>
        <div
          className="rounded-lg border border-dashed p-8 text-center"
          style={{
            borderColor: 'rgb(var(--brew-border-subtle))',
            background: 'var(--brew-card-inset)',
          }}
        >
          <p className="text-muted text-sm mb-4">
            Configure bottling or kegging for this recipe.
          </p>
          <button onClick={handleInit} className="brew-btn-primary">
            Set Up Packaging
          </button>
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────

  const hasBottle = pkg.methods.includes('bottle');
  const hasKeg = pkg.methods.includes('keg');

  return (
    <div className="brew-section brew-animate-in brew-stagger-8" data-accent="packaging">
      <div className="flex items-center justify-between mb-4">
        <h2 className="brew-section-title">Packaging</h2>
        <button
          onClick={() => updateRecipe({ packaging: undefined })}
          className="brew-btn-ghost text-xs px-3 py-1"
        >
          Clear
        </button>
      </div>

      {/* Method toggle */}
      <div className="flex gap-2 mb-5">
        {(['bottle', 'keg'] as PackagingMethod[]).map((m) => (
          <button
            key={m}
            onClick={() => toggleMethod(m)}
            className={
              pkg.methods.includes(m)
                ? 'brew-chip-active text-sm font-semibold px-4 py-2'
                : 'brew-chip text-sm px-4 py-2'
            }
          >
            {m === 'bottle' ? 'Bottling' : 'Kegging'}
          </button>
        ))}
      </div>

      {/* CO₂ target — hero row */}
      <div className="equip-hero-grid mb-2">
        <PackagingDatum
          id="pkg-co2-target"
          label="Target CO₂"
          unit="vol"
          value={pkg.targetCo2Volumes}
          onChange={(v) => update({ targetCo2Volumes: v })}
          step="0.1"
        />
        <PackagingReadout
          label="Residual CO₂"
          value={residual.toFixed(2)}
          unit="vol"
          sub="from fermentation"
        />
        <PackagingReadout
          label="CO₂ Needed"
          value={Math.max(0, pkg.targetCo2Volumes - residual).toFixed(2)}
          unit="vol"
        />
      </div>
      {styleSuggestion && currentRecipe.style && (
        <p className="text-[11px] text-muted mb-5">
          <span className="brew-chip text-[10px] px-2 py-0.5">
            {currentRecipe.style}: {styleSuggestion.min}–{styleSuggestion.max} vol
          </span>
        </p>
      )}

      {/* ── Bottling ─────────────────────────────────────────────────────── */}
      {hasBottle && (
        <div className="equip-group">
          <span className="equip-group-label">Bottling</span>

          {/* Sugar type + conditioning */}
          <div className="equip-detail-grid">
            <PackagingSelect
              id="pkg-sugar-type"
              label="Priming Sugar"
              value={pkg.primingSugarType ?? 'corn-sugar'}
              options={SUGAR_OPTIONS}
              onChange={(v) => update({ primingSugarType: v as PrimingSugarType })}
            />
            <PackagingDatum
              id="pkg-cond-temp"
              label="Conditioning"
              unit="°C"
              value={pkg.conditioningTempC ?? 20}
              onChange={(v) => update({ conditioningTempC: v })}
              step="1"
            />
          </div>

          {/* Bottle entries */}
          <div className="mt-3 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Bottles</span>
              {bottles.length < BOTTLE_OPTIONS.length && (
                <button
                  onClick={handleAddBottle}
                  className="brew-btn-ghost text-xs px-2 py-0.5"
                >
                  + Add Size
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(bottles.length, 3)}, 1fr)`, gap: '6px' }}>
              {bottles.map((entry, i) => {
                const rowVolumeL = (entry.count * calc.bottleSizeML(entry.size)) / 1000;
                const sugarEa = totalBottles > 0 ? primingSugarG / totalBottles : 0;

                return (
                  <BottleDatumEditable
                    key={i}
                    entry={entry}
                    index={i}
                    volumeL={rowVolumeL}
                    sugarPerBottle={sugarEa}
                    onChangeSize={(size) => handleBottleSizeChange(i, size)}
                    onChangeCount={(count) => handleBottleCountChange(i, count)}
                    onRemove={() => handleRemoveBottle(i)}
                  />
                );
              })}
            </div>
            {/* Remainder display */}
            {(() => {
              const remainderML = Math.round(batchML - totalBottleVolumeL * 1000);
              const isOver = remainderML < 0;
              return (
                <p className={`text-[10px] mt-2 text-center ${isOver ? 'text-[var(--brew-danger)]' : 'text-muted'}`}>
                  <strong className="tabular-nums">{totalBottles}</strong> bottles · <strong className="tabular-nums">{totalBottleVolumeL.toFixed(1)}L</strong> of {currentRecipe.batchVolumeL}L
                  {remainderML > 0 && (
                    <span className="opacity-70"> · {(remainderML / 1000).toFixed(1)}L remaining</span>
                  )}
                  {isOver && (
                    <span> · {(Math.abs(remainderML) / 1000).toFixed(1)}L over batch</span>
                  )}
                </p>
              );
            })()}
          </div>

          {/* Readouts */}
          <div className="equip-detail-grid mt-2">
            <PackagingReadout
              label="Priming Sugar"
              value={`${Math.round(primingSugarG)}`}
              unit="g"
              sub={`${calc.gramsToOz(primingSugarG).toFixed(1)} oz`}
            />
            <PackagingReadout
              label="Dissolve In"
              value={`${totalBottles * 10}`}
              unit="ml"
              sub={`${totalBottles} × 10ml boiled water`}
            />
            <PackagingReadout
              label="Conditioning"
              value={`~${conditioningDays}`}
              unit="days"
              sub={`at ${pkg.conditioningTempC ?? 20}°C`}
            />
            <PackagingReadout
              label="Sugar / Bottle"
              value={totalBottles > 0 ? (primingSugarG / totalBottles).toFixed(1) : '–'}
              unit="g"
              sub="if dosing individually"
            />
          </div>
        </div>
      )}

      {/* ── Kegging ──────────────────────────────────────────────────────── */}
      {hasKeg && (
        <div className="equip-group">
          <span className="equip-group-label">Kegging</span>

          {/* Inputs */}
          <div className="equip-detail-grid">
            <PackagingDatum
              id="pkg-serving-temp"
              label="Serving Temp"
              unit="°C"
              value={pkg.servingTempC ?? 4}
              onChange={(v) => update({ servingTempC: v })}
              step="0.5"
            />
            <div className="equip-datum is-small">
              <span className="equip-datum-label">Method</span>
              <div className="equip-datum-value" style={{ justifyContent: 'center' }}>
                <div className="flex gap-1.5">
                  {(
                    [
                      { value: 'set-and-forget', label: 'Set & Forget' },
                      { value: 'burst', label: 'Burst' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.value}
                      onClick={() => update({ carbonationMethod: m.value })}
                      className={
                        (pkg.carbonationMethod ?? 'set-and-forget') === m.value
                          ? 'brew-chip-active text-[10px] font-semibold px-2 py-1'
                          : 'brew-chip text-[10px] px-2 py-1'
                      }
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Readouts */}
          <div className="equip-detail-grid mt-2">
            <PackagingReadout
              label="Serving PSI"
              value={forcedPsi.toFixed(1)}
              unit="PSI"
              sub={`at ${pkg.servingTempC ?? 4}°C`}
            />
            {(pkg.carbonationMethod ?? 'set-and-forget') === 'set-and-forget' ? (
              <PackagingReadout
                label="Set & Forget"
                value={forcedPsi.toFixed(1)}
                unit="PSI"
                sub="5–7 days to fully carb"
              />
            ) : (
              <>
                <PackagingReadout
                  label="Burst Phase"
                  value={`${burstSchedule.burstPsi}`}
                  unit="PSI"
                  sub={`for ${burstSchedule.burstDurationHours}h`}
                />
                <PackagingReadout
                  label="Then Reduce"
                  value={burstSchedule.finalPsi.toFixed(1)}
                  unit="PSI"
                  sub="serving pressure"
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mt-4">
        <label htmlFor="pkg-notes" className="block text-xs text-muted mb-1">Packaging Notes</label>
        <textarea
          id="pkg-notes"
          className="w-full rounded-md border border-[rgb(var(--border))] bg-[var(--surface)] text-[var(--fg-strong)] text-sm p-2 focus-glow outline-none resize-none"
          rows={2}
          placeholder="e.g., bottle conditioning in closet, gelatin fining before kegging..."
          value={pkg.notes ?? ''}
          onChange={(e) => update({ notes: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
