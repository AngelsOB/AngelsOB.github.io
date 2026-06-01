"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";

const SMOOTH = [0.22, 1, 0.36, 1] as const;

interface Props {
  index: number;
  kicker?: string;
  kickerColor?: string;
  eyebrow?: string;
  title: ReactNode;
  alignEnd?: ReactNode;
}

export default function LandingSectionHeader({
  index,
  kicker,
  kickerColor,
  eyebrow,
  title,
  alignEnd,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const indexStr = String(index).padStart(2, "0");

  return (
    <div ref={ref} className="lv2-section-header">
      <div
        className="lv2-section-header-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "auto minmax(0, 1fr) auto",
          alignItems: "start",
          gap: "clamp(18px, 3vw, 36px)",
          marginBottom: "clamp(20px, 3vw, 32px)",
        }}
      >
        {/* Big index numeral — sized to fill the title block's vertical space */}
        <motion.div
          initial={{ opacity: 0, x: -16, scale: 0.85 }}
          animate={inView ? { opacity: 1, x: 0, scale: 1 } : {}}
          transition={{ duration: 0.6, ease: SMOOTH }}
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(120px, 17vw, 240px)",
            lineHeight: 0.74,
            letterSpacing: "-0.07em",
            color: `color-mix(in oklch, ${hsTokens.ink} 14%, transparent)`,
            fontVariantNumeric: "tabular-nums",
            userSelect: "none",
            paddingTop: 0,
            marginBottom: "-0.12em",
          }}
          aria-hidden
        >
          {indexStr}
        </motion.div>

        {/* Content block */}
        <div style={{ minWidth: 0, paddingTop: "clamp(12px, 1.8vw, 22px)" }}>
          {kicker ? (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.45, delay: 0.12, ease: SMOOTH }}
              style={{
                fontFamily: hsTokens.script,
                fontSize: "clamp(20px, 2vw, 26px)",
                color: kickerColor ?? hsTokens.yeast,
                transform: "rotate(-2deg)",
                display: "inline-block",
                marginBottom: 6,
                letterSpacing: "-0.005em",
              }}
            >
              {kicker}
            </motion.div>
          ) : null}
          {eyebrow ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: 0.18, ease: SMOOTH }}
              style={{
                fontFamily: hsTokens.body,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: hsTokens.muted,
                marginBottom: 12,
              }}
            >
              {eyebrow}
            </motion.div>
          ) : null}
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.24, ease: SMOOTH }}
            style={{
              fontFamily: hsTokens.display,
              fontSize: "clamp(38px, 5.2vw, 64px)",
              letterSpacing: "-0.035em",
              lineHeight: 1.02,
              margin: 0,
              color: hsTokens.ink,
            }}
          >
            {title}
          </motion.h2>
        </div>

        {/* End slot */}
        {alignEnd ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.3, ease: SMOOTH }}
            style={{ paddingTop: "clamp(20px, 2.5vw, 32px)" }}
          >
            {alignEnd}
          </motion.div>
        ) : null}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .lv2-section-header-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </div>
  );
}
