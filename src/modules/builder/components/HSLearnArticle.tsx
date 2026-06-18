import Link from "next/link";
import type { ReactNode } from "react";

import { hsTokens } from "../tokens";
import HSScriptNote from "./HSScriptNote";
import HSEyebrow from "./HSEyebrow";
import HSCard from "./HSCard";
import { learnNav } from "@/modules/learn/docsConfig";
import { resolveCalculatorLink } from "@/modules/calculators/calculatorsMeta";

interface Props {
  /** Article title — rendered in display font */
  title: string;
  /** Subtitle in script font, rotated -2deg */
  subtitle?: string;
  /** Hrefs of related learn pages to cross-link at the bottom */
  relatedLearn?: string[];
  /** Article body */
  children: ReactNode;
  /** CTA text (defaults to "See this in the recipe builder") */
  ctaText?: string;
  /** CTA href (defaults to /recipes/new) */
  ctaHref?: string;
}

function resolveLearnLink(href: string) {
  // Calculator pages live outside docsConfig (their own /calculators section),
  // so resolve those first to allow learn↔calculator cross-links.
  const calc = resolveCalculatorLink(href);
  if (calc) return calc;
  for (const section of learnNav) {
    for (const link of section.links) {
      if (link.href === href) return link;
    }
  }
  return null;
}

/**
 * HS-native article wrapper. Pairs with the HS learn layout (sidebar + main).
 * Apply via `<HSLearnArticle title=...>{body}</HSLearnArticle>` from each
 * /app/learn/[topic]/page.tsx file. The article body should use plain HTML
 * tags (p, h2, h3, ul, code, a) and HSFormulaCallout for callouts — the
 * `.learn-prose` CSS in overrides.css styles those into HS prose.
 */
export default function HSLearnArticle({
  title,
  subtitle,
  relatedLearn,
  children,
  ctaText = "See this in the recipe builder",
  ctaHref = "/recipes/new",
}: Props) {
  const relatedLinks = relatedLearn
    ?.map(resolveLearnLink)
    .filter(Boolean) as NonNullable<ReturnType<typeof resolveLearnLink>>[];

  return (
    <article style={{ maxWidth: 768 }}>
      {/* Hero */}
      <header style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(36px, 4.6vw, 64px)",
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            margin: 0,
            color: hsTokens.ink,
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div style={{ marginTop: 8 }}>
            <HSScriptNote color={hsTokens.roast} size={24} rotate={-2}>
              {subtitle}
            </HSScriptNote>
          </div>
        ) : null}
        <div
          aria-hidden
          style={{
            marginTop: 20,
            height: 2,
            width: 56,
            background: hsTokens.ink,
          }}
        />
      </header>

      {/* Body */}
      <div className="learn-prose">{children}</div>

      {/* CTA */}
      <div
        style={{
          marginTop: 48,
          paddingTop: 32,
          borderTop: `2px solid color-mix(in oklch, ${hsTokens.ink} 14%, transparent)`,
        }}
      >
        <HSCard shadow={3} padding="28px 24px">
          <div style={{ textAlign: "center" }}>
            <HSScriptNote color={hsTokens.muted} size={20} rotate={-2}>
              try it in the builder —
            </HSScriptNote>
            <p
              style={{
                fontFamily: hsTokens.body,
                color: hsTokens.muted,
                fontSize: 14,
                margin: "10px 0 16px",
              }}
            >
              See all the numbers come together in real time.
            </p>
            <Link
              href={ctaHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: hsTokens.ink,
                color: hsTokens.cream,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                padding: "10px 20px",
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                boxShadow: hsTokens.sh2,
                textDecoration: "none",
              }}
            >
              {ctaText} <span aria-hidden>→</span>
            </Link>
          </div>
        </HSCard>
      </div>

      {/* Related */}
      {relatedLinks && relatedLinks.length > 0 ? (
        <div style={{ marginTop: 40 }}>
          <HSEyebrow>Related topics</HSEyebrow>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{ textDecoration: "none", color: hsTokens.ink }}
              >
                <HSCard shadow={2} padding="14px 18px">
                  <div
                    style={{
                      fontFamily: hsTokens.display,
                      fontSize: 16,
                      letterSpacing: "-0.02em",
                      color: hsTokens.ink,
                      marginBottom: 4,
                    }}
                  >
                    {link.label}
                  </div>
                  <div
                    style={{
                      fontFamily: hsTokens.body,
                      fontSize: 12,
                      color: hsTokens.muted,
                      lineHeight: 1.5,
                    }}
                  >
                    {link.description}
                  </div>
                </HSCard>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
