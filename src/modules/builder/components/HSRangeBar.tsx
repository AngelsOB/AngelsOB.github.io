import { hsTokens } from "../tokens";

interface Props {
  value: number;
  lo: number;
  hi: number;
  /** Optional outer min/max for the track (defaults to lo - span, hi + span). */
  trackMin?: number;
  trackMax?: number;
  suffix?: string;
  fill?: string;
  label?: string;
  className?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function HSRangeBar({
  value,
  lo,
  hi,
  trackMin,
  trackMax,
  suffix = "",
  fill = hsTokens.hops,
  label,
  className,
}: Props) {
  const span = hi - lo || 1;
  const tMin = trackMin ?? lo - span * 0.5;
  const tMax = trackMax ?? hi + span * 0.5;
  const range = tMax - tMin || 1;

  const fillLeft = ((lo - tMin) / range) * 100;
  const fillRight = 100 - ((hi - tMin) / range) * 100;
  const needleLeft = (clamp(value, tMin, tMax) - tMin) / range;
  const inRange = value >= lo && value <= hi;

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: hsTokens.mono,
            fontSize: 10,
            color: hsTokens.muted,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          <span>{label}</span>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              color: inRange ? hsTokens.ink : hsTokens.roast,
            }}
          >
            {value.toFixed(value < 10 ? 2 : 1)}
            {suffix}
          </span>
        </div>
      ) : null}
      <div
        style={{
          position: "relative",
          height: 10,
          background: hsTokens.cream,
          border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 20%, transparent)`,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${clamp(fillLeft, 0, 100)}%`,
            right: `${clamp(fillRight, 0, 100)}%`,
            background: fill,
            opacity: 0.4,
            borderRadius: 999,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -3,
            bottom: -3,
            left: `calc(${clamp(needleLeft * 100, 0, 100)}% - 1.5px)`,
            width: 3,
            background: inRange ? hsTokens.ink : hsTokens.roast,
            borderRadius: 1,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: hsTokens.mono,
          fontSize: 9,
          color: hsTokens.muted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>
          {lo}
          {suffix}
        </span>
        <span>
          {hi}
          {suffix}
        </span>
      </div>
    </div>
  );
}
