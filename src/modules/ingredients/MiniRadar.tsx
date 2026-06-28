/**
 * Tiny label-free radar polygon for card previews. Pure SVG (no hooks), so it
 * renders server-side and stays crawlable + cheap to stamp out hundreds of
 * times. The full labelled radar lives on the detail page; this is just the
 * shape-at-a-glance. Generic over axis count — pass any 0–max value vector.
 */
export default function MiniRadar({
  values,
  max = 5,
  color,
  size = 104,
}: {
  values: number[];
  max?: number;
  color: string;
  size?: number;
}) {
  const axes = values.length;
  if (axes < 3) return null;

  const pad = 9;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;

  const point = (i: number, value: number): [number, number] => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2; // start at top
    const r = (Math.max(0, value) / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const ring = (mult: number) =>
    values
      .map((_, i) => {
        const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
        const r = radius * mult;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      })
      .join(" ");

  const poly = values.map((v, i) => point(i, v).join(",")).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: "block" }}
    >
      {[0.5, 1].map((m) => (
        <polygon
          key={m}
          points={ring(m)}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
          opacity={m === 1 ? 0.26 : 0.14}
        />
      ))}
      {values.map((_, i) => {
        const [x, y] = point(i, max);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--hs-ink)"
            strokeWidth={0.3}
            opacity={0.16}
          />
        );
      })}
      <polygon
        points={poly}
        fill={color}
        fillOpacity={0.32}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
