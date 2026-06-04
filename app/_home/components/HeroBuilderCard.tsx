"use client";

import {
  animate,
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import {
  DEFAULT_MOCK_DATA,
  type MockData,
} from "../lib/mapRecipeToMock";

const SMOOTH = [0.22, 1, 0.36, 1] as const;
const SPRINGY = [0.34, 1.56, 0.64, 1] as const;
const INK = "var(--hs-ink)";

function useCountUpInView(
  target: number,
  trigger: boolean,
  options: {
    duration?: number;
    delay?: number;
    format?: (v: number) => string;
  } = {}
): MotionValue<string> {
  const { duration = 0.55, delay = 0, format = (v) => v.toFixed(0) } = options;
  const mv = useMotionValue(0);
  const text = useTransform(mv, format);
  useEffect(() => {
    if (!trigger) return;
    const controls = animate(mv, target, { duration, delay, ease: SMOOTH });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, target, duration, delay]);
  return text;
}

type TabKey =
  | "Fermentables"
  | "Mash"
  | "Hops"
  | "Yeast"
  | "Water"
  | "Boil"
  | "Brewsheet";

const BASE_TABS: { label: TabKey; enabled: boolean }[] = [
  { label: "Fermentables", enabled: true },
  { label: "Hops", enabled: true },
  { label: "Water", enabled: true },
  { label: "Mash", enabled: true },
  { label: "Yeast", enabled: true },
  { label: "Boil", enabled: false },
];

// Auto-rotate cycles through these. Brewsheet is intentionally omitted so
// the marketing showcase doesn't auto-cycle to it (controlled-mode in v3
// drives it by scroll position instead).
const TAB_ORDER: TabKey[] = ["Fermentables", "Hops", "Water", "Mash", "Yeast"];

interface Props {
  /** Override mock data. Defaults to the Citra Mosaic IPA showcase recipe. */
  data?: MockData;
  /** When set, the green CTA reads "Open recipe →" and links here. */
  openHref?: string;
  /** Auto-rotate through tabs every 2.4s. Defaults to true (marketing
   *  showcase). Pass false when the card represents a user-selected recipe —
   *  no one wants their own recipe panel auto-cycling out from under them. */
  autoRotate?: boolean;
  /** Controlled active tab. When set, overrides internal state — used by the
   *  v3 homepage scroll tour to drive the visible tab from scroll position. */
  controlledTab?: TabKey;
  /** Fires when a tab pill is clicked. Use in controlled mode to keep the
   *  parent's scroll-tab state in sync with click-to-jump interactions. */
  onTabChange?: (tab: TabKey) => void;
  /** Show the "Brewsheet" tab at the right end of the tab bar. Only used by
   *  the v3 homepage tour where the breakout literally grows from this tab.
   *  Defaults to false; other surfaces don't include it. */
  showBrewsheetTab?: boolean;
  /** Hide the Brewsheet tab (while keeping showBrewsheetTab logic intact).
   *  Legacy of an earlier breakout approach — kept for backward compat. */
  hideBrewsheetTab?: boolean;
  /** Custom content to render when activeTab === "Brewsheet". Defaults to
   *  the inline BrewsheetTabPanel placeholder. v3 passes its own
   *  BrewSheetPanel here so the section renders real brew sheet content. */
  brewsheetSection?: React.ReactNode;
}

export default function HeroBuilderCard({
  data = DEFAULT_MOCK_DATA,
  openHref,
  autoRotate = true,
  controlledTab,
  onTabChange,
  showBrewsheetTab = false,
  hideBrewsheetTab = false,
  brewsheetSection,
}: Props = {}) {
  // Regular tabs stay in their array map. The Brewsheet tab is rendered
  // separately after the map so we can right-align it via the flex
  // spacer pattern (matches the real builder's TABS split).
  const TABS = BASE_TABS;
  const renderBrewsheetTab = showBrewsheetTab && !hideBrewsheetTab;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const srmColor = srmToRgb(data.srm);
  const [internalTab, setInternalTab] = useState<TabKey>("Fermentables");
  const [userInteracted, setUserInteracted] = useState(false);
  // Controlled mode wins when a parent supplies a tab; otherwise the card
  // owns its own state (the existing behavior used on every other surface).
  const activeTab: TabKey = controlledTab ?? internalTab;
  const setActiveTab = (tab: TabKey | ((prev: TabKey) => TabKey)) => {
    setInternalTab((prev) =>
      typeof tab === "function" ? (tab as (p: TabKey) => TabKey)(prev) : tab
    );
  };

  const stats = [
    { label: "OG", target: data.og, format: (v: number) => v.toFixed(3) },
    { label: "FG", target: data.fg, format: (v: number) => v.toFixed(3) },
    { label: "ABV", target: data.abv, format: (v: number) => `${v.toFixed(1)}%` },
    { label: "IBU", target: data.ibu, format: (v: number) => Math.round(v).toString() },
    { label: "Cal", target: data.cal, format: (v: number) => Math.round(v).toString() },
  ];

  // Auto-rotate tabs. First switch fires 2s after mount, subsequent switches
  // every 2.4s. Stops on user click. Skipped entirely when autoRotate=false
  // (signed-in user looking at their own recipe).
  useEffect(() => {
    if (!autoRotate || userInteracted || controlledTab !== undefined) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const advance = () =>
      setActiveTab((prev) => {
        const i = TAB_ORDER.indexOf(prev);
        return TAB_ORDER[(i + 1) % TAB_ORDER.length];
      });
    const startId = setTimeout(() => {
      advance();
      intervalId = setInterval(advance, 2650);
    }, 2150);
    return () => {
      clearTimeout(startId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRotate, userInteracted, controlledTab]);

  const handleTabClick = (tab: TabKey) => {
    setActiveTab(tab);
    setUserInteracted(true);
    onTabChange?.(tab);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease: SMOOTH }}
      style={{
        position: "relative",
        background: hsTokens.cream,
        padding: "14px 16px 18px",
        border: `2px solid ${INK}`,
        borderRadius: 14,
        boxShadow: "6px 6px 0 var(--hs-ink)",
      }}
    >
      {/* Builder chrome (toolbar + title + stats). No breakout
          animation here anymore — TourMock orchestrates the breakout
          at the wrapper level by scaling/dimming the whole mock card. */}
      <div>
      {/* Top toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.1, ease: SMOOTH }}
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
        {openHref ? (
          <Link
            href={openHref}
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
              textDecoration: "none",
            }}
          >
            Open recipe →
          </Link>
        ) : (
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
        )}
      </motion.div>

      {/* Title */}
      <div style={{ padding: "14px 0 10px" }}>
        <motion.div
          key={`name-${data.name}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: SMOOTH }}
          style={{
            fontFamily: hsTokens.display,
            fontSize: 34,
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
            color: hsTokens.ink,
          }}
        >
          {data.name}
        </motion.div>

        {/* Meta row */}
        <motion.div
          key={`meta-${data.name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: SMOOTH }}
          style={{
            marginTop: 10,
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          <PaperPill label="STYLE" value={`${data.style} ▾`} />
          <PaperPill label="BATCH" value={`${data.batch} ▾`} />
          <GhostPill>Profile · {data.profile} ▾</GhostPill>
          <GhostPill subdued>Advanced</GhostPill>
        </motion.div>
      </div>

      {/* Stat strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto",
          gap: 6,
          marginTop: 6,
        }}
      >
        {stats.map((s, i) => (
          <StatCell
            key={s.label}
            label={s.label}
            target={s.target}
            format={s.format}
            delay={0.45 + i * 0.05}
            inView={inView}
          />
        ))}
        <SRMCell color={srmColor} value={data.srm} delay={0.75} inView={inView} />
      </div>
      </div>

      {/* Tab nav */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          marginTop: 14,
          borderBottom: `2px solid ${INK}`,
          paddingLeft: 4,
        }}
      >
        {TABS.map((t, i) => {
          const isActive = activeTab === t.label;
          return (
            <motion.button
              key={t.label}
              type="button"
              onClick={() => t.enabled && handleTabClick(t.label)}
              disabled={!t.enabled}
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.4,
                delay: 0.82 + i * 0.04,
                ease: SMOOTH,
              }}
              whileHover={t.enabled && !isActive ? { y: -1 } : {}}
              style={{
                padding: "8px 12px",
                fontFamily: hsTokens.body,
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                color: isActive
                  ? hsTokens.ink
                  : t.enabled
                  ? hsTokens.muted
                  : `color-mix(in oklch, ${hsTokens.muted} 60%, transparent)`,
                background: isActive ? hsTokens.paper : "transparent",
                border: isActive
                  ? `2px solid ${INK}`
                  : "2px solid transparent",
                borderBottom: isActive ? "2px solid transparent" : undefined,
                borderRadius: "10px 10px 0 0",
                marginBottom: -2,
                whiteSpace: "nowrap",
                position: "relative",
                cursor: t.enabled ? "pointer" : "not-allowed",
              }}
            >
              {t.label}
            </motion.button>
          );
        })}
        {renderBrewsheetTab ? (
          <>
            {/* Flex spacer between mainTabs and the right-aligned Brewsheet
                tab — carries the 2px ink baseline across the gap, matching
                the real builder's mainTabs/rightTabs split. */}
            <div
              aria-hidden
              style={{
                flex: 1,
                minWidth: 16,
                alignSelf: "stretch",
                borderBottom: `2px solid ${INK}`,
                marginBottom: -2,
              }}
            />
            {/* Brewsheet tab — same tab shape and dimensions as the
                other tabs (matches active tab height since it isn't
                scaled down like inactive ones), with ink fill + cream
                text so it reads as the distinct "destination" tab. */}
            <motion.button
              key="Brewsheet"
              type="button"
              onClick={() => handleTabClick("Brewsheet")}
              initial={{ opacity: 0, y: 6 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.4,
                delay: 0.82 + TABS.length * 0.04,
                ease: SMOOTH,
              }}
              whileHover={
                activeTab !== "Brewsheet" ? { y: -1 } : {}
              }
              style={{
                padding: "8px 14px",
                fontFamily: hsTokens.body,
                fontSize: 12,
                fontWeight: 600,
                color: hsTokens.cream,
                background: hsTokens.ink,
                // No explicit border — the dark fill creates its own
                // edge against the cream surroundings. Removes the
                // "weird outline" feel and lets the tab read as a
                // solid filled tab, like the real builder.
                border: "none",
                // Top-left rounded; top-right square so the tab sits
                // flush against the card's right inner-padding edge.
                borderRadius: "10px 0 0 0",
                marginBottom: -2,
                whiteSpace: "nowrap",
                position: "relative",
                cursor: "pointer",
              }}
            >
              Brew sheet
            </motion.button>
          </>
        ) : null}
      </div>

      {/* Section card. Plain 360px tall slot. */}
      <div
        style={{
          position: "relative",
          background: hsTokens.paper,
          border: `2px solid ${INK}`,
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          boxShadow: "4px 4px 0 var(--hs-ink)",
          height: 360,
          overflow: "hidden",
        }}
      >
        <AnimatePresence mode="wait">
          {activeTab === "Fermentables" && (
            <FermentablesPanel key={`ferm-${data.name}`} data={data} />
          )}
          {activeTab === "Mash" && (
            <MashPanel key={`mash-${data.name}`} data={data} />
          )}
          {activeTab === "Hops" && (
            <HopsPanel key={`hops-${data.name}`} data={data} />
          )}
          {activeTab === "Yeast" && (
            <YeastPanel key={`yeast-${data.name}`} data={data} />
          )}
          {activeTab === "Water" && (
            <WaterPanel key={`water-${data.name}`} data={data} />
          )}
          {activeTab === "Brewsheet" && (
            brewsheetSection ?? (
              <BrewsheetTabPanel key={`brewsheet-${data.name}`} />
            )
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────── shared panel pieces ───────────────────────────

function panelWrap(children: React.ReactNode) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.28, ease: SMOOTH }}
      style={{
        position: "absolute",
        inset: 0,
        padding: "16px 16px 14px",
        overflow: "hidden",
      }}
    >
      {children}
    </motion.div>
  );
}


