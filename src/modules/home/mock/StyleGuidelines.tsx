"use client";

import { hsTokens } from "@/modules/builder/tokens";
import { srmToRgb } from "@/modules/recipe/utils/srmColorUtils";
import type { V4MockData } from "../lib/mapRecipeToV4Mock";

// Compact mock of the real builder's BJCPStyleRail: a row of vitals gauges
// (value vs BJCP style range, marker goes roast when out of range) + an SRM
// color visualizer (sampled gradient bar with the style's SRM range boxed,
// the out-of-range ends hatched, and a colored pin at the recipe's SRM).
// Numbers are the mock recipe (Citra Mosaic IPA) vs American IPA · 21A.

const INK = hsTokens.ink;
const ROAST = hsTokens.roast;
const HOPS = hsTokens.hops;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ── SRM gradient, sampled at 1-SRM steps so the pin color lines up. ──────────
const SRM_MAX = 40;
const SRM_GRADIENT = (() => {
  const stops: string[] = [];
  for (let s = 1; s <= SRM_MAX; s += 1) {
    const p = ((s - 1) / (SRM_MAX - 1)) * 100;
    stops.push(`${srmToRgb(s)} ${p.toFixed(1)}%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
})();
const srmPctNum = (n: number) => ((clamp(n, 1, SRM_MAX) - 1) / (SRM_MAX - 1)) * 100;
const HATCH = `repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in srgb, ${INK} 22%, transparent) 3px 4.5px)`;

function srmAdjective(srm: number): string {
  if (srm < 2) return "straw";
  if (srm < 4) return "pale gold";
  if (srm < 7) return "gold";
  if (srm < 10) return "amber";
  if (srm < 15) return "deep amber";
  if (srm < 20) return "copper";
  if (srm < 28) return "deep red";
  if (srm < 36) return "brown";
  return "black";
}

// base = value at an empty bill (gravities at 1.000, the rest at 0); value =
// full-recipe target. The grains beat interpolates current = base..value.
type Gauge = { label: string; base: number; value: number; lo: number; hi: number; fmt: (n: number) => string };
const GAUGES: Gauge[] = [
  { label: "OG", base: 1, value: 1.062, lo: 1.056, hi: 1.07, fmt: (n) => n.toFixed(3) },
  { label: "FG", base: 1, value: 1.012, lo: 1.008, hi: 1.014, fmt: (n) => n.toFixed(3) },
  { label: "ABV", base: 0, value: 6.6, lo: 5.5, hi: 7.5, fmt: (n) => `${n.toFixed(1)}%` },
  { label: "IBU", base: 0, value: 52, lo: 40, hi: 70, fmt: (n) => `${Math.round(n)}` },
];
const SRM_VALUE = 6.2;
const SRM_RANGE: [number, number] = [6, 14];

function eyebrow(size = 8.5): React.CSSProperties {
  return { fontFamily: hsTokens.body, fontSize: size, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: hsTokens.muted };
}

export function StyleGuidelines({ grainFill = 1, fgShift = 0, data }: { grainFill?: number; fgShift?: number; data?: V4MockData }) {
  // Sample uses the hardcoded 21A GAUGES. Data mode (signed-in hero) builds the
  // gauges from the recipe's stats + its BJCP style spec. If the style has no
  // spec (custom style), fall back to a tight band around the value so the gauge
  // still renders sensibly.
  const mk = (
    label: string,
    base: number,
    value: number,
    range: [number, number] | undefined,
    fmt: (n: number) => string,
  ): Gauge => {
    const [lo, hi] = range ?? [value, value];
    return { label, base, value, lo, hi, fmt };
  };
  const baseGauges: Gauge[] = data
    ? [
        mk("OG", 1, data.stats.og, data.ranges?.og, (n) => n.toFixed(3)),
        mk("FG", 1, data.stats.fg, data.ranges?.fg, (n) => n.toFixed(3)),
        mk("ABV", 0, data.stats.abv, data.ranges?.abv, (n) => `${n.toFixed(1)}%`),
        mk("IBU", 0, data.stats.ibu, data.ranges?.ibu, (n) => `${Math.round(n)}`),
      ]
    : GAUGES;
  // Honest-numbers sweep: nudge FG (and the dependent ABV) so these gauges move
  // in lockstep with the stat strip above. fgShift is 0 outside that beat and in
  // the data-mode hero, so this is a no-op there.
  const ogVal = baseGauges.find((g) => g.label === "OG")?.value ?? 1.062;
  const fgVal =
    (baseGauges.find((g) => g.label === "FG")?.value ?? 1.012) + 0.003 * fgShift;
  const gauges: Gauge[] =
    fgShift !== 0
      ? baseGauges.map((g) =>
          g.label === "FG"
            ? { ...g, value: fgVal }
            : g.label === "ABV"
              ? { ...g, value: (ogVal - fgVal) * 131.25 }
              : g,
        )
      : baseGauges;
  const srmValue = data ? data.stats.srm : SRM_VALUE;
  const srmRange: [number, number] = data
    ? data.ranges?.srm ?? [Math.max(0, data.stats.srm - 1), data.stats.srm + 1]
    : SRM_RANGE;
  const styleLabel = data ? data.style : "American IPA · 21A";
  return (
    <div
      style={{
        marginTop: 12,
        background: hsTokens.cream2,
        border: `2px solid ${INK}`,
        borderRadius: 10,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, padding: "7px 12px 6px", borderBottom: `1.5px solid color-mix(in oklch, ${INK} 18%, transparent)` }}>
        <span style={{ ...eyebrow(9), display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden style={{ width: 8, height: 8, background: HOPS, border: `1.5px solid ${INK}`, borderRadius: 2 }} />
          Style guidelines
        </span>
        <span style={{ fontFamily: hsTokens.mono, fontSize: 10, color: hsTokens.muted }}>{styleLabel} ⇄</span>
      </div>
      {/* vitals gauges */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${gauges.length}, minmax(0, 1fr))` }}>
        {gauges.map((g, i) => (
          <GaugeCell key={g.label} g={g} grainFill={grainFill} isFirst={i === 0} isLast={i === gauges.length - 1} />
        ))}
      </div>
      {/* SRM color visualizer */}
      <SrmVisualizer grainFill={grainFill} value={srmValue} range={srmRange} />
    </div>
  );
}

