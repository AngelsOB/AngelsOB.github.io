"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { STAGES } from "../data";

// Left-column text blocks for the Phase 0 spike (Hero intro + Hops +
// Brewsheet). Pure scrolling DOM. The Brewsheet block is the one GSAP
// hard-pins; HomeV4 targets these via the `data-v4-stage` attribute.
//
// Text reveals here are intentionally plain in Phase 0 — SplitText reveals
// are Phase 4. The point of the spike is the mock choreography + the pin.

const eyebrowStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: hsTokens.hops,
  margin: 0,
};

const leadStyle: React.CSSProperties = {
  fontFamily: hsTokens.display,
  fontSize: "clamp(28px, 3.2vw, 44px)",
  lineHeight: 1.04,
  letterSpacing: "-0.03em",
  color: hsTokens.ink,
  margin: "14px 0 18px",
};

const bodyStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: "clamp(15px, 1.15vw, 18px)",
  lineHeight: 1.6,
  color: hsTokens.muted,
  margin: "0 0 14px",
  maxWidth: 540,
};

function sectionStyle(minVh: number): React.CSSProperties {
  return {
    minHeight: `${minVh}vh`,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "10vh 0",
  };
}

export function StageIntro({ recipeCount }: { recipeCount: number }) {
  const s = STAGES.hero;
  return (
    <section style={{ ...sectionStyle(72), justifyContent: "flex-end" }}>
      <p style={eyebrowStyle}>{s.kicker}</p>
      <h1
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(40px, 6vw, 84px)",
          lineHeight: 0.96,
          letterSpacing: "-0.04em",
          color: hsTokens.ink,
          margin: "16px 0 18px",
        }}
      >
        A recipe builder that{" "}
        <span style={{ color: hsTokens.roast }}>thinks ahead.</span>
      </h1>
      <p style={{ ...bodyStyle, maxWidth: 560 }}>{s.subhead}</p>
      <p style={{ ...eyebrowStyle, color: hsTokens.muted, marginTop: 10 }}>
        {recipeCount.toLocaleString()} community recipes and counting
      </p>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 13,
          color: hsTokens.muted,
          marginTop: 28,
          opacity: 0.7,
        }}
      >
        ↓ scroll
      </p>
    </section>
  );
}

export function StageHops() {
  const s = STAGES.hops;
  return (
    <section data-v4-stage="hops" style={sectionStyle(108)}>
      <p style={eyebrowStyle}>{s.h2}</p>
      <h2 style={leadStyle}>{s.lead}</h2>
      {s.paragraphs.map((p, i) => (
        <p key={i} style={bodyStyle}>
          {p}
        </p>
      ))}
    </section>
  );
}

export function StageBrewSheet() {
  const s = STAGES.brewSheet;
  return (
    <section data-v4-stage="brewsheet" style={sectionStyle(72)}>
      <p style={{ ...eyebrowStyle, color: hsTokens.roast }}>{s.h2}</p>
      <h2 style={leadStyle}>{s.lead}</h2>
      {s.paragraphs.map((p, i) => (
        <p key={i} style={bodyStyle}>
          {p}
        </p>
      ))}
    </section>
  );
}