function SectionTitleRow({
  underlineColor,
  title,
  meta,
}: {
  underlineColor: string;
  title: string;
  meta: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: `3px solid ${underlineColor}`,
          paddingBottom: 6,
        }}
      >
        <h3
          style={{
            fontFamily: hsTokens.display,
            fontSize: 30,
            letterSpacing: "-0.035em",
            margin: 0,
            color: hsTokens.ink,
            lineHeight: 1,
          }}
        >
          {title}
        </h3>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          {meta}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────── Fermentables ───────────────────────────

function FermentablesPanel({ data }: { data: MockData }) {
  const ferms = data.fermentables;
  return panelWrap(
    <>
      <SectionTitleRow
        underlineColor={hsTokens.malt}
        title="Fermentables."
        meta={`${ferms.length} in the bill · ${data.fermentablesTotalLb}`}
      />

      {/* Bill stack */}
      <div
        style={{
          marginTop: 10,
          height: 12,
          background: hsTokens.cream2,
          border: `1.5px solid ${INK}`,
          borderRadius: 999,
          overflow: "hidden",
          display: "flex",
        }}
      >
        {ferms.map((f, i) => (
          <motion.div
            key={`stack-${i}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.55, delay: i * 0.07, ease: SMOOTH }}
            style={{
              width: f.percent,
              height: "100%",
              background: srmToRgb(f.srm),
              transformOrigin: "left center",
            }}
          />
        ))}
      </div>

      {/* Ledger rows */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {ferms.map((f, i) => (
          <motion.div
            key={`${f.name}-${i}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.18 + i * 0.08, ease: SMOOTH }}
          >
            <FermRow ferm={f} />
          </motion.div>
        ))}
      </div>
    </>
  );
}

