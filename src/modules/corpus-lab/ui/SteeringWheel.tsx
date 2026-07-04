"use client";

import { useRef, useState, type CSSProperties } from "react";

import { hsTokens, hsAlpha } from "@/modules/builder/tokens";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";
import { PUSH_HEADROOM, type FlavorAxis } from "./axes";

/**
 * Interactive Hop-&-Skip flavour "steering wheel".
 *
 * A radar the user drags to push a recipe's flavour. Each spoke has a handle:
 *  - unset axes rest at the style's own median (a hollow "ghost" handle) — the
 *    engine will fill them from the neighbourhood, so leaving them alone means
 *    "however this style usually tastes";
 *  - a pushed axis becomes a solid ink handle at the value you dragged to.
 *
 * The rim is the style's typical ceiling — the radar itself is the "normal"
 * zone. Drag a handle out to the rim for a strong-but-classic amount, or keep
 * pulling PAST the rim to go "off the charts" (up to PUSH_HEADROOM×, the reach
 * of the engine's residual correction); drag back to the centre to release it
 * (back to typical). After a Calculate, an accent-filled polygon shows what the
 * generated recipe actually tastes like ("in the glass") — and it, too, can
 * spill past the rim when the recipe genuinely out-does a normal one.
 *
 * Structural chrome (rings, spokes, handles) is pure HS ink; only the axis
 * labels carry each flavour's own identity colour. Interaction math (pointer →
 * axis projection, per-axis max scaling) is ported from the dev FlavorRadar so
 * compressed axes like malt "grainy" still use the full radius.
 */

type ValueMap = Record<string, number>;

