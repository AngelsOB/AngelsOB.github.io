"use client";

import { useState } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import type { TabKey } from "./V4Mock";

// At-rest content for the mock's non-hops, non-brewsheet tabs. The mock is a
// usable mini builder, so clicking Fermentables / Mash / Water / Yeast /
// Fermentation shows a believable section. These mirror the LIVE homepage
// mock's section look (app/_home/components/HeroBuilderCard.tsx): a
// display-font section title with a thick accent underline + meta, then the
// real panel vocabulary — the salts/ion-bar water visualizer, the numbered
// mash steps + pH gauge, the yeast strain card, and the fermentation journey
// timeline (ported from the real builder's FermentationSection). Numbers stay
// consistent with the brew sheet. No scroll beats here — those layer on later;
// water's salts are static (the interactive "flex" is a separate beat).
//
// Sized to fit the mock body (~544x228) so its height stays steady per tab.

const INK = hsTokens.ink;
const ROAST = hsTokens.roast;
const MALT = hsTokens.malt;
const WATER = hsTokens.water;
const YEAST = hsTokens.yeast;
const HONEY = hsTokens.honey;
const HOPS = hsTokens.hops;

export function TabSection({ active, grainFill = 1 }: { active: TabKey; grainFill?: number }) {
  switch (active) {
    case "fermentables":
      return <FermentablesSection grainFill={grainFill} />;
    case "mash":
      return <MashSection />;
    case "water":
      return <WaterSection />;
    case "yeast":
      return <YeastSection />;
    case "fermentation":
      return <FermentationSection />;
    default:
      return null;
  }
}

// ─── shared shell ─────────────────────────────────────────────────────────

function SectionBody({ children, gap = 8 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div style={{ height: "100%", padding: 10, display: "flex", flexDirection: "column", gap }}>
      {children}
    </div>
  );
}

// Mirrors the live mock's SectionTitleRow: big display title, thick accent
// underline, uppercase meta on the right. The "looks real" anchor.
export function SectionHead({ title, meta, underline }: { title: string; meta: string; underline: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        borderBottom: `2.5px solid ${underline}`,
        paddingBottom: 4,
      }}
    >
      <h3 style={{ fontFamily: hsTokens.display, fontSize: 19, letterSpacing: "-0.035em", margin: 0, color: INK, lineHeight: 1 }}>
        {title}
      </h3>
      <span style={{ fontFamily: hsTokens.body, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: hsTokens.muted, whiteSpace: "nowrap" }}>
        {meta}
      </span>
    </div>
  );
}

// mono value chip (mash temp, grain weight)
function Chip({ children, minWidth }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: hsTokens.mono,
        fontSize: 11,
        fontWeight: 700,
        color: INK,
        padding: "3px 9px",
        background: hsTokens.paper,
        border: `1.5px solid ${INK}`,
        borderRadius: 6,
        fontVariantNumeric: "tabular-nums",
        minWidth,
      }}
    >
      {children}
    </span>
  );
}

// ─── Fermentables ──────────────────────────────────────────────────────────

const GRAINS = [
  { name: "2-row Pale", category: "Base malt", weight: "9.0 lb", lb: 9.0, srm: 2 },
  { name: "Munich", category: "Base · kilned", weight: "1.0 lb", lb: 1.0, srm: 9 },
  { name: "Crystal 40", category: "Caramel", weight: "0.3 lb", lb: 0.3, srm: 40 },
];
const GRAIN_TOTAL = GRAINS.reduce((s, g) => s + g.lb, 0);

// Cumulative weight fraction of the bill AFTER each grain is added — the step
// levels for the grains "live math" beat. The base malt is most of the bill, so
// it makes a big jump and the specialty malts add small bumps (each grain moves
// the numbers by its own contribution). Shared with HomeV4's staircase timeline
// so the grain reveal here stays in sync with the number steps.
// e.g. [0.87, 0.97, 1.0] for 9.0 / 1.0 / 0.3 lb.
export const GRAIN_STEP_LEVELS = (() => {
  let acc = 0;
  return GRAINS.map((g) => (acc += g.lb) / GRAIN_TOTAL);
})();