function FermRow({ ferm }: { ferm: MockData["fermentables"][number] }) {
  const swatchColor = srmToRgb(ferm.srm);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        background: hsTokens.cream,
        border: `2px solid ${INK}`,
        borderRadius: 10,
        boxShadow: "2px 2px 0 var(--hs-ink)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 26,
          height: 26,
          background: swatchColor,
          border: `1.5px solid ${INK}`,
          borderRadius: 5,
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
        {ferm.srm}L
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: hsTokens.body,
            fontSize: 13,
            fontWeight: 700,
            color: hsTokens.ink,
            lineHeight: 1.1,
          }}
        >
          {ferm.name}
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 2,
            fontFamily: hsTokens.body,
            fontSize: 8,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: `color-mix(in oklch, ${hsTokens.malt} 32%, ${hsTokens.cream2})`,
            border: `1px solid ${INK}`,
            color: hsTokens.ink,
            padding: "1px 6px",
            borderRadius: 999,
          }}
        >
          {ferm.category}
        </span>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: hsTokens.mono,
          fontSize: 11,
          fontWeight: 600,
          color: hsTokens.ink,
          padding: "3px 9px",
          background: hsTokens.paper,
          border: `1.5px solid ${INK}`,
          borderRadius: 6,
          fontVariantNumeric: "tabular-nums",
          minWidth: 64,
          justifyContent: "center",
        }}
      >
        {ferm.weight}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 11,
          fontWeight: 700,
          color: hsTokens.muted,
          minWidth: 44,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {ferm.percent}
      </span>
    </div>
  );
}

