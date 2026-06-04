"use client";

import { hsTokens } from "@/modules/hopskip/tokens";

// Top toolbar + recipe title + style/batch/profile pills.
// Rendered inside MockCardChrome which fades + scales when a highlight
// is active.

export function MockHeader() {
  return (
    <div>
      {/* Top toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottom: `1.5px dashed color-mix(in oklch, ${hsTokens.ink} 20%, transparent)`,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          ← Back to recipes
        </span>
        <button
          type="button"
          style={{
            background: hsTokens.hops,
            color: hsTokens.cream,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 999,
            padding: "8px 16px",
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.06em",
            boxShadow: "2px 2px 0 var(--hs-ink)",
            cursor: "pointer",
          }}
        >
          Save recipe →
        </button>
      </div>

      {/* Title */}
      <h2
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(28px, 3.4vw, 40px)",
          letterSpacing: "-0.03em",
          color: hsTokens.ink,
          margin: "14px 0 10px",
          lineHeight: 0.95,
        }}
      >
        Citra Mosaic IPA
      </h2>

      {/* Meta pills row */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <PaperPill label="STYLE" value="American IPA · 21A ▾" color={hsTokens.malt} />
        <PaperPill label="BATCH" value="5 gal · 60 min ▾" color={hsTokens.water} />
        <PaperPill label="" value="Profile · BIAB ▾" color={hsTokens.roast} />
        <GhostPill>Advanced</GhostPill>
      </div>
    </div>
  );
}

function PaperPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px 8px 10px",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        fontFamily: hsTokens.body,
        fontSize: 12,
        color: hsTokens.muted,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          background: color,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      {label ? (
        <span
          style={{
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontSize: 9,
          }}
        >
          {label}
        </span>
      ) : null}
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 13,
          color: hsTokens.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </span>
  );
}

function GhostPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 14px",
        background: "transparent",
        border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 30%, transparent)`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: hsTokens.muted,
      }}
    >
      {children}
    </span>
  );
}