function GaugeCell({ g, grainFill, isFirst, isLast }: { g: Gauge; grainFill: number; isFirst: boolean; isLast: boolean }) {
  // Current (animating) value; the BJCP range band stays fixed (uses g.value
  // for the view window so it doesn't shift as the marker animates).
  const cur = g.base + (g.value - g.base) * grainFill;
  const span = g.hi - g.lo;
  const pad = span;
  let vLo = g.lo - pad;
  let vHi = g.hi + pad;
  if (g.value < vLo) vLo = g.value - span * 0.3;
  if (g.value > vHi) vHi = g.value + span * 0.3;
  const vSpan = Math.max(1e-6, vHi - vLo);
  const pct = (n: number) => clamp(((n - vLo) / vSpan) * 100, 0, 100);
  const loP = pct(g.lo);
  const hiP = pct(g.hi);
  const curP = pct(cur);
  const inRange = cur >= g.lo && cur <= g.hi;
  return (
    <div
      style={{
        padding: "7px 10px 6px",
        paddingLeft: isFirst ? 13 : 10,
        paddingRight: isLast ? 13 : 10,
        borderRight: isLast ? "none" : `1px solid color-mix(in oklch, ${INK} 10%, transparent)`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 5 }}>
        <span style={eyebrow(9)}>{g.label}</span>
        <span style={{ fontFamily: hsTokens.body, fontSize: 11, fontWeight: 700, color: inRange ? INK : ROAST, fontVariantNumeric: "tabular-nums" }}>{g.fmt(cur)}</span>
      </div>
      <div style={{ position: "relative", height: 6, background: hsTokens.cream, border: `1.5px solid ${INK}`, borderRadius: 999 }}>
        {/* range band */}
        <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${loP}%`, width: `${Math.max(0, hiP - loP)}%`, background: HOPS, opacity: 0.28 }} />
        {/* range edges */}
        <span aria-hidden style={{ position: "absolute", top: -2, bottom: -2, left: `${loP}%`, width: 1.5, background: HOPS, opacity: 0.85 }} />
        <span aria-hidden style={{ position: "absolute", top: -2, bottom: -2, left: `${hiP}%`, width: 1.5, background: HOPS, opacity: 0.85 }} />
        {/* marker */}
        <span aria-hidden style={{ position: "absolute", left: `calc(${curP}% - 4px)`, top: -3, width: 8, height: 12, background: inRange ? INK : ROAST, borderRadius: 2, boxShadow: inRange ? "none" : `0 0 0 1.5px ${hsTokens.cream2}` }} />
      </div>
      <div style={{ position: "relative", height: 12, marginTop: 3 }}>
        <span style={{ position: "absolute", left: `${loP}%`, transform: "translateX(-50%)", fontFamily: hsTokens.mono, fontSize: 8.5, color: hsTokens.muted, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{g.fmt(g.lo)}</span>
        <span style={{ position: "absolute", left: `${hiP}%`, transform: "translateX(-50%)", fontFamily: hsTokens.mono, fontSize: 8.5, color: hsTokens.muted, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{g.fmt(g.hi)}</span>
      </div>
    </div>
  );
}

function SrmVisualizer({ grainFill = 1, value = SRM_VALUE, range = SRM_RANGE }: { grainFill?: number; value?: number; range?: [number, number] }) {
  const [lo, hi] = range;
  const cur = value * grainFill; // animates 0 -> value as the bill builds
  const loP = srmPctNum(lo);
  const hiP = srmPctNum(hi);
  const curP = srmPctNum(cur);
  const inRange = cur >= lo && cur <= hi;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px 9px", borderTop: `1.5px solid color-mix(in oklch, ${INK} 18%, transparent)` }}>
      <span style={eyebrow(9)}>Color</span>
      <div style={{ position: "relative", flex: 1, minWidth: 140, height: 40 }}>
        {/* current SRM value above the pin */}
        <span style={{ position: "absolute", top: 0, left: curP < 8 ? "0%" : curP > 92 ? "100%" : `${curP}%`, transform: curP < 8 ? "none" : curP > 92 ? "translateX(-100%)" : "translateX(-50%)", fontFamily: hsTokens.body, fontSize: 11, fontWeight: 700, color: inRange ? INK : ROAST, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {cur.toFixed(1)}
        </span>
        {/* gradient bar with style range boxed + out-of-range hatch */}
        <div style={{ position: "absolute", top: 15, left: 0, right: 0, height: 14, border: `1.5px solid ${INK}`, borderRadius: 4, background: SRM_GRADIENT, overflow: "hidden" }}>
          {/* hatch the out-of-range ends */}
          <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${loP}%`, backgroundColor: `color-mix(in srgb, ${hsTokens.paper} 45%, transparent)`, backgroundImage: HATCH }} />
          <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${hiP}%`, right: 0, backgroundColor: `color-mix(in srgb, ${hsTokens.paper} 45%, transparent)`, backgroundImage: HATCH }} />
          {/* in-range box outline */}
          <span aria-hidden style={{ position: "absolute", top: -1, bottom: -1, left: `${loP}%`, width: `${Math.max(0, hiP - loP)}%`, border: `1.5px solid ${INK}`, borderRadius: 3, boxSizing: "border-box" }} />
        </div>
        {/* pin at recipe SRM */}
        <span aria-hidden title={`${cur.toFixed(1)} SRM`} style={{ position: "absolute", top: 11, left: `calc(${curP}% - 6px)`, width: 12, height: 22, background: srmToRgb(Math.max(0.1, cur)), border: `2px solid ${INK}`, borderRadius: 3, boxShadow: `0 0 0 1.5px ${hsTokens.cream2}`, boxSizing: "border-box" }} />
        {/* lo/hi labels */}
        <span style={{ position: "absolute", top: 30, left: `${loP}%`, transform: "translateX(-50%)", fontFamily: hsTokens.mono, fontSize: 8.5, color: hsTokens.muted, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{lo}</span>
        <span style={{ position: "absolute", top: 30, left: `${hiP}%`, transform: "translateX(-50%)", fontFamily: hsTokens.mono, fontSize: 8.5, color: hsTokens.muted, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{hi}</span>
      </div>
      <span style={{ fontFamily: hsTokens.mono, fontSize: 10, color: hsTokens.muted, fontWeight: 600, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{Math.round(cur * 1.97)} EBC</span>
      <span style={{ fontFamily: hsTokens.script, fontSize: 13, color: ROAST, flexShrink: 0, transform: "rotate(-3deg)" }}>{srmAdjective(cur)}</span>
    </div>
  );
}