// ─────────────────────────── Mash ───────────────────────────

function MashPanel({ data }: { data: MockData }) {
  const steps = data.mashSteps;
  return panelWrap(
    <>
      <SectionTitleRow
        underlineColor={hsTokens.roast}
        title="Mash."
        meta={`${steps.length === 1 ? "single infusion" : `${steps.length} steps`}`}
      />

      <div
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {steps.map((s, i) => (
          <motion.div
            key={s.name}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: SMOOTH }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              background: hsTokens.cream,
              border: `2px solid ${INK}`,
              borderRadius: 10,
              boxShadow: "2px 2px 0 var(--hs-ink)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 36,
                height: 36,
                background: s.color,
                border: `1.5px solid ${INK}`,
                borderRadius: 8,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: hsTokens.display,
                fontSize: 16,
                color: hsTokens.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  fontWeight: 700,
                  color: hsTokens.ink,
                }}
              >
                {s.name}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: hsTokens.muted,
                  letterSpacing: "0.04em",
                  marginTop: 2,
                }}
              >
                {s.kind}
              </div>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontFamily: hsTokens.mono,
                fontSize: 12,
                fontWeight: 700,
                color: hsTokens.ink,
                padding: "4px 10px",
                background: hsTokens.paper,
                border: `1.5px solid ${INK}`,
                borderRadius: 6,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.temp}
            </span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                fontWeight: 700,
                color: hsTokens.muted,
                minWidth: 56,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {s.time}
            </span>
          </motion.div>
        ))}
      </div>

      {/* pH gauge */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.4, ease: SMOOTH }}
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: hsTokens.cream2,
          border: `1.5px solid ${INK}`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              marginBottom: 4,
            }}
          >
            Predicted mash pH
          </div>
          <div
            style={{
              position: "relative",
              height: 8,
              background: hsTokens.paper,
              border: `1.5px solid ${INK}`,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "30%",
                right: "20%",
                top: 0,
                bottom: 0,
                background: hsTokens.hops,
              }}
            />
            <motion.div
              initial={{ left: "10%" }}
              animate={{ left: "55%" }}
              transition={{ duration: 0.8, delay: 0.5, ease: SMOOTH }}
              style={{
                position: "absolute",
                top: -2,
                width: 3,
                height: 12,
                background: hsTokens.ink,
                borderRadius: 2,
              }}
            />
          </div>
        </div>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 22,
            color: hsTokens.ink,
            letterSpacing: "-0.03em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          5.42
        </span>
      </motion.div>
    </>
  );
}

// ─────────────────────────── Hops ───────────────────────────

