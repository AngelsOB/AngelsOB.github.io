"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { hsTokens } from "../tokens";
import HSCard from "./HSCard";
import HSCardLift from "./HSCardLift";
import HSEyebrow from "./HSEyebrow";
import HSScriptNote from "./HSScriptNote";
import HSSectionHeader from "./HSSectionHeader";
import HSButton from "./HSButton";
import HSIngredientDot from "./HSIngredientDot";
import Glyph from "./Glyph";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

const CALC_PREVIEW: {
  eyebrow: string;
  value: string;
  subtitle: string;
  color: string;
  glyph: "drop" | "hop" | "scale";
}[] = [
  { eyebrow: "ABV", value: "5.51%", subtitle: "from gravity", color: hsTokens.malt, glyph: "drop" },
  { eyebrow: "IBU", value: "38", subtitle: "Tinseth", color: hsTokens.hops, glyph: "hop" },
  { eyebrow: "Boil-off", value: "9.2%", subtitle: "to target OG", color: hsTokens.roast, glyph: "scale" },
];

export default function HopSkipHomeContent() {
  const recipes = useRecipeStore((s) => s.recipes);
  const recipesLoaded = useRecipeStore((s) => s.recipesLoaded);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);

  useEffect(() => {
    if (!recipesLoaded) loadRecipes();
  }, [recipesLoaded, loadRecipes]);

  const recentRecipes = useMemo(() => {
    return [...recipes]
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
      .slice(0, 3);
  }, [recipes]);

  const recipeCount = recipes.length;

  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section
        style={{
          background: hsTokens.cream,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="hs-hero"
          style={{
            maxWidth: 1600,
            margin: "0 auto",
            padding:
              "clamp(36px, 4.5vw, 64px) 0 clamp(28px, 4vw, 56px) clamp(20px, 4vw, 56px)",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ minWidth: 0, position: "relative", zIndex: 2 }}>
            <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
              hello, brewer —
            </HSScriptNote>
            <h1
              style={{
                fontFamily: hsTokens.display,
                fontSize: "clamp(44px, 6.5vw, 100px)",
                letterSpacing: "-0.04em",
                lineHeight: 0.92,
                margin: "12px 0 0",
                color: hsTokens.ink,
              }}
            >
              <span>Brew with</span>
              <br />
              <span
                style={{
                  background: hsTokens.malt,
                  padding: "0 14px",
                  display: "inline-block",
                  transform: "rotate(-1.5deg)",
                }}
              >
                numbers
              </span>
              <br />
              <span style={{ color: hsTokens.roast }}>that&nbsp;agree.</span>
            </h1>
            <p
              style={{
                fontFamily: hsTokens.body,
                fontSize: 16,
                lineHeight: 1.55,
                color: hsTokens.muted,
                maxWidth: 460,
                marginTop: 22,
              }}
            >
              A recipe builder, calculators, and a brewing science library &mdash; built by,
              and for, homebrewers who keep forgetting things.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 28, alignItems: "center" }}>
              <HSButton
                href="/recipes/new"
                variant="ink"
                color={hsTokens.roast}
                size="lg"
                arrow
              >
                Start a recipe
              </HSButton>
              <HSButton href="/calculators" variant="ghost" size="lg">
                Open calculators
              </HSButton>
              <HSScriptNote color={hsTokens.hops} size={20} rotate={-4} style={{ marginLeft: 4 }}>
                free, forever ✦
              </HSScriptNote>
            </div>
          </div>

          <div
            className="hs-hero-image-wrap"
            aria-hidden
            style={{
              position: "relative",
              minHeight: 360,
              width: "100%",
            }}
          >
            <Image
              src="/images/hero.png"
              alt=""
              width={1380}
              height={767}
              priority
              className="hs-hero-image"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </div>
        </div>

        <style>{`
          @media (max-width: 1100px) {
            .hs-hero {
              grid-template-columns: 1fr !important;
              padding: clamp(28px, 5vw, 52px) clamp(20px, 4vw, 40px) !important;
            }
            .hs-hero-image-wrap {
              position: absolute !important;
              inset: 0 !important;
              z-index: 1 !important;
              min-height: 0 !important;
              opacity: 0.08 !important;
              pointer-events: none !important;
            }
            .hs-hero-image {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
          }
        `}</style>
      </section>

      {/* ───────────────────── Stats strip ───────────────────── */}
      <section
        style={{
          background: hsTokens.cream2,
          borderTop: `2px solid ${hsTokens.ink}`,
          borderBottom: `2px solid ${hsTokens.ink}`,
        }}
      >
        <div
          className="hs-stats"
          style={{
            maxWidth: 1600,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          }}
        >
          {[
            { color: hsTokens.roast, value: recipeCount, label: "recipes in your library" },
            { color: hsTokens.water, value: 5, label: "calculators wired up" },
            { color: hsTokens.hops, value: 0, label: "spreadsheets needed" },
          ].map((stat, i, arr) => (
            <div
              key={stat.label}
              className="hs-stats-cell"
              style={{
                padding: "28px 32px",
                display: "flex",
                alignItems: "center",
                gap: 18,
                borderRight: i < arr.length - 1 ? `2px solid ${hsTokens.ink}` : undefined,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 40,
                  height: 40,
                  background: stat.color,
                  border: `2px solid ${hsTokens.ink}`,
                  borderRadius: 6,
                  flexShrink: 0,
                  boxShadow: hsTokens.sh1,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: "clamp(34px, 4vw, 48px)",
                    letterSpacing: "-0.04em",
                    lineHeight: 0.9,
                    fontVariantNumeric: "tabular-nums",
                    color: hsTokens.ink,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                    marginTop: 4,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
        <style>{`
          @media (max-width: 640px) {
            .hs-stats { grid-template-columns: 1fr; }
            .hs-stats-cell { border-right: none !important; border-bottom: 2px solid ${hsTokens.ink}; }
            .hs-stats-cell:last-child { border-bottom: none; }
          }
        `}</style>
      </section>

      {/* ───────────────────── Section 01 — Builder ───────────────────── */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
        }}
      >
        <HSSectionHeader
          index={1}
          kicker="every dial talks —"
          eyebrow="Recipe builder"
          title="Every input nudges every output."
          kickerColor={hsTokens.yeast}
        />
        <div
          className="hs-feature-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)",
            gap: 48,
            alignItems: "start",
          }}
        >
          <div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: hsTokens.muted, marginTop: 0, maxWidth: 460 }}>
              Build recipes with real-time calculations. Grain bills, hop schedules, mash
              steps, water chemistry — everything talks to your equipment profile, the BJCP
              style guide, and your saved preferences.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 14,
                marginTop: 24,
              }}
            >
              {[
                { color: hsTokens.malt, label: "Live numbers", desc: "OG, FG, ABV, IBU, SRM update on every edit." },
                { color: hsTokens.water, label: "Water chem", desc: "Mineral additions, salt targets, mash pH." },
                { color: hsTokens.hops, label: "BJCP style guide", desc: "In-range gauges per metric, by style." },
                { color: hsTokens.muted, label: "Equipment-aware", desc: "Boil-off, deadspace, absorption baked in." },
              ].map((f) => (
                <HSCard key={f.label} shadow={2} padding="14px 16px">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <HSIngredientDot color={f.color} shape="square" size={14} />
                    <span style={{ fontFamily: hsTokens.body, fontWeight: 700, fontSize: 14 }}>
                      {f.label}
                    </span>
                  </div>
                  <p style={{ marginTop: 6, fontSize: 12, color: hsTokens.muted, lineHeight: 1.4 }}>
                    {f.desc}
                  </p>
                </HSCard>
              ))}
            </div>

            <div style={{ marginTop: 28 }}>
              <HSButton href="/recipes/new" variant="solid" color={hsTokens.hops} arrow size="md">
                Open builder
              </HSButton>
            </div>
          </div>

          {/* Decorative mock builder card */}
          <div style={{ position: "relative" }}>
            <HSCard
              shadow={3}
              tilt={-1.5}
              padding={0}
              bg={hsTokens.honey}
              style={{
                position: "absolute",
                inset: "32px 32px auto auto",
                width: "75%",
                height: 220,
              }}
            >
              <span style={{ display: "none" }} aria-hidden />
            </HSCard>
            <HSCard shadow={4} padding="22px 22px 18px">
              <HSEyebrow>Tuesday pale</HSEyebrow>
              <div
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 28,
                  letterSpacing: "-0.035em",
                  margin: "6px 0 14px",
                }}
              >
                Maris Otter Pale
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                  marginBottom: 18,
                }}
              >
                {[
                  { label: "OG", value: "1.054", accent: hsTokens.malt },
                  { label: "FG", value: "1.012", accent: hsTokens.malt },
                  { label: "ABV", value: "5.5%", accent: hsTokens.yeast },
                  { label: "IBU", value: "38", accent: hsTokens.hops },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: hsTokens.cream2,
                      borderTop: `4px solid ${s.accent}`,
                      borderRadius: 8,
                      padding: "10px 10px 8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: hsTokens.muted,
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontFamily: hsTokens.display,
                        fontSize: 20,
                        letterSpacing: "-0.035em",
                        marginTop: 2,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <HSEyebrow>Grain bill</HSEyebrow>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { name: "Maris Otter", grams: 4500, width: "82%" },
                  { name: "Crystal 60L", grams: 350, width: "12%" },
                  { name: "Munich II", grams: 250, width: "6%" },
                ].map((g) => (
                  <div key={g.name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontFamily: hsTokens.body, fontSize: 12, width: 90, flexShrink: 0 }}>
                      {g.name}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 10,
                        background: hsTokens.cream,
                        border: `1.5px solid ${hsTokens.ink}`,
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: g.width,
                          height: "100%",
                          background: hsTokens.malt,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: hsTokens.mono,
                        fontSize: 11,
                        color: hsTokens.muted,
                        width: 56,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {g.grams} g
                    </span>
                  </div>
                ))}
              </div>
            </HSCard>
          </div>
        </div>
        <style>{`
          @media (max-width: 1024px) {
            .hs-feature-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          }
        `}</style>
      </section>

      {/* ───────────────────── Section 02 — Calculators ───────────────────── */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px)",
        }}
      >
        <HSSectionHeader
          index={2}
          kicker="brew-day math without the spreadsheet —"
          eyebrow="Calculators"
          title="The numbers you'll need, ready when you are."
          kickerColor={hsTokens.water}
        />
        <div
          className="hs-calc-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 18,
          }}
        >
          {CALC_PREVIEW.map((c) => (
            <Link
              key={c.eyebrow}
              href="/calculators"
              style={{ textDecoration: "none", color: hsTokens.ink }}
            >
              <HSCard shadow={3} padding="20px" style={{ position: "relative" }}>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    width: 50,
                    height: 50,
                    background: c.color,
                    border: `2px solid ${hsTokens.ink}`,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: hsTokens.ink,
                  }}
                >
                  <Glyph kind={c.glyph} size={26} color={hsTokens.ink} />
                </div>
                <HSEyebrow>{c.eyebrow}</HSEyebrow>
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 48,
                    letterSpacing: "-0.04em",
                    lineHeight: 0.9,
                    marginTop: 12,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {c.value}
                </div>
                <div
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 13,
                    color: hsTokens.muted,
                    marginTop: 6,
                  }}
                >
                  {c.subtitle}
                </div>
                <div style={{ marginTop: 14 }}>
                  <HSScriptNote color={hsTokens.muted} size={18} rotate={-3}>
                    tap to open →
                  </HSScriptNote>
                </div>
              </HSCard>
            </Link>
          ))}
        </div>
        <style>{`
          @media (max-width: 1024px) {
            .hs-calc-grid { grid-template-columns: 1fr 1fr !important; }
          }
          @media (max-width: 640px) {
            .hs-calc-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>

      {/* ───────────────────── Section 03 — Your library ───────────────────── */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px) clamp(56px, 8vw, 96px)",
        }}
      >
        <HSSectionHeader
          index={3}
          kicker="most recent —"
          eyebrow="Your library"
          title="Pick up where you left off."
          kickerColor={hsTokens.hops}
          alignEnd={
            recipeCount > 3 ? (
              <Link
                href="/recipes"
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
                Browse all {recipeCount} →
              </Link>
            ) : undefined
          }
        />

        {recentRecipes.length === 0 ? (
          <HSCard shadow={3} padding="32px 28px" style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
            <HSScriptNote color={hsTokens.yeast} size={22}>
              empty shelf —
            </HSScriptNote>
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 28,
                letterSpacing: "-0.035em",
                margin: "10px 0 8px",
              }}
            >
              Build your first recipe.
            </div>
            <p style={{ fontSize: 14, color: hsTokens.muted, lineHeight: 1.5, margin: "0 0 18px" }}>
              Pick a style, drop in grain and hops, and watch the numbers settle into shape.
            </p>
            <HSButton href="/recipes/new" variant="ink" color={hsTokens.malt} arrow>
              Start a recipe
            </HSButton>
          </HSCard>
        ) : (
          <div
            className="hs-library-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 20,
            }}
          >
            {recentRecipes.map((recipe, idx) => {
              const tilts = [-1.2, 0.8, -0.6];
              const calc = recipeCalculationService.calculate(recipe);
              const srm = calc.srm ?? 0;
              const srmColor = srmToRgb(srm);
              return (
                <HSCardLift
                  key={recipe.id}
                  href={`/recipes/${recipe.id}`}
                  ariaLabel={recipe.name || "Untitled recipe"}
                  ctaColor={hsTokens.hops}
                >
                  <HSCard
                    shadow={3}
                    tilt={tilts[idx % tilts.length]}
                    padding={0}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ height: 16, background: srmColor }} aria-hidden />
                    <div style={{ padding: "16px 18px 18px" }}>
                      <div
                        style={{
                          fontFamily: hsTokens.display,
                          fontSize: 22,
                          letterSpacing: "-0.035em",
                          lineHeight: 1.05,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {recipe.name || "Untitled recipe"}
                      </div>
                      <div
                        style={{
                          fontStyle: "italic",
                          fontSize: 13,
                          color: hsTokens.muted,
                          marginTop: 4,
                          minHeight: 18,
                        }}
                      >
                        {recipe.style || "no style set"}
                      </div>
                      {(recipe.tags ?? []).length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          {(recipe.tags ?? []).slice(0, 3).map((t) => (
                            <span
                              key={t}
                              style={{
                                fontFamily: hsTokens.body,
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                background: `color-mix(in oklch, ${hsTokens.hops} 22%, ${hsTokens.cream2})`,
                                color: hsTokens.ink,
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`,
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 14,
                          display: "grid",
                          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                          gap: 8,
                        }}
                      >
                        {[
                          { label: "ABV", value: `${(calc.abv ?? 0).toFixed(1)}%`, accent: hsTokens.yeast },
                          { label: "IBU", value: `${Math.round(calc.ibu ?? 0)}`, accent: hsTokens.hops },
                          { label: "SRM", value: `${(calc.srm ?? 0).toFixed(0)}`, accent: hsTokens.roast },
                          { label: "OG", value: `${(calc.og ?? 0).toFixed(3)}`, accent: hsTokens.malt },
                        ].map((s) => (
                          <div
                            key={s.label}
                            style={{
                              background: hsTokens.cream2,
                              borderTop: `3px solid ${s.accent}`,
                              borderRadius: 6,
                              padding: "8px 6px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: hsTokens.muted,
                              }}
                            >
                              {s.label}
                            </div>
                            <div
                              style={{
                                fontFamily: hsTokens.display,
                                fontSize: 14,
                                letterSpacing: "-0.03em",
                                marginTop: 2,
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {s.value}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: 12,
                          fontFamily: hsTokens.mono,
                          fontSize: 10,
                          color: hsTokens.muted,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        updated {recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString() : "—"}
                      </div>
                    </div>
                  </HSCard>
                </HSCardLift>
              );
            })}
          </div>
        )}

        <style>{`
          @media (max-width: 1024px) {
            .hs-library-grid { grid-template-columns: 1fr 1fr !important; }
          }
          @media (max-width: 640px) {
            .hs-library-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </section>
    </>
  );
}
