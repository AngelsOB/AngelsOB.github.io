import { hsTokens } from "../tokens";
import { getBjcpStyleSpec } from "@/utils/bjcpSpecs";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import HSEyebrow from "./HSEyebrow";
import HSScriptNote from "./HSScriptNote";
import BJCPRangeRow from "./BJCPRangeRow";

interface Props {
  styleCode?: string;
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
  srmRange?: [number, number];
  onSwitchStyle?: () => void;
}

// SRM gradient is sampled at 1-SRM intervals so the pin's actual color
// (srmToRgb) lines up exactly with the gradient color at its position.
const SRM_BAR_MAX = 40;
const SRM_GRADIENT = (() => {
  const stops: string[] = [];
  for (let s = 1; s <= SRM_BAR_MAX; s += 1) {
    const p = ((s - 1) / (SRM_BAR_MAX - 1)) * 100;
    stops.push(`${srmToRgb(s)} ${p.toFixed(2)}%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
})();

function srmAdjective(srm: number): string {
  if (srm < 2) return "straw ✦";
  if (srm < 4) return "pale gold ✦";
  if (srm < 7) return "gold ✦";
  if (srm < 10) return "amber ✦";
  if (srm < 15) return "deep amber ✦";
  if (srm < 20) return "copper ✦";
  if (srm < 28) return "deep red ✦";
  if (srm < 36) return "brown ✦";
  return "black ✦";
}

function srmPctNum(n: number): number {
  const clamped = Math.max(1, Math.min(SRM_BAR_MAX, n));
  return ((clamped - 1) / (SRM_BAR_MAX - 1)) * 100;
}
function srmPct(n: number): string {
  return `${srmPctNum(n)}%`;
}

/**
 * Slice the full SRM_GRADIENT (covering SRM 1→40) so it shows only
 * the [a, b] sub-range across the segment's own width — the colors at
 * position x within the segment match what they'd be on the full-width
 * bar. Used so out-of-range "skinny" segments still show the correct
 * SRM colors continuous with the in-range bulge.
 */
function srmSliceBackground(a: number, b: number) {
  if (a <= 1 && b >= SRM_BAR_MAX) {
    return {
      backgroundImage: SRM_GRADIENT,
      backgroundSize: "100% 100%",
      backgroundPosition: "0% 0%",
      backgroundRepeat: "no-repeat" as const,
    };
  }
  const denom = SRM_BAR_MAX - 1;
  const span = Math.max(0.001, b - a);
  const sizePct = (denom / span) * 100;
  const scroll = denom - span;
  const positionPct = scroll <= 0 ? 0 : ((a - 1) / scroll) * 100;
  return {
    backgroundImage: SRM_GRADIENT,
    backgroundSize: `${sizePct}% 100%`,
    backgroundPosition: `${positionPct}% 0%`,
    backgroundRepeat: "no-repeat" as const,
  };
}


interface StatRow {
  label: string;
  value: number;
  range?: [number, number];
  format: (n: number) => string;
  suffix?: string;
  statMinPad: number;
  viewMin?: number;
}

export default function BJCPStyleRail({
  styleCode,
  og,
  fg,
  abv,
  ibu,
  srm,
  srmRange,
  onSwitchStyle,
}: Props) {
  if (!styleCode) return null;

  const code = styleCode.split(".")[0]?.trim();
  const spec = getBjcpStyleSpec(code);
  if (!spec) return null;

  const styleName = styleCode.includes(".")
    ? styleCode.split(".").slice(1).join(".").trim() || styleCode
    : styleCode;

  // BU/GU — mirror the derivation from StyleRangeComparison.
  const ogPoints = Math.max(0, Math.round((og - 1) * 1000));
  const buGu = ogPoints > 0 ? ibu / ogPoints : 0;
  let buGuRange: [number, number] | undefined;
  if (spec.ibu && spec.og) {
    const ogMinPts = Math.max(1, Math.round((spec.og[0] - 1) * 1000));
    const ogMaxPts = Math.max(1, Math.round((spec.og[1] - 1) * 1000));
    const derivedMin = spec.ibu[0] / ogMaxPts;
    const derivedMax = spec.ibu[1] / ogMinPts;
    const lo = Math.min(derivedMin, derivedMax);
    const hi = Math.max(derivedMin, derivedMax);
    buGuRange = [Number(lo.toFixed(2)), Number(hi.toFixed(2))];
  }

  const rows: StatRow[] = [
    {
      label: "OG",
      value: og,
      range: spec.og,
      format: (n) => n.toFixed(3),
      statMinPad: 0.008,
      viewMin: 1.0,
    },
    {
      label: "FG",
      value: fg,
      range: spec.fg,
      format: (n) => n.toFixed(3),
      statMinPad: 0.006,
    },
    {
      label: "ABV",
      value: abv,
      range: spec.abv,
      format: (n) => n.toFixed(1),
      suffix: "%",
      statMinPad: 1.2,
      viewMin: 0,
    },
    {
      label: "IBU",
      value: ibu,
      range: spec.ibu,
      format: (n) => Math.round(n).toString(),
      statMinPad: 12,
      viewMin: 0,
    },
    {
      label: "BU/GU",
      value: buGu,
      range: buGuRange,
      format: (n) => n.toFixed(2),
      statMinPad: 0.2,
      viewMin: 0,
    },
  ];

  const scoredRows = rows.filter((r) => r.range);
  const overCount = scoredRows.filter((r) => r.value > (r.range as [number, number])[1]).length;
  const underCount = scoredRows.filter((r) => r.value < (r.range as [number, number])[0]).length;
  const offCount = overCount + underCount;
  const inCount = scoredRows.length - offCount;
  const inStyle = offCount === 0;

  const summaryLabel = inStyle
    ? "all in style!"
    : overCount > 0 && underCount === 0
      ? `${overCount} over, ${inCount} in`
      : underCount > 0 && overCount === 0
        ? `${underCount} under, ${inCount} in`
        : `${offCount} off, ${inCount} in`;
  const summaryColor = inStyle ? hsTokens.hops : hsTokens.roast;
  const badgeBg = inStyle ? hsTokens.hops : hsTokens.roast;

  return (
    <div
      className="hs-bjcp-rail"
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: `4px 4px 0 ${hsTokens.ink}`,
        overflow: "hidden",
        color: hsTokens.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          background: hsTokens.cream2,
          borderBottom: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 20%, transparent)`,
          flexWrap: "wrap",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: badgeBg,
            border: `1.5px solid ${hsTokens.ink}`,
            color: hsTokens.paper,
            display: "grid",
            placeItems: "center",
            fontFamily: hsTokens.display,
            fontSize: 13,
            lineHeight: 1,
            boxShadow: `2px 2px 0 ${hsTokens.ink}`,
            flexShrink: 0,
          }}
        >
          {inStyle ? "✓" : "!"}
        </span>
        <HSEyebrow>Style check · {code}</HSEyebrow>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 16,
            letterSpacing: "-0.02em",
            color: hsTokens.ink,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {styleName}
        </span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: hsTokens.ink,
            opacity: 0.18,
            minWidth: 12,
          }}
        />
        <HSScriptNote color={summaryColor} size={17} rotate={-4}>
          {summaryLabel}
        </HSScriptNote>
        {onSwitchStyle ? (
          <button
            type="button"
            onClick={onSwitchStyle}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: 700,
              color: hsTokens.ink,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            Switch style ⇄
          </button>
        ) : null}
      </div>

      <div
        className="hs-bjcp-rail-grid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
        }}
      >
        {rows.map((r, i) => (
          <BJCPRangeRow
            key={r.label}
            label={r.label}
            value={r.value}
            range={r.range}
            format={r.format}
            suffix={r.suffix}
            statMinPad={r.statMinPad}
            viewMin={r.viewMin}
            isFirst={i === 0}
            isLast={i === rows.length - 1}
          />
        ))}
      </div>

      {/* SRM color footer — same card, divider on top. The gradient bar
          carries the BJCP comparison for color: hollow rings mark the
          style's SRM range, the pin shows the recipe's current SRM. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "10px 18px 12px",
          borderTop: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 20%, transparent)`,
          background: hsTokens.cream2,
          flexWrap: "wrap",
        }}
      >
        <HSEyebrow style={{ fontSize: 11.5, fontWeight: 800 }}>Color</HSEyebrow>
        {/* Wrapper height reserves: 14px value above + 4px gap + 20px bar
            + 8px gap to keep lo/hi labels clear of the pin's lower edge
            (pin extends 6px below the bar) + 14px label text. The bar's
            midpoint sits ~at the wrapper's midpoint so flex-centered
            siblings (right-side EBC + script) stay visually aligned. */}
        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: 200,
            height: 58,
          }}
        >
          {(() => {
            const srmCurPctRaw =
              ((Math.max(1, Math.min(SRM_BAR_MAX, srm)) - 1) /
                (SRM_BAR_MAX - 1)) *
              100;
            const srmInRange = srmRange
              ? srm >= srmRange[0] && srm <= srmRange[1]
              : true;
            let vLeft = `${srmCurPctRaw}%`;
            let vTransform = "translateX(-50%)";
            if (srmCurPctRaw < 8) {
              vLeft = "0%";
              vTransform = "none";
            } else if (srmCurPctRaw > 92) {
              vLeft = "100%";
              vTransform = "translateX(-100%)";
            }
            return (
              <div
                style={{
                  position: "absolute",
                  left: vLeft,
                  top: 0,
                  transform: vTransform,
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  fontWeight: 700,
                  color: srmInRange ? hsTokens.ink : hsTokens.roast,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                  pointerEvents: "none",
                }}
              >
                {srm.toFixed(1)}
              </div>
            );
          })()}
          {/* Bar wrapper — 20px tall positioning context. The in-range
              segment fills full 20px; the out-of-range segments are
              shorter (12px) and centered vertically, so the in-range
              bulges out top and bottom by 4px each — that bulge IS the
              prominence cue, the hatch on the outer segments adds the
              "muted" texture. */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 0,
              right: 0,
              height: 20,
              overflow: "visible",
            }}
          >
            {srmRange ? (
              <>
                {srmPctNum(srmRange[0]) > 0 ? (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 4,
                      height: 12,
                      left: 0,
                      width: srmPct(srmRange[0]),
                      borderTop: `1.5px solid ${hsTokens.ink}`,
                      borderBottom: `1.5px solid ${hsTokens.ink}`,
                      borderLeft: `1.5px solid ${hsTokens.ink}`,
                      borderTopLeftRadius: 4,
                      borderBottomLeftRadius: 4,
                      boxSizing: "border-box",
                      overflow: "hidden",
                      ...srmSliceBackground(1, srmRange[0]),
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: `color-mix(in srgb, ${hsTokens.paper} 50%, transparent)`,
                        backgroundImage: `repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in srgb, ${hsTokens.ink} 22%, transparent) 3px 4.5px)`,
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                ) : null}
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 1,
                    height: 18,
                    left: srmPct(srmRange[0]),
                    width: `${srmPctNum(srmRange[1]) - srmPctNum(srmRange[0])}%`,
                    border: `1.5px solid ${hsTokens.ink}`,
                    borderRadius: 3,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    ...srmSliceBackground(srmRange[0], srmRange[1]),
                  }}
                />
                {srmPctNum(srmRange[1]) < 100 ? (
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 4,
                      height: 12,
                      left: srmPct(srmRange[1]),
                      right: 0,
                      borderTop: `1.5px solid ${hsTokens.ink}`,
                      borderBottom: `1.5px solid ${hsTokens.ink}`,
                      borderRight: `1.5px solid ${hsTokens.ink}`,
                      borderTopRightRadius: 4,
                      borderBottomRightRadius: 4,
                      boxSizing: "border-box",
                      overflow: "hidden",
                      ...srmSliceBackground(srmRange[1], SRM_BAR_MAX),
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: `color-mix(in srgb, ${hsTokens.paper} 50%, transparent)`,
                        backgroundImage: `repeating-linear-gradient(135deg, transparent 0 3px, color-mix(in srgb, ${hsTokens.ink} 22%, transparent) 3px 4.5px)`,
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  border: `1.5px solid ${hsTokens.ink}`,
                  borderRadius: 4,
                  background: SRM_GRADIENT,
                  boxSizing: "border-box",
                }}
              />
            )}
            <span
              aria-hidden
              title={`${srm.toFixed(1)} SRM`}
              style={{
                position: "absolute",
                left: `calc(${srmPct(srm)} - 7px)`,
                top: -6,
                width: 14,
                height: 32,
                background: srmToRgb(Math.max(1, Math.min(SRM_BAR_MAX, srm))),
                borderRadius: 3,
                border: `2px solid ${hsTokens.ink}`,
                boxShadow: `0 0 0 1.5px ${hsTokens.cream2}`,
                boxSizing: "border-box",
              }}
            />
          </div>
          {srmRange ? (
            <>
              <span
                style={{
                  position: "absolute",
                  top: 46,
                  left: srmPct(srmRange[0]),
                  transform: "translateX(-50%)",
                  fontFamily: hsTokens.mono,
                  fontSize: 11,
                  color: hsTokens.muted,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  fontWeight: 700,
                }}
              >
                {srmRange[0].toFixed(1)}
              </span>
              <span
                style={{
                  position: "absolute",
                  top: 46,
                  left: srmPct(srmRange[1]),
                  transform: "translateX(-50%)",
                  fontFamily: hsTokens.mono,
                  fontSize: 11,
                  color: hsTokens.muted,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  fontWeight: 700,
                }}
              >
                {srmRange[1].toFixed(1)}
              </span>
            </>
          ) : null}
        </div>
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 12.5,
            color: hsTokens.muted,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          SRM · {Math.round(srm * 1.97)} EBC
        </span>
        <HSScriptNote color={hsTokens.roast} size={18} rotate={-3}>
          {srmAdjective(srm)}
        </HSScriptNote>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .hs-bjcp-rail-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .hs-bjcp-rail-grid > * { border-right: 1px solid color-mix(in oklch, ${hsTokens.ink} 10%, transparent) !important; }
          .hs-bjcp-rail-grid > *:nth-child(3n) { border-right: none !important; }
          .hs-bjcp-rail-grid > *:last-child { border-right: none !important; }
        }
        @media (max-width: 520px) {
          .hs-bjcp-rail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .hs-bjcp-rail-grid > * { border-right: 1px solid color-mix(in oklch, ${hsTokens.ink} 10%, transparent) !important; }
          .hs-bjcp-rail-grid > *:nth-child(2n) { border-right: none !important; }
          .hs-bjcp-rail-grid > *:last-child { border-right: none !important; }
        }
      `}</style>
    </div>
  );
}
