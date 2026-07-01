"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "framer-motion";

import { hsTokens } from "@/modules/builder/tokens";
import { springSupersoft } from "@/modules/builder/motion";
import {
  formatFlocculation,
  formatStrainType,
} from "@/modules/builder/components/builder/yeastDetails";
import { getYeastLabFavicon } from "@/modules/recipe/utils/yeastLabIcons";
import type { YeastPreset } from "@/modules/recipe/models/Presets";

import type { IngredientRow } from "../types";
import {
  yeastSlug,
  yeastAccent,
  yeastTolerance,
  yeastEquivalents,
  yeastSubstitutes,
} from "./yeastKind";

const DWELL_MS = 570;
const COLLAPSE_MS = 90;

/**
 * The yeast card. At rest it's the static grid card (always mounted, so the grid
 * never reflows and the link stays crawlable) — a lab-coloured accent stripe +
 * favicon, the strain name, and its attenuation/temp. A short hover grows it
 * (CSS); a longer dwell morphs an overlay in place out of the card's geometry,
 * blurring in the rest of the spec block plus the cross-lab "same strain" and
 * substitute chips. Mirrors HopMorphCard (which grows the flavor radar) — yeast
 * has no radar, so the payoff is the equivalence + substitutes a brewer wants.
 */
export default function YeastMorphCard({
  row,
  preset,
  basePath,
}: {
  row: IngredientRow;
  preset: YeastPreset | undefined;
  basePath: string;
}) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const dwell = useRef<number | null>(null);
  const collapse = useRef<number | null>(null);

  // Only morph when there's genuinely more to show than the resting card.
  const canExpand =
    !!preset &&
    (!!preset.strainGroup ||
      !!preset.substitutes?.length ||
      !!preset.flocculation ||
      preset.alcoholTolerance != null ||
      preset.pof !== undefined ||
      preset.sta1 !== undefined);

  const onEnter = () => {
    if (collapse.current) {
      window.clearTimeout(collapse.current);
      collapse.current = null;
    }
    if (reduced || !canExpand || expanded) return;
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
  const accent = row.accent;
  const lab = preset?.category ?? row.group;
  const favicon = getYeastLabFavicon(lab);
  const typeLabel = preset ? formatStrainType(preset.type) : null;
  const atten = row.stats.find((s) => s.label === "Atten")?.value ?? null;
  const temp = row.stats.find((s) => s.label === "Temp")?.value ?? null;

  // Expanded-only derived data (resolve lazily, only while open).
  const floc = expanded && preset ? formatFlocculation(preset.flocculation) : null;
  const abv = expanded && preset ? yeastTolerance(preset) : null;
  const peers = expanded && preset ? yeastEquivalents(preset) : [];
  const subs = expanded && preset ? yeastSubstitutes(preset) : [];

  // Genetic-trait pills (POF / STA-1), shown only when known. The notable states
  // (POF+, STA-1+) are filled so spicy/diastatic strains pop while scanning the
  // grid; the clean states stay quiet as outlines. STA-1+ borrows the warning red
  // — it flags a real over-attenuation / gushing risk.
  const quietBorder = `color-mix(in oklab, ${hsTokens.muted} 45%, transparent)`;
  const traitBadges: { label: string; bg: string; fg: string; border: string }[] = [];
  if (expanded && preset) {
    if (preset.pof !== undefined)
      traitBadges.push(
        preset.pof
          ? { label: "POF+", bg: hsTokens.honey, fg: hsTokens.ink, border: hsTokens.honey }
          : { label: "POF−", bg: "transparent", fg: hsTokens.muted, border: quietBorder }
      );
    if (preset.sta1 !== undefined)
      traitBadges.push(
        preset.sta1
          ? { label: "STA-1+", bg: hsTokens.roast, fg: hsTokens.paper, border: hsTokens.roast }
          : { label: "STA-1−", bg: "transparent", fg: hsTokens.muted, border: quietBorder }
      );
  }

  const specRows: { label: string; value: string }[] = [];
  if (expanded) {
    if (atten) specRows.push({ label: "Atten", value: atten });
    if (temp) specRows.push({ label: "Temp", value: temp });
    if (floc) specRows.push({ label: "Floc", value: floc });
    if (abv) specRows.push({ label: "ABV", value: abv });
  }

  return (
    // Dwell is a pure mouse enhancement; the card's <Link> is the accessible
    // path (keyboard/touch), so the hover-intent handlers need no role.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      style={{ position: "relative", height: "100%" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {/* Resting card — always mounted (grid stability + crawlable link). */}
      <Link href={href} className="hop-card">
        <div className="hop-card-body" style={cardChrome(hsTokens.sh2)}>
          <AccentStripe color={accent} />
          <div style={bodyPad}>
            <Header lab={lab} favicon={favicon} typeLabel={typeLabel} accent={accent} />
            <Name name={row.name} />
            <LabLine lab={lab} />
            <div style={{ marginTop: "auto", paddingTop: 8 }}>
              {atten ? <SpecLine label="Atten" value={atten} /> : null}
              {temp ? (
                <SpecLine label="Temp" value={temp} top={!!atten} />
              ) : null}
            </div>
          </div>
        </div>
      </Link>

      {/* Centering anchor — pins the overlay's middle to the card's middle so it
          grows up AND down as the content fills in. */}
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
          {expanded && preset ? (
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
                ...cardChrome(hsTokens.sh4),
                height: "auto",
                pointerEvents: "auto",
                cursor: "pointer",
              }}
            >
              <AccentStripe color={accent} />
              <div style={bodyPad}>
                <Header
                  lab={lab}
                  favicon={favicon}
                  typeLabel={typeLabel}
                  accent={accent}
                />
                <Name name={row.name} expanded />
                <LabLine lab={lab} />

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
                  {specRows.length ? (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto 1fr",
                        columnGap: 10,
                        rowGap: 5,
                        margin: "12px 0 0",
                      }}
                    >
                      {specRows.map((s) => (
                        <StatPair key={s.label} label={s.label} value={s.value} />
                      ))}
                    </div>
                  ) : null}

                  {traitBadges.length ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 11,
                      }}
                    >
                      {traitBadges.map((t) => (
                        <span
                          key={t.label}
                          style={{
                            fontFamily: hsTokens.body,
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            color: t.fg,
                            background: t.bg,
                            border: `1.5px solid ${t.border}`,
                            borderRadius: 999,
                            padding: "2px 9px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {peers.length ? (
                    <ChipGroup label="Same strain" accent={hsTokens.yeast}>
                      {peers.map((p) => (
                        <MorphChip
                          key={p.name}
                          name={p.name}
                          href={`/${basePath}/${yeastSlug(p)}`}
                          dot={yeastAccent(p)}
                        />
                      ))}
                    </ChipGroup>
                  ) : null}

                  {subs.length ? (
                    <ChipGroup label="Substitutes" accent={hsTokens.muted}>
                      {subs.map((s) =>
                        s.preset ? (
                          <MorphChip
                            key={s.name}
                            name={s.name}
                            href={`/${basePath}/${yeastSlug(s.preset)}`}
                            dot={yeastAccent(s.preset)}
                          />
                        ) : (
                          <MorphChip key={s.name} name={s.name} dot={hsTokens.muted} />
                        )
                      )}
                    </ChipGroup>
                  ) : null}
                </m.div>
              </div>
            </m.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Chrome shared by the resting card + the morph overlay ──────────────────

function cardChrome(shadow: string): React.CSSProperties {
  return {
    position: "relative",
    height: "100%",
    background: hsTokens.paper,
    border: `2px solid ${hsTokens.ink}`,
    borderRadius: 14,
    boxShadow: shadow,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transformOrigin: "center",
    textAlign: "left",
  };
}

const bodyPad: React.CSSProperties = {
  padding: "13px 14px 14px",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  height: "100%",
  minWidth: 0,
};

function AccentStripe({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        background: color,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
      }}
    />
  );
}

function Header({
  lab,
  favicon,
  typeLabel,
  accent,
}: {
  lab: string | undefined;
  favicon: string | null;
  typeLabel: string | null;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <LabBadge lab={lab} favicon={favicon} />
      {typeLabel ? (
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: accent,
            border: `1.5px solid ${accent}`,
            borderRadius: 999,
            padding: "2px 8px",
            whiteSpace: "nowrap",
          }}
        >
          {typeLabel}
        </span>
      ) : null}
    </div>
  );
}

