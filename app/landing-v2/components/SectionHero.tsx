"use client";

import { motion } from "framer-motion";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSButton from "@/modules/hopskip/components/HSButton";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import HeroBuilderCard from "./HeroBuilderCard";
import { COPY } from "../data";

const SMOOTH = [0.22, 1, 0.36, 1] as const;

interface Props {
  recipeCount: number;
}

export default function SectionHero({ recipeCount }: Props) {
  return (
    <section
      style={{
        background: hsTokens.cream,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <SectionBlobs />
      <div
        className="hs-v2-hero"
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding:
            "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) clamp(48px, 6vw, 84px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          alignItems: "start",
          gap: 48,
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Left column */}
        <div style={{ minWidth: 0 }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: SMOOTH }}
          >
            <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
              {COPY.hero.kicker}
            </HSScriptNote>
          </motion.div>

          <h1
            style={{
              fontFamily: hsTokens.display,
              fontSize: "clamp(44px, 6.5vw, 100px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.92,
              margin: "12px 0 0",
              color: hsTokens.ink,
              maxWidth: 700,
            }}
          >
            <Word delay={0.15}>A</Word>
            <br />
            <SimplerHighlight delay={0.25} />
            <br />
            <Word delay={0.35} color={hsTokens.roast}>
              place
            </Word>{" "}
            <Word delay={0.43} color={hsTokens.roast}>
              to
            </Word>{" "}
            <Word delay={0.51} color={hsTokens.roast}>
              brew.
            </Word>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7, ease: SMOOTH }}
            style={{
              fontFamily: hsTokens.body,
              fontSize: 17,
              lineHeight: 1.55,
              color: hsTokens.muted,
              maxWidth: 480,
              marginTop: 22,
            }}
          >
            {COPY.hero.subhead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.95, ease: SMOOTH }}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              marginTop: 28,
              alignItems: "center",
            }}
          >
            <HSButton
              href={COPY.hero.primaryHref}
              variant="ink"
              color={hsTokens.roast}
              size="lg"
              arrow
            >
              {COPY.hero.primaryCta}
            </HSButton>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.2, ease: SMOOTH }}
            style={{
              marginTop: 20,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <StatPill
              color={hsTokens.roast}
              value={recipeCount.toLocaleString()}
              label="recipes in the library"
            />
            <StatPill color={hsTokens.water} value="20+" label="live calculations" />
            <StatPill color={hsTokens.hops} value="0" label="spreadsheets needed" />
          </motion.div>
        </div>

        {/* Right column — builder card + annotation */}
        <div
          style={{
            position: "relative",
            minWidth: 0,
          }}
        >
          <HeroBuilderCard />
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .hs-v2-hero {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
      `}</style>
    </section>
  );
}

function StatPill({
  color,
  value,
  label,
}: {
  color: string;
  value: string;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 10px",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        fontFamily: hsTokens.body,
        fontSize: 12,
        color: hsTokens.muted,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          background: color,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 14,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span style={{ color: hsTokens.muted }}>{label}</span>
    </span>
  );
}

/**
 * "simpler" word: the text reveals once and stays still. The malt-yellow
 * highlighter rectangle behind it gently floats so the page has a small
 * ambient motion without the headline itself moving.
 */
function SimplerHighlight({ delay }: { delay: number }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        padding: "0 14px",
        transform: "rotate(-1.5deg)",
        isolation: "isolate",
      }}
    >
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scaleX: 0.6, scaleY: 0.7 }}
        animate={{
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          y: [0, -2.5, 0, 2.5, 0],
          rotate: [0, 0.7, 0, -0.7, 0],
        }}
        transition={{
          opacity: { duration: 0.5, delay, ease: SMOOTH },
          scaleX: { duration: 0.5, delay, ease: SMOOTH },
          scaleY: { duration: 0.5, delay, ease: SMOOTH },
          y: {
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay + 1.2,
          },
          rotate: {
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay + 1.2,
          },
        }}
        style={{
          position: "absolute",
          inset: "0.04em 0",
          background: hsTokens.malt,
          boxShadow: "3px 3px 0 var(--hs-ink)",
          zIndex: -1,
          transformOrigin: "center",
        }}
      />
      <motion.span
        initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut", delay }}
        style={{
          display: "inline-block",
          position: "relative",
        }}
      >
        simpler
      </motion.span>
    </span>
  );
}

function Word({
  children,
  delay,
  color,
  style,
}: {
  children: React.ReactNode;
  delay: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
      style={{
        display: "inline-block",
        color,
        ...style,
      }}
    >
      {children}
    </motion.span>
  );
}

function SectionBlobs() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "5%",
          width: 320,
          height: 320,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.malt} 18%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "8%",
          width: 280,
          height: 280,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.water} 14%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "30%",
          width: 600,
          height: 400,
          background: `radial-gradient(ellipse, color-mix(in oklab, ${hsTokens.hops} 10%, transparent) 0%, transparent 70%)`,
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}
