"use client";

import { motion } from "framer-motion";
import { hsTokens } from "@/modules/hopskip/tokens";
import { EASE, STAGES } from "../data";
import { useStageInView } from "../lib/useStageInView";
import { useStageTabTrigger } from "../lib/useStageTabTrigger";
import ParagraphReveal, { endDelay } from "./ParagraphReveal";
import StageEyebrow from "./StageEyebrow";

const LEAD_DELAY = 0.1;
const GAP = 0.15;

export default function StageGrains({
  onEnter,
  onLeave,
}: {
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  // Reveal trigger: eager (content fades in as the section enters from below).
  const { ref, inView } = useStageInView<HTMLElement>();
  // Tab trigger: late (mock swap only happens when the lead h3 is the
  // focal point of the viewport).
  const leadRef = useStageTabTrigger<HTMLHeadingElement>(onEnter, onLeave);

  const bodyDelay = endDelay(STAGES.grains.lead, LEAD_DELAY) + GAP;

  return (
    <section
      ref={ref}
      style={{
        paddingTop: "clamp(56px, 8vw, 96px)",
        paddingBottom: "clamp(56px, 8vw, 96px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.4, ease: EASE.smooth }}
      >
        <StageEyebrow>{STAGES.grains.h2}</StageEyebrow>
      </motion.div>

      <h3
        ref={leadRef}
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(28px, 3.5vw, 44px)",
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          color: hsTokens.ink,
          margin: "10px 0 18px",
          maxWidth: 540,
        }}
      >
        <ParagraphReveal
          text={STAGES.grains.lead}
          inView={inView}
          baseDelay={LEAD_DELAY}
        />
      </h3>

      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 17,
          lineHeight: 1.6,
          color: hsTokens.muted,
          maxWidth: 480,
        }}
      >
        <ParagraphReveal
          text={STAGES.grains.body}
          inView={inView}
          baseDelay={bodyDelay}
        />
      </p>
    </section>
  );
}
