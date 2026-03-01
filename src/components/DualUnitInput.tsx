// DualUnitInput component with direct unit operation
import { useEffect, useState } from "react";

// Unit conversion utilities
const UNIT_CONVERSIONS = {
  // Weight conversions
  kg_lb: (kg: number) => kg * 2.2046226218,
  lb_kg: (lb: number) => lb / 2.2046226218,
  g_oz: (g: number) => g * 0.03527396195,
  oz_g: (oz: number) => oz / 0.03527396195,

  // Volume conversions
  L_gal: (L: number) => L * 0.2641720524,
  gal_L: (gal: number) => gal / 0.2641720524,
  ml_floz: (ml: number) => ml * 0.0338140227,
  floz_ml: (floz: number) => floz / 0.0338140227,

  // Temperature conversions
  C_F: (c: number) => (c * 9) / 5 + 32,
  F_C: (f: number) => ((f - 32) * 5) / 9,

  // Pressure conversions
  psi_bar: (psi: number) => psi * 0.0689475729,
  bar_psi: (bar: number) => bar / 0.0689475729,

  // Time conversions (same units, no conversion needed)
  min_min: (min: number) => min,
  hour_hour: (hour: number) => hour,
  day_day: (day: number) => day,

  // Percentage (same units)
  percent_percent: (p: number) => p,

  // Gravity points (same units)
  sg_sg: (sg: number) => sg,
  plato_plato: (p: number) => p,
  brix_brix: (b: number) => b,
} as const;

type UnitPair = {
  primary: string;
  secondary: string;
  primaryLabel: string;
  secondaryLabel: string;
  step: number;
  precision: number; // decimal places for rounding
};

const UNIT_PAIRS: Record<string, UnitPair> = {
  weight: {
    primary: "kg",
    secondary: "lb",
    primaryLabel: "kg",
    secondaryLabel: "lb",
    step: 0.1,
    precision: 2,
  },
  weightSmall: {
    primary: "g",
    secondary: "oz",
    primaryLabel: "g",
    secondaryLabel: "oz",
    step: 0.1,
    precision: 2,
  },
  volume: {
    primary: "L",
    secondary: "gal",
    primaryLabel: "L",
    secondaryLabel: "gal",
    step: 0.1,
    precision: 2,
  },
  volumeSmall: {
    primary: "ml",
    secondary: "floz",
    primaryLabel: "ml",
    secondaryLabel: "floz",
    step: 1,
    precision: 0,
  },
  temperature: {
    primary: "C",
    secondary: "F",
    primaryLabel: "°C",
    secondaryLabel: "°F",
    step: 0.5,
    precision: 1,
  },
  pressure: {
    primary: "psi",
    secondary: "bar",
    primaryLabel: "psi",
    secondaryLabel: "bar",
    step: 0.1,
    precision: 2,
  },
  time: {
    primary: "min",
    secondary: "min",
    primaryLabel: "min",
    secondaryLabel: "min",
    step: 1,
    precision: 0,
  },
  percentage: {
    primary: "percent",
    secondary: "percent",
    primaryLabel: "%",
    secondaryLabel: "%",
    step: 1,
    precision: 0,
  },
  gravity: {
    primary: "sg",
    secondary: "sg",
    primaryLabel: "",
    secondaryLabel: "",
    step: 0.001,
    precision: 3,
  },
};

type Props = {
  value: number | undefined | null;
  onChange: (next: number) => void;
  unitType: keyof typeof UNIT_PAIRS;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  readOnly?: boolean;
  step?: number;
};

