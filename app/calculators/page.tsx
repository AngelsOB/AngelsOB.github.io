import type { Metadata } from "next";
import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import Glyph from "@/modules/builder/components/Glyph";
import HSCard from "@/modules/builder/components/HSCard";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import { CALCULATORS_META } from "@/modules/calculators/calculatorsMeta";
import { breadcrumbJsonLd } from "@/utils/seo";

export const metadata: Metadata = {
  title: "Brewing Calculators - ABV, IBU, Carbonation & More",
  description:
    "Free homebrewing calculators: ABV, IBU, boil-off, dilution, carbonation, hydrometer temperature correction, and strike water temperature. No signup needed.",
  alternates: { canonical: "/calculators" },
  openGraph: {
    title: "Brewing Calculators | Brewing.It",
    description:
      "Free homebrewing calculators: ABV, IBU, boil-off, dilution, carbonation, hydrometer correction, and strike temperature.",
    url: "/calculators",
    siteName: "Brewing.It",
  },
  twitter: {
    card: "summary",
    title: "Brewing Calculators | Brewing.It",
    description:
      "Free homebrewing calculators: ABV, IBU, boil-off, dilution, carbonation, hydrometer correction, and strike temperature.",
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com";

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Brewing Calculators",
  itemListElement: CALCULATORS_META.map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.appName,
    url: `${BASE_URL}/calculators/${c.slug}`,
  })),
};

const jsonLd = [
  itemListJsonLd,
  breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calculators", path: "/calculators" },
  ]),
];

/**
 * The /calculators directory: a clean overview that ranks for the category
 * search ("brewing/homebrew calculators") and routes to each tool. No embedded
 * calculator — each card opens its own tool-first page.
 */
export default function CalculatorsHubPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div>
        <div style={{ marginBottom: 22 }}>
          <HSEyebrow>All calculators</HSEyebrow>
          <h1
            style={{
              fontFamily: hsTokens.display,
              fontSize: 28,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              color: hsTokens.ink,
              margin: "6px 0 0",
            }}
          >
            Brewing Calculators
          </h1>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}
        >
          {CALCULATORS_META.map((c) => (
            <Link
              key={c.slug}
              href={`/calculators/${c.slug}`}
              style={{
                display: "block",
                height: "100%",
                textDecoration: "none",
                color: hsTokens.ink,
              }}
            >
              <HSCard
                shadow={3}
                accent={c.accent}
                padding="16px 18px 18px"
                style={{ height: "100%" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 34,
                      height: 34,
                      background: c.accent,
                      border: `2px solid ${hsTokens.ink}`,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Glyph kind={c.glyph} size={18} color={hsTokens.ink} />
                  </div>
                  <HSEyebrow>{c.eyebrow}</HSEyebrow>
                </div>
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 18,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.1,
                    color: hsTokens.ink,
                    marginBottom: 6,
                  }}
                >
                  {c.label}
                </div>
                <p
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: hsTokens.muted,
                    margin: 0,
                  }}
                >
                  {c.blurb}
                </p>
              </HSCard>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