export default function SteeringWheel({
  title,
  hint,
  accent,
  axes,
  median,
  band,
  values,
  achieved,
  onChange,
  onReset,
  locked = false,
  onToggleLock,
  size = 300,
  loading = false,
}: {
  title: string;
  hint?: string;
  accent: string;
  /** Axes with their per-axis display `max` already attached (see axesWithMax). */
  axes: FlavorAxis[];
  /** Resting value per axis (the style's median) — where an unpushed handle sits. */
  median: ValueMap;
  /** Style's typical p25–p75 band, drawn as a faint shaded zone. */
  band?: { p25: ValueMap; p75: ValueMap } | null;
  /** Axes the user has actively pushed (key present ⇒ pushed). */
  values: ValueMap;
  /** What the generated recipe actually tastes like — drawn after Calculate. */
  achieved?: ValueMap | null;
  /** (key, value) to push an axis; value === null releases it back to median. */
  onChange: (key: string, value: number | null) => void;
  onReset: () => void;
  /** When set, shows a lock toggle; a locked bill is kept (not rerolled) on "Another take". */
  locked?: boolean;
  onToggleLock?: () => void;
  size?: number;
  /** Norms still loading — dim the wheel and ignore drags. */
  loading?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lockedAxis = useRef<number | null>(null);
  const [activeAxis, setActiveAxis] = useState<number | null>(null);

  const n = axes.length;
  // Floor guards against a caller passing a tiny size (< 108 ⇒ negative radius).
  // Pulled in from -48 to leave a margin the "off the charts" overflow (up to
  // PUSH_HEADROOM× the rim) can spill into without clipping the viewBox.
  const radius = Math.max(1, size / 2 - 54);
  // How far a handle/polygon vertex may sit from centre — the rim (typical) plus
  // the push headroom. Labels live just beyond this so an overflow can't hit them.
  const overflowRadius = radius * PUSH_HEADROOM;
  const cx = size / 2;
  const cy = size / 2;

  const axisMax = (i: number) => axes[i].max ?? 5;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const hasPush = Object.keys(values).length > 0;

  /** The value a handle currently sits at: pushed value, else the style median. */
  const effective = (i: number) => {
    const key = axes[i].key;
    if (key in values) return values[key];
    return median[key] ?? 0;
  };

  function pointAt(i: number, value: number) {
    const angle = angleFor(i);
    const max = axisMax(i); // the rim = the style's typical ceiling
    // A value may run past the rim, out to max × PUSH_HEADROOM (the residual-
    // correction reach) — rendered "off the charts" beyond the outer ring.
    const r = (Math.max(0, Math.min(max * PUSH_HEADROOM, value)) / max) * radius;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function polygon(getValue: (i: number) => number) {
    return axes.map((_, i) => { const p = pointAt(i, getValue(i)); return `${p.x},${p.y}`; }).join(" ");
  }

  function ringPoints(m: number) {
    return axes
      .map((_, i) => { const a = angleFor(i); const r = radius * m; return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`; })
      .join(" ");
  }

  // ── interaction ───────────────────────────────────────────────────────────
  function toViewbox(e: React.PointerEvent) {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (size / rect.width),
      y: (e.clientY - rect.top) * (size / rect.height),
    };
  }

  function nearestAxis(dx: number, dy: number) {
    const ang = Math.atan2(dy, dx);
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < n; i++) {
      let d = Math.abs(ang - angleFor(i)) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < bestDiff) { bestDiff = d; best = i; }
    }
    return best;
  }

  function applyAt(e: React.PointerEvent, axisIdx: number) {
    const { x, y } = toViewbox(e);
    const angle = angleFor(axisIdx);
    // Project the pointer onto the locked axis so sideways drift doesn't jump
    // to a neighbour — only radial movement moves the value.
    const proj = (x - cx) * Math.cos(angle) + (y - cy) * Math.sin(angle);
    const max = axisMax(axisIdx);
    // Drag spans 0 → rim → PUSH_HEADROOM× rim: past the rim is the "off the
    // charts" push, still capped at what residual correction can actually reach.
    const raw = Math.max(0, Math.min(PUSH_HEADROOM, proj / radius)) * max;
    const key = axes[axisIdx].key;
    // Snap to a tidy 0.05 step; anything inside the hub is a release.
    if (raw < max * 0.04) onChange(key, null);
    else onChange(key, Math.round(raw * 20) / 20);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (loading) return;
    const { x, y } = toViewbox(e);
    const idx = nearestAxis(x - cx, y - cy);
    lockedAxis.current = idx;
    setActiveAxis(idx);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    applyAt(e, idx);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (lockedAxis.current == null) return;
    applyAt(e, lockedAxis.current);
  }
  function endDrag() {
    lockedAxis.current = null;
    setActiveAxis(null);
  }

  const inkFaint = hsAlpha(hsTokens.ink, 11);
  const inkRing = hsAlpha(hsTokens.ink, 20);

  return (
    <div
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 16,
        boxShadow: hsTokens.sh3,
        padding: "14px 14px 12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* top accent strip — the HS card signature */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: accent }} />

      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <HSEyebrow style={{ fontSize: 11 }}>{title}</HSEyebrow>
          {hint ? (
            <HSScriptNote color={hsTokens.muted} size={15} rotate={-3}>
              {hint}
            </HSScriptNote>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          {onToggleLock ? (
            <button
              type="button"
              className="studio-focus"
              onClick={onToggleLock}
              aria-pressed={locked}
              aria-label={locked ? "Locked — “Another take” keeps this bill" : "Unlocked — lock so “Another take” keeps this bill"}
              title={locked ? "Locked — “Another take” keeps this bill" : "Lock this bill so “Another take” keeps it"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: locked ? accent : hsTokens.muted,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "1px 2px",
                transition: "color 120ms var(--hs-ease, ease)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="4.5" y="11" width="15" height="10" rx="2" />
                {locked ? <path d="M8 11V7a4 4 0 0 1 8 0v4" /> : <path d="M8 11V7a4 4 0 0 1 7.9-1" />}
              </svg>
            </button>
          ) : null}
          <button
            type="button"
            className="studio-focus"
            onClick={onReset}
            disabled={!hasPush}
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: hasPush ? hsTokens.ink : hsTokens.muted,
              background: "transparent",
              border: "none",
              cursor: hasPush ? "pointer" : "default",
              opacity: hasPush ? 1 : 0.4,
              padding: "2px 2px",
              transition: "opacity 120ms var(--hs-ease, ease)",
            }}
          >
            reset
          </button>
        </div>
      </div>

      {/* the wheel */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        role="group"
        aria-label={`${title} steering wheel — drag a spoke outward to push that flavour, or back to the centre to release it`}
        style={{
          display: "block",
          maxWidth: size,
          margin: "2px auto 0",
          touchAction: "none",
          cursor: loading ? "progress" : activeAxis != null ? "grabbing" : "grab",
          opacity: loading ? 0.5 : 1,
          transition: "opacity 200ms var(--hs-ease, ease)",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
      >
        {/* concentric rings */}
        {[0.25, 0.5, 0.75, 1].map((m) => (
          <polygon
            key={m}
            points={ringPoints(m)}
            fill="none"
            stroke={m === 1 ? inkRing : inkFaint}
            strokeWidth={m === 1 ? 1.75 : 1}
          />
        ))}

        {/* spokes */}
        {axes.map((ax, i) => {
          const a = angleFor(i);
          return (
            <line
              key={ax.key}
              x1={cx}
              y1={cy}
              x2={cx + radius * Math.cos(a)}
              y2={cy + radius * Math.sin(a)}
              stroke={inkFaint}
              strokeWidth={1}
            />
          );
        })}

        {/* style's typical band (p25–p75) as a shaded ring, drawn with even-odd fill */}
        {band ? (
          <path
            d={`M ${polygon((i) => band.p75[axes[i].key] ?? 0).replaceAll(" ", " L ")} Z M ${polygon((i) => band.p25[axes[i].key] ?? 0).replaceAll(" ", " L ")} Z`}
            fill={hsAlpha(hsTokens.ink, 7)}
            fillRule="evenodd"
            stroke="none"
          />
        ) : null}

        {/* achieved — what the generated recipe actually tastes like */}
        {achieved ? (
          <polygon
            points={polygon((i) => achieved[axes[i].key] ?? 0)}
            fill={hsAlpha(accent, 22)}
            stroke={accent}
            strokeWidth={2}
            strokeLinejoin="round"
            style={{ transition: "opacity 200ms var(--hs-ease, ease)" }}
          />
        ) : null}

        {/* target — the shape you're steering to */}
        <polygon
          points={polygon(effective)}
          fill={hasPush ? hsAlpha(hsTokens.ink, 5) : "none"}
          stroke={hsTokens.ink}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeDasharray={hasPush ? undefined : "1 5"}
          strokeOpacity={hasPush ? 1 : 0.45}
          strokeLinecap="round"
        />

        {/* handles */}
        {axes.map((ax, i) => {
          const pushed = ax.key in values;
          const active = activeAxis === i;
          const p = pointAt(i, effective(i));
          const r = active ? 8 : pushed ? 5.5 : 4.5;
          return (
            <circle
              key={ax.key}
              cx={p.x}
              cy={p.y}
              fill={pushed ? hsTokens.ink : hsTokens.paper}
              stroke={hsTokens.ink}
              strokeWidth={pushed ? 1.5 : 1.5}
              opacity={pushed ? 1 : 0.55}
              style={{ r, transition: "r 120ms var(--hs-ease, ease)" } as CSSProperties}
            />
          );
        })}

        {/* live value readout while dragging */}
        {activeAxis != null ? (() => {
          const i = activeAxis;
          const p = pointAt(i, effective(i));
          const pct = Math.round((effective(i) / axisMax(i)) * 100);
          const a = angleFor(i);
          const tx = p.x + 15 * Math.cos(a);
          const ty = p.y + 15 * Math.sin(a);
          const label = `${pct}%`;
          const w = 34;
          return (
            <g pointerEvents="none">
              <rect x={tx - w / 2} y={ty - 11} width={w} height={20} rx={6} fill={hsTokens.ink} />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill={hsTokens.cream} fontFamily="var(--font-ibm-plex-mono, monospace)">
                {label}
              </text>
            </g>
          );
        })() : null}

        {/* axis labels */}
        {axes.map((ax, i) => {
          const a = angleFor(i);
          const x = cx + (overflowRadius + 12) * Math.cos(a);
          const y = cy + (overflowRadius + 12) * Math.sin(a);
          const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
          const pushed = ax.key in values;
          return (
            <text
              key={ax.key}
              x={x}
              y={y}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={10}
              fontWeight={pushed ? 800 : 600}
              fill={ax.color}
              fontFamily="var(--font-space-grotesk, sans-serif)"
              style={{ letterSpacing: "0.02em" }}
            >
              {ax.label}
            </text>
          );
        })}
      </svg>

      {/* legend */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 2,
          fontFamily: hsTokens.body,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        <LegendSwatch color={hsAlpha(hsTokens.ink, 22)} label="typical" filled />
        <LegendSwatch color={hsTokens.ink} label="your push" />
        {achieved ? <LegendSwatch color={accent} label="in the glass" filled /> : null}
      </div>
    </div>
  );
}

function LegendSwatch({ color, label, filled }: { color: string; label: string; filled?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 3,
          background: filled ? color : "transparent",
          border: `1.5px solid ${filled ? "transparent" : color}`,
        }}
      />
      {label}
    </span>
  );
}
