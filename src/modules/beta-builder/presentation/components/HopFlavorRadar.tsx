import { useState } from "react";
import type { HopFlavorProfile } from "../../domain/models/Presets";
import { HOP_FLAVOR_KEYS } from "../../domain/models/Presets";

type Series = { name: string; flavor: HopFlavorProfile };

type Props = {
  series: Series[]; // any length
  maxValue?: number; // default 5
  size?: number; // px, default 320
  title?: string;
  emptyHint?: string;
  // Coloring behavior:
  //  - 'index' (default): distinct hues by series index (good for multi-series readability)
  //  - 'dominant': choose color from dominant aroma axis in each series (used for estimator)
  colorStrategy?: "index" | "dominant";
  // If true, axis labels are tinted by their semantic color mapping
  labelColorize?: boolean;
  // If false, hides the legend entirely
  showLegend?: boolean;
  // Legend placement: "bottom" (default horizontal wrap) or "side" (vertical stack on right)
  legendPosition?: "bottom" | "side";
  // Space reserved from SVG edge to radar rings. Higher = more gutter for labels.
  outerPadding?: number; // default 30
  // Keep ring size constant regardless of padding; if set, we expand the SVG canvas
  // to fit labels instead of shrinking the ring radius.
  ringRadius?: number;
  // If true, SVG fills its container width (no fixed px dimensions). viewBox still
  // uses size/ringRadius for the internal coordinate system.
  responsive?: boolean;
};

// Generate distinct colors per series index
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function colorForIndex(index: number, total: number): string {
  const hue = Math.round((360 * index) / Math.max(total, 6));
  return hslToHex(hue, 70, 50);
}