function FermentablesSection({ grainFill = 1 }: { grainFill?: number }) {
  // Each grain reveals during ITS step of the staircase build: grain i fills in
  // as grainFill rises from the previous step level to its own, so grains appear
  // one at a time, in lockstep with the number jumps (see GRAIN_STEP_LEVELS).
  const reveal = (i: number) => {
    const lo = i === 0 ? 0 : GRAIN_STEP_LEVELS[i - 1];
    const hi = GRAIN_STEP_LEVELS[i];
    return Math.max(0, Math.min(1, (grainFill - lo) / (hi - lo)));
  };
  const revealedLb = GRAINS.reduce((s, g, i) => s + g.lb * reveal(i), 0);
  const revealedCount = GRAINS.filter((_, i) => reveal(i) > 0.5).length;
  return (
    <SectionBody gap={7}>
      <SectionHead title="Grain." meta={`${revealedCount} in the bill · ${revealedLb.toFixed(1)} lb`} underline={MALT} />
      {/* bill stack — each segment grows in with its grain */}
      <div style={{ height: 11, background: hsTokens.cream2, border: `1.5px solid ${INK}`, borderRadius: 999, overflow: "hidden", display: "flex" }}>
        {GRAINS.map((g, i) => (
          <div key={g.name} style={{ width: `${(g.lb / GRAIN_TOTAL) * 100 * reveal(i)}%`, background: srmToRgb(g.srm) }} />
        ))}
      </div>
      {/* ledger rows — fade + slide in as each grain is added */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {GRAINS.map((g, i) => {
          const r = reveal(i);
          return (
          <div
            key={g.name}
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 9px", background: hsTokens.cream, border: `2px solid ${INK}`, borderRadius: 9, boxShadow: "2px 2px 0 var(--hs-ink)", opacity: r, transform: `translateY(${(1 - r) * 6}px)` }}
          >
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                background: srmToRgb(g.srm),
                border: `1.5px solid ${INK}`,
                borderRadius: 5,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: hsTokens.mono,
                fontSize: 7.5,
                fontWeight: 700,
                color: g.srm > 20 ? "#fff" : INK,
                textShadow: g.srm > 20 ? "0 1px 1px rgba(0,0,0,0.4)" : "none",
              }}
            >
              {g.srm}L
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: hsTokens.body, fontSize: 12, fontWeight: 700, color: INK, lineHeight: 1.1 }}>{g.name}</div>
              <span style={{ display: "inline-block", marginTop: 2, fontFamily: hsTokens.body, fontSize: 7.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", background: `color-mix(in oklch, ${MALT} 32%, ${hsTokens.cream2})`, border: `1px solid ${INK}`, color: INK, padding: "1px 6px", borderRadius: 999 }}>
                {g.category}
              </span>
            </div>
            <Chip minWidth={56}>{g.weight}</Chip>
            <span style={{ fontFamily: hsTokens.mono, fontSize: 11, fontWeight: 700, color: hsTokens.muted, minWidth: 38, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {Math.round((g.lb / GRAIN_TOTAL) * 100)}%
            </span>
          </div>
          );
        })}
      </div>
    </SectionBody>
  );
}

// ─── Mash — numbered steps + pH gauge ────────────────────────────────────────

function MashSection() {
  return (
    <SectionBody>
      <SectionHead title="Mash." meta="single infusion · BIAB" underline={ROAST} />
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", background: hsTokens.cream, border: `2px solid ${INK}`, borderRadius: 10, boxShadow: "2px 2px 0 var(--hs-ink)" }}>
        <span aria-hidden style={{ width: 32, height: 32, background: `color-mix(in oklch, ${ROAST} 40%, ${hsTokens.cream})`, border: `1.5px solid ${INK}`, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: hsTokens.display, fontSize: 15, color: INK, fontVariantNumeric: "tabular-nums" }}>
          1
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: hsTokens.body, fontSize: 13, fontWeight: 700, color: INK }}>Saccharification rest</div>
          <div style={{ fontFamily: hsTokens.body, fontSize: 9.5, fontWeight: 600, color: hsTokens.muted, letterSpacing: "0.04em", marginTop: 2 }}>hold mash temperature</div>
        </div>
        <Chip>152°F</Chip>
        <span style={{ fontFamily: hsTokens.mono, fontSize: 11, fontWeight: 700, color: hsTokens.muted, minWidth: 52, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>60 min</span>
      </div>
      {/* strike / volumes strip */}
      <div style={{ display: "flex", gap: 6 }}>
        <MiniStat label="Strike" value="164°F" />
        <MiniStat label="Mash water" value="4.0 gal" />
        <MiniStat label="Sparge" value="3.5 gal" />
      </div>
      {/* pH gauge */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "8px 11px", background: hsTokens.cream2, border: `1.5px solid ${INK}`, borderRadius: 8 }}>
        <span style={{ fontFamily: hsTokens.body, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: hsTokens.muted }}>Mash pH</span>
        <div style={{ position: "relative", flex: 1, height: 8, background: hsTokens.paper, border: `1.5px solid ${INK}`, borderRadius: 999, overflow: "hidden" }}>
          {/* ideal band 5.2-5.6 across a 5.0-5.8 track */}
          <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: "25%", width: "50%", background: `color-mix(in oklch, ${HOPS} 28%, transparent)` }} />
          <span aria-hidden style={{ position: "absolute", top: -3, bottom: -3, left: `${((5.38 - 5.0) / 0.8) * 100}%`, transform: "translateX(-50%)", width: 2.5, background: INK, borderRadius: 1 }} />
        </div>
        <span style={{ fontFamily: hsTokens.display, fontSize: 15, color: INK, fontVariantNumeric: "tabular-nums" }}>5.38</span>
        <span aria-hidden style={{ width: 7, height: 7, background: HOPS, border: `1px solid ${INK}`, borderRadius: 999 }} title="in range" />
      </div>
    </SectionBody>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: hsTokens.paper, border: `2px solid ${INK}`, borderRadius: 8, boxShadow: "2px 2px 0 var(--hs-ink)", padding: "5px 9px", minWidth: 0 }}>
      <div style={{ fontFamily: hsTokens.body, fontSize: 8, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: hsTokens.muted }}>{label}</div>
      <div style={{ fontFamily: hsTokens.display, fontSize: 14, letterSpacing: "-0.02em", color: INK, marginTop: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

// ─── Water — interactive salts + ion-bar visualizer (live WaterPanel) ────────
// Tap +/- on a salt and the ion profile recomputes live, like the real
// builder. Per-gram-per-5-gal ion contributions tuned so the default salts
// land on the target profile.

const SALT_DEFS = [
  { short: "CaSO₄", name: "Gypsum", contributes: { Ca: 46, SO4: 112 } },
  { short: "CaCl₂", name: "Calcium Chloride", contributes: { Ca: 54, Cl: 96 } },
  { short: "MgSO₄", name: "Epsom", contributes: { Mg: 20, SO4: 78 } },
  { short: "NaCl", name: "Salt", contributes: { Na: 79, Cl: 121 } },
] as const;
const SALT_DEFAULTS = [5.2, 1.8, 0.4, 0.3];
// RO source water — essentially blank, a touch of bicarbonate.
const SOURCE_IONS: Record<string, number> = { Ca: 0, Mg: 0, Na: 0, SO4: 0, Cl: 8, HCO3: 8 };

type IonMeta = { key: string; label: string; color: string; max: number; tMin: number; tMax: number };
const ION_META: IonMeta[] = [
  { key: "Ca", label: "Ca", color: MALT, max: 450, tMin: 100, tMax: 350 },
  { key: "Mg", label: "Mg", color: HOPS, max: 60, tMin: 5, tMax: 40 },
  { key: "Na", label: "Na", color: YEAST, max: 150, tMin: 0, tMax: 60 },
  { key: "SO4", label: "SO₄", color: WATER, max: 700, tMin: 300, tMax: 650 },
  { key: "Cl", label: "Cl", color: ROAST, max: 300, tMin: 100, tMax: 250 },
  { key: "HCO3", label: "HCO₃", color: hsTokens.muted, max: 150, tMin: 0, tMax: 60 },
];

function WaterSection() {
  const [salts, setSalts] = useState<number[]>(SALT_DEFAULTS);
  const bump = (i: number, d: number) =>
    setSalts((prev) => prev.map((g, j) => (j === i ? Math.max(0, Math.round((g + d) * 10) / 10) : g)));
  const ions: Record<string, number> = { ...SOURCE_IONS };
  SALT_DEFS.forEach((def, i) => {
    for (const [ion, ppm] of Object.entries(def.contributes)) ions[ion] += salts[i] * ppm;
  });
  return (
    <SectionBody gap={7}>
      <SectionHead title="Water." meta="target · American IPA" underline={WATER} />
      {/* source -> target */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: hsTokens.paper, border: `2px solid ${INK}`, borderRadius: 999, fontFamily: hsTokens.body, fontSize: 10.5, fontWeight: 600, color: INK }}>
          <span style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: hsTokens.muted }}>Source</span>
          RO
        </span>
        <span style={{ color: hsTokens.muted, fontSize: 12 }}>→</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: WATER, border: `2px solid ${INK}`, borderRadius: 999, fontFamily: hsTokens.body, fontSize: 10.5, fontWeight: 700, color: "#fff", boxShadow: "2px 2px 0 var(--hs-ink)" }}>
          BJCP · Hoppy ▾
        </span>
      </div>
      {/* 2-col: interactive salts | ion bars */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)", gap: 9, flex: 1, minHeight: 0 }}>
        {/* salts — +/- recompute the profile */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {SALT_DEFS.map((s, i) => (
            <div key={s.short} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 6, padding: "4px 6px 4px 8px", background: hsTokens.cream, border: `1.5px solid ${INK}`, borderRadius: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: hsTokens.body, fontSize: 10, fontWeight: 800, color: INK, letterSpacing: "0.02em", lineHeight: 1 }}>{s.short}</div>
                <div style={{ fontSize: 7.5, color: hsTokens.muted, fontWeight: 600, lineHeight: 1.1, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
              </div>
              <span style={{ fontFamily: hsTokens.mono, fontSize: 12, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums", minWidth: 26, textAlign: "right" }}>{salts[i].toFixed(1)}</span>
              <span style={{ display: "flex", gap: 3 }}>
                <SaltBtn label="−" onClick={() => bump(i, -0.1)} />
                <SaltBtn label="+" onClick={() => bump(i, 0.1)} />
              </span>
            </div>
          ))}
        </div>
        {/* ion bars */}
        <div style={{ background: hsTokens.cream2, border: `2px solid ${INK}`, borderRadius: 10, padding: "7px 9px 8px", boxShadow: "2px 2px 0 var(--hs-ink)", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 7.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: hsTokens.muted, marginBottom: 4 }}>Profile · ppm</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, justifyContent: "center" }}>
            {ION_META.map((m) => (
              <IonBar key={m.key} label={m.label} value={Math.round(ions[m.key] ?? 0)} color={m.color} max={m.max} tMin={m.tMin} tMax={m.tMax} />
            ))}
          </div>
        </div>
      </div>
    </SectionBody>
  );
}

function SaltBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: 18, height: 18, background: hsTokens.paper, border: `1.5px solid ${INK}`, borderRadius: 5, fontFamily: hsTokens.body, fontSize: 12, fontWeight: 800, color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, boxShadow: "1.5px 1.5px 0 var(--hs-ink)", lineHeight: 1 }}
    >
      {label}
    </button>
  );
}

function IonBar({ label, value, color, max, tMin, tMax }: { label: string; value: number; color: string; max: number; tMin: number; tMax: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const inRange = value >= tMin && value <= tMax;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 30px", alignItems: "center", gap: 5 }}>
      <span style={{ fontFamily: hsTokens.body, fontSize: 8.5, fontWeight: 800, color: INK, letterSpacing: "0.02em" }}>{label}</span>
      <div style={{ position: "relative", height: 8, background: hsTokens.paper, border: `1.5px solid ${INK}`, borderRadius: 999, overflow: "hidden" }}>
        {/* target range band */}
        <span aria-hidden style={{ position: "absolute", top: 0, bottom: 0, left: `${(tMin / max) * 100}%`, width: `${((tMax - tMin) / max) * 100}%`, background: `color-mix(in oklab, ${color} 28%, transparent)` }} />
        {/* current fill */}
        <span aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, background: color, borderRight: `1.5px solid ${INK}` }} />
      </div>
      <span style={{ fontFamily: hsTokens.mono, fontSize: 9, fontWeight: 700, color: inRange ? INK : ROAST, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

// ─── Yeast — strain card + starter ───────────────────────────────────────────

function YeastSection() {
  return (
    <SectionBody>
      <SectionHead title="Yeast." meta="needs a starter" underline={YEAST} />
      {/* strain card */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: hsTokens.cream, border: `2px solid ${INK}`, borderRadius: 12, boxShadow: "3px 3px 0 var(--hs-ink)" }}>
        <span aria-hidden style={{ width: 44, height: 44, background: YEAST, border: `2px solid ${INK}`, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: hsTokens.display, fontSize: 19, color: INK, boxShadow: "2px 2px 0 var(--hs-ink)" }}>
          ✿
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: hsTokens.display, fontSize: 18, letterSpacing: "-0.03em", color: INK, lineHeight: 1 }}>WLP001 · California Ale</div>
          <div style={{ fontSize: 10, color: hsTokens.muted, marginTop: 3, fontWeight: 600 }}>White Labs · Liquid · 1 vial = 100 B cells</div>
          <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
            <StatChip label="ATTEN" value="79%" />
            <StatChip label="TEMP" value="68°F" />
            <StatChip label="FLOCC" value="Med" />
          </div>
        </div>
      </div>
      {/* starter — needed because 1 vial (100 B) is short of the pitch target */}
      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", background: hsTokens.cream2, border: `2px solid ${INK}`, borderRadius: 10, boxShadow: "2px 2px 0 var(--hs-ink)" }}>
        <FlaskGlyph />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: hsTokens.muted }}>Starter</div>
          <div style={{ fontFamily: hsTokens.display, fontSize: 15, letterSpacing: "-0.02em", color: INK, marginTop: 1 }}>2.0 L · stir plate</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: hsTokens.mono, fontSize: 11, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>100 B → 210 B</div>
          <div style={{ fontFamily: hsTokens.body, fontSize: 8, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: hsTokens.muted, marginTop: 2 }}>target 217 B</div>
        </div>
      </div>
    </SectionBody>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", background: hsTokens.paper, border: `1.5px solid ${INK}`, borderRadius: 6, fontFamily: hsTokens.body }}>
      <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: "0.1em", color: hsTokens.muted }}>{label}</span>
      <span style={{ fontFamily: hsTokens.mono, fontSize: 9.5, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </span>
  );
}

function FlaskGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      {/* yeast slurry fills the bowl */}
      <path d="M7.6 14 L5 19 a1 1 0 0 0 1 1 h12 a1 1 0 0 0 1 -1 L16.4 14 Z" fill={`color-mix(in oklch, ${YEAST} 60%, ${hsTokens.cream})`} />
      {/* flask outline */}
      <path d="M9 3 h6 M10 3 v6 L5 19 a1 1 0 0 0 1 1 h12 a1 1 0 0 0 1 -1 L14 9 V3" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Fermentation — journey timeline (ported from the real builder) ──────────

// Real builder's stepTypeColor: primary=honey, diacetyl-rest=roast,
// cold-crash=#7faec9, carb-keg=honey (marked with a diagonal stripe). Solid
// (not tinted) — the journey bar uses the colors directly, like
// FermentationSection's JourneySegment.
const FERM_STEPS = [
  { label: "Primary", temp: "68°F", days: 14, color: HONEY, dark: false, carb: false },
  { label: "Diacetyl rest", temp: "70°F", days: 2, color: ROAST, dark: true, carb: false },
  { label: "Cold crash", temp: "34°F", days: 3, color: "#7faec9", dark: false, carb: false },
  { label: "Keg", temp: "12 PSI", days: 7, color: HONEY, dark: false, carb: true },
];
const FERM_TOTAL = FERM_STEPS.reduce((s, st) => s + st.days, 0);
const FERM_PACKAGE_DAY = FERM_STEPS.filter((s) => !s.carb).reduce((s, st) => s + st.days, 0);
// Carb segments get a faint diagonal stripe, signalling "estimated" — same as
// the real JourneySegment.
const CARB_STRIPE = "repeating-linear-gradient(135deg, transparent 0 6px, rgba(0,0,0,0.06) 6px 7px)";

