import type { Hop } from "../../domain/models/Recipe";
import { useHoldToRepeat } from "../../../../hooks/useHoldToRepeat";
import AnimatedNumberInput from "../../../../components/AnimatedNumberInput";

type OLD_HopAdditionRowProps = {
  hop: Hop;
  onUpdate: (id: string, updates: Partial<Hop>) => void;
  onRemove: (id: string) => void;
};

/**
 * Datum readout for hop addition values — handwritten font, label above,
 * with vertically-stacked chevron stepper buttons beside the value.
 */
function HopDatum({
  label,
  value,
  unit,
  onChange,
  step,
  min,
  max,
  narrow,
  ariaLabel,
}: {
  label: string;
  value: number;
  unit: string;
  onChange: (v: number) => void;
  step: string;
  min: string;
  max?: string;
  narrow?: boolean;
  ariaLabel: string;
}) {
  const stepNum = parseFloat(step);
  const minNum = parseFloat(min);
  const maxNum = max !== undefined ? parseFloat(max) : Infinity;
  const decimals = step.split(".")[1]?.length ?? 0;

  const nudge = (dir: 1 | -1) => {
    const next = value + dir * stepNum;
    const rounded = parseFloat(next.toFixed(decimals));
    if (rounded >= minNum && rounded <= maxNum) onChange(rounded);
  };

  const holdUp = useHoldToRepeat(() => nudge(1));
  const holdDown = useHoldToRepeat(() => nudge(-1));

  return (
    <div className="hop-addition-datum">
      <span className="hop-addition-datum-label">{label}</span>
      <div className="hop-addition-datum-value">
        <AnimatedNumberInput
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={"hop-addition-datum-input" + (narrow ? " is-narrow" : "")}
          step={step}
          min={min}
          max={max}
          aria-label={ariaLabel}
        />
        <span className="hop-addition-datum-unit">{unit}</span>
        <div className="hop-stepper">
          <button
            type="button"
            className="hop-stepper-btn"
            {...holdUp}
            aria-label={`Increase ${label}`}
            tabIndex={-1}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 5 5 1 9 5"/></svg>
          </button>
          <button
            type="button"
            className="hop-stepper-btn"
            {...holdDown}
            aria-label={`Decrease ${label}`}
            tabIndex={-1}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1 5 5 9 1"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OLD_HopAdditionRow({ hop, onUpdate, onRemove }: OLD_HopAdditionRowProps) {
  return (
    <div className="hop-addition-row">
      {/* Type selector badge */}
      <select
        value={hop.type}
        onChange={(e) =>
          onUpdate(hop.id, { type: e.target.value as Hop["type"] })
        }
        className="hop-addition-type"
        aria-label="Hop addition type"
      >
        <option value="boil">Boil</option>
        <option value="whirlpool">Whirlpool</option>
        <option value="dry hop">Dry Hop</option>
        <option value="first wort">First Wort</option>
        <option value="mash">Mash Hop</option>
      </select>

      {/* Timing datums — vary by type */}
      {hop.type === "boil" && (
        <HopDatum
          label="Time"
          value={hop.timeMinutes || 0}
          unit="min"
          onChange={(v) => onUpdate(hop.id, { timeMinutes: v })}
          step="5"
          min="0"
          ariaLabel="Boil time minutes"
        />
      )}

      {hop.type === "whirlpool" && (
        <>
          <HopDatum
            label="Temp"
            value={hop.temperatureC || 80}
            unit="°C"
            onChange={(v) => onUpdate(hop.id, { temperatureC: v })}
            step="5"
            min="40"
            max="100"
            ariaLabel="Whirlpool temperature"
          />
          <HopDatum
            label="Time"
            value={hop.whirlpoolTimeMinutes || 15}
            unit="min"
            onChange={(v) => onUpdate(hop.id, { whirlpoolTimeMinutes: v })}
            step="5"
            min="0"
            ariaLabel="Whirlpool time minutes"
          />
        </>
      )}

      {hop.type === "dry hop" && (
        <>
          <HopDatum
            label="Start"
            value={hop.dryHopStartDay ?? 0}
            unit="day"
            onChange={(v) => onUpdate(hop.id, { dryHopStartDay: v })}
            step="1"
            min="0"
            narrow
            ariaLabel="Dry hop start day"
          />
          <HopDatum
            label="Duration"
            value={hop.dryHopDays ?? 3}
            unit="days"
            onChange={(v) => onUpdate(hop.id, { dryHopDays: v })}
            step="1"
            min="0"
            narrow
            ariaLabel="Dry hop duration days"
          />
        </>
      )}

      {/* Spacer — pushes weight to the right */}
      <div className="hop-addition-spacer" />

      {/* Weight datum — always present */}
      <HopDatum
        label="Weight"
        value={hop.grams}
        unit="g"
        onChange={(v) => onUpdate(hop.id, { grams: v })}
        step="1"
        min="0"
        ariaLabel="Weight in grams"
      />

      {/* Hover-reveal delete */}
      <div className="brew-row-actions">
        <button
          onClick={() => onRemove(hop.id)}
          className="brew-row-action-btn brew-danger-text"
          aria-label={`Remove ${hop.name} ${hop.type} addition`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
    </div>
  );
}