export default function HopFlavorRadar({
  series,
  maxValue = 5,
  size = 320,
  title,
  emptyHint,
  colorStrategy = "index",
  labelColorize = false,
  showLegend = true,
  legendPosition = "bottom",
  outerPadding = 30,
  ringRadius,
  responsive = false,
}: Props) {
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);

  // In responsive mode, keep a large internal coordinate system so text/strokes
  // stay at their intended pixel sizes, then constrain the rendered output via CSS.
  const radius = ringRadius != null ? ringRadius : responsive ? 140 : size / 2 - outerPadding;
  const pad = responsive ? 72 : outerPadding;
  const canvasWidth = radius * 2 + pad * 2;
  const canvasHeight = radius * 2 + pad * 1.2; // slightly less vertical padding
  const center = { x: canvasWidth / 2, y: canvasHeight / 2 };
  const axes = HOP_FLAVOR_KEYS.length;

  function pointFor(idx: number, value: number) {
    const angle = (Math.PI * 2 * idx) / axes - Math.PI / 2; // start at top
    const r = (value / maxValue) * radius;
    const x = center.x + r * Math.cos(angle);
    const y = center.y + r * Math.sin(angle);
    return `${x},${y}`;
  }

  function ringPath(multiplier: number) {
    const pts = HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * multiplier;
      const x = center.x + r * Math.cos(angle);
      const y = center.y + r * Math.sin(angle);
      return `${x},${y}`;
    }).join(" ");
    return pts;
  }

  const rings = [0.2, 0.4, 0.6, 0.8, 1];
  const list = series;

  const isAllZero =
    series.length === 0 ||
    series.every((s) => HOP_FLAVOR_KEYS.every((k) => (s.flavor[k] || 0) === 0));

  // Semantic color per axis (align with HopFlavorMini)
  function colorForAxis(key: keyof HopFlavorProfile): string {
    switch (key) {
      case "citrus":
        return "#facc15"; // yellow-400
      case "tropicalFruit":
        return "#fb923c"; // orange-400
      case "stoneFruit":
        return "#f97316"; // orange-500
      case "berry":
        return "#a855f7"; // violet-500
      case "floral":
        return "#f472b6"; // pink-400
      case "grassy":
        return "#84cc16"; // lime-500
      case "herbal":
        return "#22c55e"; // green-500
      case "spice":
        return "#ef4444"; // red-500
      case "resinPine":
        return "#16a34a"; // green-600
      default:
        return "#6b7280"; // neutral-500 fallback
    }
  }

  function dominantAxisKey(profile: HopFlavorProfile): (typeof HOP_FLAVOR_KEYS)[number] {
    let key: (typeof HOP_FLAVOR_KEYS)[number] = HOP_FLAVOR_KEYS[0];
    let best = -Infinity;
    for (const k of HOP_FLAVOR_KEYS) {
      const v = profile[k] || 0;
      if (v > best) {
        best = v;
        key = k;
      }
    }
    return key;
  }

  const sideLegend = legendPosition === "side" && showLegend;

  const svgElement = (
    <svg
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      {...(responsive
        ? { width: "100%", height: "100%", style: { maxHeight: "400px" } }
        : { width: canvasWidth, height: canvasHeight })}
      className="mx-auto"
    >
      {/* Web background — rings with alternating fills and animated axes */}
      {rings.map((m, i) => {
        // Fill alternating ring bands
        const innerM = i > 0 ? rings[i - 1] : 0;
        const outerPts = HOP_FLAVOR_KEYS.map((_, j) => {
          const angle = (Math.PI * 2 * j) / axes - Math.PI / 2;
          const r = radius * m;
          return `${center.x + r * Math.cos(angle)},${center.y + r * Math.sin(angle)}`;
        }).join(" ");
        const innerPts =
          i > 0
            ? HOP_FLAVOR_KEYS.map((_, j) => {
                const angle = (Math.PI * 2 * j) / axes - Math.PI / 2;
                const r = radius * innerM;
                return `${center.x + r * Math.cos(angle)},${center.y + r * Math.sin(angle)}`;
              })
                .reverse()
                .join(" ")
            : `${center.x},${center.y}`;
        return (
          <g key={`ring-${i}`}>
            {/* Band fill — subtle alternating tint */}
            {i % 2 === 0 && (
              <polygon
                points={i > 0 ? `${outerPts} ${innerPts}` : outerPts}
                fill="var(--brew-accent-500)"
                fillOpacity={0.03}
                stroke="none"
              />
            )}
            {/* Ring outline */}
            <polygon
              points={ringPath(m)}
              fill="none"
              stroke="var(--brew-accent-500)"
              strokeWidth={i === rings.length - 1 ? 1.5 : 0.75}
              strokeOpacity={i === rings.length - 1 ? 0.3 : 0.15}
              className="hop-radar-ring"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          </g>
        );
      })}
      {/* Axes — dashed lines radiating from center */}
      {(HOP_FLAVOR_KEYS as readonly (keyof HopFlavorProfile)[]).map((key, i) => {
        const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        return (
          <line
            key={key}
            x1={center.x}
            y1={center.y}
            x2={x}
            y2={y}
            stroke="var(--brew-accent-500)"
            strokeWidth={0.75}
            strokeOpacity={0.3}
            className="hop-radar-axis"
            style={{ animationDelay: `${i * 50}ms` }}
          />
        );
      })}
      {/* Labels */}
      {(HOP_FLAVOR_KEYS as readonly (keyof HopFlavorProfile)[]).map((key, i) => {
        const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
        const x = center.x + (radius + 14) * Math.cos(angle);
        const y = center.y + (radius + 14) * Math.sin(angle);
        const textAnchor =
          Math.cos(angle) > 0.2 ? "start" : Math.cos(angle) < -0.2 ? "end" : "middle";
        const dy = Math.sin(angle) > 0.6 ? 8 : Math.sin(angle) < -0.6 ? -2 : 4;
        const label = key
          .replace("resinPine", "Resin / Pine")
          .replace("tropicalFruit", "Tropical Fruit")
          .replace("stoneFruit", "Stone Fruit")
          .replace("citrus", "Citrus")
          .replace("berry", "Berry")
          .replace("floral", "Floral")
          .replace("grassy", "Grassy")
          .replace("herbal", "Herbal")
          .replace("spice", "Spice");
        return (
          <text
            key={key}
            x={x}
            y={y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            className="text-[11px]"
            style={{ fill: labelColorize ? colorForAxis(key) : "var(--fg-muted)" }}
            dy={dy}
          >
            {label}
          </text>
        );
      })}
      {/* Glow filter for series polygons */}
      <defs>
        {list.map((s, si) => {
          const color =
            colorStrategy === "dominant"
              ? colorForAxis(dominantAxisKey(s.flavor))
              : colorForIndex(si, list.length);
          return (
            <filter
              key={`glow-${si}`}
              id={`hop-glow-${si}`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feFlood floodColor={color} floodOpacity="0.3" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          );
        })}
      </defs>
      {/* Series Polygons — with glow and draw-in animation */}
      {list.map((s, si) => {
        const pts = HOP_FLAVOR_KEYS.map((k, i) => pointFor(i, s.flavor[k] || 0)).join(" ");
        const color =
          colorStrategy === "dominant"
            ? colorForAxis(dominantAxisKey(s.flavor))
            : colorForIndex(si, list.length);
        const dimmed = highlightIdx !== null && highlightIdx !== si;
        return (
          <g
            key={s.name}
            className="hop-radar-series"
            style={{
              animationDelay: `${si * 120}ms`,
              opacity: dimmed ? 0.02 : 1,
              transition: "opacity 200ms ease",
            }}
          >
            <polygon
              points={pts}
              fill={color + (dimmed ? "18" : "25")}
              stroke={color}
              strokeWidth={dimmed ? 0.35 : 2}
              strokeOpacity={dimmed ? 0.5 : 1}
              strokeLinejoin="round"
              filter={dimmed ? undefined : `url(#hop-glow-${si})`}
              className="hop-radar-polygon"
            />
          </g>
        );
      })}
      {isAllZero && (
        <text
          x={center.x}
          y={center.y}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs"
          style={{ fill: "var(--fg-muted)" }}
        >
          {emptyHint || "No data"}
        </text>
      )}
    </svg>
  );

  const legendElement = showLegend ? (
    <div className="hop-radar-legend-wrap" onMouseLeave={() => setHighlightIdx(null)}>
      <div
        className={
          sideLegend ? "flex flex-col gap-0.5" : "flex flex-wrap items-center justify-center gap-2"
        }
      >
        {list.map((s, i) => {
          const dimmed = highlightIdx !== null && highlightIdx !== i;
          return (
            <div
              key={s.name}
              className="hop-radar-legend-item"
              style={{ opacity: dimmed ? 0.4 : 1 }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span
                className="hop-radar-legend-swatch"
                style={{ backgroundColor: colorForIndex(i, list.length) }}
              />
              <span className="truncate">{s.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-2 pt-8 sm:pt-0">
      {title && <div className="text-muted text-center text-sm font-medium">{title}</div>}
      {sideLegend ? (
        <div className="relative flex flex-col items-center gap-2">
          {svgElement}
          {legendElement && (
            <div className="shrink-0 sm:absolute sm:top-1/2 sm:right-4 sm:-translate-y-1/2">
              {legendElement}
            </div>
          )}
        </div>
      ) : (
        <>
          {svgElement}
          {legendElement}
        </>
      )}
      <div className="text-muted text-center text-xs">
        0-5 scale. 0s mean no aroma values available.
      </div>
    </div>
  );
}
