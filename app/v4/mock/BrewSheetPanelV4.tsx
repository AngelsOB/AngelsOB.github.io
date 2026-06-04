"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { STAGES } from "../data";

// Small-scale, presentational mirror of the live builder's brew sheet
// (src/modules/hopskip/components/builder/HSBrewSheetSection.tsx). It copies
// that component's visual vocabulary — accent-barred cards, gridded stat
// tables, display/script typography, the roast-accented OG recovery card —
// at roughly half scale, without any of its interactivity or calc logic.
//
// No framer-motion. Every block that the GSAP tour staggers is a plain
// <div className="bs-reveal">; nothing animates on its own here.
//
// `compact` (default false) renders just the top sections (title block,
// 3-col stat strip, 01 Ingredients) so the panel fits the mock's body slot.
// `framed` (default true) draws the panel's own card; the mock passes
// framed={false} because its body panel already supplies the border/bg.
export default function BrewSheetPanelV4({
  compact = false,
  framed = true,
}: {
  compact?: boolean;
  framed?: boolean;
}) {
  const { panel } = STAGES.brewSheet;

  return (
    <div
      style={{
        background: framed ? hsTokens.paper : "transparent",
        padding: framed ? "16px 18px 18px" : "12px 14px 14px",
        border: framed ? `2px solid var(--hs-ink)` : "none",
        borderRadius: framed ? 14 : 0,
        boxShadow: framed ? hsTokens.sh3 : "none",
        fontFamily: hsTokens.body,
      }}
    >
      {/* ── Title block ───────────────────────────────────────────────── */}
      <div className="bs-reveal">
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            {/* Script kicker — the real header's "brew day —" hand note. */}
            <div
              style={{
                fontFamily: hsTokens.script,
                fontSize: 15,
                lineHeight: 1,
                color: hsTokens.honey,
                transform: "rotate(-3deg)",
                transformOrigin: "left bottom",
                marginBottom: 3,
              }}
            >
              brew day —
            </div>
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 26,
                letterSpacing: "-0.035em",
                color: hsTokens.ink,
                lineHeight: 0.95,
              }}
            >
              {panel.title}
            </div>
          </div>
          <StatusPill label={panel.status} />
        </div>
      </div>

      {/* ── 3-col stat strip ─────────────────────────────────────────── */}
      <div className="bs-reveal">
        <div
          className="bs-strip"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <MiniTable title="Brew Data" rows={panel.brewData} accent={hsTokens.muted} />
          <MiniTable title="Targets" rows={panel.targets} accent={hsTokens.malt} />
          <MiniTable title="Yeast" rows={panel.yeast} accent={hsTokens.yeast} />
        </div>
      </div>

      {/* ── 01 Ingredients ────────────────────────────────────────────── */}
      <div className="bs-reveal">
        <Section number="01" name="Ingredients" accent={hsTokens.malt}>
          <div
            className="bs-ingredients"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div>
              <GroupBand label="Grains" accent={hsTokens.malt} />
              {panel.grains.map((g, i) => (
                <GrainRow key={i} {...g} />
              ))}
            </div>
            <div>
              <GroupBand label="Hops" accent={hsTokens.hops} />
              {panel.hops.map((h, i) => (
                <HopRow key={i} {...h} />
              ))}
            </div>
          </div>
        </Section>
      </div>

      {/* Sections 02-04 only render in expanded (non-compact) mode. */}
      {!compact ? (
        <>
          {/* ── 02 Water ──────────────────────────────────────────────── */}
          <div className="bs-reveal">
            <Section number="02" name="Water" accent={hsTokens.water}>
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
          </div>

          {/* ── 03 Mash ──────────────────────────────────────────────── */}
          <div className="bs-reveal">
            <Section number="03" name="Mash" accent={hsTokens.roast}>
              <div
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 15,
                  letterSpacing: "-0.015em",
                  color: hsTokens.ink,
                }}
              >
                {panel.mash}
              </div>
            </Section>
          </div>

          {/* ── 04 Boil — the highlighted moment ──────────────────────── */}
          <div className="bs-reveal">
            <Section number="04" name="Boil" accent={hsTokens.roast}>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
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
                      fontFamily: hsTokens.display,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.16em",
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
                  <span
                    style={{ color: hsTokens.muted, fontSize: 9, marginLeft: 4 }}
                  >
                    predicted / target
                  </span>
                </div>

                {/* OG recovery card — the differentiator. Mirrors the live
                    builder's BrewTipCard: cream bg, roast top accent, a
                    warning-triangle + uppercase problem label header with a
                    script reasoning aside, then the fix options. */}
                <RecoveryCard
                  options={panel.options}
                  warning={panel.warning}
                />
              </div>
            </Section>
          </div>
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

