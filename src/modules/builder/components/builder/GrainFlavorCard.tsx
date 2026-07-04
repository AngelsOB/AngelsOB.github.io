"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import type { Fermentable } from "@/modules/recipe/models/Recipe";
import {
  MALT_FLAVOR_KEYS,
  MALT_ARCHETYPES_BY_SLUG,
  aggregateMaltFlavorFrom,
  maltArchetypeForFermentable,
  type MaltFlavorProfile,
} from "@/modules/recipe/data/maltFlavor";

/**
 * Grain flavour radar — the corpus lab's malt wheel, read-only, for the
 * fermentables side column. Each fermentable is matched to a malt archetype
 * (name + colour rules) and the bill aggregates to one 9-axis profile via the
 * same lexicon + saturating math the steering engine uses, so the builder and
 * the Brew Studio tell the same story about a grist.
 *
 * Unlike the hop radar (flat 0–5 axes), every malt axis is scaled to its own
 * typical ceiling — the cloud-audit p99 of real recipes — because malt axes
 * are compressed (a "grainy" of 1.5 IS a lot). The outer ring = that ceiling;
 * a genuinely extreme bill may poke past it (clamped at 1.25×, the same
 * "off the charts" headroom the steering wheel allows).
 */

type MaltKey = keyof MaltFlavorProfile;

// Mirrors MALT_AXES + DEFAULT_MALT_MAX in corpus-lab/ui/axes.ts (keep in sync):
// same order, labels and per-axis ceilings. The three darkest identity colours
// (chocolate/coffee/roast) are lifted a step here — the studio's near-black
// inks disappear against the builder's dark mode surface.
const MALT_AXIS_META: Array<{ key: MaltKey; label: string; color: string; max: number }> = [
  { key: "grainy", label: "Grainy", color: "#c99a2e", max: 1.5 },
  { key: "biscuit", label: "Biscuit", color: "#b9781f", max: 2.5 },
  { key: "caramel", label: "Caramel", color: "#cf8f1a", max: 2.5 },
  { key: "darkFruit", label: "Dark fruit", color: "#8a4bb0", max: 2 },
  { key: "chocolate", label: "Chocolate", color: "#8a5220", max: 2.5 },
  { key: "coffee", label: "Coffee", color: "#7a6a55", max: 2.5 },
  { key: "roast", label: "Roast", color: "#6e5c4d", max: 2.5 },
  { key: "nutty", label: "Nutty", color: "#9a5a1f", max: 1.5 },
  { key: "honey", label: "Honey", color: "#d9a531", max: 2 },
];

/** How far past the rim a value may render — the steering wheel's push zone. */
const OVERFLOW_HEADROOM = 1.25;

// The polygon's ink. NOT the raw malt token (#f2c14e): at hatch-line weights
// that amber washes out on cream, so the radar prints in a deeper caramel
// gold that still reads unmistakably "malt" next to the section accents.
const SERIES_COLOR = "#cf8f1a";

// Baked crosshatch + offset print look — same plate recipe as the hop radar's
// RADAR_HATCH (HopSection.tsx), kept local for the same reason the axis meta
// is: the two cards mount on different tabs, so nothing shared is in scope.
const RADAR_HATCH = {
  hGap: 2.5,
  hWeight: 1.4,
  vGap: 3,
  vWeight: 0.3,
  offsetX: 0,
  offsetY: 0,
  hatchX: 0,
  hatchY: 0,
} as const;

