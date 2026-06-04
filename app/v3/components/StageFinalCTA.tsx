"use client";

import HSButton from "@/modules/hopskip/components/HSButton";
import { hsTokens } from "@/modules/hopskip/tokens";
import { CTA, STAGES } from "../data";

// Stage 12. Repeats the hero's primary action. Breath pulse on the headline
// (1.0 -> 1.02 -> 1.0 over 600ms SMOOTH) lands in task #7.
export default function StageFinalCTA() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(40px, 5vw, 72px)",
            letterSpacing: "-0.04em",
            lineHeight: 1.0,
            color: hsTokens.ink,
            margin: "0 0 28px",
          }}
        >
          {STAGES.finalCta.headline}
        </h2>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <HSButton
            href={CTA.primary.href}
            variant="ink"
            color={hsTokens.roast}
            size="lg"
            arrow
          >
            {CTA.primary.label}
          </HSButton>
          {CTA.secondary.map((s) => (
            <a
              key={s.href}
              href={s.href}
              style={{
                fontFamily: hsTokens.body,
                fontSize: 14,
                fontWeight: 600,
                color: hsTokens.ink,
                textDecoration: "none",
              }}
            >
              {s.label} →
            </a>
          ))}
        </div>
        <p
          style={{
            marginTop: 16,
            fontFamily: hsTokens.body,
            fontSize: 13,
            color: hsTokens.muted,
            fontStyle: "italic",
          }}
        >
          {CTA.trust}
        </p>
      </div>
    </section>
  );
}
