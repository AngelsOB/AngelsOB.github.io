"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useState } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

const SMOOTH = [0.22, 1, 0.36, 1] as const;
const SPRINGY = [0.34, 1.56, 0.64, 1] as const;
const INK = "var(--hs-ink)";

function useCountUp(
  target: number,
  options: {
    duration?: number;
    delay?: number;
    format?: (v: number) => string;
  } = {}
): MotionValue<string> {
  const { duration = 0.6, delay = 0, format = (v) => v.toFixed(0) } = options;
  const mv = useMotionValue(target);
  const text = useTransform(mv, format);
  useEffect(() => {
    const controls = animate(mv, target, { duration, delay, ease: SMOOTH });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return text;
}

type Grain = {
  name: string;
  category: string;
  srm: number;
  weight: string;
  percent: number; // 0-100
};

type RecipeState = {
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
  grains: Grain[];
  cue: string; // small Caveat text to hint at what just changed
};

// Three states that play "live as you edit": start with one grain, add Crystal,
// add Munich. Then loop back. Stats and the bill stack reshape each cycle.
const STATES: RecipeState[] = [
  {
    og: 1.038,
    fg: 1.01,
    abv: 3.7,
    ibu: 22,
    srm: 4,
    cue: "start with the base —",
    grains: [
      { name: "Maris Otter", category: "Base malt", srm: 4, weight: "5.5 lb", percent: 100 },
    ],
  },
  {
    og: 1.048,
    fg: 1.012,
    abv: 4.7,
    ibu: 32,
    srm: 9,
    cue: "+ a touch of crystal —",
    grains: [
      { name: "Maris Otter", category: "Base malt", srm: 4, weight: "8.5 lb", percent: 88 },
      { name: "Crystal 60L", category: "Crystal", srm: 60, weight: "1.15 lb", percent: 12 },
    ],
  },
  {
    og: 1.054,
    fg: 1.012,
    abv: 5.5,
    ibu: 38,
    srm: 7,
    cue: "+ munich to round —",
    grains: [
      { name: "Maris Otter", category: "Base malt", srm: 4, weight: "9.0 lb", percent: 82 },
      { name: "Crystal 60L", category: "Crystal", srm: 60, weight: "1.3 lb", percent: 12 },
      { name: "Munich II", category: "Base malt", srm: 9, weight: "0.65 lb", percent: 6 },
    ],
  },
];

const RECIPE_META = {
  name: "Maris Otter Pale",
  style: "English Pale Ale · 11A",
  batch: "5 gal · 60 min",
  profile: "BIAB",
};

const TABS = [
  { label: "Fermentables", active: true },
  { label: "Mash", active: false },
  { label: "Hops", active: false },
  { label: "Yeast", active: false },
];

export default function RecipeBuilderMock() {
  const [stateIdx, setStateIdx] = useState(0);
  const state = STATES[stateIdx];

  useEffect(() => {
    // Start cycling after a short settle delay so the card's entrance plays first.
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startId = setTimeout(() => {
      intervalId = setInterval(() => {
        setStateIdx((i) => (i + 1) % STATES.length);
      }, 3200);
    }, 2200);
    return () => {
      clearTimeout(startId);
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  const srmColor = srmToRgb(state.srm);
  const totalLb = state.grains
    .reduce((sum, g) => sum + parseFloat(g.weight), 0)
    .toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.1, ease: SMOOTH }}
      style={{
        position: "relative",
        background: hsTokens.cream,
        padding: "14px 16px 16px",
        border: `2px solid ${INK}`,
        borderRadius: 14,
        boxShadow: "6px 6px 0 var(--hs-ink)",
      }}
    >
      {/* Top toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: SMOOTH }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingBottom: 10,
          borderBottom: `1.5px dashed color-mix(in oklch, ${INK} 25%, transparent)`,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            color: hsTokens.muted,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          ← back to recipes
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: hsTokens.hops,
            border: `2px solid ${INK}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontSize: 11,
            fontWeight: 700,
            color: hsTokens.cream,
            boxShadow: "2px 2px 0 var(--hs-ink)",
          }}
        >
          Save recipe →
        </span>
      </motion.div>

      {/* Title */}
      <div style={{ padding: "12px 0 8px" }}>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.42, ease: SMOOTH }}
          style={{
            fontFamily: hsTokens.display,
            fontSize: 32,
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            color: hsTokens.ink,
          }}
        >
          {RECIPE_META.name}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.55, ease: SMOOTH }}
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <PaperPill label="STYLE" value={`${RECIPE_META.style} ▾`} />
          <PaperPill label="BATCH" value={`${RECIPE_META.batch} ▾`} />
          <GhostPill>Profile · {RECIPE_META.profile} ▾</GhostPill>
        </motion.div>
      </div>

      {/* Stat strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr)) auto",
          gap: 6,
          marginTop: 4,
        }}
      >
        <StatCell
          label="OG"
          target={state.og}
          format={(v) => v.toFixed(3)}
          delay={0}
          accent={hsTokens.malt}
        />
        <StatCell
          label="FG"
          target={state.fg}
          format={(v) => v.toFixed(3)}
          delay={0.05}
          accent={hsTokens.malt}
        />
        <StatCell
          label="ABV"
          target={state.abv}
          format={(v) => `${v.toFixed(1)}%`}
          delay={0.1}
          accent={hsTokens.yeast}
        />
        <StatCell
          label="IBU"
          target={state.ibu}
          format={(v) => Math.round(v).toString()}
          delay={0.15}
          accent={hsTokens.hops}
        />
        <SRMCell color={srmColor} value={state.srm} delay={0.2} />
      </div>

      {/* Tab nav */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          marginTop: 12,
          borderBottom: `2px solid ${INK}`,
          paddingLeft: 4,
        }}
      >
        {TABS.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 1.0 + i * 0.04,
              ease: SMOOTH,
            }}
            style={{
              padding: "7px 11px",
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: t.active ? 700 : 500,
              color: t.active ? hsTokens.ink : hsTokens.muted,
              background: t.active ? hsTokens.paper : "transparent",
              border: t.active ? `2px solid ${INK}` : "2px solid transparent",
              borderBottom: t.active ? "2px solid transparent" : undefined,
              borderRadius: "10px 10px 0 0",
              marginBottom: -2,
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </motion.div>
        ))}
      </div>

      {/* Section card */}
      <div
        style={{
          background: hsTokens.paper,
          border: `2px solid ${INK}`,
          borderTop: "none",
          borderRadius: "0 14px 14px 14px",
          padding: "12px 12px 10px",
          boxShadow: "4px 4px 0 var(--hs-ink)",
        }}
      >
        {/* Section title row */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 1.2, ease: SMOOTH }}
          style={{ marginBottom: 8 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
              borderBottom: `3px solid ${hsTokens.malt}`,
              paddingBottom: 4,
            }}
          >
            <h3
              style={{
                fontFamily: hsTokens.display,
                fontSize: 24,
                letterSpacing: "-0.035em",
                margin: 0,
                color: hsTokens.ink,
                lineHeight: 1,
              }}
            >
              Fermentables.
            </h3>
            <span
              style={{
                fontFamily: hsTokens.body,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: hsTokens.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {state.grains.length} · {totalLb} lb
            </span>
          </div>
        </motion.div>

        {/* Bill stack — segments animate width when state changes */}
        <div
          style={{
            marginTop: 8,
            height: 10,
            background: hsTokens.cream2,
            border: `1.5px solid ${INK}`,
            borderRadius: 999,
            overflow: "hidden",
            display: "flex",
          }}
        >
          {state.grains.map((g) => (
            <motion.div
              key={`stack-${g.name}`}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: `${g.percent}%`, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.7, ease: SMOOTH }}
              style={{
                height: "100%",
                background: srmToRgb(g.srm),
              }}
            />
          ))}
        </div>

        {/* Compact rows — AnimatePresence on add/remove. Fixed minHeight so the
            card doesn't jump when grains animate in/out. */}
        <motion.div
          style={{
            marginTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 5,
            overflow: "hidden",
            minHeight: 132,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {state.grains.map((g) => (
              <motion.div
                key={g.name}
                layout
                initial={{ opacity: 0, x: -16, height: 0 }}
                animate={{ opacity: 1, x: 0, height: "auto" }}
                exit={{ opacity: 0, x: 16, height: 0 }}
                transition={{ duration: 0.45, ease: SMOOTH }}
              >
                <CompactFermRow ferm={g} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}

function PaperPill({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px 4px 10px",
        background: hsTokens.paper,
        border: `2px solid ${INK}`,
        borderRadius: 999,
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 11,
          fontWeight: 600,
          color: hsTokens.ink,
        }}
      >
        {value}
      </span>
    </span>
  );
}

function GhostPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        background: "transparent",
        border: `1.5px solid color-mix(in oklch, ${INK} 35%, transparent)`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 600,
        color: hsTokens.ink,
      }}
    >
      {children}
    </span>
  );
}