function HopFlavorRadar({
  values,
  color,
  size,
}: {
  values: { label: string; value: number }[];
  color: string;
  size: number;
}) {
  const n = values.length;
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size / 2 - 18; // leave room for labels

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, v: number) => {
    const r = innerR * v;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const labelPoint = (i: number) => {
    const r = innerR + 9;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };

  const gridRings = [0.33, 0.66, 1];
  const gridPolys = gridRings.map((scale) =>
    Array.from({ length: n }, (_, i) => {
      const [x, y] = point(i, scale);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ")
  );

  const valuePoly = values
    .map((v, i) => {
      const [x, y] = point(i, v.value);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      {/* Background rings — fade in first to set the stage for the polygon. */}
      {gridPolys.map((poly, i) => (
        <motion.polygon
          key={`ring-${i}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 + i * 0.05, ease: SMOOTH }}
          points={poly}
          fill={i === 2 ? hsTokens.paper : "transparent"}
          stroke={`color-mix(in oklch, ${INK} ${i === 2 ? 100 : 25}%, transparent)`}
          strokeWidth={i === 2 ? 1.5 : 1}
        />
      ))}
      {/* Axes — fade in alongside the rings. */}
      {values.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <motion.line
            key={`axis-${i}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 + i * 0.03, ease: SMOOTH }}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke={`color-mix(in oklch, ${INK} 20%, transparent)`}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        );
      })}
      {/* Filled profile — SPRINGY bounce entry (matches the production
          HopFlavorRadarSvg "bounce in" feel: starts small, overshoots ~4%
          past 1.0, settles back down). The natural overshoot in cubic-bezier
          (0.34, 1.56, 0.64, 1) gives the bounce without needing keyframes. */}
      <motion.polygon
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.55, ease: SPRINGY }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        points={valuePoly}
        fill={color}
        fillOpacity={0.35}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* Vertices pop in one by one as the polygon settles. */}
      {values.map((v, i) => {
        const [x, y] = point(i, v.value);
        return (
          <motion.circle
            key={`pt-${i}`}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              duration: 0.35,
              delay: 0.85 + i * 0.04,
              ease: SPRINGY,
            }}
            style={{ transformOrigin: `${x}px ${y}px` }}
            cx={x}
            cy={y}
            r={2.5}
            fill={INK}
          />
        );
      })}
      {/* Axis labels */}
      {values.map((v, i) => {
        const [lx, ly] = labelPoint(i);
        const a = angle(i);
        // text anchor & baseline based on position
        let anchor: "start" | "middle" | "end" = "middle";
        if (Math.abs(Math.cos(a)) > 0.3) {
          anchor = Math.cos(a) > 0 ? "start" : "end";
        }
        return (
          <text
            key={`label-${i}`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontFamily="'Space Grotesk', system-ui, sans-serif"
            fontSize={7.5}
            fontWeight={800}
            fill="var(--hs-muted)"
            letterSpacing="0.08em"
            style={{ textTransform: "uppercase" }}
          >
            {v.label}
          </text>
        );
      })}
    </svg>
  );
}

const CITRA_PROFILE = [
  { label: "Citrus", value: 0.95 },
  { label: "Tropical", value: 0.85 },
  { label: "Stone fruit", value: 0.65 },
  { label: "Pine", value: 0.22 },
  { label: "Spice", value: 0.18 },
  { label: "Floral", value: 0.35 },
];

function HopsPanel({ data }: { data: MockData }) {
  const hops = data.hops;
  return panelWrap(
    <>
      <SectionTitleRow
        underlineColor={hsTokens.hops}
        title="Hops."
        meta={`${hops.length} additions · ${Math.round(data.ibu)} IBU`}
      />

      {/* 2-column layout: hop rows left, visualizer right */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
          gap: 10,
          alignItems: "start",
        }}
      >
        {/* LEFT: hop rows */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {hops.map((h, i) => (
            <motion.div
              key={`hop-${i}`}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.15 + i * 0.08,
                ease: SMOOTH,
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                background: hsTokens.cream,
                border: `2px solid ${INK}`,
                borderRadius: 10,
                boxShadow: "2px 2px 0 var(--hs-ink)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  background: h.color,
                  border: `1.5px solid ${INK}`,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                }}
              >
                🌿
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 12,
                    fontWeight: 700,
                    color: hsTokens.ink,
                    lineHeight: 1.1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.name}
                </div>
                <span
                  style={{
                    display: "inline-block",
                    marginTop: 2,
                    fontFamily: hsTokens.body,
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    background: `color-mix(in oklch, ${h.color} 28%, ${hsTokens.cream2})`,
                    border: `1px solid ${INK}`,
                    color: hsTokens.ink,
                    padding: "1px 6px",
                    borderRadius: 999,
                  }}
                >
                  {h.usage}
                </span>
              </div>
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 10,
                  fontWeight: 600,
                  color: hsTokens.ink,
                  padding: "2px 7px",
                  background: hsTokens.paper,
                  border: `1.5px solid ${INK}`,
                  borderRadius: 5,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 48,
                  textAlign: "center",
                }}
              >
                {h.weight}
              </span>
              <span
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 13,
                  color: hsTokens.hops,
                  fontVariantNumeric: "tabular-nums",
                  minWidth: 22,
                  textAlign: "right",
                  letterSpacing: "-0.02em",
                }}
              >
                {h.ibu}
              </span>
            </motion.div>
          ))}
        </div>

        {/* RIGHT: flavor radar visualizer */}
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.4, ease: SMOOTH }}
          style={{
            padding: "10px 10px 12px",
            background: hsTokens.cream2,
            border: `2px solid ${INK}`,
            borderRadius: 12,
            boxShadow: "3px 3px 0 var(--hs-ink)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              fontFamily: hsTokens.display,
              fontSize: 20,
              letterSpacing: "-0.03em",
              color: hsTokens.ink,
              lineHeight: 1,
              marginBottom: 6,
            }}
          >
            Citra
          </div>
          <HopFlavorRadar
            values={CITRA_PROFILE}
            color={hsTokens.hops}
            size={150}
          />
          <div
            style={{
              marginTop: 6,
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              justifyContent: "center",
            }}
          >
            {["citrus", "tropical", "stone fruit"].map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  background: `color-mix(in oklch, ${hsTokens.hops} 25%, ${hsTokens.paper})`,
                  border: `1px solid ${INK}`,
                  color: hsTokens.ink,
                  padding: "2px 7px",
                  borderRadius: 999,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}