export default function DualUnitInput({
  value,
  onChange,
  unitType,
  className,
  placeholder,
  min,
  max,
  readOnly,
  step,
}: Props) {
  const unitPair = UNIT_PAIRS[unitType];
  const [activeUnit, setActiveUnit] = useState<"primary" | "secondary">(
    "primary"
  );
  // Stores the value currently displayed in the input field, in its active unit
  const [displayedValue, setDisplayedValue] = useState<number | null>(null);
  const [displayText, setDisplayText] = useState<string>("");

  // Effect to initialize displayedValue and displayText when the canonical 'value' prop changes
  useEffect(() => {
    if (value == null || !Number.isFinite(value)) {
      setDisplayedValue(null);
      setDisplayText("");
      return;
    }

    let valToDisplay: number;
    if (activeUnit === "primary") {
      valToDisplay = value;
    } else {
      // Convert primary 'value' to secondary unit for display
      const conversionKey =
        `${unitPair.primary}_${unitPair.secondary}` as keyof typeof UNIT_CONVERSIONS;
      valToDisplay = UNIT_CONVERSIONS[conversionKey]?.(value) ?? value;
    }
    const rounded = Number(valToDisplay.toFixed(unitPair.precision));
    setDisplayedValue(rounded);
    setDisplayText(String(rounded));
  }, [value, unitPair, activeUnit]); // Re-run if canonical value, unit type, or active unit changes

  const handleValueChange = (newDisplayedValue: number) => {
    if (!Number.isFinite(newDisplayedValue)) return;

    setDisplayedValue(newDisplayedValue);
    setDisplayText(String(newDisplayedValue));

    // Convert the new displayed value back to the primary unit for the parent
    let newPrimaryValue: number;
    if (activeUnit === "primary") {
      newPrimaryValue = newDisplayedValue;
    } else {
      const conversionKey =
        `${unitPair.secondary}_${unitPair.primary}` as keyof typeof UNIT_CONVERSIONS;
      newPrimaryValue =
        UNIT_CONVERSIONS[conversionKey]?.(newDisplayedValue) ??
        newDisplayedValue;
    }
    onChange(newPrimaryValue);
  };

  const handleUnitToggle = () => {
    const newActiveUnit = activeUnit === "primary" ? "secondary" : "primary";
    setActiveUnit(newActiveUnit);

    if (displayedValue == null || !Number.isFinite(displayedValue)) {
      return;
    }

    let convertedAndRounded: number;
    if (newActiveUnit === "primary") {
      // Convert from current secondary (displayedValue) to primary
      const conversionKey =
        `${unitPair.secondary}_${unitPair.primary}` as keyof typeof UNIT_CONVERSIONS;
      const converted =
        UNIT_CONVERSIONS[conversionKey]?.(displayedValue) ?? displayedValue;
      convertedAndRounded = Number(converted.toFixed(unitPair.precision));
    } else {
      // Convert from current primary (displayedValue) to secondary
      const conversionKey =
        `${unitPair.primary}_${unitPair.secondary}` as keyof typeof UNIT_CONVERSIONS;
      const converted =
        UNIT_CONVERSIONS[conversionKey]?.(displayedValue) ?? displayedValue;
      convertedAndRounded = Number(converted.toFixed(unitPair.precision));
    }

    setDisplayedValue(convertedAndRounded);
    setDisplayText(String(convertedAndRounded));

    // If we toggled to primary, the onChange should already have the correct primary value.
    // If we toggled to secondary, we need to ensure the parent's primary value is updated
    // based on the newly converted and rounded secondary value.
    if (newActiveUnit === "primary") {
      onChange(convertedAndRounded);
    } else {
      // When switching to secondary, the displayedValue is now in secondary units.
      // We need to convert this back to primary to inform the parent.
      const conversionKey =
        `${unitPair.secondary}_${unitPair.primary}` as keyof typeof UNIT_CONVERSIONS;
      const primaryEquivalent =
        UNIT_CONVERSIONS[conversionKey]?.(convertedAndRounded) ??
        convertedAndRounded;
      onChange(primaryEquivalent);
    }
  };

  const currentLabel =
    activeUnit === "primary" ? unitPair.primaryLabel : unitPair.secondaryLabel;

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        className="rounded-md border px-3 py-2 pr-16 w-full sm:text-right text-left"
        type="number"
        step={step ?? unitPair.step}
        min={min}
        max={max}
        placeholder={placeholder}
        value={displayText}
        readOnly={readOnly}
        onChange={(e) => {
          const v = e.currentTarget.value;
          setDisplayText(v);
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) {
            // Round to appropriate precision for the current unit before handling change
            const rounded = Number(n.toFixed(unitPair.precision));
            handleValueChange(rounded);
          }
        }}
        onInput={(e) => {
          // Handle native increment/decrement buttons
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) {
            const rounded = Number(n.toFixed(unitPair.precision));
            handleValueChange(rounded);
          }
        }}
        onBlur={(e) => {
          const v = e.currentTarget.value;
          if (v === "") {
            return;
          }
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) {
            const rounded = Number(n.toFixed(unitPair.precision));
            setDisplayText(String(rounded));
          }
        }}
      />
      <button
        type="button"
        className={`absolute inset-y-0 right-0 px-2 flex items-center text-xs font-medium transition-colors ${
          readOnly
            ? "text-neutral-500 hover:text-[var(--coral-300)]/80 cursor-pointer"
            : "text-neutral-500 hover:text-[var(--coral-300)]/80 cursor-pointer"
        }`}
        onClick={handleUnitToggle}
        disabled={false}
        title={`Switch to ${
          activeUnit === "primary"
            ? unitPair.secondaryLabel
            : unitPair.primaryLabel
        }`}
      >
        {currentLabel}
      </button>
    </div>
  );
}
