"use client";

import { hsTokens } from "@/modules/hopskip/tokens";

export function MashContent() {
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
        Mash.
      </h3>
      <div
        style={{
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 10,
          boxShadow: "2px 2px 0 var(--hs-ink)",
          padding: "14px 16px",
          display: "flex",
          gap: 16,
        }}
      >
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
            Single infusion
          </div>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 22,
              color: hsTokens.ink,
              fontVariantNumeric: "tabular-nums",
              marginTop: 4,
            }}
          >
            152°F · 60 min
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
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
            Strike temp
          </div>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 22,
              color: hsTokens.ink,
              fontVariantNumeric: "tabular-nums",
              marginTop: 4,
            }}
          >
            162°F
          </div>
        </div>
      </div>
    </div>
  );
}
