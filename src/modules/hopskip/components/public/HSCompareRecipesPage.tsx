"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

import type { Recipe } from "@/modules/beta-builder/domain/models/Recipe";
import { RecipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import {
  type RecipeWithCalcs,
  type FermentableGroup,
  avg,
  categorizeRecipeFermentable,
  getGrainBreakdown,
  getHopSummary,
  getWeightedMashTemp,
  getEffectiveWaterProfile,
  averageWaterProfiles,
  normalizeGrainName,
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

/** BU/GU = IBU divided by gravity units, where GU = (OG - 1) * 1000.
 *  Brewing rule of thumb: <0.5 malty, ~0.5–0.75 balanced, >0.75 hoppy. */
function buGu(ibu: number, og: number): number {
  const gu = (og - 1) * 1000;
  if (gu <= 0) return 0;
  return ibu / gu;
}

/** BJCP BU/GU range from the style's IBU and OG specs. Spans the corners
 *  (low-IBU/high-GU → high-IBU/low-GU) so it tracks the widest plausible
 *  balance window for the style. */
function bjcpBuGuRange(
  ibu: RangeTuple | undefined,
  og: RangeTuple | undefined,
): RangeTuple | undefined {
  if (!ibu || !og) return undefined;
  const guLo = (og[0] - 1) * 1000;
  const guHi = (og[1] - 1) * 1000;
  if (guLo <= 0 || guHi <= 0) return undefined;
  return [ibu[0] / guHi, ibu[1] / guLo];
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
  // Per-recipe BU/GU then averaged — averaging the ratio rather than ratio-of-
  // averages is the brewing-textbook reading (each recipe sits at its own
  // balance point; the avg is what those points cluster around).
  const avgBuGu = avg(calcs.map((c) => buGu(c.ibu, c.og)));

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
              <th style={cellHeadStyle} title="IBU divided by gravity units. <0.5 malty · 0.5–0.75 balanced · >0.75 hoppy">BU/GU</th>
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
                  <td style={cellBodyStyle}>{buGu(c.ibu, c.og).toFixed(2)}</td>
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
              <td style={cellAvgStyle}>{avgBuGu.toFixed(2)}</td>
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
                  {formatRange(bjcpBuGuRange(bjcpInfo.spec.ibu, bjcpInfo.spec.og), 2)}
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

interface GrainSegment {
  id: string;
  name: string;
  shortName: string;
  weightKg: number;
  pct: number;
  srmColor: string;
  category: FermentableGroup;
  colorLovibond: number;
  ppg: number;
}

/** Strips maltster prefixes ("Crisp Malting - …") and trims to first 2 words
 *  for in-bar / chip labels. Mirrors FermentableSection's shortName. */
function shortGrainName(full: string): string {
  const tail = full.includes(" - ")
    ? full.split(" - ").slice(-1)[0].trim()
    : full;
  return tail.split(" ").slice(0, 2).join(" ");
}

function buildGrainSegments(recipe: Recipe): GrainSegment[] {
  const totalKg = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
  if (totalKg === 0) return [];
  return recipe.fermentables
    .map((f) => ({
      id: f.id,
      name: f.name,
      shortName: shortGrainName(f.name),
      weightKg: f.weightKg,
      pct: (f.weightKg / totalKg) * 100,
      srmColor: srmToRgb(f.colorLovibond),
      category: categorizeRecipeFermentable(f),
      colorLovibond: f.colorLovibond,
      ppg: f.ppg,
    }))
    // Order: light → dark by category, then biggest weight within category.
    // Lines grains up across recipes for at-a-glance comparison.
    .sort((a, b) => {
      const ca = GRAIN_CATEGORY_ORDER.indexOf(a.category);
      const cb = GRAIN_CATEGORY_ORDER.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return b.weightKg - a.weightKg;
    });
}

function GrainBlock({ items }: { items: RecipeWithCalcs[] }) {
  const perRecipe = items.map(({ recipe }) => ({
    id: recipe.id,
    name: recipe.name,
    grains: buildGrainSegments(recipe),
    totalKg: recipe.fermentables.reduce((s, f) => s + f.weightKg, 0),
  }));

  // Avg bar still aggregates by category — that's the cross-recipe insight,
  // not a per-grain claim. The detail per category (which grains contribute,
  // averaged, and in how many recipes) powers the avg hover tooltip.
  const breakdowns = items.map(({ recipe }) => getGrainBreakdown(recipe));
  const allCategories = GRAIN_CATEGORY_ORDER.filter((cat) =>
    breakdowns.some((b) => b[cat]),
  );
  const recipeCount = items.length;
  const avgDetail: Partial<Record<FermentableGroup, AvgCategoryDetail>> = {};
  for (const cat of allCategories) {
    const avgPct = avg(breakdowns.map((b) => b[cat]?.pct ?? 0));
    const grainCounts: Record<string, { count: number; pctSum: number }> = {};
    for (const b of breakdowns) {
      const entry = b[cat];
      if (!entry) continue;
      // Merge by normalized name so "Crisp - Maris Otter" and "Thomas Fawcett -
      // Maris Otter" count as the same grain across recipes.
      const merged: Record<string, number> = {};
      for (const g of entry.grains) {
        const norm = normalizeGrainName(g.name);
        merged[norm] = (merged[norm] || 0) + g.pct;
      }
      for (const [name, pct] of Object.entries(merged)) {
        if (!grainCounts[name]) grainCounts[name] = { count: 0, pctSum: 0 };
        grainCounts[name].count += 1;
        grainCounts[name].pctSum += pct;
      }
    }
    const grains = Object.entries(grainCounts)
      .map(([name, d]) => ({
        name,
        avgPct: d.pctSum / recipeCount,
        count: d.count,
      }))
      .sort((a, b) => b.avgPct - a.avgPct);
    avgDetail[cat] = { avgPct, grains };
  }

  const hasAnyGrains = perRecipe.some((r) => r.grains.length > 0);
  if (!hasAnyGrains) return null;

  return (
    <HSCard shadow={2} accent={hsTokens.hops} padding={20}>
      <div style={{ paddingTop: 6 }}>
        <div style={sectionEyebrowStyle}>section</div>
        <h2 style={sectionTitleStyle}>Grain bill.</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 20 }}>
        {perRecipe.map((r) => (
          <RecipeGrainRow
            key={r.id}
            name={r.name}
            grains={r.grains}
            totalKg={r.totalKg}
          />
        ))}
        <AvgCategoryBar
          segments={GRAIN_CATEGORY_ORDER.map((cat) => ({
            cat,
            pct: avgDetail[cat]?.avgPct ?? 0,
            detail: avgDetail[cat],
          }))}
          recipeCount={recipeCount}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          paddingTop: 12,
          borderTop: `1px dashed color-mix(in oklch, ${hsTokens.ink} 18%, transparent)`,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          Avg bar key
        </span>
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

// ── Hover-intent helper for anchored grain-bar tooltips ───────────────

interface UseHoverIntentResult {
  hoveredIdx: number | null;
  setHoveredIdx: (idx: number | null) => void;
  tooltipVisible: boolean;
  /** Absolute clientX of the cursor — pass straight to position:fixed transforms. */
  clientX: number;
  /** Absolute viewport-Y of the bar's top edge — tooltip's bottom should sit at this row. */
  barTop: number;
  /** Tilt in degrees, derived from cursor velocity. */
  tilt: number;
  barRef: React.RefObject<HTMLDivElement | null>;
  onBarMouseEnter: () => void;
  onBarMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onBarMouseLeave: () => void;
}

/**
 * Hover-intent + cursor-tracking + velocity-driven tilt for the anchored
 * grain-bar tooltips. Mirrors FermentableSection's BillStack: ~300ms dwell
 * before the card surfaces (filters quick sweeps), ~350ms cooldown before
 * dismissal (re-entry cancels), cursor absolute coords + bar.top exposed so
 * consumers can portal the tooltip outside the (overflow:hidden) HSCard,
 * and a small ±10° tilt driven by cursor dx so the card swings playfully
 * while moving.
 */
function useHoverIntent(): UseHoverIntentResult {
  const SHOW_DELAY_MS = 300;
  const HIDE_COOLDOWN_MS = 350;

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [clientX, setClientX] = useState(0);
  const [barTop, setBarTop] = useState(0);
  const [tilt, setTilt] = useState(0);

  const barRef = useRef<HTMLDivElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const tiltRestTimerRef = useRef<number | null>(null);
  const lastClientXRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
      if (tiltRestTimerRef.current !== null) window.clearTimeout(tiltRestTimerRef.current);
    };
  }, []);

  function armShowTimer() {
    if (showTimerRef.current !== null) window.clearTimeout(showTimerRef.current);
    showTimerRef.current = window.setTimeout(() => {
      setTooltipVisible(true);
      showTimerRef.current = null;
    }, SHOW_DELAY_MS);
  }

  function onBarMouseEnter() {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (!tooltipVisible) armShowTimer();
  }

  function onBarMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    setClientX(e.clientX);
    setBarTop(rect.top);

    const last = lastClientXRef.current;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    // Negative sign → card tilts AWAY from motion direction (lags the cursor).
    const rotation = Math.max(-10, Math.min(10, -dx * 0.35));
    setTilt(rotation);

    if (tiltRestTimerRef.current !== null) {
      window.clearTimeout(tiltRestTimerRef.current);
    }
    tiltRestTimerRef.current = window.setTimeout(() => setTilt(0), 120);

    // Every mousemove re-arms the dwell timer — tooltip only surfaces once
    // the cursor has been still for SHOW_DELAY_MS continuously.
    if (!tooltipVisible) armShowTimer();
  }

  function onBarMouseLeave() {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    setTilt(0);
    lastClientXRef.current = null;
    if (tiltRestTimerRef.current !== null) {
      window.clearTimeout(tiltRestTimerRef.current);
      tiltRestTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setTooltipVisible(false);
      setHoveredIdx(null);
      hideTimerRef.current = null;
    }, HIDE_COOLDOWN_MS);
  }

  return {
    hoveredIdx,
    setHoveredIdx,
    tooltipVisible,
    clientX,
    barTop,
    tilt,
    barRef,
    onBarMouseEnter,
    onBarMouseMove,
    onBarMouseLeave,
  };
}

