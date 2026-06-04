"use client";

import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import { hsTokens } from "@/modules/hopskip/tokens";
import { STAGES } from "../data";

// Stage 10. Full-width, centered. Path B: two equal-weight CTAs. The
// featured article cards (SectionLearn) get reused in task #7.
export default function StageLearn() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      {/* h2 is the eyebrow text per PRD section 10. The visible "Learn brewing.
          And Brewing.It." line is presentational (h3 below). */}
      <h2
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {STAGES.learn.h2}
      </h2>
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
          {STAGES.learn.kicker}
        </HSScriptNote>
        <h3
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(32px, 4vw, 52px)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: hsTokens.ink,
            margin: "12px 0 24px",
          }}
        >
          {STAGES.learn.title}
        </h3>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          {STAGES.learn.ctas.map((c) => (
            <a
              key={c.href}
              href={c.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                boxShadow: hsTokens.sh2,
                fontFamily: hsTokens.body,
                fontSize: 14,
                fontWeight: 700,
                color: hsTokens.ink,
                textDecoration: "none",
              }}
            >
              {c.label} →
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
