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
  // Space reserved from SVG edge to radar rings. Higher = more gutter for labels.
  outerPadding?: number; // default 30
  // Keep ring size constant regardless of padding; if set, we expand the SVG canvas
  // to fit labels instead of shrinking the ring radius.
  ringRadius?: number;
};

// Generate distinct colors per series index
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
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
  outerPadding = 30,
  ringRadius,
}: Props) {
  const radius = ringRadius != null ? ringRadius : size / 2 - outerPadding;
  const canvasWidth =
    ringRadius != null ? ringRadius * 2 + outerPadding * 2 : size;
  const canvasHeight =
    ringRadius != null ? ringRadius * 2 + outerPadding * 1.2 : size; // slightly less vertical padding
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

  function dominantAxisKey(
    profile: HopFlavorProfile
  ): (typeof HOP_FLAVOR_KEYS)[number] {
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

  return (
    <div className="flex flex-col gap-3">
      {title && (
        <div className="text-center text-sm font-medium text-muted">
          {title}
        </div>
      )}
      <svg
        width={canvasWidth}
        height={canvasHeight}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="mx-auto"
      >
        {/* Rings */}
        {rings.map((m, i) => (
          <polygon
            key={i}
            points={ringPath(m)}
            fill="none"
            style={{ stroke: 'rgb(var(--brew-border-subtle))' }}
            strokeWidth={1}
            strokeOpacity={0.5}
          />
        ))}
        {/* Axes */}
        {(HOP_FLAVOR_KEYS as readonly (keyof HopFlavorProfile)[]).map(
          (key, i) => {
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
                style={{ stroke: 'rgb(var(--brew-border-subtle))' }}
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            );
          }
        )}
        {/* Labels */}
        {(HOP_FLAVOR_KEYS as readonly (keyof HopFlavorProfile)[]).map(
          (key, i) => {
            const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
            const x = center.x + (radius + 14) * Math.cos(angle);
            const y = center.y + (radius + 14) * Math.sin(angle);
            const textAnchor =
              Math.cos(angle) > 0.2
                ? "start"
                : Math.cos(angle) < -0.2
                ? "end"
                : "middle";
            const dy =
              Math.sin(angle) > 0.6 ? 8 : Math.sin(angle) < -0.6 ? -2 : 4;
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
                style={{ fill: labelColorize ? colorForAxis(key) : 'var(--fg-muted)' }}
                dy={dy}
              >
                {label}
              </text>
            );
          }
        )}
        {/* Series Polygons */}
        {list.map((s, si) => {
          const pts = HOP_FLAVOR_KEYS.map((k, i) =>
            pointFor(i, s.flavor[k] || 0)
          ).join(" ");
          const color =
            colorStrategy === "dominant"
              ? colorForAxis(dominantAxisKey(s.flavor))
              : colorForIndex(si, list.length);
          return (
            <g key={s.name}>
              <polygon
                points={pts}
                fill={color + "33"}
                stroke={color}
                strokeWidth={2}
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
            className="text-xs" style={{ fill: 'var(--fg-muted)' }}
          >
            {emptyHint || "No data"}
          </text>
        )}
      </svg>
      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
          {list.map((s, i) => (
            <div
              key={s.name}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1"
              style={{ background: 'color-mix(in oklch, var(--brew-accent-900) 15%, rgb(var(--brew-card-inset) / 0.35))', border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))' }}
            >
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: colorForIndex(i, list.length) }}
              />
              <span className="font-medium" style={{ color: 'var(--fg-strong)' }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-center text-xs text-muted">
        0-5 scale. 0s mean no aroma values available.
      </div>
    </div>
  );
}
