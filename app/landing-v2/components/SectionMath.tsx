"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSEyebrow from "@/modules/hopskip/components/HSEyebrow";
import LandingSectionHeader from "./LandingSectionHeader";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import Glyph from "@/modules/hopskip/components/Glyph";
import { COPY } from "../data";

const SMOOTH = [0.22, 1, 0.36, 1] as const;
const SPRINGY = [0.34, 1.56, 0.64, 1] as const;

const CALC_PREVIEW: {
  eyebrow: string;
  value: string;
  subtitle: string;
  color: string;
  glyph: "drop" | "hop" | "scale";
}[] = [
  {
    eyebrow: "ABV",
    value: "5.51%",
    subtitle: "from gravity",
    color: hsTokens.malt,
    glyph: "drop",
  },
  {
    eyebrow: "IBU",
    value: "38",
    subtitle: "Tinseth",
    color: hsTokens.hops,
    glyph: "hop",
  },
  {
    eyebrow: "Boil-off",
    value: "9.2%",
    subtitle: "to target OG",
    color: hsTokens.roast,
    glyph: "scale",
  },
];

interface QuestionTile {
  text: string;
  bg: string;
  fg: string;
  /** Final position within the questions zone, in % */
  top: string;
  left: string;
  rotate: number;
  /** Where it flies in from */
  fromX: number;
  fromY: number;
  /** Relative size */
  size: "sm" | "md" | "lg";
}

const QUESTIONS: QuestionTile[] = [
  // Big anchors — the canonical 4 from voice-and-tone
  {
    text: "Did I hit my OG?",
    bg: hsTokens.malt,
    fg: hsTokens.ink,
    top: "0%",
    left: "2%",
    rotate: -5,
    fromX: -320,
    fromY: -160,
    size: "lg",
  },
  {
    text: "What do I do now that I didn't?",
    bg: hsTokens.roast,
    fg: "#ffffff",
    top: "5%",
    left: "42%",
    rotate: 3,
    fromX: 280,
    fromY: -140,
    size: "lg",
  },
  {
    text: "How long do I boil?",
    bg: hsTokens.water,
    fg: "#ffffff",
    top: "62%",
    left: "8%",
    rotate: 4,
    fromX: -240,
    fromY: 180,
    size: "md",
  },
  {
    text: "How much priming sugar?",
    bg: hsTokens.hops,
    fg: "#ffffff",
    top: "64%",
    left: "52%",
    rotate: -5,
    fromX: 240,
    fromY: 200,
    size: "md",
  },
  // Smaller accent questions — texture
  {
    text: "Is my mash pH right?",
    bg: hsTokens.yeast,
    fg: "#ffffff",
    top: "30%",
    left: "22%",
    rotate: -7,
    fromX: -180,
    fromY: -40,
    size: "sm",
  },
  {
    text: "What's my BU/GU?",
    bg: hsTokens.water,
    fg: "#ffffff",
    top: "8%",
    left: "78%",
    rotate: 8,
    fromX: 320,
    fromY: -180,
    size: "sm",
  },
  {
    text: "When do I dry hop?",
    bg: hsTokens.hops,
    fg: "#ffffff",
    top: "33%",
    left: "62%",
    rotate: 5,
    fromX: 260,
    fromY: 40,
    size: "sm",
  },
  {
    text: "How much grain do I need?",
    bg: hsTokens.malt,
    fg: hsTokens.ink,
    top: "36%",
    left: "85%",
    rotate: -4,
    fromX: 340,
    fromY: 60,
    size: "sm",
  },
  {
    text: "What yeast pitch rate?",
    bg: hsTokens.yeast,
    fg: "#ffffff",
    top: "66%",
    left: "82%",
    rotate: 6,
    fromX: 320,
    fromY: 180,
    size: "sm",
  },
  {
    text: "Sparge volume?",
    bg: hsTokens.roast,
    fg: "#ffffff",
    top: "38%",
    left: "2%",
    rotate: -8,
    fromX: -260,
    fromY: 40,
    size: "sm",
  },
];

