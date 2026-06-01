"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSCardLift from "@/modules/hopskip/components/HSCardLift";
import LandingSectionHeader from "./LandingSectionHeader";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { COPY } from "../data";

const SMOOTH = [0.22, 1, 0.36, 1] as const;
const TILTS = [-1.2, 0.8, -0.6];

const DEMO_RECIPES = [
  {
    id: "demo-1",
    name: "House Pale",
    style: "American Pale Ale",
    tags: ["citra", "house", "tuesday"],
    srm: 5,
    abv: 5.4,
    ibu: 38,
    og: 1.052,
    updated: "yesterday",
  },
  {
    id: "demo-2",
    name: "Festbier Lager",
    style: "Festbier",
    tags: ["lager", "fall"],
    srm: 7,
    abv: 5.9,
    ibu: 24,
    og: 1.056,
    updated: "3d ago",
  },
  {
    id: "demo-3",
    name: "Porter v3",
    style: "English Porter",
    tags: ["porter", "winter"],
    srm: 28,
    abv: 5.2,
    ibu: 32,
    og: 1.054,
    updated: "1w ago",
  },
];

export default function SectionLibraryDemo() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding:
          "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px) clamp(40px, 6vw, 72px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: SMOOTH }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          background: hsTokens.cream2,
          border: `1.5px dashed ${hsTokens.ink}`,
          borderRadius: 999,
          fontFamily: hsTokens.body,
          fontSize: 11,
          fontWeight: 600,
          color: hsTokens.muted,
          marginBottom: 18,
          letterSpacing: "0.02em",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: hsTokens.yeast,
          }}
        />
        {COPY.library.previewNote}
      </motion.div>

      <LandingSectionHeader
        index={5}
        eyebrow={COPY.library.eyebrow}
        title={COPY.library.title}
      />

      <div
        className="hs-v2-library-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 20,
        }}
      >
        {DEMO_RECIPES.map((recipe, idx) => {
          const srmColor = srmToRgb(recipe.srm);
          return (
            <motion.div
              key={recipe.id}
              initial={{ opacity: 0, y: -24, scale: 0.94, rotate: 0 }}
              animate={
                inView
                  ? {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      rotate: TILTS[idx % TILTS.length],
                    }
                  : {}
              }
              transition={{
                duration: 0.65,
                delay: 0.3 + idx * 0.1,
                ease: SMOOTH,
              }}
              style={{ transformOrigin: "center center" }}
            >
              <HSCardLift
                href="/recipes"
                ariaLabel={recipe.name}
                ctaColor={hsTokens.hops}
              >
                <HSCard
                  shadow={3}
                  padding={0}
                  style={{ overflow: "hidden" }}
                >
                  <div
                    style={{ height: 16, background: srmColor }}
                    aria-hidden
                  />
                  <div style={{ padding: "16px 18px 18px" }}>
                    <div
                      style={{
                        fontFamily: hsTokens.display,
                        fontSize: 22,
                        letterSpacing: "-0.035em",
                        lineHeight: 1.05,
                      }}
                    >
                      {recipe.name}
                    </div>
                    <div
                      style={{
                        fontStyle: "italic",
                        fontSize: 13,
                        color: hsTokens.muted,
                        marginTop: 4,
                      }}
                    >
                      {recipe.style}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 10,
                      }}
                    >
                      {recipe.tags.map((t) => (
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
                          value: `${recipe.abv.toFixed(1)}%`,
                          accent: hsTokens.yeast,
                        },
                        {
                          label: "IBU",
                          value: `${recipe.ibu}`,
                          accent: hsTokens.hops,
                        },
                        {
                          label: "SRM",
                          value: `${recipe.srm}`,
                          accent: hsTokens.roast,
                        },
                        {
                          label: "OG",
                          value: recipe.og.toFixed(3),
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

                    <div
                      style={{
                        marginTop: 12,
                        fontFamily: hsTokens.mono,
                        fontSize: 10,
                        color: hsTokens.muted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      updated {recipe.updated}
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
          .hs-v2-library-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .hs-v2-library-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
