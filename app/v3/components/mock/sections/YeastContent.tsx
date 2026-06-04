"use client";

import { hsTokens } from "@/modules/hopskip/tokens";

export function YeastContent() {
  return (
    <div
      style={{
        padding: "18px 20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 14,
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
        Yeast.
      </h3>
      <div
        style={{
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 10,
          boxShadow: "2px 2px 0 var(--hs-ink)",
          padding: "14px 16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 20,
              color: hsTokens.ink,
              letterSpacing: "-0.02em",
            }}
          >
            US-05 · Dry
          </span>
          <span
            style={{
              padding: "3px 10px",
              background: `color-mix(in oklch, ${hsTokens.yeast} 30%, ${hsTokens.cream})`,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 999,
              fontFamily: hsTokens.body,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            American Ale
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
            fontFamily: hsTokens.body,
            fontSize: 11,
          }}
        >
          <Stat label="Pitch" value="1.0 pkg" />
          <Stat label="Pitch temp" value="68°F" />
          <Stat label="Ferment temp" value="66–72°F" />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 13,
          color: hsTokens.ink,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}