export default function GrainFlavorCard({ fermentables }: { fermentables: Fermentable[] }) {
  // Match every fermentable once; pseudo archetypes (sugar / extract / adjunct
  // / unknown …) resolve to no lexicon entry and simply don't chart.
  const matched = useMemo(
    () =>
      fermentables.map((f) => {
        const match = maltArchetypeForFermentable(f.name, f.colorLovibond);
        return { f, archetype: MALT_ARCHETYPES_BY_SLUG.get(match.archetype) ?? null };
      }),
    [fermentables]
  );

  const profile = useMemo<MaltFlavorProfile>(
    () =>
      aggregateMaltFlavorFrom(
        matched
          .filter((m) => m.archetype)
          .map((m) => ({
            flavor: m.archetype!.flavor,
            intensity: m.archetype!.intensity,
            amount: m.f.weightKg,
          }))
      ),
    [matched]
  );

  // Which grain drives each axis — potency-weighted contribution, the same
  // per-item term the aggregate sums (intensity × grist fraction × axis).
  const dominantPerAxis = useMemo(() => {
    const out: Partial<Record<MaltKey, { name: string; value: number }>> = {};
    const charted = matched.filter((m) => m.archetype && m.f.weightKg > 0);
    const total = charted.reduce((s, m) => s + m.f.weightKg, 0);
    if (total <= 0) return out;
    for (const m of charted) {
      const weight = m.archetype!.intensity * (m.f.weightKg / total);
      for (const k of MALT_FLAVOR_KEYS) {
        const contrib = weight * (m.archetype!.flavor[k] || 0);
        if (contrib <= 0) continue;
        const prior = out[k];
        if (!prior || contrib > prior.value) out[k] = { name: m.f.name, value: contrib };
      }
    }
    return out;
  }, [matched]);

  // Grains that can't chart (sugars, extracts, fruit, unmatched oddballs) —
  // surfaced so an extract-heavy bill's quiet radar explains itself.
  const notCharted = useMemo(
    () => matched.filter((m) => !m.archetype && m.f.weightKg > 0).map((m) => m.f.name),
    [matched]
  );

  const hasFlavor = MALT_FLAVOR_KEYS.some((k) => profile[k] > 0.01);

  return (
    <div
      className="hs-ferm-radar-card"
      style={{
        // Same compound malt tint as the Grain bill card above it.
        background:
          "color-mix(in srgb, color-mix(in srgb, var(--hs-cream), var(--hs-cream-2)) 95%, var(--hs-malt))",
        border: `2px solid color-mix(in srgb, ${hsTokens.ink} 85%, var(--hs-malt))`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        padding: 18,
      }}
    >
      <GrainFlavorCardStyles />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Eyebrow size={11}>Flavor profile</Eyebrow>
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 14,
            color: hsTokens.muted,
            transform: "rotate(-2deg)",
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          what the grist tastes like
        </span>
      </div>

      {hasFlavor ? (
        <>
          <GrainFlavorRadarSvg profile={profile} dominantPerAxis={dominantPerAxis} />
          {notCharted.length > 0 ? (
            <p
              style={{
                margin: "10px 0 0",
                textAlign: "center",
                fontFamily: hsTokens.body,
                fontSize: 11,
                color: hsTokens.muted,
              }}
            >
              not on the wheel: {formatNameList(notCharted)} — sugars, extracts and fruit
              don&apos;t carry malt flavour data
            </p>
          ) : null}
        </>
      ) : (
        <p
          style={{
            margin: 0,
            padding: "22px 12px",
            textAlign: "center",
            fontFamily: hsTokens.body,
            fontSize: 13,
            lineHeight: 1.45,
            color: hsTokens.muted,
          }}
        >
          {notCharted.length > 0
            ? "Nothing to chart yet — sugars, extracts and fruit don't carry malt flavour data. Add a grain and the wheel fills in."
            : "Add some grain weight and the wheel fills in."}
        </p>
      )}
    </div>
  );
}

/** "A, B" or "A, B +2 more" — keeps the caption to one calm line. */
function formatNameList(names: string[]): string {
  const shown = names.slice(0, 2).join(", ");
  const extra = names.length - 2;
  return extra > 0 ? `${shown} +${extra} more` : shown;
}

// ─── The radar ────────────────────────────────────────────────────

