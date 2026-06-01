"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSButton from "@/modules/hopskip/components/HSButton";
import HSIngredientDot from "@/modules/hopskip/components/HSIngredientDot";
import LandingSectionHeader from "./LandingSectionHeader";
import RecipeBuilderMock from "./RecipeBuilderMock";
import { COPY } from "../data";

const SMOOTH = [0.22, 1, 0.36, 1] as const;

const PILL_COLORS = [
  hsTokens.malt,
  hsTokens.water,
  hsTokens.hops,
  hsTokens.muted,
];

export default function SectionBrewDay() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const titleWords = COPY.brewDay.title.split(" ");

  return (
    <section
      ref={ref}
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <LandingSectionHeader
        index={1}
        eyebrow={COPY.brewDay.eyebrow}
        title={
          <span>
            {titleWords.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                initial={{ opacity: 0, filter: "blur(10px)", y: 18 }}
                animate={
                  inView
                    ? { opacity: 1, filter: "blur(0px)", y: 0 }
                    : {}
                }
                transition={{
                  duration: 0.5,
                  ease: "easeOut",
                  delay: i * 0.06,
                }}
                style={{
                  display: "inline-block",
                  marginRight: "0.22em",
                }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        }
      />

      <div
        className="hs-v2-brewday-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.15fr)",
          gap: 48,
          alignItems: "start",
        }}
      >
        <div>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.5, ease: SMOOTH }}
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: hsTokens.muted,
              marginTop: 0,
              maxWidth: 460,
            }}
          >
            {COPY.brewDay.body}
          </motion.p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginTop: 26,
            }}
          >
            {COPY.brewDay.pills.map((pill, i) => (
              <motion.div
                key={pill.label}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={
                  inView ? { opacity: 1, y: 0, scale: 1 } : {}
                }
                transition={{
                  duration: 0.55,
                  delay: 0.7 + i * 0.08,
                  ease: SMOOTH,
                }}
              >
                <HSCard shadow={2} padding="14px 16px">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <HSIngredientDot
                      color={PILL_COLORS[i]}
                      shape="square"
                      size={14}
                    />
                    <span
                      style={{
                        fontFamily: hsTokens.body,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      {pill.label}
                    </span>
                  </div>
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: hsTokens.muted,
                      lineHeight: 1.45,
                    }}
                  >
                    {pill.desc}
                  </p>
                </HSCard>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 1.1, ease: SMOOTH }}
            style={{ marginTop: 28 }}
          >
            <HSButton
              href={COPY.brewDay.ctaHref}
              variant="solid"
              color={hsTokens.hops}
              size="md"
              arrow
            >
              {COPY.brewDay.cta}
            </HSButton>
          </motion.div>
        </div>

        <div style={{ minWidth: 0 }}>
          <RecipeBuilderMock />
        </div>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .hs-v2-brewday-grid {
            grid-template-columns: 1fr !important;
            gap: 32px !important;
          }
        }
      `}</style>
    </section>
  );
}