function StatCell({
  label,
  target,
  format,
  accent,
}: {
  label: string;
  target: number;
  format: (v: number) => string;
  delay: number;
  accent?: string;
}) {
  const text = useCountUp(target, { duration: 0.7, format });
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: SMOOTH }}
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid ${INK}`,
        borderRadius: 8,
        padding: "7px 6px 6px",
        textAlign: "center",
        boxShadow: "2px 2px 0 var(--hs-ink)",
        overflow: "hidden",
      }}
    >
      {accent ? (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: accent,
          }}
        />
      ) : null}
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </div>
      <motion.div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 17,
          letterSpacing: "-0.035em",
          marginTop: 1,
          fontVariantNumeric: "tabular-nums",
          color: hsTokens.ink,
          lineHeight: 1,
        }}
      >
        {text}
      </motion.div>
    </motion.div>
  );
}

function SRMCell({
  color,
  value,
  delay,
}: {
  color: string;
  value: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, delay, ease: SPRINGY }}
      style={{
        background: hsTokens.paper,
        border: `2px solid ${INK}`,
        borderRadius: 8,
        padding: "5px 10px 6px",
        textAlign: "center",
        boxShadow: "2px 2px 0 var(--hs-ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        SRM
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <BeerGlass color={color} />
        <motion.span
          key={value.toFixed(1)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: SMOOTH }}
          style={{
            fontFamily: hsTokens.display,
            fontSize: 15,
            letterSpacing: "-0.035em",
            fontVariantNumeric: "tabular-nums",
            color: hsTokens.ink,
            lineHeight: 1,
          }}
        >
          {value.toFixed(1)}
        </motion.span>
      </div>
    </motion.div>
  );
}

function BeerGlass({ color }: { color: string }) {
  return (
    <motion.svg
      key={color}
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.35, ease: SMOOTH }}
      width={16}
      height={20}
      viewBox="0 0 22 26"
      aria-hidden
    >
      <defs>
        <clipPath id="glass-clip-hero">
          <path d="M 3 2 L 19 2 L 17 24 L 5 24 Z" />
        </clipPath>
      </defs>
      <path
        d="M 3 2 L 19 2 L 17 24 L 5 24 Z"
        fill={hsTokens.paper}
        stroke={INK}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <motion.rect
        x={3}
        y={6}
        width={16}
        height={18}
        fill={color}
        clipPath="url(#glass-clip-hero)"
        animate={{ fill: color }}
        transition={{ duration: 0.6, ease: SMOOTH }}
      />
      <ellipse
        cx={11}
        cy={5}
        rx={7}
        ry={2}
        fill="#fff8e2"
        stroke={INK}
        strokeWidth={1}
        clipPath="url(#glass-clip-hero)"
      />
    </motion.svg>
  );
}

function CompactFermRow({ ferm }: { ferm: Grain }) {
  const swatchColor = srmToRgb(ferm.srm);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 9px",
        background: hsTokens.cream,
        border: `2px solid ${INK}`,
        borderRadius: 9,
        boxShadow: "2px 2px 0 var(--hs-ink)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 22,
          background: swatchColor,
          border: `1.5px solid ${INK}`,
          borderRadius: 4,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: hsTokens.mono,
          fontSize: 8,
          fontWeight: 700,
          color: ferm.srm > 20 ? "#ffffff" : hsTokens.ink,
          textShadow: ferm.srm > 20 ? "0 1px 1px rgba(0,0,0,0.4)" : "none",
        }}
      >
        {ferm.srm}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: hsTokens.body,
          fontSize: 12,
          fontWeight: 700,
          color: hsTokens.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {ferm.name}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          fontWeight: 600,
          color: hsTokens.ink,
          padding: "2px 8px",
          background: hsTokens.paper,
          border: `1.5px solid ${INK}`,
          borderRadius: 5,
          fontVariantNumeric: "tabular-nums",
          minWidth: 56,
          textAlign: "center",
        }}
      >
        {ferm.weight}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          fontWeight: 700,
          color: hsTokens.muted,
          minWidth: 36,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {ferm.percent}%
      </span>
    </div>
  );
}