function GrainFlavorRadarSvg({
  profile,
  dominantPerAxis,
}: {
  profile: MaltFlavorProfile;
  dominantPerAxis: Partial<Record<MaltKey, { name: string; value: number }>>;
}) {
  const [hoveredAxis, setHoveredAxis] = useState<MaltKey | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);
  const hatch = RADAR_HATCH;

  const size = 240;
  const pad = 36;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const n = MALT_AXIS_META.length;

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  /** Vertex for axis i at raw value v — scaled to that axis's own ceiling,
   *  clamped at the off-the-charts headroom past the rim. */
  const pointAt = (i: number, value: number) => {
    const angle = angleFor(i);
    const max = MALT_AXIS_META[i].max;
    const r = (Math.min(max * OVERFLOW_HEADROOM, Math.max(0, value)) / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const labelLayoutAt = (i: number) => {
    const angle = angleFor(i);
    const cos = Math.cos(angle);
    const anchor: "start" | "middle" | "end" =
      cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
    // Labels sit beyond the overflow zone so an off-the-charts vertex can't
    // touch them; side labels spill into the card padding (overflow visible).
    const r = radius * OVERFLOW_HEADROOM + (anchor === "middle" ? 12 : 5);
    return { lx: cx + r * cos, ly: cy + r * Math.sin(angle), anchor };
  };

  const ringPoints = (mult: number) =>
    MALT_AXIS_META.map((_, i) => {
      const angle = angleFor(i);
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  const polyPoints = MALT_AXIS_META.map((a, i) => pointAt(i, profile[a.key]).join(",")).join(" ");
  const vertexPoints = MALT_AXIS_META.map((a, i) => pointAt(i, profile[a.key]));

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    t.style.transform = `translate(${clientX}px, ${clientY - 14}px) translate(-50%, -100%) rotate(${rotation}deg)`;
  }

  function onAxisMouseMove(e: React.MouseEvent<SVGElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove ? 0 : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
      t.style.transition = "none";
      applyTransform(e.clientX, e.clientY, 0);
      void t.offsetHeight;
      t.style.transition = "opacity 140ms ease, transform 90ms ease-out";
    } else {
      applyTransform(e.clientX, e.clientY, rotation);
    }
    t.style.opacity = "1";
    if (restTimerRef.current !== null) window.clearTimeout(restTimerRef.current);
    const restClientX = e.clientX;
    const restClientY = e.clientY;
    restTimerRef.current = window.setTimeout(
      () => applyTransform(restClientX, restClientY, 0),
      120
    );
  }

  function onAxisMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    setHoveredAxis(null);
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  const hoveredMeta = hoveredAxis ? MALT_AXIS_META.find((a) => a.key === hoveredAxis) : null;
  const hoveredValue = hoveredAxis ? profile[hoveredAxis] : 0;
  const hoveredDom = hoveredAxis ? dominantPerAxis[hoveredAxis] : null;

  return (
    <>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        style={{
          maxWidth: 260,
          display: "block",
          margin: "0 auto",
          overflow: "visible",
        }}
        aria-label="Estimated malt flavor profile of the grain bill"
      >
        <defs>
          <pattern
            id="grain-radar-hatch"
            patternUnits="userSpaceOnUse"
            width={hatch.vGap}
            height={hatch.hGap}
          >
            {hatch.vWeight > 0 ? (
              <line x1={0} y1={0} x2={0} y2={hatch.hGap} stroke={SERIES_COLOR} strokeWidth={hatch.vWeight} />
            ) : null}
            {hatch.hWeight > 0 ? (
              <line x1={0} y1={0} x2={hatch.vGap} y2={0} stroke={SERIES_COLOR} strokeWidth={hatch.hWeight} />
            ) : null}
          </pattern>
        </defs>

        {/* rings + spokes — group fade like the hop radar, so the settled
            state matches the pre-animation attributes exactly. */}
        <g className="hs-ferm-radar-grid">
          {[0.25, 0.5, 0.75, 1].map((mult) => (
            <polygon
              key={mult}
              points={ringPoints(mult)}
              fill="none"
              stroke="var(--hs-ink)"
              strokeWidth={mult === 1 ? 0.8 : 0.5}
              opacity={mult === 1 ? 0.35 : 0.2}
            />
          ))}
          {MALT_AXIS_META.map((a, i) => {
            const angle = angleFor(i);
            return (
              <line
                key={a.key}
                x1={cx}
                y1={cy}
                x2={cx + radius * Math.cos(angle)}
                y2={cy + radius * Math.sin(angle)}
                stroke="var(--hs-ink)"
                strokeWidth={0.3}
                opacity={0.25}
              />
            );
          })}
        </g>

        {/* the grist polygon — riso print stack: faint offset colour plate,
            crosshatch fill, crisp stroke on top. */}
        <g
          className="hs-ferm-radar-series"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        >
          <polygon
            points={polyPoints}
            fill={SERIES_COLOR}
            fillOpacity={0.19}
            stroke="none"
            transform={`translate(${hatch.offsetX} ${hatch.offsetY})`}
          />
          <polygon
            points={polyPoints}
            fill="url(#grain-radar-hatch)"
            fillOpacity={0.55}
            stroke="none"
            transform={`translate(${hatch.hatchX} ${hatch.hatchY})`}
          />
          <polygon
            points={polyPoints}
            fill="none"
            stroke={SERIES_COLOR}
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
        </g>

        {/* vertex dots — pop in staggered clockwise after the polygon lands. */}
        <g>
          {vertexPoints.map(([x, y], i) => (
            <circle
              key={i}
              className="hs-ferm-radar-dot"
              style={{ animationDelay: `${600 + i * 40}ms` }}
              cx={x}
              cy={y}
              r={2.2}
              fill={SERIES_COLOR}
              stroke="var(--hs-ink)"
              strokeWidth={0.5}
            />
          ))}
        </g>

        {/* axis labels + hover hit areas */}
        {MALT_AXIS_META.map((a, i) => {
          const { lx, ly, anchor } = labelLayoutAt(i);
          const words = a.label.split(" ");
          return (
            <g key={`label-${a.key}`}>
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                style={{
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fill: a.color,
                  pointerEvents: "none",
                }}
              >
                {words.length === 1
                  ? a.label
                  : words.map((w, wi) => (
                      <tspan key={wi} x={lx} dy={wi === 0 ? -5 : 10}>
                        {w}
                      </tspan>
                    ))}
              </text>
              <circle
                cx={lx}
                cy={ly}
                r={24}
                fill="transparent"
                onMouseEnter={() => setHoveredAxis(a.key)}
                onMouseMove={onAxisMouseMove}
                onMouseLeave={onAxisMouseLeave}
                style={{ cursor: "default" }}
              />
            </g>
          );
        })}
      </svg>

      {/* cursor-following tooltip — position: fixed escapes the card bounds. */}
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden={hoveredAxis === null}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 100,
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 140ms ease, transform 90ms ease-out",
          padding: "10px 14px",
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 10,
          boxShadow: hsTokens.sh3,
          maxWidth: 240,
        }}
      >
        {hoveredMeta ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: hsTokens.script,
                fontSize: 15,
                color: hoveredMeta.color,
                transform: "rotate(-2deg)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: hoveredMeta.color,
                  border: `1px solid ${hsTokens.ink}`,
                }}
              />
              {hoveredMeta.label}
            </div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 14,
                color: hsTokens.ink,
              }}
            >
              {hoveredValue.toFixed(1)}
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 11,
                  color: hsTokens.muted,
                  marginLeft: 4,
                }}
              >
                / {hoveredMeta.max} typical
              </span>
            </div>
            {hoveredDom ? (
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 12,
                  color: hsTokens.muted,
                }}
              >
                most from{" "}
                <span style={{ color: hsTokens.ink, fontWeight: 600 }}>{hoveredDom.name}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

