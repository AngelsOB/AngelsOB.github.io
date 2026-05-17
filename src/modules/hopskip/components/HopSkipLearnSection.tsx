import Link from "next/link";

import { hsTokens } from "../tokens";
import HSCard from "./HSCard";
import HSSectionHeader from "./HSSectionHeader";
import { learnNav } from "@/modules/learn/docsConfig";

export default function HopSkipLearnSection() {
  // Mirror classic Home: 1 from "How To Use…" + 3 picks from the Brewing Science nav.
  const featured = [
    learnNav[0]?.links?.[0],
    ...(learnNav[1]?.links ?? []).filter((l) =>
      ["/learn/ibu", "/learn/water-chemistry", "/learn/gravity"].includes(l.href),
    ),
  ].filter(Boolean) as { href: string; label: string; description: string }[];

  if (featured.length === 0) return null;

  return (
    <section
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px) clamp(40px, 6vw, 72px)",
      }}
    >
      <HSSectionHeader
        index={5}
        kicker="behind the numbers —"
        eyebrow="Brewing science"
        title="The research behind the numbers."
        kickerColor={hsTokens.roast}
        alignEnd={
          <Link
            href="/learn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 999,
              fontFamily: hsTokens.body,
              fontWeight: 600,
              fontSize: 12,
              color: hsTokens.ink,
              textDecoration: "none",
            }}
          >
            All articles →
          </Link>
        }
      />

      <div
        className="hs-learn-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {featured.map((link, idx) => {
          const tilts = [-0.4, 0.3, -0.2, 0.4];
          const accents = [hsTokens.malt, hsTokens.hops, hsTokens.water, hsTokens.roast];
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{ textDecoration: "none", color: hsTokens.ink }}
            >
              <HSCard
                shadow={3}
                tilt={tilts[idx % tilts.length]}
                accent={accents[idx % accents.length]}
                padding="22px 22px 20px"
              >
                <div
                  style={{
                    fontFamily: hsTokens.body,
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                  }}
                >
                  Article
                </div>
                <h3
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 22,
                    letterSpacing: "-0.035em",
                    lineHeight: 1.05,
                    margin: "8px 0 8px",
                  }}
                >
                  {link.label}
                </h3>
                <p
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: hsTokens.muted,
                    margin: 0,
                  }}
                >
                  {link.description}
                </p>
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: hsTokens.script,
                    fontSize: 16,
                    color: accents[idx % accents.length],
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
      <style>{`
        @media (max-width: 640px) {
          .hs-learn-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