function Name({ name, expanded }: { name: string; expanded?: boolean }) {
  return (
    <div
      style={{
        fontFamily: hsTokens.display,
        fontSize: 16,
        letterSpacing: "-0.02em",
        lineHeight: 1.1,
        color: hsTokens.ink,
        ...(expanded
          ? {}
          : {
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }),
      }}
    >
      {name}
    </div>
  );
}

function LabLine({ lab }: { lab: string | undefined }) {
  if (!lab) return null;
  return (
    <div
      style={{
        fontFamily: hsTokens.body,
        fontSize: 11.5,
        color: hsTokens.muted,
        marginTop: -3,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {lab}
    </div>
  );
}

/** A label/value line in the resting card foot (attenuation, temp). */
function SpecLine({
  label,
  value,
  top,
}: {
  label: string;
  value: string;
  top?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginTop: top ? 6 : 0,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 12.5,
          fontWeight: 600,
          color: hsTokens.ink,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** A label/value pair in the expanded spec grid (two pairs per row). */
function StatPair({ label, value }: { label: string; value: string }) {
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
          fontSize: 11.5,
          color: hsTokens.ink,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </>
  );
}

function ChipGroup({
  label,
  accent,
  children,
}: {
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{children}</div>
    </div>
  );
}

/** One strain pill in the morph. A Link when it resolves to a page, otherwise
 *  plain text (name carried so the brewer can look it up elsewhere). Stops the
 *  card's navigate-on-click so the chip routes to its own strain. */
function MorphChip({
  name,
  href,
  dot,
}: {
  name: string;
  href?: string;
  dot: string;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: dot,
          border: `1px solid ${hsTokens.ink}`,
          flexShrink: 0,
        }}
      />
      {name}
    </>
  );
  if (!href) {
    return (
      <span className="yeast-morph-chip yeast-morph-chip--static">{inner}</span>
    );
  }
  return (
    <Link
      href={href}
      className="yeast-morph-chip"
      onClick={(e) => e.stopPropagation()}
    >
      {inner}
    </Link>
  );
}

function LabBadge({
  lab,
  favicon,
}: {
  lab: string | undefined;
  favicon: string | null;
}) {
  const box = {
    width: 24,
    height: 24,
    borderRadius: 6,
    background: hsTokens.cream,
    border: "1px solid color-mix(in oklab, var(--hs-ink) 33%, transparent)",
    flexShrink: 0,
  } as const;
  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        width={24}
        height={24}
        style={{ ...box, objectFit: "contain", padding: 3 }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...box,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: hsTokens.body,
        fontSize: 12,
        fontWeight: 700,
        color: hsTokens.muted,
      }}
    >
      {lab?.charAt(0).toUpperCase() || "Y"}
    </span>
  );
}
