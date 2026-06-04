"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import { EASE, STAGES } from "../data";

// PRD section 7, stage 2. Two sentences. First (long atmospheric one) gets
// the standard sentence reveal (opacity 0->1, y 12->0, 700ms SMOOTH). Second
// (the "I made this..." closer) lands as a beat: 900ms duration, delayed so
// it follows the first by ~200ms after the first settles.
//
// Triggered when the section enters view. Once only — replay would feel
// gimmicky on scroll-back.
export default function StageOpening() {
  const ref = useRef<HTMLElement | null>(null);
  // -120px margin: start the reveal slightly before the section fully enters
  // view so the visitor's eye isn't on blank space waiting.
  const inView = useInView(ref, { once: true, margin: "-120px" });

  return (
    <section
      ref={ref}
      style={{
        paddingTop: "clamp(56px, 8vw, 96px)",
        paddingBottom: "clamp(56px, 8vw, 96px)",
      }}
    >
      {STAGES.opening.sentences.map((sentence, i) => {
        const isFinal = i === STAGES.opening.sentences.length - 1;
        return (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : undefined}
            transition={{
              duration: isFinal ? 0.9 : 0.7,
              delay: i * 0.9,
              ease: EASE.smooth,
            }}
            style={{
              fontFamily: hsTokens.display,
              fontStyle: "italic",
              fontSize: "clamp(20px, 2.4vw, 24px)",
              lineHeight: 1.5,
              color: hsTokens.ink,
              maxWidth: 560,
              marginTop: i === 0 ? 0 : 24,
            }}
          >
            {sentence}
          </motion.p>
        );
      })}
    </section>
  );
}
