import Link from "next/link";
import type { Metadata } from "next";

import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";
import { learnNav } from "@/modules/learn/docsConfig";

export const metadata: Metadata = {
  title: "Learn Brewing Science",
};

const FEATURED_PATHS = [
  "/learn/getting-started",
  "/learn/ibu",
  "/learn/gravity",
  "/learn/water-chemistry",
];

export default function HopSkipLearnIndex() {
  const featured = learnNav
    .flatMap((s) => s.links)
    .filter((l) => FEATURED_PATHS.includes(l.href));

  return (
    <article>
      <HSScriptNote color={hsTokens.roast} size={26} rotate={-3}>
        behind the numbers —
      </HSScriptNote>
      <h1
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(36px, 4.6vw, 64px)",
          letterSpacing: "-0.035em",
          lineHeight: 0.92,
          margin: "10px 0 0",
          color: hsTokens.ink,
        }}
      >
        The science behind{" "}
        <span
          style={{
            background: hsTokens.malt,
            padding: "0 12px",
            display: "inline-block",
            transform: "rotate(-1.5deg)",
          }}
        >
          every
        </span>{" "}
        <span style={{ color: hsTokens.roast }}>calculation.</span>
      </h1>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 16,
          lineHeight: 1.55,
          color: hsTokens.muted,
          maxWidth: 640,
          marginTop: 18,
        }}
      >
        A living brewing science library &mdash; the formulas, the reasoning, and the
        sources behind every number in the builder. Browse by topic from the sidebar.
      </p>

      <section style={{ marginTop: 40 }}>
        <HSEyebrow>Start here</HSEyebrow>
        <h2
          style={{
            fontFamily: hsTokens.display,
            fontSize: 24,
            letterSpacing: "-0.035em",
            lineHeight: 1,
            margin: "6px 0 16px",
            color: hsTokens.ink,
          }}
        >
          Four picks to set the foundation.
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {featured.map((link, idx) => {
            const accents = [hsTokens.yeast, hsTokens.hops, hsTokens.malt, hsTokens.water];
            const accent = accents[idx % accents.length];
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ textDecoration: "none", color: hsTokens.ink }}
              >
                <HSCard shadow={2} accent={accent} padding="18px 18px 16px">
                  <HSEyebrow>Article</HSEyebrow>
                  <h3
                    style={{
                      fontFamily: hsTokens.display,
                      fontSize: 18,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.1,
                      margin: "6px 0 6px",
                      color: hsTokens.ink,
                    }}
                  >
                    {link.label}
                  </h3>
                  <p
                    style={{
                      fontFamily: hsTokens.body,
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: hsTokens.muted,
                      margin: 0,
                    }}
                  >
                    {link.description}
                  </p>
                  <div
                    style={{
                      marginTop: 12,
                      fontFamily: hsTokens.script,
                      fontSize: 15,
                      color: accent,
                      transform: "rotate(-3deg)",
                      display: "inline-block",
                    }}
                  >
                    read more →
                  </div>
                </HSCard>
              </Link>
            );
          })}
        </div>
      </section>

      <section style={{ marginTop: 48 }}>
        <HSEyebrow>What&rsquo;s inside</HSEyebrow>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          {learnNav.map((section) => (
            <div key={section.title}>
              <h3
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 18,
                  letterSpacing: "-0.03em",
                  color: hsTokens.ink,
                  margin: "0 0 8px",
                }}
              >
                {section.title}
              </h3>
              <p
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: hsTokens.muted,
                  margin: 0,
                  maxWidth: 720,
                }}
              >
                {section.links.map((l) => l.label).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div
        style={{
          marginTop: 40,
          padding: "16px 18px",
          background: hsTokens.cream2,
          border: `1.5px dashed color-mix(in oklch, ${hsTokens.ink} 22%, transparent)`,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          color: hsTokens.muted,
          fontSize: 13,
          fontFamily: hsTokens.body,
        }}
      >
        <HSScriptNote color={hsTokens.muted} size={18} rotate={-3}>
          heads up —
        </HSScriptNote>
        <span style={{ flex: 1, minWidth: 240 }}>
          Individual article pages still render in the classic theme. Sidebar links jump to
          the classic article for now &mdash; we&rsquo;ll bring those over once the rest of
          the HS preview is locked in.
        </span>
      </div>
    </article>
  );
}