// ─── Entrance animation styles ────────────────────────────────────
// Copies the hop radar's entrance vocabulary (grid fades, polygon
// scale-bounces, dots pop) under ferm-scoped names — the hop card's
// keyframes live in HopSection's <style>, which isn't mounted on the
// fermentables tab.

function GrainFlavorCardStyles() {
  return (
    <style>{`
      @keyframes hs-ferm-radar-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes hs-ferm-radar-enter {
        0%   { opacity: 0; transform: scale(0.3); }
        60%  { opacity: 1; transform: scale(1.04); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes hs-ferm-radar-dot-in {
        0%   { opacity: 0; transform: scale(0); }
        100% { opacity: 1; transform: scale(1); }
      }
      .hs-ferm-radar-grid {
        animation: hs-ferm-radar-fade-in 500ms ease-out both;
      }
      .hs-ferm-radar-series {
        animation: hs-ferm-radar-enter 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      .hs-ferm-radar-dot {
        transform-box: fill-box;
        transform-origin: center;
        animation: hs-ferm-radar-dot-in 320ms ease-out both;
      }
      @media (prefers-reduced-motion: reduce) {
        .hs-ferm-radar-grid,
        .hs-ferm-radar-series,
        .hs-ferm-radar-dot {
          animation: none !important;
        }
      }
      @media (max-width: 560px) {
        .hs-ferm-radar-card { padding: 12px !important; }
      }
    `}</style>
  );
}

// ─── Eyebrow (matches FermentableSection's local primitive) ───────

function Eyebrow({
  children,
  size = 10,
  color = hsTokens.muted,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