// ── Per-recipe row: SRM-colored individual grain segments + chip list ──

/** Minimum share a hovered segment claims so its in-bar label can surface.
 *  Mirrors the same idea in FermentableSection's BillStack (HOVER_REVEAL_PCT). */
const HOVER_REVEAL_PCT = 22;

function RecipeGrainRow({
  name,
  grains,
  totalKg,
}: {
  name: string;
  grains: GrainSegment[];
  totalKg: number;
}) {
  const {
    hoveredIdx,
    setHoveredIdx,
    tooltipVisible,
    clientX,
    barTop,
    tilt,
    barRef,
    onBarMouseEnter,
    onBarMouseMove,
    onBarMouseLeave,
  } = useHoverIntent();

  const hovered = hoveredIdx !== null ? grains[hoveredIdx] : null;

  // Expand the hovered slice to HOVER_REVEAL_PCT so its label can surface,
  // while siblings shrink proportionally — same trick as FermentableSection.
  const displayPcts = useMemo<number[]>(() => {
    const original = grains.map((g) => g.pct);
    if (hoveredIdx === null) return original;
    const h = grains[hoveredIdx];
    if (!h || h.pct >= HOVER_REVEAL_PCT) return original;
    const reveal = HOVER_REVEAL_PCT;
    const othersTotal = original.reduce(
      (s, p, i) => (i === hoveredIdx ? s : s + p),
      0,
    );
    if (othersTotal <= 0) {
      return original.map((_, i) => (i === hoveredIdx ? 100 : 0));
    }
    const scale = (100 - reveal) / othersTotal;
    return original.map((p, i) => (i === hoveredIdx ? reveal : p * scale));
  }, [grains, hoveredIdx]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 5,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 13,
            fontWeight: 700,
            color: hsTokens.ink,
            maxWidth: "65%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 11,
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {totalKg.toFixed(2)} kg · {grains.length} grain{grains.length === 1 ? "" : "s"}
        </span>
      </div>
      {/* Presentational bill bar — hover drives the dwell tooltip; segments
          aren't clickable, so no interactive role applies. The tooltip is
          portaled to document.body (below) so HSCard's overflow:hidden
          can't clip the card or its connector line. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={barRef}
        onMouseEnter={onBarMouseEnter}
        onMouseMove={onBarMouseMove}
        onMouseLeave={onBarMouseLeave}
        style={{
          display: "flex",
          height: 42,
          width: "100%",
          overflow: "hidden",
          borderRadius: 6,
          border: `2px solid ${hsTokens.ink}`,
          background: hsTokens.cream2,
          boxShadow: hsTokens.sh1,
        }}
      >
        {grains.map((g, i) => {
          const isHovered = i === hoveredIdx;
          const dark = g.colorLovibond > 25;
          const showName = isHovered || g.pct >= 12;
          const showPct = isHovered || g.pct >= 6;
          const width = `${displayPcts[i]}%`;
          // Divider rule: ink 1.5px by default — it reads cleanly against
          // the light SRM fills. SWITCH to a thin (1px) light cream stroke
          // ONLY when both adjacent malts are dark — ink-on-dark blends a
          // pale-chocolate / black-malt / black-barley stack into one blob.
          // Light-and-light or mixed pairs keep the dark ink stroke.
          const next = grains[i + 1];
          const bothDark = dark && Boolean(next && next.colorLovibond > 25);
          const dividerStroke = bothDark
            ? `1px solid color-mix(in oklch, ${hsTokens.paper} 88%, ${hsTokens.ink})`
            : `1.5px solid ${hsTokens.ink}`;
          return (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              key={g.id}
              onMouseEnter={() => setHoveredIdx(i)}
              style={{
                width,
                background: g.srmColor,
                borderRight: i < grains.length - 1 ? dividerStroke : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2px 4px",
                boxSizing: "border-box",
                minWidth: 0,
                overflow: "hidden",
                cursor: "default",
                transition: "width 180ms ease",
              }}
            >
              {showPct ? (
                <span
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 13,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    color: dark ? "#fff" : hsTokens.ink,
                    pointerEvents: "none",
                  }}
                >
                  {Math.round(g.pct)}%
                </span>
              ) : null}
              {showName ? (
                <span
                  style={{
                    fontFamily: hsTokens.body,
                    fontWeight: 700,
                    fontSize: 9,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginTop: 2,
                    color: dark ? "#fff" : hsTokens.ink,
                    opacity: 0.92,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                    pointerEvents: "none",
                  }}
                >
                  {g.shortName}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Portaled tooltip: position:fixed at (clientX, barTop), translated
          by (-50%, -100%) so its bottom-center sits on the bar's top edge.
          Portal escapes HSCard's overflow:hidden. */}
      {typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden
              // .hs-theme is the scope that defines --hs-paper, --hs-ink, etc.
              // Without it, the portal lands in document.body where those CSS
              // custom properties don't exist and the card renders bare.
              // Override `.hs-theme`'s own `background: var(--hs-cream)` since
              // this wrapper is just a position anchor — the visible card
              // inside has its own background.
              className="hs-theme"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                pointerEvents: "none",
                zIndex: 100,
                opacity: tooltipVisible && hovered ? 1 : 0,
                transform: `translate(${clientX}px, ${barTop}px) translate(-50%, -100%)`,
                transition: "opacity 200ms ease, transform 90ms ease-out",
                willChange: "transform, opacity",
                background: "transparent",
              }}
            >
              {hovered ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      background: hsTokens.paper,
                      border: `2px solid ${hsTokens.ink}`,
                      borderRadius: 10,
                      boxShadow: hsTokens.sh2,
                      padding: "10px 14px",
                      minWidth: 220,
                      maxWidth: 320,
                      transform: `rotate(${tilt}deg)`,
                      transformOrigin: "bottom center",
                      transition: "transform 220ms cubic-bezier(.34, 1.56, .64, 1)",
                    }}
                  >
                    <HSScriptNote color={hovered.srmColor} size={20}>
                      {hovered.category} —
                    </HSScriptNote>
                    <div
                      style={{
                        marginTop: 2,
                        fontFamily: hsTokens.body,
                        fontSize: 14,
                        fontWeight: 700,
                        color: hsTokens.ink,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {hovered.name}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        fontFamily: hsTokens.body,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: hsTokens.muted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {hovered.pct.toFixed(1)}% of bill · {hovered.weightKg.toFixed(2)} kg
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontFamily: hsTokens.mono,
                        fontSize: 11,
                        color: hsTokens.muted,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {hovered.colorLovibond}°L · {hovered.ppg} PPG ·{" "}
                      {(hovered.colorLovibond * 1.97).toFixed(1)} EBC
                    </div>
                  </div>
                  <div
                    aria-hidden
                    style={{
                      width: 2,
                      height: 12,
                      background: hsTokens.ink,
                    }}
                  />
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {/* Readable chip list: every grain visible without hovering. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 8,
        }}
      >
        {grains.map((g) => (
          <span
            key={g.id}
            title={`${g.name} · ${g.colorLovibond}°L · ${g.ppg} PPG`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 8px 3px 5px",
              borderRadius: 999,
              background: hsTokens.paper,
              border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 35%, transparent)`,
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: 600,
              color: hsTokens.ink,
              maxWidth: 280,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 11,
                height: 11,
                borderRadius: 3,
                background: g.srmColor,
                border: `1px solid ${hsTokens.ink}`,
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
              {g.name}
            </span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                color: hsTokens.muted,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {g.pct.toFixed(1)}% · {g.weightKg.toFixed(2)}kg
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Average row: category-aggregated bar with rich hover tooltip ───────

interface AvgCategoryDetail {
  avgPct: number;
  grains: { name: string; avgPct: number; count: number }[];
}

interface AvgSegment {
  cat: FermentableGroup;
  pct: number;
  detail?: AvgCategoryDetail;
}

function AvgCategoryBar({
  segments,
  recipeCount,
}: {
  segments: AvgSegment[];
  recipeCount: number;
}) {
  const visible = segments.filter((s) => s.pct >= 0.5);
  const {
    hoveredIdx,
    setHoveredIdx,
    tooltipVisible,
    clientX,
    barTop,
    tilt,
    barRef,
    onBarMouseEnter,
    onBarMouseMove,
    onBarMouseLeave,
  } = useHoverIntent();

  const hovered = hoveredIdx !== null ? visible[hoveredIdx] : null;

  // Avg bar uses category palette (only "Roasted" is truly dark, and there's
  // only ever one of each category per bar), so dark-on-dark stacking can't
  // happen here — ink dividers at 1.5px match the recipe bars' light-pair
  // styling.
  const dividerStroke = `1.5px solid ${hsTokens.ink}`;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 14,
            fontWeight: 700,
            fontStyle: "italic",
            color: hsTokens.ink,
          }}
        >
          Average
        </span>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          By category · across {recipeCount} recipes
        </span>
      </div>
      {/* Presentational avg bar — hover drives the dwell tooltip; segments
          aren't interactive. Tooltip is portaled (below) to escape HSCard
          overflow:hidden. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={barRef}
        onMouseEnter={onBarMouseEnter}
        onMouseMove={onBarMouseMove}
        onMouseLeave={onBarMouseLeave}
        style={{
          display: "flex",
          height: 22,
          width: "100%",
          overflow: "hidden",
          borderRadius: 4,
          border: `2px solid ${hsTokens.ink}`,
          background: hsTokens.cream2,
        }}
      >
        {visible.map((s, i) => (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div
            key={s.cat}
            onMouseEnter={() => setHoveredIdx(i)}
            style={{
              width: `${s.pct}%`,
              background: GRAIN_CATEGORY_COLORS[s.cat],
              borderRight: i < visible.length - 1 ? dividerStroke : "none",
              cursor: "default",
            }}
          />
        ))}
      </div>

      {/* Portaled tooltip: matches the recipe bars' pattern but rendered to
          document.body so HSCard's overflow:hidden can't clip the card. */}
      {typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden
              // .hs-theme is the scope that defines --hs-paper, --hs-ink, etc.
              // Without it, the portal lands in document.body where those CSS
              // custom properties don't exist and the card renders bare.
              // Override `.hs-theme`'s own `background: var(--hs-cream)` since
              // this wrapper is just a position anchor — the visible card
              // inside has its own background.
              className="hs-theme"
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                pointerEvents: "none",
                zIndex: 100,
                opacity: tooltipVisible && hovered ? 1 : 0,
                transform: `translate(${clientX}px, ${barTop}px) translate(-50%, -100%)`,
                transition: "opacity 200ms ease, transform 90ms ease-out",
                willChange: "transform, opacity",
                background: "transparent",
              }}
            >
              {hovered ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      background: hsTokens.paper,
                      border: `2px solid ${hsTokens.ink}`,
                      borderRadius: 10,
                      boxShadow: hsTokens.sh2,
                      padding: "10px 14px",
                      minWidth: 240,
                      maxWidth: 340,
                      transform: `rotate(${tilt}deg)`,
                      transformOrigin: "bottom center",
                      transition: "transform 220ms cubic-bezier(.34, 1.56, .64, 1)",
                    }}
                  >
                    <HSScriptNote color={GRAIN_CATEGORY_COLORS[hovered.cat]} size={20}>
                      {hovered.cat} —
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
                      {hovered.pct.toFixed(1)}% avg of grain bill
                    </div>
                    {hovered.detail && hovered.detail.grains.length > 0 ? (
                      <ul
                        style={{
                          margin: "10px 0 0",
                          padding: 0,
                          listStyle: "none",
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                        }}
                      >
                        {hovered.detail.grains.map((g) => (
                          <li
                            key={g.name}
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              justifyContent: "space-between",
                              gap: 12,
                              fontFamily: hsTokens.body,
                              fontSize: 13,
                              color: hsTokens.ink,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: 600,
                              }}
                            >
                              {g.name}
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontFamily: hsTokens.mono,
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: hsTokens.muted,
                                }}
                              >
                                {g.count}/{recipeCount}
                              </span>
                            </span>
                            <span
                              style={{
                                color: hsTokens.muted,
                                flexShrink: 0,
                                fontFamily: hsTokens.mono,
                                fontSize: 11,
                              }}
                            >
                              {g.avgPct.toFixed(1)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div
                    aria-hidden
                    style={{
                      width: 2,
                      height: 12,
                      background: hsTokens.ink,
                    }}
                  />
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
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
