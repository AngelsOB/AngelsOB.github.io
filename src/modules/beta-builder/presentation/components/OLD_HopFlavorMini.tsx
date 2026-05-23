import type { HopFlavorProfile } from "../../domain/models/Presets";
import { HOP_FLAVOR_KEYS } from "../../domain/models/Presets";

type Props = {
  flavor: HopFlavorProfile;
  size?: number; // px
  maxValue?: number; // default 5
  stroke?: string; // CSS color for stroke (overrides auto)
  fill?: string; // CSS color for fill (overrides auto)
  className?: string;
};

export default function OLD_HopFlavorMini({
  flavor,
  size = 40,
  maxValue = 5,
  stroke,
  fill,
  className,
}: Props) {
  const radius = size / 2 - 1;
  const center = { x: size / 2, y: size / 2 };
  const axes = HOP_FLAVOR_KEYS.length;

  const points = HOP_FLAVOR_KEYS.map((key, i) => {
    const value = flavor[key] || 0;
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / maxValue) * radius;
    const x = center.x + r * Math.cos(angle);
    const y = center.y + r * Math.sin(angle);
    return `${x},${y}`;
  }).join(" ");

  // Choose color based on dominant axis (matches old builder logic)
  function dominantKey(): (typeof HOP_FLAVOR_KEYS)[number] | null {
    let bestKey: (typeof HOP_FLAVOR_KEYS)[number] | null = null;
    let bestVal = -Infinity;
    for (const k of HOP_FLAVOR_KEYS) {
      const v = flavor[k] || 0;
      if (v > bestVal) {
        bestVal = v;
        bestKey = k;
      }
    }
    return bestKey;
  }

  function colorFor(key: (typeof HOP_FLAVOR_KEYS)[number] | null): string {
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

  const autoStroke = colorFor(dominantKey());
  const strokeColor = stroke ?? autoStroke;
  const fillColor =
    fill ?? (strokeColor.startsWith("#") ? `${strokeColor}26` : strokeColor);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
      focusable="false"
    >
      <polygon
        points={points}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={1}
      />
    </svg>
  );
}
