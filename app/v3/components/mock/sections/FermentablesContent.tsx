"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { Highlight } from "../types";

// Fermentables section. Has ONE sub-bone:
//   - BillStackBone (the colored grain percentage bar)
//
// When highlight=fermentables, the BillStack lifts up + scales out.

interface Props {
  highlight: Highlight;
}

const GRAINS = [
  { name: "Pale 2-Row", category: "Base malt", amount: "9.0 lb", pct: 75, srm: 2.5 },
  { name: "Munich II", category: "Base malt", amount: "1.5 lb", pct: 12.5, srm: 9 },
  { name: "Caramel 40", category: "Crystal", amount: "1.5 lb", pct: 12.5, srm: 40 },
];

export function FermentablesContent(_props: Props) {
  return (
    <div
      style={{
        padding: "18px 20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            fontFamily: hsTokens.display,
            fontSize: 26,
            letterSpacing: "-0.03em",
            color: hsTokens.ink,
            margin: 0,
            lineHeight: 1,
          }}
        >
          Fermentables.
        </h3>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          3 in the bill · 12.0 lb
        </span>
      </div>

      {/* Bill stack bar — plain element, not a sub-bone for now. User
          flagged this as the wrong element to explode for Fermentables.
          We'll identify a better candidate (maybe the grain swatches,
          or the stats strip ticking as grains change) later. */}
      <div
        style={{
          height: 14,
          borderRadius: 4,
          border: `2px solid ${hsTokens.ink}`,
          display: "flex",
          overflow: "hidden",
          background: hsTokens.paper,
        }}
      >
        {GRAINS.map((g) => (
          <div
            key={g.name}
            style={{
              flex: g.pct,
              background: srmToRgb(g.srm),
              borderRight:
                g === GRAINS[GRAINS.length - 1]
                  ? "none"
                  : `1.5px solid ${hsTokens.ink}`,
            }}
            title={`${g.name} ${g.pct}%`}
          />
        ))}
      </div>

      {/* Grain rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {GRAINS.map((grain) => (
          <div
            key={grain.name}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 90px 50px",
              gap: 10,
              alignItems: "center",
              padding: "8px 12px",
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 10,
              boxShadow: "2px 2px 0 var(--hs-ink)",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 32,
                height: 32,
                background: srmToRgb(grain.srm),
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: hsTokens.mono,
                fontSize: 9,
                fontWeight: 700,
                color: grain.srm > 20 ? hsTokens.cream : hsTokens.ink,
              }}
            >
              {grain.srm}L
            </div>
            <div>
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  fontWeight: 700,
                  color: hsTokens.ink,
                }}
              >
                {grain.name}
              </div>
              <span
                style={{
                  display: "inline-block",
                  marginTop: 3,
                  padding: "2px 8px",
                  background: `color-mix(in oklch, ${hsTokens.malt} 30%, ${hsTokens.cream})`,
                  border: `1.5px solid ${hsTokens.ink}`,
                  borderRadius: 999,
                  fontFamily: hsTokens.body,
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: hsTokens.ink,
                }}
              >
                {grain.category}
              </span>
            </div>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 12,
                color: hsTokens.ink,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 8,
                padding: "5px 9px",
                background: hsTokens.cream,
              }}
            >
              {grain.amount}
            </div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontSize: 12,
                color: hsTokens.muted,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {grain.pct}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