// ─────────────────────────── Yeast ───────────────────────────

function YeastPanel({ data }: { data: MockData }) {
  const yeast = data.yeast;
  return panelWrap(
    <>
      <SectionTitleRow
        underlineColor={hsTokens.yeast}
        title="Yeast."
        meta={`${yeast.attenuation}% attenuation target`}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: SMOOTH }}
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 14px",
          background: hsTokens.cream,
          border: `2px solid ${INK}`,
          borderRadius: 12,
          boxShadow: "3px 3px 0 var(--hs-ink)",
        }}
      >
        {/* Yeast badge */}
        <span
          aria-hidden
          style={{
            width: 56,
            height: 56,
            background: hsTokens.yeast,
            border: `2px solid ${INK}`,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: hsTokens.display,
            fontSize: 22,
            color: hsTokens.ink,
            boxShadow: "2px 2px 0 var(--hs-ink)",
          }}
        >
          ✿
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 20,
              letterSpacing: "-0.03em",
              color: hsTokens.ink,
              lineHeight: 1,
            }}
          >
            {yeast.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: hsTokens.muted,
              marginTop: 4,
              fontWeight: 600,
            }}
          >
            {yeast.lab}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <YeastStat label="ATTEN" value={`${yeast.attenuation}%`} />
            <YeastStat label="TEMP" value={yeast.tempRange} />
            <YeastStat label="FLOCC" value={yeast.flocc} />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: SMOOTH }}
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "8px 12px",
          background: hsTokens.cream2,
          border: `1.5px dashed ${INK}`,
          borderRadius: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          Pitch
        </span>
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 12,
            fontWeight: 600,
            color: hsTokens.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {yeast.pitch}
        </span>
      </motion.div>
    </>
  );
}

function YeastStat({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        background: hsTokens.paper,
        border: `1.5px solid ${INK}`,
        borderRadius: 999,
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          fontWeight: 700,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </span>
  );
}

// ─────────────────────────── Water ───────────────────────────

// Per-gram-per-5-gal contribution constants. Close enough for a mock that lets
// you click +/- and watch the predicted ion profile move.
const SALT_DEFS: {
  key: "gypsum" | "cacl2" | "epsom" | "nacl" | "nahco3";
  short: string;
  name: string;
  contributes: Partial<{ Ca: number; Mg: number; Na: number; SO4: number; Cl: number; HCO3: number }>;
}[] = [
  { key: "gypsum", short: "CaSO₄", name: "Gypsum", contributes: { Ca: 46, SO4: 112 } },
  { key: "cacl2", short: "CaCl₂", name: "Calcium Chloride", contributes: { Ca: 54, Cl: 96 } },
  { key: "epsom", short: "MgSO₄", name: "Epsom", contributes: { Mg: 20, SO4: 78 } },
  { key: "nacl", short: "NaCl", name: "Salt", contributes: { Na: 79, Cl: 121 } },
  { key: "nahco3", short: "NaHCO₃", name: "Baking Soda", contributes: { Na: 55, HCO3: 145 } },
];

const ION_DEFS: {
  key: "Ca" | "Mg" | "Na" | "SO4" | "Cl" | "HCO3";
  label: string;
  color: string;
  max: number;
  targetMin: number;
  targetMax: number;
}[] = [
  { key: "Ca", label: "Ca", color: hsTokens.malt, max: 400, targetMin: 70, targetMax: 150 },
  { key: "Mg", label: "Mg", color: hsTokens.hops, max: 50, targetMin: 5, targetMax: 40 },
  { key: "Na", label: "Na", color: hsTokens.yeast, max: 150, targetMin: 0, targetMax: 50 },
  { key: "SO4", label: "SO₄", color: hsTokens.water, max: 700, targetMin: 100, targetMax: 450 },
  { key: "Cl", label: "Cl", color: hsTokens.roast, max: 300, targetMin: 25, targetMax: 100 },
  { key: "HCO3", label: "HCO₃", color: hsTokens.muted, max: 200, targetMin: 0, targetMax: 50 },
];

