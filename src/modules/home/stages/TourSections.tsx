"use client";

import HSButton from "@/modules/builder/components/HSButton";
import { hsTokens } from "@/modules/builder/tokens";
import { CTA, STAGES } from "../data";

// Left-column text blocks for the tour. Pure scrolling DOM. Home targets
// these via the `data-tour-stage` attribute for the per-beat triggers.
//
// Headings + body paragraphs are tagged `data-tour-split-reveal` with a mode
// (`words` for short heads, `lines` for paragraphs). Home's useGSAP picks
// them up, SplitText-splits each, and plays a single rise-up reveal on
// scroll-enter. Eyebrows + the hero CTA are NOT split — they're small
// "labels" that read naturally without a reveal.

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

export function StageIntro() {
  const s = STAGES.hero;
  return (
    <section style={{ ...sectionStyle(72), justifyContent: "flex-end" }}>
      <p style={eyebrowStyle}>{s.kicker}</p>
      <h1
        data-tour-split-reveal
        data-tour-split-mode="words"
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(40px, 6vw, 84px)",
          lineHeight: 0.96,
          letterSpacing: "-0.04em",
          color: hsTokens.ink,
          margin: "16px 0 18px",
        }}
      >
        {s.headline.pre}
        <span style={{ color: hsTokens.roast }}>{s.headline.accent}</span>
      </h1>
      <p
        data-tour-split-reveal
        data-tour-split-mode="lines"
        style={{ ...bodyStyle, maxWidth: 560 }}
      >
        {s.subhead}
      </p>
      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <HSButton
          href={CTA.hero.href}
          variant="ink"
          color={hsTokens.roast}
          size="lg"
          arrow
        >
          {CTA.hero.label}
        </HSButton>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 13,
            color: hsTokens.muted,
            fontStyle: "italic",
          }}
        >
          {CTA.hero.note}
        </span>
      </div>
    </section>
  );
}

export function StageOpening() {
  const s = STAGES.opening;
  const last = s.sentences.length - 1;
  return (
    <section data-tour-stage="opening" style={sectionStyle(82)}>
      {s.sentences.map((sentence, i) => (
        <p
          key={i}
          data-tour-split-reveal
          data-tour-split-mode="lines"
          style={{
            fontFamily: hsTokens.display,
            fontStyle: "italic",
            fontSize:
              i === last ? "clamp(22px, 2.6vw, 34px)" : "clamp(18px, 2.1vw, 26px)",
            lineHeight: 1.42,
            letterSpacing: "-0.02em",
            color: i === last ? hsTokens.ink : hsTokens.muted,
            margin: i === 0 ? "0 0 22px" : 0,
            maxWidth: 560,
          }}
        >
          {sentence}
        </p>
      ))}
    </section>
  );
}

export function StageGrains() {
  const s = STAGES.grains;
  return (
    <section data-tour-stage="grains" style={sectionStyle(96)}>
      <p style={eyebrowStyle}>{s.h2}</p>
      <h2 data-tour-split-reveal data-tour-split-mode="words" style={leadStyle}>
        {s.lead}
      </h2>
      <p data-tour-split-reveal data-tour-split-mode="lines" style={bodyStyle}>
        {s.body}
      </p>
    </section>
  );
}

export function StageHops() {
  const s = STAGES.hops;
  return (
    <section data-tour-stage="hops" style={sectionStyle(108)}>
      <p style={eyebrowStyle}>{s.h2}</p>
      <h2 data-tour-split-reveal data-tour-split-mode="words" style={leadStyle}>
        {s.lead}
      </h2>
      {s.paragraphs.map((p, i) => (
        <p
          key={i}
          data-tour-split-reveal
          data-tour-split-mode="lines"
          style={bodyStyle}
        >
          {p}
        </p>
      ))}
    </section>
  );
}

export function StageWater() {
  const s = STAGES.water;
  return (
    <section data-tour-stage="water" style={sectionStyle(108)}>
      <p style={eyebrowStyle}>{s.h2}</p>
      <h2 data-tour-split-reveal data-tour-split-mode="words" style={leadStyle}>
        {s.lead}
      </h2>
      {s.paragraphs.map((p, i) => (
        <p
          key={i}
          data-tour-split-reveal
          data-tour-split-mode="lines"
          style={bodyStyle}
        >
          {p}
        </p>
      ))}
    </section>
  );
}

export function StageHonestNumbers() {
  const s = STAGES.honestNumbers;
  return (
    <section data-tour-stage="honest" style={sectionStyle(108)}>
      <p style={eyebrowStyle}>{s.h2}</p>
      <h2 data-tour-split-reveal data-tour-split-mode="words" style={leadStyle}>
        {s.lead}
      </h2>
      {s.paragraphs.map((p, i) => (
        <p
          key={i}
          data-tour-split-reveal
          data-tour-split-mode="lines"
          style={bodyStyle}
        >
          {p}
        </p>
      ))}
    </section>
  );
}

export function StageBrewSheet() {
  const s = STAGES.brewSheet;
  return (
    <section data-tour-stage="brewsheet" style={sectionStyle(120)}>
      <p style={{ ...eyebrowStyle, color: hsTokens.roast }}>{s.h2}</p>
      <h2 data-tour-split-reveal data-tour-split-mode="words" style={leadStyle}>
        {s.lead}
      </h2>
      {s.paragraphs.map((p, i) => (
        <p
          key={i}
          data-tour-split-reveal
          data-tour-split-mode="lines"
          style={bodyStyle}
        >
          {p}
        </p>
      ))}
    </section>
  );
}
