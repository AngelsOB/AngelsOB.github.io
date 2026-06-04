"use client";

import { motion } from "framer-motion";
import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { EASE, STAGES } from "../data";

// Faithful small-scale mock of HSBrewSheetSection. The real component is a
// dense, multi-section document — title block, 3-col stat strip (Brew Data
// / Targets / Yeast), then six numbered sections. The mock shows the top
// half (Ingredients / Water / Mash / Boil) so the structure reads at a
// glance, and uses the Boil section's Pre-Boil OG row to host the
// highlighted differentiator: the auto-suggested recovery options with
// the hop-character warning.
//
// Reveal sequence when `playing` flips to true:
//   1. Title block + status pill                       (delay 0)
//   2. 3-col stat strip                                 (delay 0.12)
//   3. 01 Ingredients (grains + hops, 2-col grid)       (delay 0.30)
//   4. 02 Water (salts + profile + volumes)             (delay 0.46)
//   5. 03 Mash                                          (delay 0.58)
//   6. 04 Boil — Pre-Boil OG row + recovery options    (delay 0.72)
//   7. Hop-character warning slides in SPRINGY          (delay 0.96)
//
// Style mirrors the real component: 2px ink borders, paper bg on cards,
// chunky offset shadows, eyebrow uppercase labels, mono numerics, SRM
// color swatches next to grain names.
//
// `compact` mode (default) renders just the top sections (title block,
// 3-col stat strip, 01 Ingredients) so the panel fits naturally inside
// the 360px in-section slot. The full panel (everything through 04 Boil
// with the Pre-Boil OG recovery callout) renders when the breakout is
// active and the panel has lifted out into the viewport.
export default function BrewSheetPanel({
  playing,
  compact = false,
}: {
  playing: boolean;
  compact?: boolean;
}) {
  const { panel } = STAGES.brewSheet;

  return (
    <div
      style={{
        // In compact mode (in-section view), drop the outer card framing
        // entirely — the section card around us already provides the
        // border + bg + shadow. Doubling them creates a "card inside a
        // card" look. In expanded mode (breakout), the panel lifts out
        // of the section card and acts as its own card, so it brings
        // back the full framing.
        background: compact ? "transparent" : hsTokens.cream,
        padding: compact ? "14px 16px 12px" : "16px 18px 18px",
        border: compact ? "none" : `2px solid var(--hs-ink)`,
        borderRadius: compact ? 0 : 14,
        boxShadow: compact ? "none" : "6px 6px 0 var(--hs-ink)",
        fontFamily: hsTokens.body,
      }}
    >
      {/* ── Title block ───────────────────────────────────────────────── */}
      <Reveal playing={playing} delay={0} y={6}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 20,
              letterSpacing: "-0.025em",
              color: hsTokens.ink,
              lineHeight: 1,
            }}
          >
            {panel.title}
          </div>
          <StatusPill label={panel.status} />
        </div>
      </Reveal>

      {/* ── 3-col stat strip ─────────────────────────────────────────── */}
      <Reveal playing={playing} delay={0.12} y={6}>
        <div
          className="bs-strip"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 6,
            marginBottom: 14,
          }}
        >
          <MiniTable eyebrow="Brew Data" rows={panel.brewData} />
          <MiniTable eyebrow="Targets" rows={panel.targets} accent="malt" />
          <MiniTable eyebrow="Yeast" rows={panel.yeast} />
        </div>
      </Reveal>

      {/* ── 01 Ingredients ────────────────────────────────────────────── */}
      <Reveal playing={playing} delay={0.3} y={6}>
        <Section number="01" name="Ingredients">
          <div
            className="bs-ingredients"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <SubEyebrow>Grains</SubEyebrow>
              {panel.grains.map((g, i) => (
                <GrainRow key={i} {...g} />
              ))}
            </div>
            <div>
              <SubEyebrow>Hops</SubEyebrow>
              {panel.hops.map((h, i) => (
                <HopRow key={i} {...h} />
              ))}
            </div>
          </div>
        </Section>
      </Reveal>

      {/* Sections 02-04 only render in expanded (non-compact) mode.
          In the 360px in-section slot we just show the top portion
          (title + stats strip + 01 Ingredients) so the panel reads
          as a clean scaled-down preview of the brewsheet. */}
      {!compact ? (
        <>
      {/* ── 02 Water ──────────────────────────────────────────────────── */}
      <Reveal playing={playing} delay={0.46} y={6}>
        <Section number="02" name="Water">
          <div style={{ display: "grid", gap: 4 }}>
            <KVLine label="Salts" mono>
              {panel.water.salts}
            </KVLine>
            <KVLine label="Profile" mono>
              {panel.water.profile}
            </KVLine>
            <KVLine label="Volumes">{panel.water.volumes}</KVLine>
          </div>
        </Section>
      </Reveal>

      {/* ── 03 Mash ──────────────────────────────────────────────────── */}
      <Reveal playing={playing} delay={0.58} y={6}>
        <Section number="03" name="Mash">
          <div
            style={{
              fontFamily: hsTokens.body,
              fontSize: 11,
              color: hsTokens.ink,
            }}
          >
            {panel.mash}
          </div>
        </Section>
      </Reveal>

      {/* ── 04 Boil — the highlighted moment ──────────────────────────── */}
      <Reveal playing={playing} delay={0.72} y={6}>
        <Section number="04" name="Boil" highlight>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Pre-Boil OG actual vs target */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                  marginRight: 2,
                }}
              >
                {panel.preBoilLabel}
              </span>
              <span
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 18,
                  letterSpacing: "-0.025em",
                  color: hsTokens.roast,
                }}
              >
                {panel.preBoilPredicted}
              </span>
              <span style={{ color: hsTokens.muted, fontSize: 11 }}>→</span>
              <span
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 18,
                  letterSpacing: "-0.025em",
                  color: hsTokens.ink,
                }}
              >
                {panel.preBoilTarget}
              </span>
              <span style={{ color: hsTokens.muted, fontSize: 9, marginLeft: 4 }}>
                predicted / target
              </span>
            </div>

            {/* Two recovery option cards */}
            <div
              className="bs-options"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {panel.options.map((opt, i) => (
                <div
                  key={opt.title}
                  style={{
                    position: "relative",
                    padding: "8px 10px",
                    background: hsTokens.paper,
                    border: `1.5px solid var(--hs-ink)`,
                    borderRadius: 8,
                    boxShadow: "2px 2px 0 var(--hs-ink)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      fontWeight: 800,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: i === 0 ? hsTokens.hops : hsTokens.muted,
                      marginBottom: 4,
                    }}
                  >
                    {opt.tag}
                  </div>
                  <div
                    style={{
                      fontFamily: hsTokens.display,
                      fontSize: 12,
                      letterSpacing: "-0.015em",
                      color: hsTokens.ink,
                      lineHeight: 1.15,
                      marginBottom: 3,
                    }}
                  >
                    {opt.title}
                  </div>
                  <div
                    style={{
                      fontFamily: hsTokens.body,
                      fontSize: 9.5,
                      lineHeight: 1.45,
                      color: hsTokens.muted,
                    }}
                  >
                    {opt.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Hop-character warning — slides in SPRINGY, the "wow it caught
                that" beat. Delayed past all other content reveals. */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={playing ? { opacity: 1, x: 0 } : undefined}
              transition={{ duration: 0.5, delay: 0.96, ease: EASE.springy }}
              style={{
                padding: "8px 10px",
                background: hsTokens.honey,
                border: `1.5px solid var(--hs-ink)`,
                borderRadius: 8,
                boxShadow: "2px 2px 0 var(--hs-ink)",
                fontFamily: hsTokens.body,
                fontSize: 10,
                lineHeight: 1.4,
                color: hsTokens.ink,
                display: "flex",
                gap: 6,
                alignItems: "flex-start",
              }}
            >
              <span aria-hidden style={{ flexShrink: 0, marginTop: -1 }}>
                ⚠
              </span>
              <span>{panel.warning}</span>
            </motion.div>
          </div>
        </Section>
      </Reveal>
        </>
      ) : null}

      <style>{`
        @media (max-width: 540px) {
          .bs-strip { grid-template-columns: 1fr !important; }
          .bs-ingredients { grid-template-columns: 1fr !important; }
          .bs-options { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────

function Reveal({
  playing,
  delay,
  y = 4,
  children,
}: {
  playing: boolean;
  delay: number;
  y?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={playing ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.42, delay, ease: EASE.smooth }}
    >
      {children}
    </motion.div>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px 3px 6px",
        background: hsTokens.ink,
        border: `1.5px solid var(--hs-ink)`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.cream,
      }}
    >
      <motion.span
        aria-hidden
        animate={{ opacity: [1, 0.35, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 6,
          height: 6,
          background: hsTokens.roast,
          borderRadius: 999,
        }}
      />
      {label}
    </span>
  );
}

function MiniTable({
  eyebrow,
  rows,
  accent,
}: {
  eyebrow: string;
  rows: Array<{ label: string; value: string; srm?: number }>;
  accent?: "malt";
}) {
  return (
    <div
      style={{
        background: hsTokens.paper,
        border: `1.5px solid var(--hs-ink)`,
        borderRadius: 8,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        padding: "7px 8px 8px",
      }}
    >
      <div
        style={{
          fontSize: 8.5,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: accent === "malt" ? hsTokens.roast : hsTokens.muted,
          marginBottom: 5,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 6,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <span
              style={{
                fontFamily: hsTokens.body,
                fontSize: 9,
                color: hsTokens.muted,
                whiteSpace: "nowrap",
              }}
            >
              {r.label}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {typeof r.srm === "number" ? (
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    background: srmToRgb(r.srm),
                    border: `1px solid var(--hs-ink)`,
                    borderRadius: 2,
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: hsTokens.ink,
                }}
              >
                {r.value}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({
  number,
  name,
  children,
  highlight = false,
}: {
  number: string;
  name: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px 10px",
        background: highlight
          ? `color-mix(in oklab, ${hsTokens.honey} 22%, ${hsTokens.cream})`
          : "transparent",
        border: highlight ? `1.5px solid var(--hs-ink)` : "none",
        borderRadius: highlight ? 10 : 0,
        boxShadow: highlight ? "2px 2px 0 var(--hs-ink)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 11,
            color: hsTokens.muted,
            letterSpacing: "-0.02em",
          }}
        >
          {number}
        </span>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: hsTokens.ink,
          }}
        >
          {name}
        </span>
      </div>
      {children}
    </div>
  );
}

function SubEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function GrainRow({
  name,
  amount,
  srm,
}: {
  name: string;
  amount: string;
  srm: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 0",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          background: srmToRgb(srm),
          border: `1px solid var(--hs-ink)`,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          // min-width: 0 is critical on flex children with nowrap content:
          // without it the flex item refuses to shrink below its content
          // width, which pushes the entire panel wider than the column and
          // collapses the left tour column to 0.
          flex: 1,
          minWidth: 0,
          fontFamily: hsTokens.body,
          fontSize: 10,
          color: hsTokens.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          color: hsTokens.muted,
          flexShrink: 0,
        }}
      >
        {amount}
      </span>
    </div>
  );
}

function HopRow({
  name,
  amount,
  use,
}: {
  name: string;
  amount: string;
  use: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 0",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          background: hsTokens.hops,
          borderRadius: 999,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: hsTokens.body,
          fontSize: 10,
          color: hsTokens.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 9.5,
          color: hsTokens.muted,
          flexShrink: 0,
        }}
      >
        {amount}
      </span>
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          color: hsTokens.muted,
          fontStyle: "italic",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {use}
      </span>
    </div>
  );
}

function KVLine({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 8,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          minWidth: 50,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          // No nowrap here: profile / salts strings wrap naturally onto
          // multiple lines when the column is narrow, which is fine and
          // doesn't force the panel wider than its column.
          flex: 1,
          minWidth: 0,
          fontFamily: mono ? hsTokens.mono : hsTokens.body,
          fontSize: 10,
          lineHeight: 1.45,
          color: hsTokens.ink,
        }}
      >
        {children}
      </span>
    </div>
  );
}
