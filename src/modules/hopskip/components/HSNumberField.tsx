import { useId } from "react";

import { hsTokens } from "../tokens";
import HSEyebrow from "./HSEyebrow";

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  accent?: string;
  precision?: number;
  hint?: string;
}

export default function HSNumberField({
  label,
  value,
  onChange,
  unit,
  step = 1,
  min,
  max,
  accent = hsTokens.malt,
  precision,
  hint,
}: Props) {
  const id = useId();
  const display =
    precision !== undefined && !Number.isNaN(value) ? value.toFixed(precision) : value;
  return (
    <label
      htmlFor={id}
      style={{
        display: "block",
        position: "relative",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 10,
        padding: "10px 14px 12px",
        boxShadow: hsTokens.sh1,
        cursor: "text",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 6,
          background: accent,
          borderTopLeftRadius: 8,
          borderBottomLeftRadius: 8,
        }}
      />
      <div style={{ marginLeft: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <HSEyebrow>{label}</HSEyebrow>
        {hint ? (
          <span
            style={{
              fontFamily: hsTokens.script,
              color: hsTokens.muted,
              fontSize: 14,
              transform: "rotate(-3deg)",
              display: "inline-block",
            }}
          >
            {hint}
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginLeft: 4, marginTop: 4 }}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={display}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(Number.isNaN(v) ? 0 : v);
          }}
          style={{
            fontFamily: hsTokens.display,
            fontSize: 28,
            letterSpacing: "-0.03em",
            background: "transparent",
            border: "none",
            outline: "none",
            color: hsTokens.ink,
            padding: 0,
            width: "100%",
            fontVariantNumeric: "tabular-nums",
            appearance: "textfield",
          }}
        />
        {unit ? (
          <span style={{ fontFamily: hsTokens.mono, fontSize: 13, color: hsTokens.muted }}>
            {unit}
          </span>
        ) : null}
      </div>
    </label>
  );
}
