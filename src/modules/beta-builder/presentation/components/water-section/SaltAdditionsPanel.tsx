/**
 * Salt Additions Panel Component
 *
 * Input controls for adjusting total salt additions.
 * Uses machined datum readouts (same as Equipment section)
 * with stepper buttons and mash/sparge split display.
 */

import type { SaltAdditions } from "../../../domain/services/WaterChemistryService";
import { SALT_SHORT_LABELS } from "./constants";
import { useHoldToRepeat } from "../../../../../hooks/useHoldToRepeat";
import AnimatedNumberInput from "../../../../../components/AnimatedNumberInput";

type Props = {
  /** Current total salt additions */
  saltAdditions: Partial<SaltAdditions>;
  /** Salt amounts for mash water (auto-calculated) */
  mashSalts: Partial<SaltAdditions>;
  /** Salt amounts for sparge water (auto-calculated) */
  spargeSalts: Partial<SaltAdditions>;
  /** Callback when a salt amount changes */
  onSaltChange: (saltKey: keyof SaltAdditions, value: number) => void;
  /** Callback to auto-calculate salt additions (premium feature) */
  onAutoCalculate?: () => void;
  /** Whether the user has access to auto-calculate */
  canAutoCalc?: boolean;
  /** Whether baking soda is included in auto-calculate */
  includeBakingSoda?: boolean;
  /** Callback when baking soda toggle changes */
  onToggleBakingSoda?: (include: boolean) => void;
};

function SaltRow({
  saltKey,
  totalAmount,
  mashAmount,
  spargeAmount,
  onNudge,
  onDirectChange,
}: {
  saltKey: keyof SaltAdditions;
  totalAmount: number;
  mashAmount: number;
  spargeAmount: number;
  onNudge: (dir: 1 | -1) => void;
  onDirectChange: (value: number) => void;
}) {
  const holdDown = useHoldToRepeat(() => onNudge(-1));
  const holdUp = useHoldToRepeat(() => onNudge(1));

  return (
    <div className="equip-datum">
      <label htmlFor={`salt-${saltKey}`} className="equip-datum-label">
        {SALT_SHORT_LABELS[saltKey]}
      </label>
      <div className="equip-datum-value">
        <div className="starter-stepper">
          <button
            type="button"
            className="starter-stepper-btn"
            {...holdDown}
            aria-label={`Decrease ${SALT_SHORT_LABELS[saltKey]}`}
          >
            −
          </button>
          <div className="starter-stepper-center">
            <AnimatedNumberInput
              id={`salt-${saltKey}`}
              value={totalAmount || ""}
              onChange={(e) =>
                onDirectChange(parseFloat(e.target.value) || 0)
              }
              placeholder="0"
              step="0.1"
              min="0"
              className="equip-datum-input starter-stepper-input"
            />
            <span className="equip-datum-unit starter-stepper-unit">g</span>
          </div>
          <button
            type="button"
            className="starter-stepper-btn"
            {...holdUp}
            aria-label={`Increase ${SALT_SHORT_LABELS[saltKey]}`}
          >
            +
          </button>
        </div>
      </div>
      {totalAmount > 0 && (
        <p className="text-[10px] text-muted mt-1 text-center">
          {mashAmount.toFixed(1)}g mash · {spargeAmount.toFixed(1)}g sparge
        </p>
      )}
    </div>
  );
}

export default function SaltAdditionsPanel({
  saltAdditions,
  mashSalts,
  spargeSalts,
  onSaltChange,
  onAutoCalculate,
  canAutoCalc,
  includeBakingSoda,
  onToggleBakingSoda,
}: Props) {
  const nudge = (saltKey: keyof SaltAdditions, dir: 1 | -1) => {
    const current = saltAdditions[saltKey] || 0;
    const next = parseFloat((current + dir * 0.1).toFixed(1));
    onSaltChange(saltKey, Math.max(0, next));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Salt Additions</h4>
        {onAutoCalculate && (
          <div className="flex items-center gap-3">
            {onToggleBakingSoda && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!includeBakingSoda}
                  onChange={(e) => onToggleBakingSoda(e.target.checked)}
                  className="brew-checkbox"
                />
                NaHCO₃
              </label>
            )}
            <button
              type="button"
              onClick={onAutoCalculate}
              className={`brew-btn-ghost text-xs ${!canAutoCalc ? 'opacity-50' : ''}`}
            >
              {!canAutoCalc && (
                <svg className="inline-block w-3 h-3 mr-1 -mt-0.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 7H6V5a2 2 0 1 1 4 0v3z"/>
                </svg>
              )}
              Auto-Calculate
            </button>
          </div>
        )}
      </div>
      <div className="salt-additions-grid">
        {(Object.keys(SALT_SHORT_LABELS) as Array<keyof SaltAdditions>).map((saltKey) => {
          const totalAmount = saltAdditions[saltKey] || 0;
          const mashAmount = mashSalts[saltKey] || 0;
          const spargeAmount = spargeSalts[saltKey] || 0;

          return (
            <SaltRow
              key={saltKey}
              saltKey={saltKey}
              totalAmount={totalAmount}
              mashAmount={mashAmount}
              spargeAmount={spargeAmount}
              onNudge={(dir) => nudge(saltKey, dir)}
              onDirectChange={(v) => onSaltChange(saltKey, v)}
            />
          );
        })}
      </div>
    </div>
  );
}
