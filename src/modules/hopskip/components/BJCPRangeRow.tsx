import { hsTokens } from "../tokens";
import HSEyebrow from "./HSEyebrow";

interface Props {
  label: string;
  value: number;
  range?: [number, number];
  format: (n: number) => string;
  suffix?: string;
  statMinPad?: number;
  viewMin?: number;
  isFirst?: boolean;
  isLast?: boolean;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function BJCPRangeRow({
  label,
  value,
  range,
  format,
  suffix = "",
  statMinPad = 0,
  viewMin,
  isFirst = false,
  isLast = false,
}: Props) {
  // first/last cells get extra side padding so the marker can't kiss the
  // card's inner edge; middle cells keep the divider symmetry.
  const cellStyle = {
    padding: "10px 16px 12px",
    paddingLeft: isFirst ? 20 : 16,
    paddingRight: isLast ? 20 : 16,
    borderRight: isLast
      ? "none"
      : `1px solid color-mix(in oklch, ${hsTokens.ink} 10%, transparent)`,
    minWidth: 0,
  } as const;

  if (!range) {
    return (
      <div style={{ ...cellStyle, opacity: 0.5 }}>
        <div style={{ position: "relative", height: 18, marginBottom: 4 }}>
          <HSEyebrow
            style={{
              position: "absolute",
              left: 0,
              top: 4,
              fontSize: 11.5,
              fontWeight: 800,
            }}
          >
            {label}
          </HSEyebrow>
          <span
            style={{
              position: "absolute",
              right: 0,
              top: 4,
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            no spec
          </span>
        </div>
        <div
          style={{
            position: "relative",
            height: 8,
            background: hsTokens.cream2,
            border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 25%, transparent)`,
            borderRadius: 999,
          }}
        />
      </div>
    );
  }

  const [lo, hi] = range;
  const span = Math.max(1e-6, hi - lo);
  const pad = Math.max(span * 1.0, statMinPad);
  let viewLo = lo - pad;
  let viewHi = hi + pad;
  if (viewMin !== undefined) viewLo = Math.max(viewMin, viewLo);
  if (value < viewLo) viewLo = value - span * 0.3;
  if (value > viewHi) viewHi = value + span * 0.3;
  if (viewMin !== undefined) viewLo = Math.max(viewMin, viewLo);

  const viewSpan = Math.max(1e-6, viewHi - viewLo);
  const pct = (n: number) => clamp(((n - viewLo) / viewSpan) * 100, 0, 100);
  const loPct = pct(lo);
  const hiPct = pct(hi);
  const curPct = pct(value);
  const inRange = value >= lo && value <= hi;

  // Anchor the value to the marker, but reserve room on the left for the
  // eyebrow label (which now shares this row) and pin to the right edge
  // when the marker is near 100% so the label can't overflow.
  const EYEBROW_RESERVE_PX = 76;
  const valueLeft =
    curPct > 90 ? "100%" : `max(${EYEBROW_RESERVE_PX}px, ${curPct}%)`;
  const valueTransform =
    curPct > 90 ? "translateX(-100%)" : "translateX(-50%)";

  const trackHeight = 8;
  const markerHeight = trackHeight + 8;

  return (
    <div style={cellStyle}>
      {/* Eyebrow + value share one row to keep the cell compact. Value is
          anchored to the marker, eyebrow stays pinned on the left. */}
      <div style={{ position: "relative", height: 18, marginBottom: 4 }}>
        <HSEyebrow
          style={{
            position: "absolute",
            left: 0,
            top: 4,
            fontSize: 11.5,
            fontWeight: 800,
          }}
        >
          {label}
        </HSEyebrow>
        <div
          style={{
            position: "absolute",
            left: valueLeft,
            top: 1,
            transform: valueTransform,
            fontFamily: hsTokens.body,
            fontSize: 13,
            fontWeight: 700,
            color: inRange ? hsTokens.ink : hsTokens.roast,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          {format(value)}
          {suffix}
        </div>
      </div>

      <div style={{ position: "relative", paddingBottom: 16 }}>
        <div
          style={{
            position: "relative",
            height: trackHeight,
            background: hsTokens.cream2,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${loPct}%`,
              width: `${Math.max(0, hiPct - loPct)}%`,
              top: 0,
              bottom: 0,
              background: hsTokens.hops,
              opacity: 0.28,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${loPct}%`,
              top: -2,
              bottom: -2,
              width: 1.5,
              background: hsTokens.hops,
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${hiPct}%`,
              top: -2,
              bottom: -2,
              width: 1.5,
              background: hsTokens.hops,
              opacity: 0.85,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `calc(${curPct}% - 6px)`,
              top: -4,
              width: 12,
              height: markerHeight,
              background: inRange ? hsTokens.ink : hsTokens.roast,
              borderRadius: 3,
              boxShadow: inRange ? "none" : `0 0 0 1.5px ${hsTokens.paper}`,
            }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            left: `${loPct}%`,
            top: trackHeight + 4,
            transform: "translateX(-50%)",
            fontFamily: hsTokens.mono,
            fontSize: 11,
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            fontWeight: 700,
          }}
        >
          {format(lo)}
        </div>
        <div
          style={{
            position: "absolute",
            left: `${hiPct}%`,
            top: trackHeight + 4,
            transform: "translateX(-50%)",
            fontFamily: hsTokens.mono,
            fontSize: 11,
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            fontWeight: 700,
          }}
        >
          {format(hi)}
        </div>
      </div>
    </div>
  );
}
