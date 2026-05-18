"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

import type { Recipe } from "@/modules/beta-builder/domain/models/Recipe";
import { RecipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import {
  type RecipeWithCalcs,
  type FermentableGroup,
  avg,
  getGrainBreakdown,
  getHopSummary,
  getWeightedMashTemp,
  getEffectiveWaterProfile,
  averageWaterProfiles,
  GRAIN_CATEGORY_COLORS,
  GRAIN_CATEGORY_ORDER,
} from "@/modules/compare/compareUtils";
import { getBjcpStyleSpec, type RangeTuple } from "@/utils/bjcpSpecs";

import { hsTokens } from "../../tokens";
import HSCard from "../HSCard";
import HSScriptNote from "../HSScriptNote";

const calc = new RecipeCalculationService();

interface Props {
  initialRecipes: Recipe[];
}

const cellHeadStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: hsTokens.muted,
  padding: "10px 12px",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const cellBodyStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  color: hsTokens.ink,
  padding: "10px 12px",
  textAlign: "right",
  borderTop: `1px dashed color-mix(in oklch, ${hsTokens.ink} 18%, transparent)`,
};

const cellAvgStyle: React.CSSProperties = {
  ...cellBodyStyle,
  fontWeight: 700,
  background: `color-mix(in oklch, ${hsTokens.malt} 14%, transparent)`,
};

const sectionEyebrowStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: hsTokens.muted,
  marginBottom: 4,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontFamily: hsTokens.display,
  fontSize: 26,
  letterSpacing: "-0.02em",
  lineHeight: 1.05,
  color: hsTokens.ink,
};

function extractBjcpCode(style?: string): string | undefined {
  if (!style) return undefined;
  return style.split(".")[0]?.trim();
}

function formatRange(range: RangeTuple | undefined, decimals = 0): string {
  if (!range) return "—";
  if (decimals > 0) return `${range[0].toFixed(decimals)}–${range[1].toFixed(decimals)}`;
  return `${range[0]}–${range[1]}`;
}

