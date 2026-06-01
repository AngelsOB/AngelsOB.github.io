"use client";

import { useState } from "react";

import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSEyebrow from "@/modules/hopskip/components/HSEyebrow";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import Glyph, { type GlyphKind } from "@/modules/hopskip/components/Glyph";
import AbvCalculator from "@/modules/hopskip/components/calculators/AbvCalculator";
import IbuCalculator from "@/modules/hopskip/components/calculators/IbuCalculator";
import BoilOffCalculator from "@/modules/hopskip/components/calculators/BoilOffCalculator";
import DilutionCalculator from "@/modules/hopskip/components/calculators/DilutionCalculator";
import CarbonationCalculator from "@/modules/hopskip/components/calculators/CarbonationCalculator";
import HydrometerCorrectionCalculator from "@/modules/hopskip/components/calculators/HydrometerCorrectionCalculator";
import StrikeTempCalculator from "@/modules/hopskip/components/calculators/StrikeTempCalculator";

type CalcId =
  | "abv"
  | "ibu"
  | "boil-off"
  | "dilution"
  | "carbonation"
  | "hydrometer"
  | "strike-temp";

const CALC_META: Record<
  CalcId,
  {
    title: string;
    eyebrow: string;
    category: string;
    accent: string;
    glyph: GlyphKind;
    blurb: string;
  }
> = {
  abv: {
    title: "Alcohol by volume",
    eyebrow: "ABV",
    category: "Gravity & ABV",
    accent: hsTokens.malt,
    glyph: "drop",
    blurb: "From original and final gravity.",
  },
  hydrometer: {
    title: "Hydrometer correction",
    eyebrow: "Hydrometer",
    category: "Gravity & ABV",
    accent: hsTokens.yeast,
    glyph: "drop",
    blurb: "Adjust a warm reading to calibrated temp.",
  },
  ibu: {
    title: "Bitterness, Tinseth style",
    eyebrow: "IBU",
    category: "Hops & bitterness",
    accent: hsTokens.hops,
    glyph: "hop",
    blurb: "Sum of hop additions with isomerization.",
  },
  "boil-off": {
    title: "Boil-off / target OG",
    eyebrow: "Boil-off",
    category: "Boil & volume",
    accent: hsTokens.roast,
    glyph: "flame",
    blurb: "Volume to boil down to the OG you want.",
  },
  dilution: {
    title: "Wort dilution",
    eyebrow: "Dilution",
    category: "Boil & volume",
    accent: hsTokens.water,
    glyph: "water",
    blurb: "Water to add to drop into spec.",
  },
  "strike-temp": {
    title: "Strike water temperature",
    eyebrow: "Strike temp",
    category: "Mash & water",
    accent: hsTokens.roast,
    glyph: "flame",
    blurb: "Hit your target mash temp first try.",
  },
  carbonation: {
    title: "Force carbonation",
    eyebrow: "Carbonation",
    category: "Packaging",
    accent: hsTokens.water,
    glyph: "water",
    blurb: "Regulator PSI for a target CO₂ volume.",
  },
};

const CATEGORIES: { label: string; calcs: CalcId[]; accent: string }[] = [
  { label: "Gravity & ABV", calcs: ["abv", "hydrometer"], accent: hsTokens.malt },
  { label: "Hops & bitterness", calcs: ["ibu"], accent: hsTokens.hops },
  {
    label: "Boil & volume",
    calcs: ["boil-off", "dilution"],
    accent: hsTokens.water,
  },
  { label: "Mash & water", calcs: ["strike-temp"], accent: hsTokens.roast },
  { label: "Packaging", calcs: ["carbonation"], accent: hsTokens.yeast },
];

export default function HopSkipCalculators() {
  const [active, setActive] = useState<CalcId>("abv");
  const meta = CALC_META[active];

  return (
    <main>
      {/* Title bar */}
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
        <h1
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
        </h1>
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
          Quick gravity and volume math &mdash; no spreadsheet required. Pick a
          calculator on the right; the inputs update live as you type.
        </p>
      </section>

      {/* Featured + catalog */}
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
          <HSCard shadow={4} padding={0} style={{ overflow: "hidden" }}>
            <header
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "18px 22px",
                borderBottom: `2px solid ${hsTokens.ink}`,
                background: hsTokens.cream2,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  background: meta.accent,
                  border: `2px solid ${hsTokens.ink}`,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Glyph kind={meta.glyph} size={24} color={hsTokens.ink} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <HSEyebrow>{meta.eyebrow}</HSEyebrow>
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 22,
                    letterSpacing: "-0.035em",
                    color: hsTokens.ink,
                    marginTop: 4,
                  }}
                >
                  {meta.title}
                </div>
              </div>
            </header>

            <div style={{ padding: 22 }}>
              {active === "abv" ? <AbvCalculator accent={meta.accent} /> : null}
              {active === "ibu" ? <IbuCalculator accent={meta.accent} /> : null}
              {active === "boil-off" ? (
                <BoilOffCalculator accent={meta.accent} />
              ) : null}
              {active === "dilution" ? (
                <DilutionCalculator accent={meta.accent} />
              ) : null}
              {active === "carbonation" ? (
                <CarbonationCalculator accent={meta.accent} />
              ) : null}
              {active === "hydrometer" ? (
                <HydrometerCorrectionCalculator accent={meta.accent} />
              ) : null}
              {active === "strike-temp" ? (
                <StrikeTempCalculator accent={meta.accent} />
              ) : null}
            </div>
          </HSCard>

          <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {CATEGORIES.map((cat) => (
              <HSCard key={cat.label} shadow={2} padding="14px 16px 16px">
                <HSEyebrow>{cat.label}</HSEyebrow>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginTop: 10,
                  }}
                >
                  {cat.calcs.length === 0 ? null : (
                    cat.calcs.map((cid) => {
                      const c = CALC_META[cid];
                      const isActive = cid === active;
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={() => setActive(cid)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            justifyContent: "space-between",
                            padding: "8px 12px",
                            borderRadius: 999,
                            border: `1.5px solid ${hsTokens.ink}`,
                            background: isActive ? c.accent : hsTokens.paper,
                            color: hsTokens.ink,
                            cursor: "pointer",
                            fontFamily: hsTokens.body,
                            fontSize: 13,
                            textAlign: "left",
                            transition: "background 120ms var(--hs-ease, ease)",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: c.accent,
                                border: `1px solid ${hsTokens.ink}`,
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{c.title}</span>
                          </span>
                          {isActive ? (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                background: hsTokens.ink,
                                color: hsTokens.cream,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              open
                            </span>
                          ) : (
                            <span
                              style={{
                                color: hsTokens.muted,
                                fontSize: 16,
                              }}
                              aria-hidden
                            >
                              →
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </HSCard>
            ))}
            <HSCard shadow={1} padding="12px 14px" bg={hsTokens.cream2}>
              <HSEyebrow>More on the way</HSEyebrow>
              <p
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 12,
                  color: hsTokens.muted,
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                Mash pH, yeast pitch rate, and starter sizing — coming next.
              </p>
            </HSCard>
          </aside>
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