function WaterPanel({ data }: { data: MockData }) {
  // Initial salt amounts come from recipe data (default mock fallback if none).
  // SALT_DEFS order: gypsum, cacl2, epsom, nacl, nahco3 — matches MockSalt keys.
  const initial = SALT_DEFS.map((def) => {
    const s = data.water.salts.find((x) => x.key === def.key);
    return s ? s.grams : 0;
  });
  const [salts, setSalts] = useState<number[]>(initial);

  const bump = (idx: number, delta: number) => {
    setSalts((prev) =>
      prev.map((g, i) =>
        i === idx ? Math.max(0, Math.round((g + delta) * 10) / 10) : g
      )
    );
  };

  // Derive ion ppm from current salt grams.
  const ions: Record<string, number> = { Ca: 0, Mg: 0, Na: 0, SO4: 0, Cl: 0, HCO3: 0 };
  SALT_DEFS.forEach((def, i) => {
    const g = salts[i];
    Object.entries(def.contributes).forEach(([ion, ppmPerGram]) => {
      ions[ion] += g * (ppmPerGram ?? 0);
    });
  });

  return panelWrap(
    <>
      <SectionTitleRow
        underlineColor={hsTokens.water}
        title="Water."
        meta={`target · ${data.water.target}`}
      />

      {/* Source → Target row */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            background: hsTokens.paper,
            border: `2px solid ${INK}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontSize: 11,
            fontWeight: 600,
            color: hsTokens.ink,
          }}
        >
          <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: hsTokens.muted }}>
            SOURCE
          </span>
          {data.water.source}
        </span>
        <span style={{ color: hsTokens.muted, fontSize: 13 }}>→</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            background: hsTokens.water,
            border: `2px solid ${INK}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontSize: 11,
            fontWeight: 700,
            color: "#ffffff",
            boxShadow: "2px 2px 0 var(--hs-ink)",
          }}
        >
          BJCP · {data.water.target} ▾
        </span>
      </div>

      {/* 2-column body: salts left, ion bar visualizer right */}
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr)",
          gap: 10,
          alignItems: "start",
        }}
      >
        {/* LEFT: interactive salt rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              padding: "0 4px 2px",
            }}
          >
            <span>SALT</span>
            <span style={{ textAlign: "right" }}>g</span>
            <span style={{ width: 50 }} aria-hidden />
          </div>
          {SALT_DEFS.map((def, i) => (
            <SaltRow
              key={def.short}
              short={def.short}
              name={def.name}
              grams={salts[i]}
              onMinus={() => bump(i, -0.1)}
              onPlus={() => bump(i, +0.1)}
            />
          ))}
        </div>

        {/* RIGHT: ion bar visualizer */}
        <div
          style={{
            background: hsTokens.cream2,
            border: `2px solid ${INK}`,
            borderRadius: 10,
            padding: "8px 10px 9px",
            boxShadow: "2px 2px 0 var(--hs-ink)",
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              marginBottom: 5,
            }}
          >
            Profile · ppm
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {ION_DEFS.map((def) => (
              <IonBar
                key={def.key}
                label={def.label}
                value={ions[def.key]}
                color={def.color}
                max={def.max}
                targetMin={def.targetMin}
                targetMax={def.targetMax}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function SaltRow({
  short,
  name,
  grams,
  onMinus,
  onPlus,
}: {
  short: string;
  name: string;
  grams: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 8,
        padding: "5px 6px 5px 8px",
        background: hsTokens.cream,
        border: `1.5px solid ${INK}`,
        borderRadius: 8,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 800,
            color: hsTokens.ink,
            letterSpacing: "0.04em",
            lineHeight: 1,
          }}
        >
          {short}
        </div>
        <div
          style={{
            fontSize: 8,
            color: hsTokens.muted,
            fontWeight: 600,
            lineHeight: 1.1,
            marginTop: 1,
          }}
        >
          {name}
        </div>
      </div>
      <motion.div
        key={grams.toFixed(1)}
        initial={{ scale: 0.92, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, ease: SMOOTH }}
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 13,
          fontWeight: 700,
          color: hsTokens.ink,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {grams.toFixed(1)}
      </motion.div>
      <div style={{ display: "flex", gap: 3 }}>
        <SaltBtn onClick={onMinus} label="−" />
        <SaltBtn onClick={onPlus} label="+" />
      </div>
    </div>
  );
}

function SaltBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.88 }}
      style={{
        width: 22,
        height: 22,
        background: hsTokens.paper,
        border: `1.5px solid ${INK}`,
        borderRadius: 5,
        fontFamily: hsTokens.body,
        fontSize: 13,
        fontWeight: 800,
        color: hsTokens.ink,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        boxShadow: "1.5px 1.5px 0 var(--hs-ink)",
        lineHeight: 1,
      }}
    >
      {label}
    </motion.button>
  );
}

