import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSButton from "@/modules/builder/components/HSButton";
import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { formatFlocculation } from "@/modules/builder/components/builder/yeastDetails";
import { getYeastLabFavicon } from "@/modules/recipe/utils/yeastLabIcons";

import IngredientDetailHeader from "../IngredientDetailHeader";
import IngredientFaqList from "../IngredientFaqList";
import {
  yeastSlug,
  yeastFaq,
  yeastLede,
  yeastAccent,
  yeastAttenuation,
  yeastTemp,
  yeastTolerance,
  yeastTypeForm,
  yeastGauge,
  yeastTempBar,
  flocPosition,
  tolerancePosition,
  TEMP_DOMAIN_C,
  yeastEquivalents,
  yeastEquivalenceLine,
  yeastSubstitutes,
  equivToken,
} from "./yeastKind";
import YeastSidebar from "./YeastSidebar";

const STYLE_CAP = 14;

const cToF = (c: number) => Math.round((c * 9) / 5 + 32);

// Faint rail/divider tints. NOTE: `${hsTokens.ink}1a` resolves to
// `var(--hs-ink)1a`, which is invalid CSS (you can't suffix alpha onto a
// var() color), so it renders nothing — use color-mix for anything that must
// actually be visible.
const RAIL_FILL = "color-mix(in oklab, var(--hs-ink) 12%, transparent)";
const RAIL_BORDER = "color-mix(in oklab, var(--hs-ink) 32%, transparent)";

type SpecRow = {
  name: string;
  desc: string;
  value: string;
  sub?: string;
  band?: [number, number];
  point?: number;
  accent: string;
};

