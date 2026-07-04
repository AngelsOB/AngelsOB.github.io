"use client";

import { hsTokens } from "@/modules/builder/tokens";

// Compact malt flavour radar for the mock's grain tab — the small sibling of
// the builder's GrainFlavorCard. Same 9 axes in the same order
// (MALT_FLAVOR_KEYS), and the same per-axis ceilings (cloud-audit p99), so a
// mock polygon and the real card tell the same story about a grist. Pure SVG,
// no animation — the grain tab's reveal is driven by the `fill` prop.

// Malt axes are compressed (a "grainy" of 1.5 IS a lot), so each axis scales
// to its own typical ceiling — a shared 0-5 rim would squash every grist into
// a centre blob. Ceilings mirror GrainFlavorCard / corpus-lab axes.ts.
const AXES: Array<{ label: string; max: number }> = [
  { label: "Grainy", max: 1.5 },
  { label: "Biscuit", max: 2.5 },
  { label: "Caramel", max: 2.5 },
  { label: "Dark fruit", max: 2 },
  { label: "Chocolate", max: 2.5 },
  { label: "Coffee", max: 2.5 },
  { label: "Roast", max: 2.5 },
  { label: "Nutty", max: 1.5 },
  { label: "Honey", max: 2 },
];

// The tour grist (9 lb 2-row / 1 lb Munich / 0.3 lb Crystal 40) run through
// the real malt lexicon offline — same aggregation the steering engine uses.
const SAMPLE = [0.86, 0.54, 0.55, 0.05, 0, 0, 0, 0.12, 0.41];

// GrainFlavorCard's caramel-gold — the raw malt token washes out at these
// stroke weights on cream.
const SERIES = "#cf8f1a";

interface Props {
  size: number;
  /** Recipe mode: raw axis values (0-5-ish, MALT_FLAVOR_KEYS order); each is
   *  scaled to its axis ceiling. All-zero renders rings only. Falls back to
   *  the tour sample when omitted. */
  values?: number[];
  /** 0..1 — grows the polygon with the grains beat (1 at rest / data mode). */
  fill?: number;
}

export function GrainFlavorRadar({ size, values: valuesProp, fill = 1 }: Props) {
  const raw = valuesProp ?? SAMPLE;
  // Fraction of each axis's own rim, clamped at the rim (no overflow headroom
  // at mock scale — an off-the-charts vertex would collide with the labels).
  const values = AXES.map((a, i) => Math.min(1, Math.max(0, (raw[i] ?? 0) / a.max)) * fill);
  const hasFlavor = values.some((v) => v > 0.005);

  // Side gutters so the start/end-anchored labels fit inside the SVG.
  const gutterX = 20;
  const width = size + gutterX * 2;
  const cx = width / 2;
  const cy = size / 2;
  const innerR = size / 2 - 14;
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
      viewBox={`0 0 ${width} ${size}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
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
      {/* Filled value polygon */}
      {hasFlavor ? (
        <polygon
          points={polygon}
          fill={SERIES}
          fillOpacity={0.3}
          stroke={SERIES}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ) : null}
      {/* Vertices */}
      {hasFlavor
        ? values.map((v, i) => {
            const [x, y] = point(i, v);
            return <circle key={`pt-${i}`} cx={x} cy={y} r={2} fill={hsTokens.ink} />;
          })
        : null}
      {/* Axis labels */}
      {AXES.map(({ label }, i) => {
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
