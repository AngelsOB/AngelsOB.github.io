"use client";

import { motion } from "framer-motion";
import HSButton from "@/modules/hopskip/components/HSButton";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import { hsTokens } from "@/modules/hopskip/tokens";
import { CTA, EASE, STAGES } from "../data";

// PRD section 7, stage 1. On-mount reveal cascade (above the fold so no
// useInView). Kicker -> H1 words (staggered) -> subhead -> CTA cluster ->
// trust line -> stat pills. SMOOTH easing throughout.
//
// Headline word delays: 6 words at 0.09s stagger from 0.15s. Subhead, CTAs,
// trust, and pills then layer in at fixed delays per PRD.
const WORD_DELAYS = [0.15, 0.24, 0.33, 0.42, 0.51, 0.6];

export default function StageHero({ recipeCount }: { recipeCount: number }) {
  // Full headline text rebuilt for aria-label so screen readers read the
  // sentence as one phrase rather than 6 dis­joint words.
  const headlineText = STAGES.hero.headlineWords.map((w) => w.text).join(" ");

  return (
    <section
      style={{
        paddingTop: 0,
        paddingBottom: "clamp(56px, 8vw, 96px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE.smooth }}
      >
        <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
          {STAGES.hero.kicker}
        </HSScriptNote>
      </motion.div>

      <h1
        aria-label={headlineText}
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(44px, 6.5vw, 100px)",
          letterSpacing: "-0.04em",
          lineHeight: 0.95,
          margin: "12px 0 0",
          color: hsTokens.ink,
          maxWidth: 700,
        }}
      >
        {STAGES.hero.headlineWords.map((word, i) => {
          const isLast = i === STAGES.hero.headlineWords.length - 1;
          return (
            <span key={i} aria-hidden>
              <Word
                delay={WORD_DELAYS[i] ?? WORD_DELAYS[WORD_DELAYS.length - 1]}
                color={word.color === "roast" ? hsTokens.roast : undefined}
              >
                {word.text}
              </Word>
              {word.breakAfter ? <br /> : isLast ? null : " "}
            </span>
          );
        })}
      </h1>

      {/* PRD section 10: hero subhead is wrapped in <h2> for semantic SEO,
          styled to look identical to a paragraph subhead. */}
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.7, ease: EASE.smooth }}
        style={{
          fontFamily: hsTokens.body,
          fontSize: 17,
          fontWeight: 400,
          lineHeight: 1.55,
          color: hsTokens.muted,
          maxWidth: 480,
          marginTop: 22,
        }}
      >
        {STAGES.hero.subhead}
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.95, ease: EASE.smooth }}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 14,
          marginTop: 28,
          alignItems: "center",
        }}
      >
        <HSButton
          href={CTA.primary.href}
          variant="ink"
          color={hsTokens.roast}
          size="lg"
          arrow
        >
          {CTA.primary.label}
        </HSButton>
        {CTA.secondary.map((s) => (
          <a
            key={s.href}
            href={s.href}
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              fontWeight: 600,
              color: hsTokens.ink,
              textDecoration: "none",
            }}
          >
            {s.label} →
          </a>
        ))}
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 1.05, ease: EASE.smooth }}
        style={{
          marginTop: 16,
          fontFamily: hsTokens.body,
          fontSize: 13,
          color: hsTokens.muted,
          fontStyle: "italic",
          maxWidth: 480,
        }}
      >
        {CTA.trust}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 1.2, ease: EASE.smooth }}
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
    </section>
  );
}

// Per PRD section 8 (Text reveals — Words): opacity 0->1, y 20->0, blur 10px->0.
// 550ms SMOOTH. Per-word stagger applied via delay prop.
function Word({
  children,
  delay,
  color,
}: {
  children: React.ReactNode;
  delay: number;
  color?: string;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE.smooth }}
      style={{
        display: "inline-block",
        color,
      }}
    >
      {children}
    </motion.span>
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
