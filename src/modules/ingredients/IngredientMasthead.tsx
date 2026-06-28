import { hsTokens } from "@/modules/builder/tokens";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";

import type { IngredientSection } from "./types";

/**
 * Persistent section brand for an ingredient reference section (the marketing
 * masthead, NOT the page H1). Structurally cloned from the /calculators layout
 * masthead so the two sections read as siblings.
 */
export default function IngredientMasthead({
  section,
}: {
  section: IngredientSection;
}) {
  const accent = section.accent ?? hsTokens.hops;
  return (
    <section
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) 24px",
      }}
    >
      {section.kicker ? (
        <HSScriptNote color={accent} size={26} rotate={-3}>
          {section.kicker}
        </HSScriptNote>
      ) : null}
      <h1
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(40px, 6vw, 84px)",
          letterSpacing: "-0.04em",
          lineHeight: 0.95,
          margin: section.kicker ? "10px 0 0" : 0,
          color: hsTokens.ink,
          maxWidth: 720,
          overflowWrap: "break-word",
        }}
      >
        <span
          style={{
            background: accent,
            color: hsTokens.paper,
            padding: "0 0.18em",
            display: "inline-block",
            transform: "rotate(-1.5deg)",
            border: `2px solid ${hsTokens.ink}`,
            boxShadow: hsTokens.sh1,
          }}
        >
          {section.titleWord}
        </span>{" "}
        {section.titleRest}
      </h1>
      {section.blurb ? (
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 15,
            lineHeight: 1.55,
            color: hsTokens.muted,
            maxWidth: 540,
            marginTop: 18,
          }}
        >
          {section.blurb}
        </p>
      ) : null}
    </section>
  );
}