const SIZE_FONT_PX = { sm: 15, md: 20, lg: 25 } as const;
const SIZE_PAD = {
  sm: "9px 16px",
  md: "12px 20px",
  lg: "14px 22px",
} as const;

export default function SectionMath() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const titleWords = COPY.math.title.split(" ");

  return (
    <section
      ref={ref}
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px)",
        position: "relative",
      }}
    >
      <LandingSectionHeader
        index={2}
        kicker={COPY.math.kicker}
        eyebrow={COPY.math.eyebrow}
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
        kickerColor={hsTokens.water}
      />

      {/* Flying questions zone — viewport-wide overflow wrapper so pills can
          enter from outside the section without being clipped at the section
          edge. Inner container keeps positions relative to the section width. */}
      <div
        aria-hidden
        style={{
          position: "relative",
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          marginRight: "calc(50% - 50vw)",
          marginTop: 20,
          marginBottom: 32,
          overflow: "hidden",
        }}
      >
      <div
        aria-hidden
        style={{
          position: "relative",
          height: 360,
          maxWidth: 1600,
          margin: "0 auto",
          padding: "0 clamp(20px, 4vw, 56px)",
          boxSizing: "border-box",
        }}
      >
        {QUESTIONS.map((q, i) => {
          const fontSize = SIZE_FONT_PX[q.size];
          const padding = SIZE_PAD[q.size];
          const shadow = q.size === "lg" ? "5px 5px 0" : q.size === "md" ? "4px 4px 0" : "3px 3px 0";
          return (
            <motion.div
              key={q.text}
              initial={{
                opacity: 0,
                x: q.fromX,
                y: q.fromY,
                rotate: q.rotate * 4,
                scale: 0.6,
              }}
              animate={
                inView
                  ? {
                      opacity: 1,
                      x: 0,
                      y: 0,
                      rotate: q.rotate,
                      scale: 1,
                    }
                  : {}
              }
              transition={{
                duration: 0.85,
                delay: 0.4 + i * 0.12,
                ease: SPRINGY,
              }}
              whileHover={{
                rotate: q.rotate + (q.rotate > 0 ? 2 : -2),
                scale: 1.06,
                transition: { duration: 0.2, ease: SPRINGY },
              }}
              style={{
                position: "absolute",
                top: q.top,
                left: q.left,
                background: q.bg,
                color: q.fg,
                fontFamily: hsTokens.display,
                fontSize,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                padding,
                borderRadius: 14,
                border: `2px solid ${hsTokens.ink}`,
                boxShadow: `${shadow} var(--hs-ink)`,
                whiteSpace: "nowrap",
                cursor: "default",
              }}
            >
              {q.text}
            </motion.div>
          );
        })}
      </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{
          duration: 0.5,
          delay: 1.5,
          ease: SMOOTH,
        }}
        style={{
          maxWidth: 620,
          marginBottom: 32,
          fontFamily: hsTokens.body,
          fontSize: 16,
          fontStyle: "italic",
          lineHeight: 1.5,
          color: hsTokens.ink,
          fontWeight: 500,
        }}
      >
        {COPY.math.closer}
      </motion.div>

      <div
        className="hs-v2-calc-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        {CALC_PREVIEW.map((c, i) => (
          <motion.div
            key={c.eyebrow}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{
              duration: 0.6,
              delay: 1.7 + i * 0.1,
              ease: SMOOTH,
            }}
          >
            <Link
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
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 2.1, ease: SMOOTH }}
        style={{ marginTop: 24, textAlign: "right" }}
      >
        <Link
          href={COPY.math.endHref}
          style={{
            fontFamily: hsTokens.body,
            fontSize: 13,
            fontWeight: 700,
            color: hsTokens.ink,
            textDecoration: "none",
            letterSpacing: "0.02em",
          }}
        >
          {COPY.math.endLink}
        </Link>
      </motion.div>

      <style>{`
        @media (max-width: 1024px) {
          .hs-v2-calc-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .hs-v2-calc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
