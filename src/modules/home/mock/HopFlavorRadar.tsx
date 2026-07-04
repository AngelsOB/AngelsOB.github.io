"use client";

import { hsTokens } from "@/modules/builder/tokens";

// Mini and full hop flavor radar SVG — pure SVG, no animation; GSAP moves its
// container. Axes mirror the real builder's radar (HOP_FLAVOR_KEYS order in
// models/Presets.ts) so a mock polygon and the real one tell the same story.

const AXES = [
  "Citrus",
  "Tropical",
  "Stone fruit",
  "Berry",
  "Floral",
  "Spice",
  "Herbal",
  "Grassy",
  "Pine",
];

// Variety profiles for the tour's sample bill — the real preset dataset's
// values (0-5 scale, normalized /5). Index aligns with AXES.
const PROFILES: Record<string, number[]> = {
  Citra: [1, 0.8, 0.4, 0.2, 0.2, 0, 0, 0, 0.4],
  Mosaic: [0.6, 0.8, 0.6, 0.6, 0.2, 0, 0.2, 0.2, 0.4],
};
// The sample bill's combined estimate — the same dose/timing-weighted math the
// real builder's radar runs (HopFlavorCalculationService), computed offline
// for the tour's 0.5oz Citra 60 / 1.5oz Mosaic 60 / 1oz Citra whirlpool @ 5 gal.
const BLEND = [0.58, 0.48, 0.25, 0.14, 0.12, 0, 0.01, 0.01, 0.24];

interface Props {
  size: number;
  variant: "mini" | "full";
  hopName?: string;
  /** Recipe mode: 0..1 per axis in AXES order. Overrides the hardcoded
   *  sample profiles; all-zero renders rings only (a clean "no data" state). */
  values?: number[];
}

export function HopFlavorRadar({ size, variant, hopName, values: valuesProp }: Props) {
  const values = valuesProp ?? (hopName ? PROFILES[hopName] ?? BLEND : BLEND);
  const hasFlavor = values.some((v) => v > 0.005);
  // Full variant reserves side gutters so the start/end-anchored axis labels
  // ("Tropical", "Stone fruit") fit inside the SVG instead of clipping at its
  // edges when the radar is grown on the hops beat.
  const gutterX = variant === "full" ? 20 : 0;
  const width = size + gutterX * 2;
  const cx = width / 2;
  const cy = size / 2;
  const innerR = size / 2 - (variant === "full" ? 14 : 6);
  const n = AXES.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => {
    const r = innerR * v;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };

  const polygon = values
    .map((v, i) => point(i, v).map((m) => m.toFixed(2)).join(","))
    .join(" ");

  const gridRings = [0.33, 0.66, 1];

  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${width} ${size}`}
      aria-hidden
      style={{ flexShrink: 0, display: "block" }}
    >
      {/* Background rings */}
      {gridRings.map((s, i) => {
        const poly = Array.from({ length: n }, (_, ai) =>
          point(ai, s).map((m) => m.toFixed(2)).join(","),
        ).join(" ");
        return (
          <polygon
            key={`ring-${i}`}
            points={poly}
            fill={i === 2 ? hsTokens.paper : "transparent"}
            stroke={`color-mix(in oklch, ${hsTokens.ink} ${i === 2 ? 100 : 22}%, transparent)`}
            strokeWidth={i === 2 ? 1.5 : 1}
          />
        );
      })}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={`color-mix(in oklch, ${hsTokens.ink} 18%, transparent)`}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        );
      })}
      {/* Filled value polygon (skipped entirely when there's no flavor data —
          rings-only reads as an intentional empty state, not a glitch) */}
      {hasFlavor ? (
        <polygon
          points={polygon}
          fill={hsTokens.hops}
          fillOpacity={0.35}
          stroke={hsTokens.hops}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ) : null}
      {/* Vertices */}
      {hasFlavor
        ? values.map((v, i) => {
            const [x, y] = point(i, v);
            return (
              <circle
                key={`pt-${i}`}
                cx={x}
                cy={y}
                r={variant === "full" ? 2.5 : 1.5}
                fill={hsTokens.ink}
              />
            );
          })
        : null}
      {/* Axis labels — only on full variant */}
      {variant === "full" &&
        AXES.map((label, i) => {
          const [lx, ly] = point(i, 1).map((m, j) =>
            j === 0
              ? m + (Math.cos(angle(i)) > 0 ? 7 : -7)
              : m + (Math.sin(angle(i)) > 0 ? 4 : -2),
          );
          const a = angle(i);
          let anchor: "start" | "middle" | "end" = "middle";
          if (Math.abs(Math.cos(a)) > 0.3) {
            anchor = Math.cos(a) > 0 ? "start" : "end";
          }
          return (
            <text
              key={`label-${i}`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={5.5}
              fontWeight={800}
              fill={hsTokens.muted}
              letterSpacing="0.06em"
              // fontFamily lives in style, not the SVG presentation attribute -
              // var() only resolves in CSS properties, not attribute values
              style={{
                fontFamily: "var(--font-space-grotesk), system-ui, sans-serif",
                textTransform: "uppercase",
              }}
            >
              {label.includes(" ")
                ? // Two-word labels stack so neither line outruns the side gutter.
                  label.split(" ").map((w, wi) => (
                    <tspan key={wi} x={lx} dy={wi === 0 ? -3 : 6.5}>
                      {w}
                    </tspan>
                  ))
                : label}
            </text>
          );
        })}
    </svg>
  );
}
