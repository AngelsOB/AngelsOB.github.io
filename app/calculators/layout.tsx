import type { ReactNode } from "react";

import { hsTokens } from "@/modules/builder/tokens";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";
import CalculatorsSidebar from "@/modules/calculators/CalculatorsSidebar";
import PageTransition from "@/modules/calculators/PageTransition";

/**
 * Shared surface for /calculators. Persistent masthead + sidebar (so they stay
 * mounted across navigation), with the featured column cross-fading on nav.
 */
export default function CalculatorsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main>
      {/* Masthead — persistent section brand (not the page H1). */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) 24px",
        }}
      >
        <HSScriptNote color={hsTokens.water} size={26} rotate={-3}>
          the brewer&apos;s pocket library —
        </HSScriptNote>
        <div
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(40px, 6vw, 88px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.9,
            margin: "10px 0 0",
            color: hsTokens.ink,
          }}
        >
          <span
            style={{
              background: hsTokens.malt,
              padding: "0 0.18em",
              display: "inline-block",
              transform: "rotate(-1.5deg)",
              border: `2px solid ${hsTokens.ink}`,
              boxShadow: hsTokens.sh1,
            }}
          >
            Calculators
          </span>{" "}
          for brew day.
        </div>
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
          Quick gravity and volume math. No spreadsheet, no signup.
        </p>
      </section>

      {/* Featured column (children) + persistent catalog (sidebar). */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 56px) clamp(40px, 6vw, 96px)",
        }}
      >
        <div
          className="hs-calc-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.9fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <PageTransition>{children}</PageTransition>
          <CalculatorsSidebar />
        </div>
        <style>{`
          @media (max-width: 1024px) {
            .hs-calc-layout { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>
    </main>
  );
}
