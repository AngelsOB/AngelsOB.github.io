"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSCardLift from "@/modules/hopskip/components/HSCardLift";
import LandingSectionHeader from "./LandingSectionHeader";
import type { CommunityRecipeCard } from "../lib/communityCard";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { COPY } from "../data";

const SMOOTH = [0.22, 1, 0.36, 1] as const;
const TILTS = [-0.6, 0.5, -0.4, 0.7, -0.3, 0.6];

interface Props {
  recipes: CommunityRecipeCard[];
}

export default function SectionCommunity({ recipes }: Props) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  if (!recipes.length) return null;

  return (
    <section
      ref={ref}
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px)",
      }}
    >
      <LandingSectionHeader
        index={4}
        eyebrow={COPY.community.eyebrow}
        title={COPY.community.title}
        alignEnd={
          <Link
            href={COPY.community.endHref}
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
            {COPY.community.endLink}
          </Link>
        }
      />

      <div
        className="home-community-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
        }}
      >
        {recipes.slice(0, 6).map((recipe, idx) => {
          const tilt = TILTS[idx % TILTS.length];
          const srmColor = srmToRgb(recipe.stats.srm);
          return (
            <motion.div
              key={recipe.shareSlug}
              initial={{ opacity: 0, y: -32, scale: 0.92, rotate: 0 }}
              animate={
                inView
                  ? { opacity: 1, y: 0, scale: 1, rotate: tilt }
                  : {}
              }
              transition={{
                duration: 0.65,
                delay: 0.15 + idx * 0.08,
                ease: SMOOTH,
              }}
              style={{ transformOrigin: "center center" }}
            >
              <HSCardLift
                href={`/r/${recipe.shareSlug}`}
                ariaLabel={recipe.name}
              >
                <HSCard
                  shadow={3}
                  padding={0}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    style={{ height: 14, background: srmColor }}
                    aria-hidden
                  />
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
                      {recipe.name}
                    </div>
                    {recipe.style ? (
                      <div
                        style={{
                          fontStyle: "italic",
                          fontSize: 13,
                          color: hsTokens.muted,
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {recipe.style}
                      </div>
                    ) : null}
                    <div
                      style={{
                        marginTop: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        fontFamily: hsTokens.body,
                        fontSize: 12,
                        color: hsTokens.muted,
                      }}
                    >
                      <span>by {recipe.ownerName}</span>
                      {recipe.forkCount > 0 ? (
                        <>
                          <span aria-hidden style={{ opacity: 0.5 }}>
                            ·
                          </span>
                          <span
                            style={{
                              fontFamily: hsTokens.mono,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {recipe.forkCount}{" "}
                            {recipe.forkCount === 1 ? "fork" : "forks"}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {recipe.tags.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 6,
                          marginTop: 10,
                        }}
                      >
                        {recipe.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            style={{
                              fontFamily: hsTokens.body,
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              background: `color-mix(in oklch, ${hsTokens.water} 22%, ${hsTokens.cream2})`,
                              color: hsTokens.ink,
                              padding: "2px 8px",
                              borderRadius: 999,
                              border: `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                        {recipe.tags.length > 3 ? (
                          <span
                            style={{
                              fontFamily: hsTokens.body,
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              background: hsTokens.cream2,
                              color: hsTokens.muted,
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            +{recipe.tags.length - 3}
                          </span>
                        ) : null}
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
                        {
                          label: "ABV",
                          value: `${recipe.stats.abv.toFixed(1)}%`,
                          accent: hsTokens.yeast,
                        },
                        {
                          label: "IBU",
                          value: `${Math.round(recipe.stats.ibu)}`,
                          accent: hsTokens.hops,
                        },
                        {
                          label: "OG",
                          value: recipe.stats.og.toFixed(3),
                          accent: hsTokens.malt,
                        },
                        {
                          label: "FG",
                          value: recipe.stats.fg.toFixed(3),
                          accent: hsTokens.malt,
                        },
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
                  </div>
                </HSCard>
              </HSCardLift>
            </motion.div>
          );
        })}
      </div>
      <style>{`
        @media (max-width: 1024px) {
          .home-community-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .home-community-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
