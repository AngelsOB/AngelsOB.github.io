"use client";

import { useRef } from "react";

/**
 * Small self-contained radar chart — generic over axes so the same component
 * renders both the hop and malt flavour profiles side by side, consistently.
 *
 * Two modes:
 *  - display only (no `onPick`): draws the given series as polygons.
 *  - interactive (`onPick` set): click/drag on an axis to set that flavour's
 *    value at that radial position. Clicking near the centre clears it.
 *
 * Each axis carries its own `max` (its realistic ceiling from the cloud, ~p99),
 * so a compressed axis like malt "grainy" (never above ~1.4) still uses the
 * full radius instead of a squashed sliver on a shared 0-5 scale. Uses
 * `currentColor` for the grid so it inherits Tailwind text colour.
 */
export type RadarAxis = { key: string; label: string; color: string; max?: number };
export type RadarSeries = { name: string; values: Record<string, number>; dashed?: boolean; color?: string; handles?: boolean };

export default function FlavorRadar({
  axes,
  series,
  maxValue = 5,
  size = 280,
  onPick,
}: {
  axes: RadarAxis[];
  series: RadarSeries[];
  maxValue?: number;
  size?: number;
  /** When set, the radar is interactive: click/drag an axis to call onPick(key, value). */
  onPick?: (key: string, value: number) => void;
}) {
  const radius = size / 2 - 46;
  const center = { x: size / 2, y: size / 2 };
  const n = axes.length;
  const svgRef = useRef<SVGSVGElement>(null);
  const lockedAxis = useRef<number | null>(null);

  const axisMax = (i: number) => axes[i].max ?? maxValue;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  function pointFor(i: number, value: number) {
    const angle = angleFor(i);
    const r = (Math.max(0, Math.min(axisMax(i), value)) / axisMax(i)) * radius;
    return { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
  }

  function ringPoints(m: number) {
    return axes
      .map((_, i) => {
        const angle = angleFor(i);
        const r = radius * m;
        return `${center.x + r * Math.cos(angle)},${center.y + r * Math.sin(angle)}`;
      })
      .join(" ");
  }

  // ── interaction ──────────────────────────────────────────────────────────
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
    if (!onPick) return;
    const { x, y } = toViewbox(e);
    const dx = x - center.x;
    const dy = y - center.y;
    const angle = angleFor(axisIdx);
    // project the pointer onto the locked axis direction, so dragging sideways
    // doesn't jump to a different axis — only radial movement changes the value.
    const proj = dx * Math.cos(angle) + dy * Math.sin(angle);
    const value = Math.max(0, Math.min(1, proj / radius)) * axisMax(axisIdx);
    onPick(axes[axisIdx].key, value);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!onPick) return;
    const { x, y } = toViewbox(e);
    const idx = nearestAxis(x - center.x, y - center.y);
    lockedAxis.current = idx;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    applyAt(e, idx);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!onPick || lockedAxis.current == null) return;
    applyAt(e, lockedAxis.current);
  }
  function onPointerUp() {
    lockedAxis.current = null;
  }

  const isEmpty = series.length === 0 || series.every((s) => axes.every((ax) => (s.values[ax.key] ?? 0) === 0));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="mx-auto text-gray-300"
      style={onPick ? { cursor: "pointer", touchAction: "none" } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {[0.25, 0.5, 0.75, 1].map((m) => (
        <polygon key={m} points={ringPoints(m)} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={1} />
      ))}
      {axes.map((ax, i) => {
        const angle = angleFor(i);
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        return <line key={ax.key} x1={center.x} y1={center.y} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.4} strokeWidth={1} />;
      })}
      {axes.map((ax, i) => {
        const angle = angleFor(i);
        const x = center.x + (radius + 18) * Math.cos(angle);
        const y = center.y + (radius + 18) * Math.sin(angle);
        const anchor = Math.cos(angle) > 0.3 ? "start" : Math.cos(angle) < -0.3 ? "end" : "middle";
        return (
          <text key={ax.key} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize={10} fill={ax.color}>
            {ax.label}
          </text>
        );
      })}
      {series.map((s) => {
        const color = s.color ?? "#3b82f6";
        const pts = axes.map((ax, i) => { const p = pointFor(i, s.values[ax.key] ?? 0); return `${p.x},${p.y}`; }).join(" ");
        return (
          <g key={s.name}>
            <polygon
              points={pts}
              fill={s.dashed || s.handles ? "none" : color}
              fillOpacity={0.18}
              stroke={color}
              strokeWidth={s.dashed ? 1.5 : 2}
              strokeOpacity={s.handles ? 0.5 : 1}
              strokeDasharray={s.dashed ? "5,4" : undefined}
            />
            {s.handles &&
              axes.map((ax, i) => {
                if (!(ax.key in s.values)) return null;
                const p = pointFor(i, s.values[ax.key]);
                return <circle key={ax.key} cx={p.x} cy={p.y} r={4} fill={color} />;
              })}
          </g>
        );
      })}
      {isEmpty && !onPick && (
        <text x={center.x} y={center.y} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="currentColor">
          no overrides set
        </text>
      )}
    </svg>
  );
}