function FermentationSection() {
  return (
    <SectionBody gap={6}>
      <SectionHead title="Fermentation." meta={`${FERM_TOTAL} days to glass`} underline={HONEY} />
      {/* date pills */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <DatePill label="brew" date="Jun 4" />
        <DatePill label="keg ready" date="Jun 30" right />
      </div>
      {/* journey bar — flex by days, solid step color, label inside (≥12%) */}
      <div style={{ display: "flex", height: 32, background: hsTokens.paper, border: `1.5px solid ${INK}`, borderRadius: 8, overflow: "hidden", boxShadow: "2px 2px 0 var(--hs-ink)" }}>
        {FERM_STEPS.map((s, i) => {
          const pct = (s.days / FERM_TOTAL) * 100;
          return (
            <div
              key={s.label}
              style={{
                flex: `${s.days} 0 0`,
                minWidth: 6,
                background: s.color,
                backgroundImage: s.carb ? CARB_STRIPE : undefined,
                borderLeft: i > 0 ? `1.5px solid ${INK}` : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {pct >= 12 ? (
                <span style={{ fontFamily: hsTokens.body, fontWeight: 700, fontSize: 9, letterSpacing: "0.04em", textTransform: "uppercase", color: s.dark ? hsTokens.cream : INK, whiteSpace: "nowrap", padding: "0 5px", opacity: 0.85 }}>
                  {s.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* day axis */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontFamily: hsTokens.mono, fontSize: 9, color: hsTokens.muted }}>
        <span aria-hidden style={{ flex: 1, borderTop: `1px dotted color-mix(in oklch, ${INK} 30%, transparent)`, position: "relative", top: -3 }} />
        <span style={{ whiteSpace: "nowrap" }}>ferment {FERM_PACKAGE_DAY}d · carb {FERM_TOTAL - FERM_PACKAGE_DAY}d</span>
        <span aria-hidden style={{ flex: 1, borderTop: `1px dotted color-mix(in oklch, ${INK} 30%, transparent)`, position: "relative", top: -3 }} />
      </div>
      {/* per-step tiles — match the real StatTile: eyebrow label, big value,
          sub, accent top stripe, light border. */}
      <div style={{ display: "flex", gap: 6, flex: 1 }}>
        {FERM_STEPS.map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "7px 9px",
              background: hsTokens.paper,
              border: `1px solid color-mix(in oklch, ${INK} 22%, transparent)`,
              borderTop: `3px solid ${s.color}`,
              borderRadius: 8,
            }}
          >
            <span style={{ fontFamily: hsTokens.body, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: hsTokens.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
            <span style={{ fontFamily: hsTokens.display, fontSize: 17, letterSpacing: "-0.02em", color: INK, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{s.temp}</span>
            <span style={{ fontFamily: hsTokens.mono, fontSize: 9.5, color: hsTokens.muted, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{s.days}d</span>
          </div>
        ))}
      </div>
    </SectionBody>
  );
}

function DatePill({ label, date, right }: { label: string; date: string; right?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", background: hsTokens.paper, border: `1.5px solid ${INK}`, borderRadius: 999, boxShadow: "1.5px 1.5px 0 var(--hs-ink)", flexDirection: right ? "row-reverse" : "row" }}>
      <span style={{ fontFamily: hsTokens.body, fontSize: 7.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: hsTokens.muted }}>{label}</span>
      <span style={{ fontFamily: hsTokens.mono, fontSize: 10, fontWeight: 700, color: INK, fontVariantNumeric: "tabular-nums" }}>{date}</span>
    </span>
  );
}