export default function HSCompareRecipesPage({ initialRecipes }: Props) {
  const items: RecipeWithCalcs[] = useMemo(
    () => initialRecipes.map((r) => ({ recipe: r, calcs: calc.calculate(r) })),
    [initialRecipes],
  );

  if (items.length < 2) {
    return (
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "72px 24px",
          textAlign: "center",
        }}
      >
        <HSScriptNote color={hsTokens.water} size={22}>
          side by side —
        </HSScriptNote>
        <HSCard shadow={2} padding={32} style={{ marginTop: 12 }}>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 28,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Pick at least two.
          </div>
          <p
            style={{
              marginTop: 8,
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.muted,
            }}
          >
            Choose two or more recipes from the browse page to compare side-by-side.
          </p>
          <div style={{ marginTop: 18 }}>
            <Link
              href="/browse"
              style={{
                fontFamily: hsTokens.body,
                fontSize: 13,
                fontWeight: 700,
                color: hsTokens.water,
                textDecoration: "underline",
              }}
            >
              ← Back to browse
            </Link>
          </div>
        </HSCard>
      </section>
    );
  }

  return (
    <section
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <Link
          href="/browse"
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 14,
          }}
        >
          ← Back to browse
        </Link>
        <HSScriptNote color={hsTokens.water} size={22}>
          side by side —
        </HSScriptNote>
        <h1
          style={{
            margin: "6px 0 0",
            fontFamily: hsTokens.display,
            fontSize: "clamp(44px, 6vw, 80px)",
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
          }}
        >
          Compare recipes.
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: hsTokens.body,
            fontSize: 14,
            color: hsTokens.muted,
            maxWidth: 640,
          }}
        >
          Comparing {items.length} recipes — vitals, grains, hops, mash, water side-by-side.
        </p>
      </div>

      {/* Recipe pill row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 32,
        }}
      >
        {items.map(({ recipe: r, calcs: c }) => {
          const color = srmToRgb(c.srm);
          return (
            <div
              key={r.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 14px",
                borderRadius: 999,
                background: hsTokens.cream2,
                border: `2px solid ${hsTokens.ink}`,
                fontFamily: hsTokens.body,
                fontSize: 13,
                fontWeight: 700,
                color: hsTokens.ink,
                maxWidth: 240,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: color,
                  border: `1.5px solid ${hsTokens.ink}`,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.name}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <VitalsBlock items={items} />
        <GrainBlock items={items} />
        <HopBlock items={items} />
        <MashBlock items={items} />
        <WaterBlock items={items} />
      </div>
    </section>
  );
}

// ── Vitals ──────────────────────────────────────────────────────────────

function VitalsBlock({ items }: { items: RecipeWithCalcs[] }) {
  const calcs = items.map((i) => i.calcs);

  const bjcpInfo = useMemo(() => {
    const styleCounts: Record<string, number> = {};
    const styleNames: Record<string, string> = {};
    for (const { recipe } of items) {
      const code = extractBjcpCode(recipe.style);
      if (code) {
        styleCounts[code] = (styleCounts[code] || 0) + 1;
        styleNames[code] = recipe.style || "";
      }
    }
    let bestCode: string | undefined;
    let bestCount = 0;
    for (const [code, count] of Object.entries(styleCounts)) {
      if (count > bestCount) {
        bestCode = code;
        bestCount = count;
      }
    }
    if (!bestCode) return null;
    const spec = getBjcpStyleSpec(bestCode);
    if (!spec) return null;
    return { code: bestCode, name: styleNames[bestCode], spec };
  }, [items]);

  const avgAbv = avg(calcs.map((c) => c.abv));
  const avgOg = avg(calcs.map((c) => c.og));
  const avgFg = avg(calcs.map((c) => c.fg));
  const avgIbu = avg(calcs.map((c) => c.ibu));
  const avgSrm = avg(calcs.map((c) => c.srm));
  const avgCalories = avg(calcs.map((c) => c.calories));

  return (
    <HSCard shadow={2} accent={hsTokens.malt} padding={20}>
      <div style={{ paddingTop: 6 }}>
        <div style={sectionEyebrowStyle}>section</div>
        <h2 style={sectionTitleStyle}>Vitals</h2>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...cellHeadStyle, textAlign: "left" }}>Recipe</th>
              <th style={cellHeadStyle}>ABV</th>
              <th style={cellHeadStyle}>OG</th>
              <th style={cellHeadStyle}>FG</th>
              <th style={cellHeadStyle}>IBU</th>
              <th style={cellHeadStyle}>SRM</th>
              <th style={cellHeadStyle}>Cal</th>
            </tr>
          </thead>
          <tbody>
            {items.map(({ recipe: r, calcs: c }) => {
              const srmColor = srmToRgb(c.srm);
              return (
                <tr key={r.id}>
                  <td
                    style={{
                      ...cellBodyStyle,
                      textAlign: "left",
                      maxWidth: 180,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    {r.style ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: hsTokens.muted,
                          fontStyle: "italic",
                          marginTop: 2,
                        }}
                      >
                        {r.style}
                      </div>
                    ) : null}
                  </td>
                  <td style={cellBodyStyle}>{c.abv.toFixed(1)}%</td>
                  <td style={cellBodyStyle}>{c.og.toFixed(3)}</td>
                  <td style={cellBodyStyle}>{c.fg.toFixed(3)}</td>
                  <td style={cellBodyStyle}>{Math.round(c.ibu)}</td>
                  <td style={cellBodyStyle}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span
                        aria-hidden
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: srmColor,
                          border: `1px solid ${hsTokens.ink}`,
                        }}
                      />
                      {Math.round(c.srm)}
                    </span>
                  </td>
                  <td style={cellBodyStyle}>{Math.round(c.calories)}</td>
                </tr>
              );
            })}
            <tr>
              <td
                style={{
                  ...cellAvgStyle,
                  textAlign: "left",
                  fontFamily: hsTokens.display,
                  fontSize: 14,
                }}
              >
                Average
              </td>
              <td style={cellAvgStyle}>{avgAbv.toFixed(1)}%</td>
              <td style={cellAvgStyle}>{avgOg.toFixed(3)}</td>
              <td style={cellAvgStyle}>{avgFg.toFixed(3)}</td>
              <td style={cellAvgStyle}>{Math.round(avgIbu)}</td>
              <td style={cellAvgStyle}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: srmToRgb(avgSrm),
                      border: `1px solid ${hsTokens.ink}`,
                    }}
                  />
                  {Math.round(avgSrm)}
                </span>
              </td>
              <td style={cellAvgStyle}>{Math.round(avgCalories)}</td>
            </tr>
            {bjcpInfo ? (
              <tr>
                <td
                  style={{
                    ...cellBodyStyle,
                    textAlign: "left",
                    background: `color-mix(in oklch, ${hsTokens.water} 10%, transparent)`,
                    color: hsTokens.muted,
                    fontSize: 12,
                  }}
                >
                  <span style={{ fontWeight: 700, color: hsTokens.ink }}>BJCP</span>
                  <div
                    style={{
                      fontSize: 11,
                      color: hsTokens.muted,
                      fontStyle: "italic",
                      marginTop: 2,
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bjcpInfo.name}
                  </div>
                </td>
                <td
                  style={{
                    ...cellBodyStyle,
                    background: `color-mix(in oklch, ${hsTokens.water} 10%, transparent)`,
                    color: hsTokens.muted,
                    fontSize: 12,
                  }}
                >
                  {formatRange(bjcpInfo.spec.abv, 1)}%
                </td>
                <td
                  style={{
                    ...cellBodyStyle,
                    background: `color-mix(in oklch, ${hsTokens.water} 10%, transparent)`,
                    color: hsTokens.muted,
                    fontSize: 12,
                  }}
                >
                  {formatRange(bjcpInfo.spec.og, 3)}
                </td>
                <td
                  style={{
                    ...cellBodyStyle,
                    background: `color-mix(in oklch, ${hsTokens.water} 10%, transparent)`,
                    color: hsTokens.muted,
                    fontSize: 12,
                  }}
                >
                  {formatRange(bjcpInfo.spec.fg, 3)}
                </td>
                <td
                  style={{
                    ...cellBodyStyle,
                    background: `color-mix(in oklch, ${hsTokens.water} 10%, transparent)`,
                    color: hsTokens.muted,
                    fontSize: 12,
                  }}
                >
                  {formatRange(bjcpInfo.spec.ibu)}
                </td>
                <td
                  style={{
                    ...cellBodyStyle,
                    background: `color-mix(in oklch, ${hsTokens.water} 10%, transparent)`,
                    color: hsTokens.muted,
                    fontSize: 12,
                  }}
                >
                  {formatRange(bjcpInfo.spec.srm)}
                </td>
                <td
                  style={{
                    ...cellBodyStyle,
                    background: `color-mix(in oklch, ${hsTokens.water} 10%, transparent)`,
                    color: hsTokens.muted,
                    fontSize: 12,
                  }}
                >
                  —
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </HSCard>
  );
}

// ── Grain ───────────────────────────────────────────────────────────────

function GrainBlock({ items }: { items: RecipeWithCalcs[] }) {
  const breakdowns = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    breakdown: getGrainBreakdown(recipe),
  }));

  const allCategories = GRAIN_CATEGORY_ORDER.filter((cat) =>
    breakdowns.some((b) => b.breakdown[cat]),
  );

  const avgBreakdown: Partial<Record<FermentableGroup, number>> = {};
  for (const cat of allCategories) {
    avgBreakdown[cat] = avg(breakdowns.map((b) => b.breakdown[cat]?.pct ?? 0));
  }

  const hasAnyGrains = breakdowns.some((b) => Object.keys(b.breakdown).length > 0);
  if (!hasAnyGrains) return null;

  return (
    <HSCard shadow={2} accent={hsTokens.hops} padding={20}>
      <div style={{ paddingTop: 6 }}>
        <div style={sectionEyebrowStyle}>section</div>
        <h2 style={sectionTitleStyle}>Grain bill.</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        {breakdowns.map((b) => (
          <BarRow
            key={b.id}
            label={b.name}
            segments={GRAIN_CATEGORY_ORDER.map((cat) => ({
              cat,
              pct: b.breakdown[cat]?.pct ?? 0,
              weightKg: b.breakdown[cat]?.weightKg,
              grains: b.breakdown[cat]?.grains,
            }))}
          />
        ))}
        <BarRow
          label="Average"
          isAvg
          segments={GRAIN_CATEGORY_ORDER.map((cat) => ({
            cat,
            pct: avgBreakdown[cat] ?? 0,
          }))}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {allCategories.map((cat) => (
          <div
            key={cat}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: hsTokens.body,
              fontSize: 11,
              color: hsTokens.muted,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: 2,
                background: GRAIN_CATEGORY_COLORS[cat],
                border: `1px solid ${hsTokens.ink}`,
              }}
            />
            <span>{cat}</span>
          </div>
        ))}
      </div>
    </HSCard>
  );
}

interface BarSegment {
  cat: FermentableGroup;
  pct: number;
  weightKg?: number;
  grains?: { name: string; weightKg: number; pct: number }[];
}

function BarRow({
  label,
  segments,
  isAvg,
}: {
  label: string;
  segments: BarSegment[];
  isAvg?: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const visibleSegments = segments.filter((s) => s.pct >= 0.5);
  const hoveredSeg = hoveredIdx !== null ? visibleSegments[hoveredIdx] : null;

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    t.style.transform = `translate(${clientX}px, ${clientY - 14}px) translate(-50%, -100%) rotate(${rotation}deg)`;
  }

  function onBarMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove
      ? 0
      : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
      // Snap to cursor on first appearance — no transform transition from
      // the prior resting position (otherwise it shoots in from the
      // viewport origin where position: fixed parks it by default).
      t.style.transition = "none";
      applyTransform(e.clientX, e.clientY, 0);
      // Force a reflow so the no-transition snap applies before re-enabling.
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
      120,
    );
  }

  function onBarMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    setHoveredIdx(null);
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: isAvg ? hsTokens.display : hsTokens.body,
            fontSize: isAvg ? 14 : 12,
            fontWeight: 700,
            color: hsTokens.ink,
            maxWidth: 240,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontStyle: isAvg ? "italic" : "normal",
          }}
        >
          {label}
        </span>
      </div>
      <div
        onMouseMove={onBarMouseMove}
        onMouseLeave={onBarMouseLeave}
        style={{
          display: "flex",
          height: 18,
          width: "100%",
          overflow: "hidden",
          borderRadius: 4,
          border: `2px solid ${hsTokens.ink}`,
          background: hsTokens.cream2,
        }}
      >
        {visibleSegments.map((s, i) => (
          <div
            key={s.cat}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{
              width: `${s.pct}%`,
              background: GRAIN_CATEGORY_COLORS[s.cat],
              cursor: "default",
            }}
          />
        ))}
      </div>

      <div
        ref={tooltipRef}
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 100,
          transition: "opacity 140ms ease, transform 90ms ease-out",
          willChange: "transform, opacity",
        }}
      >
          {hoveredSeg ? (
            <div
              style={{
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 10,
                boxShadow: hsTokens.sh2,
                padding: "10px 14px",
                minWidth: 220,
                maxWidth: 320,
              }}
            >
              <HSScriptNote
                color={GRAIN_CATEGORY_COLORS[hoveredSeg.cat]}
                size={20}
              >
                {hoveredSeg.cat} —
              </HSScriptNote>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: hsTokens.body,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {hoveredSeg.pct.toFixed(1)}% of grain bill
                {hoveredSeg.weightKg !== undefined
                  ? ` · ${hoveredSeg.weightKg.toFixed(2)}kg`
                  : ""}
              </div>
              {hoveredSeg.grains && hoveredSeg.grains.length > 0 ? (
                <ul
                  style={{
                    margin: "10px 0 0",
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {hoveredSeg.grains.map((g) => (
                    <li
                      key={g.name}
                      style={{
                        fontFamily: hsTokens.body,
                        fontSize: 13,
                        color: hsTokens.ink,
                        fontVariantNumeric: "tabular-nums",
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {g.name}
                      </span>
                      <span style={{ color: hsTokens.muted, flexShrink: 0 }}>
                        {g.weightKg.toFixed(2)}kg · {g.pct.toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
      </div>
    </div>
  );
}

// ── Hops ────────────────────────────────────────────────────────────────

function HopBlock({ items }: { items: RecipeWithCalcs[] }) {
  const summaries = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    summary: getHopSummary(recipe),
  }));

  const allHopNames = Array.from(
    new Set(summaries.flatMap((s) => s.summary.hops.map((h) => h.name))),
  ).sort();

  if (allHopNames.length === 0) return null;

  return (
    <HSCard shadow={2} accent={hsTokens.hops} padding={20}>
      <div style={{ paddingTop: 6 }}>
        <div style={sectionEyebrowStyle}>section</div>
        <h2 style={sectionTitleStyle}>Hops.</h2>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ ...cellHeadStyle, textAlign: "left" }}>Hop</th>
              {summaries.map((s) => (
                <th
                  key={s.id}
                  style={{
                    ...cellHeadStyle,
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allHopNames.map((hopName) => (
              <tr key={hopName}>
                <td style={{ ...cellBodyStyle, textAlign: "left", fontWeight: 600 }}>{hopName}</td>
                {summaries.map((s) => {
                  const hop = s.summary.hops.find((h) => h.name === hopName);
                  return (
                    <td key={s.id} style={cellBodyStyle}>
                      {hop ? (
                        <span>
                          {hop.totalGrams.toFixed(0)}g
                          <span style={{ color: hsTokens.muted, marginLeft: 4, fontSize: 11 }}>
                            ({hop.avgAlphaAcid.toFixed(1)}% AA)
                          </span>
                        </span>
                      ) : (
                        <span style={{ color: hsTokens.muted }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td
                style={{
                  ...cellAvgStyle,
                  textAlign: "left",
                  fontFamily: hsTokens.display,
                  fontSize: 14,
                }}
              >
                Total
              </td>
              {summaries.map((s) => (
                <td key={s.id} style={cellAvgStyle}>
                  {s.summary.totalGrams.toFixed(0)}g
                </td>
              ))}
            </tr>
            <tr>
              <td
                style={{
                  ...cellAvgStyle,
                  textAlign: "left",
                  fontFamily: hsTokens.display,
                  fontSize: 14,
                }}
              >
                Rate
              </td>
              {summaries.map((s) => (
                <td key={s.id} style={cellAvgStyle}>
                  {s.summary.gramsPerLiter.toFixed(1)} g/L
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </HSCard>
  );
}

// ── Mash ────────────────────────────────────────────────────────────────

function MashBlock({ items }: { items: RecipeWithCalcs[] }) {
  const mashData = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    steps: recipe.mashSteps || [],
    weightedTemp: getWeightedMashTemp(recipe),
  }));

  const hasMash = mashData.some((m) => m.steps.length > 0);
  if (!hasMash) return null;

  const maxSteps = Math.max(...mashData.map((m) => m.steps.length));
  const temps = mashData.map((m) => m.weightedTemp).filter((t): t is number => t !== null);
  const avgTemp = temps.length > 0 ? avg(temps) : null;

  return (
    <HSCard shadow={2} accent={hsTokens.roast} padding={20}>
      <div style={{ paddingTop: 6 }}>
        <div style={sectionEyebrowStyle}>section</div>
        <h2 style={sectionTitleStyle}>Mash schedule.</h2>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ ...cellHeadStyle, textAlign: "left" }}>Step</th>
              {mashData.map((m) => (
                <th
                  key={m.id}
                  style={{
                    ...cellHeadStyle,
                    maxWidth: 140,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxSteps }).map((_, stepIdx) => (
              <tr key={stepIdx}>
                <td
                  style={{
                    ...cellBodyStyle,
                    textAlign: "left",
                    fontWeight: 600,
                    color: hsTokens.muted,
                  }}
                >
                  Step {stepIdx + 1}
                </td>
                {mashData.map((m) => {
                  const step = m.steps[stepIdx];
                  return (
                    <td key={m.id} style={cellBodyStyle}>
                      {step ? (
                        <>
                          <span style={{ fontWeight: 600 }}>{step.temperatureC}°C</span>
                          <span style={{ color: hsTokens.muted, marginLeft: 4, fontSize: 11 }}>
                            {step.durationMinutes}min
                          </span>
                          {step.name ? (
                            <div
                              style={{
                                fontSize: 11,
                                color: hsTokens.muted,
                                marginTop: 2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {step.name}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ color: hsTokens.muted }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td
                style={{
                  ...cellAvgStyle,
                  textAlign: "left",
                  fontFamily: hsTokens.display,
                  fontSize: 14,
                }}
              >
                Weighted avg
              </td>
              {mashData.map((m) => (
                <td key={m.id} style={cellAvgStyle}>
                  {m.weightedTemp != null ? `${m.weightedTemp.toFixed(1)}°C` : "—"}
                </td>
              ))}
            </tr>
            {avgTemp != null ? (
              <tr>
                <td
                  style={{
                    ...cellAvgStyle,
                    textAlign: "left",
                    fontFamily: hsTokens.display,
                    fontSize: 14,
                    background: `color-mix(in oklch, ${hsTokens.malt} 22%, transparent)`,
                  }}
                >
                  Overall avg
                </td>
                <td
                  colSpan={mashData.length}
                  style={{
                    ...cellAvgStyle,
                    background: `color-mix(in oklch, ${hsTokens.malt} 22%, transparent)`,
                  }}
                >
                  {avgTemp.toFixed(1)}°C
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </HSCard>
  );
}

// ── Water ───────────────────────────────────────────────────────────────

const IONS = ["Ca", "Mg", "Na", "Cl", "SO4", "HCO3"] as const;
const ION_LABELS: Record<(typeof IONS)[number], string> = {
  Ca: "Ca²⁺",
  Mg: "Mg²⁺",
  Na: "Na⁺",
  Cl: "Cl⁻",
  SO4: "SO₄²⁻",
  HCO3: "HCO₃⁻",
};

function WaterBlock({ items }: { items: RecipeWithCalcs[] }) {
  const waterData = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    profile: getEffectiveWaterProfile(recipe),
  }));

  const hasWater = waterData.some((w) => w.profile !== null);
  if (!hasWater) return null;

  const avgProfile = averageWaterProfiles(items.map((i) => i.recipe));

  return (
    <HSCard shadow={2} accent={hsTokens.water} padding={20}>
      <div style={{ paddingTop: 6 }}>
        <div style={sectionEyebrowStyle}>section</div>
        <h2 style={sectionTitleStyle}>Water chemistry.</h2>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr>
              <th style={{ ...cellHeadStyle, textAlign: "left" }}>Ion (ppm)</th>
              {waterData.map((w) => (
                <th
                  key={w.id}
                  style={{
                    ...cellHeadStyle,
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {w.name}
                </th>
              ))}
              <th style={cellHeadStyle}>Avg</th>
            </tr>
          </thead>
          <tbody>
            {IONS.map((ion) => (
              <tr key={ion}>
                <td style={{ ...cellBodyStyle, textAlign: "left", fontWeight: 600 }}>
                  {ION_LABELS[ion]}
                </td>
                {waterData.map((w) => (
                  <td key={w.id} style={cellBodyStyle}>
                    {w.profile ? Math.round(w.profile[ion]) : <span style={{ color: hsTokens.muted }}>—</span>}
                  </td>
                ))}
                <td style={{ ...cellBodyStyle, fontWeight: 700 }}>
                  {avgProfile ? Math.round(avgProfile[ion]) : "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td
                style={{
                  ...cellAvgStyle,
                  textAlign: "left",
                  fontFamily: hsTokens.display,
                  fontSize: 14,
                }}
              >
                Cl : SO₄
              </td>
              {waterData.map((w) => (
                <td key={w.id} style={cellAvgStyle}>
                  {w.profile && w.profile.SO4 > 0
                    ? (w.profile.Cl / w.profile.SO4).toFixed(2)
                    : "—"}
                </td>
              ))}
              <td style={cellAvgStyle}>
                {avgProfile && avgProfile.SO4 > 0
                  ? (avgProfile.Cl / avgProfile.SO4).toFixed(2)
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </HSCard>
  );
}
