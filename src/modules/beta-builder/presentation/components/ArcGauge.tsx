/**
 * ArcGauge → Horizontal range strip.
 *
 * Braun/TE-inspired "tuning scale" indicator: a recessed pill track with
 * a solid range block, a hand-drawn needle tick with a handwritten value
 * floating above it, and tick labels at the range edges.
 * Pure render — no hooks, no SVG.
 */

import { srmToRgb } from "../../utils/srmColorUtils";

interface ArcGaugeProps {
  label: string;
  value: number;
  range?: [number, number];
  format?: (n: number) => string;
  maxFallback?: number;
  isSrm?: boolean;
}

/**
 * Simple seeded pseudo-random for deterministic "hand-drawn" jitter.
 * Takes a numeric seed, returns a value in [-1, 1].
 */
function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

export default function ArcGauge({
  label,
  value,
  range,
  format = (n) => n.toString(),
  maxFallback,
  isSrm = false,
}: ArcGaugeProps) {
  // --- Domain ---
  const lo = range?.[0] ?? 0;
  const hi = range?.[1] ?? maxFallback ?? Math.max(lo + 1, value * 1.5);
  const span = Math.max(0.0001, hi - lo);
  const pad = span * 0.35;

  const domMin = Math.min(lo - pad, value - span * 0.1);
  const domMax = Math.max(hi + pad, value + span * 0.1);
  const domSpan = Math.max(0.0001, domMax - domMin);

  const pct = (v: number) => ((v - domMin) / domSpan) * 100;

  // Compare at display precision so "1.014" is never flagged out of a
  // range that also displays as "1.014" (avoids floating-point edge cases).
  const fmtNum = (n: number) => parseFloat(format(n).replace(/[^0-9.-]/g, ""));
  const inRange = range
    ? fmtNum(value) >= fmtNum(lo) && fmtNum(value) <= fmtNum(hi)
    : true;

  // Stretch the range block to cover in-range values that slightly
  // overshoot the raw boundary (e.g. 1.0145 displays as "1.014").
  // This avoids a needle jump and keeps the bar visually consistent.
  const vizLo = inRange && range ? Math.min(lo, value) : lo;
  const vizHi = inRange && range ? Math.max(hi, value) : hi;
  const rangeLeft = pct(vizLo);
  const rangeRight = pct(vizHi);
  const rangeWidth = rangeRight - rangeLeft;
  const needlePos = Math.max(0, Math.min(100, pct(value)));

  // --- SRM gradient (5 stops across the range block) ---
  let srmGradient: string | undefined;
  if (isSrm && range) {
    const stops = 5;
    const parts: string[] = [];
    for (let i = 0; i <= stops; i++) {
      const srmVal = lo + (hi - lo) * (i / stops);
      parts.push(srmToRgb(Math.max(1, srmVal)));
    }
    srmGradient = `linear-gradient(to right, ${parts.join(", ")})`;
  }

  // --- SRM needle color (actual beer color) ---
  const srmNeedleColor = isSrm ? srmToRgb(Math.max(1, value)) : undefined;

  // --- Hand-drawn jitter (seeded for determinism, wilder ranges) ---
  const seed = value * 1000 + lo * 100 + hi;
  const jitterRotate = seededRand(seed) * 10; // -10 to +10 degrees
  const jitterX = seededRand(seed + 1) * 8 + 4; // -4 to +12 px horizontal
  const jitterY = seededRand(seed + 2) * 5; // -5 to +5 px vertical

  // --- Needle jitter (wider rotation spread) ---
  const needleRotate = seededRand(seed + 3) * 8; // -8 to +8 degrees

  // --- Accessibility ---
  const ariaLabel = range
    ? `${label}: ${format(value)}, style range ${format(lo)} to ${format(hi)}, ${inRange ? "in range" : "out of range"}`
    : `${label}: ${format(value)}`;

  return (
    <div className="style-strip" role="img" aria-label={ariaLabel}>
      <div className="style-strip-header">
        <span className="style-strip-label">{label}</span>
      </div>

      <div className="style-strip-track-wrap">
        {/* Handwritten value floating above the needle */}
        <span
          className={"style-strip-value" + (!isSrm && !inRange ? " is-out" : "")}
          style={{
            left: `${needlePos}%`,
            transform: `rotate(${jitterRotate}deg) translate(${jitterX}px, ${jitterY}px)`,
            ...(srmNeedleColor ? { color: srmNeedleColor } : {}),
          }}
        >
          {format(value)}
        </span>

        <div className="style-strip-track">
          {/* Range block */}
          {range && (
            <div
              className={"style-strip-range" + (isSrm ? " is-srm" : "")}
              style={{
                left: `${rangeLeft}%`,
                width: `${rangeWidth}%`,
                ...(srmGradient ? { background: srmGradient } : {}),
              }}
            />
          )}

          {/* Needle */}
          <div
            className={
              "style-strip-needle" +
              (isSrm ? " is-srm" : "") +
              (!inRange && !isSrm ? " is-out" : "")
            }
            style={{
              left: `${needlePos}%`,
              transform: `translateY(-50%) rotate(${needleRotate}deg)`,
              ...(srmNeedleColor
                ? { background: srmNeedleColor, opacity: 0.85, width: "3.5px" }
                : {}),
            }}
          />
        </div>

        {/* Range tick labels — positioned at the range edges below the track */}
        {range && (
          <>
            <span
              className="style-strip-tick"
              style={{ left: `${rangeLeft}%` }}
            >
              {format(lo)}
            </span>
            <span
              className="style-strip-tick"
              style={{ left: `${rangeRight}%` }}
            >
              {format(hi)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