export default function YeastDetailBody({ yeast }: { yeast: YeastPreset }) {
  const lede = yeastLede(yeast);
  const favicon = getYeastLabFavicon(yeast.category);
  const typeForm = yeastTypeForm(yeast);
  const accent = yeastAccent(yeast);

  const atten = yeastAttenuation(yeast);
  const temp = yeastTemp(yeast);
  const floc = formatFlocculation(yeast.flocculation);
  const tolerance = yeastTolerance(yeast);

  const equivLine = yeastEquivalenceLine(yeast);
  const peers = yeastEquivalents(yeast);
  const subs = yeastSubstitutes(yeast);
  // The dataset comma-splits some compound BJCP names ("Sweet Stout" →
  // "Stout","Sweet"), so the raw array can repeat — dedupe before rendering.
  const styles = [...new Set(yeast.styles ?? [])];
  const shownStyles = styles.slice(0, STYLE_CAP);
  const moreStyles = styles.length - shownStyles.length;
  const faq = yeastFaq(yeast);

  // Hug the equivalence card to its content — the headline line or a row of
  // peer chips — and cap it, so it grows horizontally instead of sprawling
  // across the whole column. (A `width: fit-content` box collapses flex-wrap
  // children to one-per-row in Chrome, hence an explicit cap on a normal block.)
  const equivWidth = equivLine
    ? Math.min(
        760,
        Math.max(
          equivLine.length * 16 + 44,
          Math.min(peers.length, 4) * 184 + 44
        )
      )
    : 0;

  // The spec block: one clean card per measurable property (label + value +
  // a small meter). The plain-English explanation rides in a hover tooltip —
  // still real text in the DOM (crawlable), just out of the way visually.
  const specRows: SpecRow[] = [];
  const gauge = yeastGauge(yeast);
  if (gauge && atten)
    specRows.push({
      name: "Attenuation",
      desc: "The share of sugars the yeast ferments out. Higher attenuation means a drier, stronger beer.",
      value: atten,
      band: [gauge.low, gauge.high],
      accent: hsTokens.malt,
    });
  const tb = yeastTempBar(yeast);
  if (tb && temp)
    specRows.push({
      name: "Optimal temp",
      desc: "The range where this strain ferments cleanly, without throwing off-flavors. Most brewers pitch near the low end.",
      value: temp,
      sub: tb.minC === tb.maxC ? `${cToF(tb.minC)}°F` : `${cToF(tb.minC)}–${cToF(tb.maxC)}°F`,
      band: [(tb.minC / TEMP_DOMAIN_C) * 100, (tb.maxC / TEMP_DOMAIN_C) * 100],
      accent: hsTokens.roast,
    });
  const fp = flocPosition(yeast);
  if (floc && fp != null)
    specRows.push({
      name: "Flocculation",
      desc: "How readily the yeast clumps together and drops clear once fermentation winds down.",
      value: floc,
      point: fp,
      accent: hsTokens.water,
    });
  const tp = tolerancePosition(yeast);
  if (tolerance && tp != null)
    specRows.push({
      name: "Alcohol tolerance",
      desc: "The rough ABV ceiling where the yeast stresses out and stops fermenting.",
      value: tolerance,
      point: tp,
      accent: hsTokens.hops,
    });

  return (
    <article>
      <IngredientDetailHeader
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Yeast", href: "/yeast" },
        ]}
        title={yeast.name}
        lede={lede}
      />

      {/* Lab — a compact identity line (favicon + name + type/form + lab id). */}
      {yeast.category ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 26,
            flexWrap: "wrap",
          }}
        >
          <HSEyebrow>Lab</HSEyebrow>
          {favicon ? (
            <img
              src={favicon}
              alt=""
              width={20}
              height={20}
              style={{ objectFit: "contain", flexShrink: 0 }}
            />
          ) : null}
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              fontWeight: 600,
              color: hsTokens.ink,
            }}
          >
            {yeast.category}
          </span>
          {[typeForm, yeast.labProductId].filter(Boolean).length ? (
            <span
              style={{
                fontFamily: hsTokens.body,
                fontSize: 13,
                color: hsTokens.muted,
              }}
            >
              · {[typeForm, yeast.labProductId].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ingredient-page-grid">
        <div style={{ minWidth: 0 }}>
          {/* Specs first — the numbers a brewer opens the page for. Each
              explanation rides in a hover tooltip (real text in the DOM). */}
          {specRows.length ? (
            <section style={{ marginBottom: 30 }}>
              <HSEyebrow as="h2">Specs</HSEyebrow>
              <div className="yeast-spec-cards">
                {specRows.map((r) => (
                  <div
                    key={r.name}
                    className="yeast-stat-card"
                    tabIndex={0}
                    aria-label={`${r.name}: ${r.value}. ${r.desc}`}
                  >
                    <span
                      aria-hidden
                      className="yeast-stat-stripe"
                      style={{ background: r.accent }}
                    />
                    <div className="yeast-stat-label">{r.name}</div>
                    <div className="yeast-stat-value">{r.value}</div>
                    {r.sub ? <div className="yeast-stat-sub">{r.sub}</div> : null}
                    <MiniMeter band={r.band} point={r.point} accent={r.accent} />
                    <div role="tooltip" className="yeast-stat-tip">
                      {r.desc}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Cross-lab equivalence — the unowned-SERP wedge ("{strain}
              equivalent"), right beneath the headline stats. */}
          {equivLine && peers.length ? (
            <section style={{ marginBottom: 30 }}>
              <HSEyebrow as="h2">Same strain, other labs</HSEyebrow>
              <HSCard
                shadow={2}
                padding="16px 18px"
                bg={hsTokens.cream2}
                accent={accent}
                style={{ marginTop: 12, maxWidth: equivWidth }}
              >
                <div
                  style={{
                    fontFamily: hsTokens.mono,
                    fontSize: "clamp(19px, 3.2vw, 27px)",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    lineHeight: 1.25,
                    color: hsTokens.ink,
                    wordBreak: "break-word",
                  }}
                >
                  {equivLine}
                </div>
                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {peers.map((p) => (
                    <Link
                      key={p.name}
                      href={`/yeast/${yeastSlug(p)}`}
                      style={{
                        flex: "1 1 168px",
                        minWidth: 0,
                        textDecoration: "none",
                        color: hsTokens.ink,
                      }}
                    >
                      <HSCard shadow={1} padding="10px 12px" style={{ height: "100%" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 999,
                              background: yeastAccent(p),
                              border: `1px solid ${hsTokens.ink}`,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontFamily: hsTokens.mono,
                              fontSize: 13,
                              fontWeight: 700,
                              color: hsTokens.ink,
                            }}
                          >
                            {equivToken(p)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontFamily: hsTokens.body,
                            fontSize: 11.5,
                            color: hsTokens.muted,
                            marginTop: 4,
                          }}
                        >
                          {p.category}
                        </div>
                      </HSCard>
                    </Link>
                  ))}
                </div>
              </HSCard>
            </section>
          ) : null}

          {/* Substitutes — a different strain that fills the same role. Only
              ~27% of strains carry curated substitutes; omit otherwise. */}
          {subs.length ? (
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
                Potential substitutes for {yeast.name}
              </h2>
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
                }}
              >
                {subs.map((s) => {
                  const sAtten = s.preset ? yeastAttenuation(s.preset) : null;
                  const inner = (
                    <HSCard shadow={1} padding="11px 13px" style={{ height: "100%" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          marginBottom: sAtten ? 6 : 0,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 999,
                            background: s.preset
                              ? yeastAccent(s.preset)
                              : hsTokens.muted,
                            border: `1px solid ${hsTokens.ink}`,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: hsTokens.body,
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: hsTokens.ink,
                          }}
                        >
                          {s.name}
                        </span>
                      </div>
                      {sAtten ? (
                        <div
                          style={{
                            fontFamily: hsTokens.body,
                            fontSize: 11.5,
                            color: hsTokens.muted,
                          }}
                        >
                          {[s.preset?.category, `${sAtten} atten`]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}
                    </HSCard>
                  );
                  return s.preset ? (
                    <Link
                      key={s.name}
                      href={`/yeast/${yeastSlug(s.preset)}`}
                      style={{ textDecoration: "none", color: hsTokens.ink }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={s.name}>{inner}</div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Usually used in — suited styles, only when the dataset has them. */}
          {shownStyles.length ? (
            <section style={{ marginBottom: 30 }}>
              <HSEyebrow as="h2">Usually used in</HSEyebrow>
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {shownStyles.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                      fontWeight: 600,
                      color: hsTokens.ink,
                      background: hsTokens.cream,
                      border: `1.5px solid ${hsTokens.ink}`,
                      borderRadius: 999,
                      padding: "5px 13px",
                      boxShadow: hsTokens.sh1,
                    }}
                  >
                    {s}
                  </span>
                ))}
                {moreStyles > 0 ? (
                  <span
                    style={{
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                      fontWeight: 600,
                      color: hsTokens.muted,
                      alignSelf: "center",
                    }}
                  >
                    +{moreStyles} more
                  </span>
                ) : null}
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
              Brew with {yeast.name}
            </div>
            <HSButton href="/recipes/new" variant="solid" color={hsTokens.yeast} arrow>
              Build a recipe
            </HSButton>
          </section>
        </div>

        <YeastSidebar />
      </div>

      <style>{`
        .ingredient-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(230px, 0.42fr);
          gap: 28px;
          align-items: start;
        }
        .yeast-spec-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .yeast-stat-card {
          position: relative;
          background: var(--hs-paper);
          border: 2px solid var(--hs-ink);
          border-radius: 12px;
          box-shadow: ${hsTokens.sh2};
          padding: 14px 14px 16px;
          cursor: help;
          outline: none;
          transition: box-shadow 160ms ease, transform 160ms ease;
        }
        .yeast-stat-card:hover, .yeast-stat-card:focus-visible {
          transform: translateY(-2px);
          box-shadow: ${hsTokens.sh3};
        }
        .yeast-stat-stripe {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 5px;
          border-top-left-radius: 10px;
          border-top-right-radius: 10px;
        }
        .yeast-stat-label {
          font-family: var(--font-space-grotesk), system-ui, sans-serif;
          font-weight: 700;
          font-size: 9.5px;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: var(--hs-muted);
          margin-top: 4px;
          padding-bottom: 1px;
          border-bottom: 1px dotted color-mix(in oklab, var(--hs-ink) 45%, transparent);
          display: inline-block;
        }
        .yeast-stat-value {
          font-family: var(--font-ibm-plex-mono), ui-monospace, monospace;
          font-size: 19px;
          font-weight: 600;
          color: var(--hs-ink);
          margin-top: 9px;
          line-height: 1.1;
        }
        .yeast-stat-sub {
          font-family: var(--font-ibm-plex-mono), ui-monospace, monospace;
          font-size: 11px;
          color: var(--hs-muted);
          margin-top: 2px;
        }
        /* The explanation: present in the DOM (crawlable), revealed on hover. */
        .yeast-stat-tip {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          width: max-content;
          min-width: 100%;
          max-width: 240px;
          z-index: 6;
          background: var(--hs-paper);
          border: 2px solid var(--hs-ink);
          border-radius: 10px;
          box-shadow: ${hsTokens.sh3};
          padding: 9px 11px;
          font-family: var(--font-space-grotesk), system-ui, sans-serif;
          font-size: 12px;
          line-height: 1.45;
          color: var(--hs-muted);
          opacity: 0;
          transform: translateY(-4px);
          pointer-events: none;
          transition: opacity 140ms ease, transform 140ms ease;
        }
        .yeast-stat-card:hover .yeast-stat-tip,
        .yeast-stat-card:focus-visible .yeast-stat-tip {
          opacity: 1;
          transform: translateY(0);
        }
        /* Keep an edge card's tip from spilling off the right. */
        .yeast-spec-cards > .yeast-stat-card:last-child .yeast-stat-tip {
          left: auto;
          right: 0;
        }
        @media (max-width: 1024px) {
          .ingredient-page-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 540px) {
          .ingredient-faq-row { grid-template-columns: 1fr !important; gap: 2px !important; }
        }
      `}</style>
    </article>
  );
}

/**
 * The small in-card meter: a visible recessed rail with a range band
 * (attenuation, temperature) or single marker (flocculation, alcohol tolerance)
 * in the card's accent. Decorative — the value text above carries the figure —
 * so it's aria-hidden. Rail tints use color-mix (a `var()` can't take a hex
 * alpha suffix, which silently renders nothing).
 */
function MiniMeter({
  band,
  point,
  accent,
}: {
  band?: [number, number];
  point?: number;
  accent: string;
}) {
  const marker: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    height: 12,
    transform: "translateY(-50%)",
    background: accent,
    border: `1.5px solid ${hsTokens.ink}`,
    borderRadius: 3,
    boxShadow: "1px 1px 0 var(--hs-ink)",
  };
  return (
    <div aria-hidden style={{ position: "relative", height: 12, marginTop: 12 }}>
      <span
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 6,
          transform: "translateY(-50%)",
          background: RAIL_FILL,
          border: `1px solid ${RAIL_BORDER}`,
          borderRadius: 999,
        }}
      />
      {band ? (
        <span
          style={{
            ...marker,
            left: `${band[0]}%`,
            width: `${Math.max(7, band[1] - band[0])}%`,
          }}
        />
      ) : null}
      {point != null ? (
        <span style={{ ...marker, left: `calc(${point}% - 6px)`, width: 12 }} />
      ) : null}
    </div>
  );
}