function IonBar({
  label,
  value,
  color,
  max,
  targetMin,
  targetMax,
}: {
  label: string;
  value: number;
  color: string;
  max: number;
  targetMin: number;
  targetMax: number;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const targetMinPct = (targetMin / max) * 100;
  const targetMaxPct = (targetMax / max) * 100;
  const inRange = value >= targetMin && value <= targetMax;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "26px 1fr 38px",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 800,
          color: hsTokens.ink,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          position: "relative",
          height: 10,
          background: hsTokens.paper,
          border: `1.5px solid ${INK}`,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        {/* Target range band */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${targetMinPct}%`,
            width: `${targetMaxPct - targetMinPct}%`,
            background: `color-mix(in oklab, ${color} 28%, transparent)`,
          }}
        />
        {/* Current value filled bar */}
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: SMOOTH }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            background: color,
            borderRight: `1.5px solid ${INK}`,
          }}
        />
      </div>
      <motion.span
        key={Math.round(value)}
        initial={{ opacity: 0.55, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: SMOOTH }}
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          fontWeight: 700,
          color: inRange ? hsTokens.ink : hsTokens.roast,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(value)}
      </motion.span>
    </div>
  );
}

// ─────────────────────────── Brewsheet (tab placeholder) ───────────────────────────
//
// Minimal placeholder that occupies the panel area when the optional
// "Brewsheet" tab is active. The v3 homepage tour covers this with its
// breakout BrewSheetPanel (which renders the actual brew sheet content);
// this placeholder is just the "tab is active" visual that briefly shows
// before the breakout grows out of it.

function BrewsheetTabPanel() {
  return panelWrap(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 10,
        padding: 16,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        Brew sheet
      </span>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 22,
          letterSpacing: "-0.025em",
          color: hsTokens.ink,
          lineHeight: 1.1,
          maxWidth: 220,
        }}
      >
        Print-ready summary of the recipe.
      </span>
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 11,
          color: hsTokens.muted,
          lineHeight: 1.4,
          maxWidth: 240,
        }}
      >
        Ingredients, water, mash, boil, fermentation, gravity log. Adjustments
        during brew day too.
      </span>
    </div>,
  );
}

// ─────────────────────────── shared bits (pills, stat cells) ───────────────────────────

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
        fontFamily: hsTokens.body,
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

function GhostPill({
  children,
  subdued = false,
}: {
  children: React.ReactNode;
  subdued?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: subdued ? "3px 10px" : "4px 12px",
        background: "transparent",
        border: `1.5px solid color-mix(in oklch, ${INK} 35%, transparent)`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: subdued ? 9 : 11,
        fontWeight: subdued ? 800 : 600,
        color: subdued ? hsTokens.muted : hsTokens.ink,
        letterSpacing: subdued ? "0.14em" : "0.01em",
        textTransform: subdued ? "uppercase" : "none",
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
  delay,
  inView,
}: {
  label: string;
  target: number;
  format: (v: number) => string;
  delay: number;
  inView: boolean;
}) {
  const text = useCountUpInView(target, inView, {
    duration: 0.55,
    delay,
    format,
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay, ease: SMOOTH }}
      style={{
        background: hsTokens.paper,
        border: `2px solid ${INK}`,
        borderRadius: 8,
        padding: "8px 6px 7px",
        textAlign: "center",
        boxShadow: "2px 2px 0 var(--hs-ink)",
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
        {label}
      </div>
      <motion.div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 18,
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
  inView,
}: {
  color: string;
  value: number;
  delay: number;
  inView: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.55, delay, ease: SPRINGY }}
      style={{
        background: hsTokens.paper,
        border: `2px solid ${INK}`,
        borderRadius: 8,
        padding: "6px 10px 7px",
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
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <BeerGlass color={color} />
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 16,
            letterSpacing: "-0.035em",
            fontVariantNumeric: "tabular-nums",
            color: hsTokens.ink,
            lineHeight: 1,
          }}
        >
          {value.toFixed(1)}
        </span>
      </div>
    </motion.div>
  );
}

function BeerGlass({ color }: { color: string }) {
  return (
    <svg width={18} height={22} viewBox="0 0 22 26" aria-hidden>
      <defs>
        <clipPath id="glass-clip-mock">
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
      <rect
        x={3}
        y={6}
        width={16}
        height={18}
        fill={color}
        clipPath="url(#glass-clip-mock)"
      />
      <ellipse
        cx={11}
        cy={5}
        rx={7}
        ry={2}
        fill="#fff8e2"
        stroke={INK}
        strokeWidth={1}
        clipPath="url(#glass-clip-mock)"
      />
    </svg>
  );
}
