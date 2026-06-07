"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

// Small-scale faithful mirror of the real compare page,
// src/modules/hopskip/components/public/HSCompareRecipesPage.tsx.
// Renders the page as ONE framed paper card (header → pill row → section
// stack), not multiple stacked HSCards — keeps the mock reading as a single
// captured page. Inner sections share the card and are separated by dashed
// rules + left accent rails (in lieu of each section having its own card).
// No interactivity, no calc logic — purely presentational. The calling
// stage wraps the whole panel in `data-v4-reveal` for the post-tour batch
// fade-in.

type Vitals = {
  abv: number;
  og: number;
  fg: number;
  ibu: number;
  srm: number;
};

type GrainSeg = {
  name: string;
  pct: number;
  srm: number;
};

const RECIPES = [
  { id: "a", name: "Backyard IPA", style: "American IPA" },
  { id: "b", name: "Sunday Pale", style: "American Pale" },
] as const;

const VITALS: Vitals[] = [
  { abv: 6.4, og: 1.062, fg: 1.013, ibu: 44, srm: 5 },
  { abv: 5.2, og: 1.05, fg: 1.011, ibu: 32, srm: 7 },
];

const GRAINS: GrainSeg[][] = [
  [
    { name: "2-row", pct: 78, srm: 2 },
    { name: "Munich", pct: 12, srm: 9 },
    { name: "Oats", pct: 10, srm: 2 },
  ],
  [
    { name: "Maris Otter", pct: 82, srm: 3 },
    { name: "Crystal 40", pct: 10, srm: 40 },
    { name: "Munich", pct: 8, srm: 9 },
  ],
];

const GRAIN_TOTALS_KG = [4.85, 4.2];

// ── Cell styles (mirror HSCompareRecipesPage, downscaled) ───────────────

const cellHeadStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 8,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: hsTokens.muted,
  padding: "4px 6px",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const cellBodyStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 10,
  fontVariantNumeric: "tabular-nums",
  color: hsTokens.ink,
  padding: "5px 6px",
  textAlign: "right",
  borderTop: `1px dashed color-mix(in oklch, ${hsTokens.ink} 18%, transparent)`,
};

const cellAvgStyle: React.CSSProperties = {
  ...cellBodyStyle,
  fontWeight: 700,
  background: `color-mix(in oklch, ${hsTokens.malt} 14%, transparent)`,
};

// ── Component ────────────────────────────────────────────────────────────

export default function CompareMockV4() {
  return (
    <div
      style={{
        background: hsTokens.paper,
        border: `2px solid var(--hs-ink)`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        padding: "14px 16px 16px",
        fontFamily: hsTokens.body,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <PageHeader />
      <PillRow />
      <Section accent={hsTokens.malt} eyebrow="section" title="Vitals">
        <VitalsTable />
      </Section>
      <Divider />
      <Section accent={hsTokens.hops} eyebrow="section" title="Grain bill.">
        <GrainBars />
      </Section>
    </div>
  );
}

function PageHeader() {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontFamily: hsTokens.script,
          fontSize: 13,
          lineHeight: 1,
          color: hsTokens.water,
          transform: "rotate(-3deg)",
          transformOrigin: "left bottom",
          marginBottom: 2,
        }}
      >
        side by side —
      </div>
      <h3
        style={{
          margin: "2px 0 0",
          fontFamily: hsTokens.display,
          fontSize: 22,
          letterSpacing: "-0.035em",
          lineHeight: 0.95,
          color: hsTokens.ink,
        }}
      >
        Compare recipes.
      </h3>
      <p
        style={{
          margin: "5px 0 0",
          fontFamily: hsTokens.body,
          fontSize: 10,
          color: hsTokens.muted,
          lineHeight: 1.4,
        }}
      >
        2 recipes — vitals, grains, hops, mash, water side-by-side.
      </p>
    </div>
  );
}

function PillRow() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginBottom: 12,
      }}
    >
      {RECIPES.map((r, i) => {
        const color = srmToRgb(VITALS[i].srm);
        return (
          <div
            key={r.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: 999,
              background: hsTokens.cream2,
              border: `1.5px solid ${hsTokens.ink}`,
              fontFamily: hsTokens.body,
              fontSize: 10,
              fontWeight: 700,
              color: hsTokens.ink,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                border: `1px solid ${hsTokens.ink}`,
                flexShrink: 0,
              }}
            />
            <span>{r.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function Section({
  accent,
  eyebrow,
  title,
  children,
}: {
  accent: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: 3,
          flexShrink: 0,
          borderRadius: 2,
          background: accent,
          alignSelf: "stretch",
        }}
      />
      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <div
          style={{
            fontFamily: hsTokens.body,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            marginBottom: 1,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            margin: "0 0 8px",
            fontFamily: hsTokens.display,
            fontSize: 16,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: hsTokens.ink,
          }}
        >
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        borderTop: `1px dashed color-mix(in oklch, ${hsTokens.ink} 22%, transparent)`,
        margin: "10px 0",
      }}
    />
  );
}

