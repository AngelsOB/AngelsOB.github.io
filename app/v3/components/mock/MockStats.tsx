"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

// The OG / FG / ABV / IBU / CAL / SRM strip. Inputs to the recipe; one of
// the strongest visual signatures of the mock builder.

interface Stat {
  label: string;
  value: string;
}

const STATS: Stat[] = [
  { label: "OG", value: "1.062" },
  { label: "FG", value: "1.012" },
  { label: "ABV", value: "6.6%" },
  { label: "IBU", value: "52" },
  { label: "CAL", value: "198" },
];

export function MockStats() {
  const srm = 6.2;
  const srmColor = srmToRgb(srm);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto",
        gap: 8,
        marginTop: 14,
      }}
    >
      {STATS.map((s) => (
        <StatCell key={s.label} {...s} />
      ))}
      <SrmCell srm={srm} color={srmColor} />
    </div>
  );
}

function StatCell({ label, value }: Stat) {
  return (
    <div
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 8,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        padding: "10px 12px 12px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 24,
          letterSpacing: "-0.03em",
          color: hsTokens.ink,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SrmCell({ srm, color }: { srm: number; color: string }) {
  return (
    <div
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 8,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        padding: "10px 14px 12px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        SRM
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginTop: 2,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            background: color,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 3,
          }}
        />
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 24,
            letterSpacing: "-0.03em",
            color: hsTokens.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {srm}
        </span>
      </div>
    </div>
  );
}