// ─── glyphs ────────────────────────────────────────────────────────────
// Round-cap 2px ink linework, copied from the real component's
// WarningTriangleGlyph / CheckGlyph so the caution flag reads as the same
// hand-sketched notebook vocabulary.

function WarningTriangleGlyph({ color }: { color: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      aria-hidden
      style={{ display: "inline-block", verticalAlign: "middle" }}
    >
      <path
        d="M8 2.5 L13.6 13.2 L2.4 13.2 Z"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 6.3 L8 9.4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.95" fill={color} />
    </svg>
  );
}

// ─── helpers ───────────────────────────────────────────────────────────

function StatusPill({ label }: { label: string }) {
  // Matches the live builder's StatusToggle: paper bg, ink text, 2px ink
  // border, offset shadow, colored dot. (The v3 mock used an inverted dark
  // pill, which read as dated against the rest of the brand.)
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        background: hsTokens.paper,
        border: `2px solid var(--hs-ink)`,
        borderRadius: 999,
        boxShadow: hsTokens.sh1,
        fontFamily: hsTokens.body,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          background: hsTokens.hops,
          borderRadius: 999,
        }}
      />
      {label}
    </span>
  );
}

function MiniTable({
  title,
  rows,
  accent,
}: {
  title: string;
  rows: ReadonlyArray<{ label: string; value: string; srm?: number }>;
  accent: string;
}) {
  // Mirrors the real MiniTable: a paper card with a 2px ink border, an
  // accent color bar across the top, an uppercase display-font title, and a
  // gridded table where label cells sit on a cream-2 fill with 1px ink
  // gridlines.
  return (
    <div
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid var(--hs-ink)`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: accent,
          pointerEvents: "none",
        }}
      />
      <div style={{ padding: "8px 8px 5px" }}>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 10,
            color: hsTokens.ink,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
          }}
        >
          {title}
        </span>
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: hsTokens.body,
          fontSize: 10,
          tableLayout: "auto",
        }}
      >
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td
                style={{
                  padding: "3px 7px",
                  borderTop: `1px solid var(--hs-ink)`,
                  borderRight: `1px solid var(--hs-ink)`,
                  color: hsTokens.muted,
                  fontWeight: 600,
                  fontSize: 8,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  background: hsTokens.cream2,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                {r.label}
              </td>
              <td
                style={{
                  padding: "3px 8px",
                  borderTop: `1px solid var(--hs-ink)`,
                  fontFamily: hsTokens.body,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: hsTokens.ink,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.2,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {typeof r.srm === "number" ? (
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        background: srmToRgb(r.srm),
                        border: `1px solid var(--hs-ink)`,
                        borderRadius: 3,
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                  {r.value}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  number,
  name,
  children,
  accent,
}: {
  number: string;
  name: string;
  children: React.ReactNode;
  accent: string;
}) {
  // Mirrors the real SheetSection: paper card, 2px ink border, accent bar
  // across the top, header with a display-font number eyebrow + display-font
  // (not uppercase) title.
  return (
    <div
      style={{
        position: "relative",
        marginTop: 8,
        background: hsTokens.paper,
        border: `2px solid var(--hs-ink)`,
        borderRadius: 12,
        boxShadow: hsTokens.sh1,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: accent,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          padding: "9px 11px 7px",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: hsTokens.muted,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {number}
        </span>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 14,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: hsTokens.ink,
          }}
        >
          {name}
        </span>
      </div>
      <div style={{ padding: "0 11px 11px" }}>{children}</div>
    </div>
  );
}

function GroupBand({ label, accent }: { label: string; accent: string }) {
  // Mirrors the real HopGroupRow band: cream-2 fill, 1px ink rules top and
  // bottom, an ink-outlined accent dot, uppercase wide-tracked label.
  return (
    <div
      style={{
        padding: "4px 8px",
        marginBottom: 4,
        background: hsTokens.cream2,
        fontFamily: hsTokens.body,
        fontSize: 8,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: hsTokens.ink,
        borderTop: `1px solid var(--hs-ink)`,
        borderBottom: `1px solid var(--hs-ink)`,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: 999,
          background: accent,
          border: `1px solid var(--hs-ink)`,
          marginRight: 7,
          verticalAlign: "middle",
        }}
      />
      {label}
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
        padding: "3px 2px",
        borderBottom: `1px solid color-mix(in oklch, var(--hs-ink) 15%, transparent)`,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          background: srmToRgb(srm),
          border: `1px solid var(--hs-ink)`,
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: hsTokens.body,
          fontSize: 10.5,
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
        padding: "3px 2px",
        borderBottom: `1px solid color-mix(in oklch, var(--hs-ink) 15%, transparent)`,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          background: hsTokens.hops,
          border: `1px solid var(--hs-ink)`,
          borderRadius: 999,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: hsTokens.body,
          fontSize: 10.5,
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
          fontFamily: hsTokens.display,
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.12em",
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

// ─── OG recovery card (the differentiator) ───────────────────────────────

function RecoveryCard({
  options,
  warning,
}: {
  options: ReadonlyArray<{ tag: string; title: string; desc: string }>;
  warning: string;
}) {
  // Faithful miniature of the live builder's BrewTipCard: cream surface, 2px
  // ink border, roast accent bar, a warning-triangle + uppercase display
  // problem label header with a script-font reasoning aside, then the fix
  // options separated by a display-font "OR" divider.
  return (
    <div
      style={{
        position: "relative",
        background: hsTokens.cream,
        border: `2px solid var(--hs-ink)`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        padding: "10px 11px 11px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        overflow: "hidden",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: hsTokens.roast,
          pointerEvents: "none",
        }}
      />

      {/* Header — triangle glyph + uppercase problem label + script aside. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexWrap: "nowrap",
          minWidth: 0,
        }}
      >
        <span style={{ flexShrink: 0, lineHeight: 0 }}>
          <WarningTriangleGlyph color={hsTokens.roast} />
        </span>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            color: hsTokens.roast,
            textTransform: "uppercase",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          Post-boil OG predicted to miss
        </span>
        <span
          aria-hidden
          style={{ color: hsTokens.muted, fontSize: 12, lineHeight: 1, flexShrink: 0 }}
        >
          ·
        </span>
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 12,
            color: hsTokens.muted,
            lineHeight: 1.2,
            flex: "1 1 auto",
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          pre-boil gravity ran low
        </span>
      </div>

      {/* Fix options — separated by an "OR" divider, like the real grid. */}
      <div
        className="bs-options"
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 6,
          flexWrap: "nowrap",
        }}
      >
        {options.map((opt, i) => (
          <FixCard
            key={opt.title}
            opt={opt}
            first={i === 0}
            divider={i > 0}
            // The boil-longer option carries the hop-character caveat, just
            // like the live builder flags it on the "boil longer" fix.
            warning={i === 1 ? warning : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function FixCard({
  opt,
  first,
  divider,
  warning,
}: {
  opt: { tag: string; title: string; desc: string };
  first: boolean;
  divider: boolean;
  warning?: string;
}) {
  return (
    <>
      {divider ? (
        <div
          aria-hidden
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: hsTokens.display,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: hsTokens.muted,
            padding: "0 1px",
            flexShrink: 0,
          }}
        >
          OR
        </div>
      ) : null}
      <div
        style={{
          flex: "1 1 0",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "8px 10px",
          background: hsTokens.paper,
          border: `1.5px solid var(--hs-ink)`,
          borderRadius: 8,
          color: hsTokens.ink,
        }}
      >
        {/* Eyebrow — first/cleanest option carries the hops-green accent. */}
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: first ? hsTokens.hops : hsTokens.muted,
            whiteSpace: "nowrap",
          }}
        >
          {opt.tag}
        </span>
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 11.5,
            letterSpacing: "-0.005em",
            lineHeight: 1.2,
            color: hsTokens.ink,
          }}
        >
          {opt.title}
        </span>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 9,
            lineHeight: 1.45,
            color: hsTokens.muted,
          }}
        >
          {opt.desc}
        </span>
        {warning ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "flex-start",
              gap: 4,
              marginTop: 2,
              fontFamily: hsTokens.script,
              fontSize: 11,
              color: hsTokens.roast,
              lineHeight: 1.25,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1 }}>
              <WarningTriangleGlyph color={hsTokens.roast} />
            </span>
            <span>{warning}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}