// ── Vitals table ────────────────────────────────────────────────────────

function VitalsTable() {
  const avgAbv = (VITALS[0].abv + VITALS[1].abv) / 2;
  const avgOg = (VITALS[0].og + VITALS[1].og) / 2;
  const avgFg = (VITALS[0].fg + VITALS[1].fg) / 2;
  const avgIbu = (VITALS[0].ibu + VITALS[1].ibu) / 2;
  const avgSrm = (VITALS[0].srm + VITALS[1].srm) / 2;

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
      }}
    >
      <colgroup>
        <col style={{ width: "34%" }} />
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th style={{ ...cellHeadStyle, textAlign: "left" }}>Recipe</th>
          <th style={cellHeadStyle}>ABV</th>
          <th style={cellHeadStyle}>OG</th>
          <th style={cellHeadStyle}>FG</th>
          <th style={cellHeadStyle}>IBU</th>
          <th style={cellHeadStyle}>SRM</th>
        </tr>
      </thead>
      <tbody>
        {RECIPES.map((r, i) => {
          const v = VITALS[i];
          const srmColor = srmToRgb(v.srm);
          return (
            <tr key={r.id}>
              <td
                style={{
                  ...cellBodyStyle,
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 10 }}>{r.name}</div>
                <div
                  style={{
                    fontSize: 8,
                    color: hsTokens.muted,
                    fontStyle: "italic",
                    marginTop: 1,
                  }}
                >
                  {r.style}
                </div>
              </td>
              <td style={cellBodyStyle}>{v.abv.toFixed(1)}%</td>
              <td style={cellBodyStyle}>{v.og.toFixed(3)}</td>
              <td style={cellBodyStyle}>{v.fg.toFixed(3)}</td>
              <td style={cellBodyStyle}>{v.ibu}</td>
              <td style={cellBodyStyle}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: srmColor,
                      border: `1px solid ${hsTokens.ink}`,
                    }}
                  />
                  {v.srm}
                </span>
              </td>
            </tr>
          );
        })}
        <tr>
          <td
            style={{
              ...cellAvgStyle,
              textAlign: "left",
              fontFamily: hsTokens.display,
              fontSize: 11,
            }}
          >
            Average
          </td>
          <td style={cellAvgStyle}>{avgAbv.toFixed(1)}%</td>
          <td style={cellAvgStyle}>{avgOg.toFixed(3)}</td>
          <td style={cellAvgStyle}>{avgFg.toFixed(3)}</td>
          <td style={cellAvgStyle}>{Math.round(avgIbu)}</td>
          <td style={cellAvgStyle}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: srmToRgb(avgSrm),
                  border: `1px solid ${hsTokens.ink}`,
                }}
              />
              {Math.round(avgSrm)}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Grain bill — per-recipe stacked SRM bars ────────────────────────────

function GrainBars() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {RECIPES.map((r, i) => (
        <GrainRow
          key={r.id}
          name={r.name}
          grains={GRAINS[i]}
          totalKg={GRAIN_TOTALS_KG[i]}
        />
      ))}
    </div>
  );
}

function GrainRow({
  name,
  grains,
  totalKg,
}: {
  name: string;
  grains: GrainSeg[];
  totalKg: number;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 3,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
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
            fontSize: 8,
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {totalKg.toFixed(2)} kg · {grains.length} grains
        </span>
      </div>
      <div
        style={{
          display: "flex",
          height: 22,
          width: "100%",
          overflow: "hidden",
          borderRadius: 4,
          border: `1.5px solid ${hsTokens.ink}`,
          background: hsTokens.cream2,
          boxShadow: hsTokens.sh1,
        }}
      >
        {grains.map((g, i) => {
          const dark = g.srm > 25;
          const showPct = g.pct >= 8;
          const showName = g.pct >= 18;
          return (
            <div
              key={g.name}
              style={{
                width: `${g.pct}%`,
                background: srmToRgb(g.srm),
                borderRight:
                  i < grains.length - 1 ? `1.5px solid ${hsTokens.ink}` : "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "1px 2px",
                boxSizing: "border-box",
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              {showPct ? (
                <span
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 9,
                    letterSpacing: "-0.02em",
                    lineHeight: 1,
                    color: dark ? "#fff" : hsTokens.ink,
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
                    fontSize: 6,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginTop: 1,
                    color: dark ? "#fff" : hsTokens.ink,
                    opacity: 0.92,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {g.name}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
