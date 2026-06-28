import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSButton from "@/modules/builder/components/HSButton";
import type { HopPreset } from "@/modules/recipe/models/Presets";
import {
  findSimilarHops,
  formatAlphaRange,
  formatBetaRange,
  formatAlphaBetaRatio,
  formatCohumulone,
  formatOilTotal,
} from "@/modules/builder/components/builder/hopDetails";
import { getCountryFlag } from "@/utils/flags";

import IngredientDetailHeader from "../IngredientDetailHeader";
import IngredientStatGrid from "../IngredientStatGrid";
import IngredientFaqList from "../IngredientFaqList";
import type { IngredientStat } from "../types";
import {
  allHops,
  hopSlug,
  hopFaq,
  hopFlavorSummary,
  hopFlavorBreakdown,
  hopDominantLabel,
  hopAccent,
  originName,
} from "./hopKind";
import HopRadarPanel from "./HopRadarPanel";
import HopSidebar from "./HopSidebar";

export default function HopDetailBody({ hop }: { hop: HopPreset }) {
  const lib = allHops();
  const summary = hopFlavorSummary(hop);
  const origin = originName(hop.originCode);

  const acidStats: IngredientStat[] = [];
  const alpha = formatAlphaRange(hop);
  if (alpha)
    acidStats.push({
      label: "Alpha acid",
      value: alpha,
      hint: "Main source of bitterness — isomerizes over the boil to set IBU.",
    });
  const beta = formatBetaRange(hop);
  if (beta)
    acidStats.push({
      label: "Beta acid",
      value: beta,
      hint: "Contributes aroma and slow-aging bitterness; not isomerized in the boil.",
    });
  const ratio = formatAlphaBetaRatio(hop);
  if (ratio)
    acidStats.push({
      label: "α : β ratio",
      value: ratio,
      hint: "How bitterness ages — ~1:1 is common in aroma varieties.",
    });
  const cohu = formatCohumulone(hop);
  if (cohu)
    acidStats.push({
      label: "Cohumulone",
      value: cohu,
      hint: "Share of alpha as cohumulone — lower reads as a smoother bitterness.",
    });
  const oil = formatOilTotal(hop);
  if (oil)
    acidStats.push({
      label: "Total oil",
      value: oil,
      hint: "Total essential oil — the bulk indicator of aroma intensity.",
    });

  const breakdown = hopFlavorBreakdown(hop);
  const similar = findSimilarHops(hop, lib, 8);
  const faq = hopFaq(hop);

  return (
    <article>
      <IngredientDetailHeader
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Hops", href: "/hops" },
        ]}
        title={hop.name}
        lede={summary}
      />

      {/* Origin — a compact identity line, not a padded paragraph. */}
      {origin ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 26,
          }}
        >
          <HSEyebrow>Origin</HSEyebrow>
          <span style={{ fontSize: 18, lineHeight: 1 }}>
            {hop.originCode ? getCountryFlag(hop.originCode) : null}
          </span>
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              fontWeight: 600,
              color: hsTokens.ink,
            }}
          >
            {origin}
          </span>
        </div>
      ) : null}

      {/* Body + sticky accordion sidebar (the sidebar's top lines up with the
          flavor radar because the header + origin sit above this grid). */}
      <div className="ingredient-page-grid">
        <div style={{ minWidth: 0 }}>
      {/* Flavor profile — radar + per-axis values (unique per hop, crawlable) */}
      {hop.flavor ? (
        <section style={{ marginBottom: acidStats.length ? 16 : 30 }}>
          <HSEyebrow as="h2">Flavor profile</HSEyebrow>
          <div className="hop-detail-profile">
            <HSCard shadow={2} padding="10px 8px">
              <HopRadarPanel name={hop.name} flavor={hop.flavor} />
            </HSCard>
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 7,
              }}
            >
              {breakdown.map((b) => (
                <li
                  key={b.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "92px 1fr 22px",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: hsTokens.body,
                      fontSize: 12,
                      fontWeight: 600,
                      color: hsTokens.ink,
                    }}
                  >
                    {b.label}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: `${hsTokens.ink}1a`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${(b.value / 5) * 100}%`,
                        background: b.color,
                        borderRadius: 999,
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontFamily: hsTokens.mono,
                      fontSize: 12,
                      color: hsTokens.muted,
                      textAlign: "right",
                    }}
                  >
                    {b.value}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Acid & oil — sits directly under the visualizer, no header */}
      {acidStats.length ? (
        <section style={{ marginBottom: 30 }}>
          <IngredientStatGrid stats={acidStats} />
        </section>
      ) : null}

      {/* Substitutes — the headline query, as a linked, scannable list */}
      {similar.length ? (
        <section style={{ marginBottom: 30 }}>
          <h2
            style={{
              fontFamily: hsTokens.display,
              fontSize: 20,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: hsTokens.ink,
              margin: "6px 0 0",
            }}
          >
            What to substitute for {hop.name}
          </h2>
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            }}
          >
            {similar.map(({ hop: s }) => {
              const sAlpha = formatAlphaRange(s);
              const sDom = hopDominantLabel(s);
              return (
                <Link
                  key={s.name}
                  href={`/hops/${hopSlug(s)}`}
                  style={{ textDecoration: "none", color: hsTokens.ink }}
                >
                  <HSCard shadow={1} padding="11px 13px" style={{ height: "100%" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 999,
                          background: hopAccent(s),
                          border: `1px solid ${hsTokens.ink}`,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: hsTokens.body,
                          fontSize: 14,
                          fontWeight: 700,
                          color: hsTokens.ink,
                        }}
                      >
                        {s.name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: hsTokens.body,
                        fontSize: 11.5,
                        color: hsTokens.muted,
                      }}
                    >
                      {[sDom, sAlpha ? `${sAlpha} AA` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </HSCard>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <IngredientFaqList items={faq} />

      {/* CTA */}
      <section
        style={{
          marginTop: 34,
          padding: "18px 22px",
          borderRadius: 14,
          border: `2px solid ${hsTokens.ink}`,
          background: hsTokens.cream2,
          boxShadow: hsTokens.sh2,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: hsTokens.display,
            fontSize: 19,
            letterSpacing: "-0.02em",
            color: hsTokens.ink,
          }}
        >
          Brew with {hop.name}
        </div>
        <HSButton href="/recipes/new" variant="solid" color={hsTokens.hops} arrow>
          Build a recipe
        </HSButton>
      </section>
        </div>

        <HopSidebar compareSeed={hopSlug(hop)} />
      </div>

      <style>{`
        .ingredient-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(230px, 0.42fr);
          gap: 28px;
          align-items: start;
        }
        .hop-detail-profile {
          display: grid;
          grid-template-columns: minmax(190px, 0.85fr) minmax(0, 1.15fr);
          gap: 22px;
          align-items: center;
          margin-top: 12px;
        }
        @media (max-width: 1024px) {
          .ingredient-page-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .hop-detail-profile { grid-template-columns: 1fr; }
          .ingredient-faq-row { grid-template-columns: 1fr !important; gap: 2px !important; }
        }
      `}</style>
    </article>
  );
}
