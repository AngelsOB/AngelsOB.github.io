import { hsTokens } from "../tokens";

interface Props {
  size?: number;
  color?: string;
  rows?: number;
  className?: string;
}

export default function HSHopCone({
  size = 120,
  color = hsTokens.hops,
  rows = 5,
  className,
}: Props) {
  const ink = hsTokens.ink;
  // Build stacked half-circles forming a cone. Each row is slightly smaller and
  // overlaps the row above.
  const items: { cx: number; cy: number; r: number }[] = [];
  for (let i = 0; i < rows; i++) {
    const r = 22 - i * 2.4;
    const cy = 88 - i * 14;
    items.push({ cx: 30, cy, r });
    items.push({ cx: 70, cy, r });
  }
  // Tip on top
  items.push({ cx: 50, cy: 14 + (rows - 5) * 14, r: 14 - (rows - 5) * 1.5 });

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden
    >
      <g>
        {items.map((p, i) => (
          <path
            key={i}
            d={`M ${p.cx - p.r} ${p.cy} A ${p.r} ${p.r} 0 0 1 ${p.cx + p.r} ${p.cy} Z`}
            fill={color}
            stroke={ink}
            strokeWidth={1.8}
          />
        ))}
        {/* stem */}
        <rect
          x="48"
          y={88}
          width="4"
          height="10"
          fill={ink}
        />
      </g>
    </svg>
  );
}
