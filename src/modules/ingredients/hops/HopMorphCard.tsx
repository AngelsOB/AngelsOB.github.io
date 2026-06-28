"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";

import { hsTokens } from "@/modules/builder/tokens";
import { springSupersoft } from "@/modules/builder/motion";
import {
  findSimilarHops,
  formatAlphaRange,
  formatBetaRange,
  formatOilTotal,
  formatCohumulone,
} from "@/modules/builder/components/builder/hopDetails";
import type { HopPreset } from "@/modules/recipe/models/Presets";

import MiniRadar from "../MiniRadar";
import type { IngredientRow } from "../types";
import { hopSlug, hopAccent } from "./hopKind";

const DWELL_MS = 570;
const COLLAPSE_MS = 90;

/**
 * The hop card. At rest it's the static grid card (always mounted, so the grid
 * never reflows and the link stays crawlable). A short hover grows it (CSS); a
 * longer dwell expands an overlay that morphs in place out of the card's exact
 * geometry — the radar grows, the name slides, and the acid stats + similar-hop
 * links blur in. Built on our springs (springSupersoft), reduced-motion aware.
 */
export default function HopMorphCard({
  row,
  preset,
  library,
  basePath,
  compareMode,
  isSelected,
  onToggleSelect,
}: {
  row: IngredientRow;
  preset: HopPreset | undefined;
  library: HopPreset[];
  basePath: string;
  /** When on, clicking toggles compare-selection instead of navigating, and the
   *  dwell-morph is suppressed. */
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (slug: string) => void;
}) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const dwell = useRef<number | null>(null);
  const collapse = useRef<number | null>(null);

  const onEnter = () => {
    if (collapse.current) {
      window.clearTimeout(collapse.current);
      collapse.current = null;
    }
    if (compareMode || reduced || !preset || expanded || !row.chart) return;
    if (dwell.current) window.clearTimeout(dwell.current);
    dwell.current = window.setTimeout(() => {
      setExpanded(true);
      dwell.current = null;
    }, DWELL_MS);
  };
  const onLeave = () => {
    if (dwell.current) {
      window.clearTimeout(dwell.current);
      dwell.current = null;
    }
    if (collapse.current) window.clearTimeout(collapse.current);
    collapse.current = window.setTimeout(() => {
      setExpanded(false);
      collapse.current = null;
    }, COLLAPSE_MS);
  };

  useEffect(
    () => () => {
      if (dwell.current) window.clearTimeout(dwell.current);
      if (collapse.current) window.clearTimeout(collapse.current);
    },
    []
  );

  const href = `/${basePath}/${row.slug}`;

  const stats: { label: string; value: string }[] = [];
  if (preset) {
    const a = formatAlphaRange(preset);
    if (a) stats.push({ label: "Alpha", value: a });
    const b = formatBetaRange(preset);
    if (b) stats.push({ label: "Beta", value: b });
    const oil = formatOilTotal(preset);
    if (oil) stats.push({ label: "Oil", value: oil });
    const cohu = formatCohumulone(preset);
    if (cohu) stats.push({ label: "Cohu.", value: cohu });
  }
  const similar =
    expanded && preset ? findSimilarHops(preset, library, 6) : [];

  return (
    // Dwell is a pure mouse enhancement; the card's <Link> is the accessible
    // path (keyboard/touch), so the hover-intent handlers need no role.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      style={{
        position: "relative",
        height: "100%",
        borderRadius: 14,
        outline:
          compareMode && isSelected ? `2px solid ${hsTokens.water}` : undefined,
        outlineOffset: compareMode && isSelected ? 4 : undefined,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Resting card — always mounted (grid stability + crawlable link). In
          compare mode a click toggles selection instead of navigating. */}
      <Link
        href={href}
        className="hop-card"
        onClick={(e) => {
          if (compareMode) {
            e.preventDefault();
            onToggleSelect?.(row.slug);
          }
        }}
      >
        <div
          className="hop-card-body"
          style={{
            height: "100%",
            background: hsTokens.paper,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 14,
            boxShadow: hsTokens.sh2,
            padding: "16px 14px 14px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {row.chart ? (
            <div className="hop-card-radar">
              <MiniRadar values={row.chart} color={row.accent} />
            </div>
          ) : null}
          <CardName row={row} />
          {row.stats.length ? (
            <div className="hop-card-foot">
              {row.stats.map((s) => (
                <Chip key={s.label} label={s.label} value={s.value} />
              ))}
            </div>
          ) : null}
        </div>
      </Link>

      {/* Selection checkbox (compare mode only). */}
      {compareMode ? (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 28,
            width: 24,
            height: 24,
            borderRadius: 6,
            border: `2px solid ${isSelected ? hsTokens.water : hsTokens.ink}`,
            background: isSelected ? hsTokens.water : hsTokens.paper,
            boxShadow: "2px 2px 0 var(--hs-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {isSelected ? (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
        </div>
      ) : null}

      {/* Centering anchor — pins the overlay's middle to the card's middle, so
          it grows up AND down from the center as the content fills in. Anchor
          ignores pointer events; the overlay itself re-enables them. */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          transform: "translateY(-50%)",
          zIndex: 30,
          pointerEvents: "none",
        }}
      >
        <AnimatePresence>
          {expanded && preset && row.chart ? (
            <m.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
              onClick={() => router.push(href)}
              role="link"
              style={{
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 14,
                boxShadow: hsTokens.sh4,
                padding: "16px 14px 14px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                transformOrigin: "center",
                pointerEvents: "auto",
                cursor: "pointer",
              }}
            >
            {/* Radar + name — the whole overlay navigates on click (see onClick
                above); only the substitute chips below opt out via stopPropagation. */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              <m.div
                initial={{ width: 96, height: 96 }}
                animate={{ width: 128, height: 128 }}
                transition={reduced ? { duration: 0 } : springSupersoft}
              >
                <MiniRadar values={row.chart} color={row.accent} />
              </m.div>
              <CardName row={row} expanded />
            </div>

            <m.div
              initial={{ height: 0, opacity: 0, filter: "blur(6px)" }}
              animate={{ height: "auto", opacity: 1, filter: "blur(0px)" }}
              transition={{
                height: reduced ? { duration: 0 } : springSupersoft,
                opacity: { duration: 0.2, delay: 0.04 },
                filter: { duration: 0.2, delay: 0.04 },
              }}
              style={{ width: "100%", overflow: "hidden" }}
            >
              {stats.length ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto 1fr",
                    columnGap: 10,
                    rowGap: 4,
                    margin: "10px 0 0",
                    textAlign: "left",
                  }}
                >
                  {stats.map((s) => (
                    <StatRow key={s.label} label={s.label} value={s.value} />
                  ))}
                </div>
              ) : null}

              {similar.length ? (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      fontFamily: hsTokens.body,
                      fontWeight: 700,
                      fontSize: 9,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: hsTokens.muted,
                      marginBottom: 6,
                    }}
                  >
                    Similar hops
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 5,
                      justifyContent: "center",
                    }}
                  >
                    {similar.map(({ hop }) => (
                      <Link
                        key={hop.name}
                        href={`/${basePath}/${hopSlug(hop)}`}
                        className="hop-morph-chip"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          aria-hidden
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            background: hopAccent(hop),
                            border: `1px solid ${hsTokens.ink}`,
                            flexShrink: 0,
                          }}
                        />
                        {hop.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </m.div>
          </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function CardName({ row, expanded }: { row: IngredientRow; expanded?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: expanded ? 6 : 0,
        marginBottom: 6,
        maxWidth: "100%",
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: expanded ? 18 : 16,
          letterSpacing: "-0.02em",
          color: hsTokens.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {row.name}
      </span>
      {row.badge ? (
        <span
          title={row.badgeLabel}
          style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
        >
          {row.badge}
        </span>
      ) : null}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="hop-card-chip">
      <span style={{ color: hsTokens.muted }}>{label}</span>
      <span style={{ color: hsTokens.ink, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span
        style={{
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          alignSelf: "center",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 11,
          color: hsTokens.ink,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </>
  );
}
