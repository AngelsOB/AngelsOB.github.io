"use client";

import Link from "next/link";
import { hsTokens } from "@/modules/hopskip/tokens";
import { HopFlavorRadar } from "./HopFlavorRadar";
import BrewSheetPanelV4 from "./BrewSheetPanelV4";
import { TabSection, SectionHead, WaterSection } from "./TabSections";
import { StyleGuidelines } from "./StyleGuidelines";
import type { V4MockData } from "../lib/mapRecipeToV4Mock";

// A simplified version of the real recipe builder. Clickable tabs switch the
// body to that section (the mock is usable at rest). The tour then drives the
// same tab switch + animates a piece (or the whole section) OUT.
//
// Ownership split that keeps GSAP and React from fighting:
//   - React owns WHICH section is visible (opacity, keyed on activeTab).
//   - GSAP owns the pull-out TRANSFORMS (x/y/scale) — different CSS props.
//
// Named scene elements (GSAP targets):
//   - [data-v4="mock"]        the cream builder card (chrome + body)
//   - [data-v4="section-hops"] the hop bill (recedes/dims behind the radar)
//   - [data-v4="radar"]       the HopVisualizer — pulls out on the Hops beat
//   - [data-v4="brewsheet"]   the brew sheet — the whole section pulls out

export type TabKey =
  | "fermentables"
  | "hops"
  | "mash"
  | "water"
  | "yeast"
  | "fermentation"
  | "brewsheet";

interface TabDef {
  key: TabKey;
  label: string;
  color: string;
  count?: number;
}

// Mirrors the real builder's tab set + order.
const TABS: TabDef[] = [
  { key: "fermentables", label: "Grain", color: hsTokens.malt, count: 4 },
  { key: "hops", label: "Hops", color: hsTokens.hops, count: 3 },
  { key: "mash", label: "Mash", color: hsTokens.roast, count: 1 },
  { key: "water", label: "Water", color: hsTokens.water },
  { key: "yeast", label: "Yeast", color: hsTokens.yeast, count: 1 },
  { key: "fermentation", label: "Fermentation", color: hsTokens.honey, count: 3 },
];
const BREWSHEET_TAB: TabDef = {
  key: "brewsheet",
  label: "Brew sheet",
  color: hsTokens.ink,
};

// base = the value at an empty bill (gravities sit at 1.000, the rest at 0);
// target = the full-recipe value. The grains beat interpolates between them.
const STATS = [
  { label: "OG", base: 1, target: 1.062, accent: hsTokens.malt, fmt: (n: number) => n.toFixed(3) },
  { label: "FG", base: 1, target: 1.012, accent: hsTokens.malt, fmt: (n: number) => n.toFixed(3) },
  { label: "ABV", base: 0, target: 6.6, accent: hsTokens.honey, fmt: (n: number) => `${n.toFixed(1)}%` },
  { label: "IBU", base: 0, target: 52, accent: hsTokens.hops, fmt: (n: number) => `${Math.round(n)}` },
  { label: "CAL", base: 0, target: 198, accent: hsTokens.roast, fmt: (n: number) => `${Math.round(n)}` },
];

const HOPS = [
  { name: "Citra", amount: "0.5oz", use: "boil 60", purpose: "Aroma", ibu: 14 },
  { name: "Mosaic", amount: "1.5oz", use: "boil 60", purpose: "Aroma", ibu: 28 },
  { name: "Citra", amount: "1.0oz", use: "whirlpool", purpose: "Aroma", ibu: 10 },
];

interface Props {
  activeTab: TabKey;
  onSelectTab: (key: TabKey) => void;
  /** 0 = empty bill / all vitals at 0, 1 = full recipe. Drives the grains
   *  "live math" beat (stat count-ups, gauge + grain-bill animation). */
  grainFill?: number;
  /** 0 = blank RO water, 1 = solved. Drives the water "solve" beat (the salts
   *  count up + the ion bars climb into their target bands). */
  waterFill?: number;
  /** Mash-temp sweep for the honest-numbers beat. -1 is ~148F (lower FG, higher
   *  ABV), 0 is the 152F default, +1 is ~156F (higher FG, lower ABV). Moves FG +
   *  ABV in the stat strip and the mash step temperature. */
  fgShift?: number;
  /** Mash-temp lead value for the honest-numbers beat. Drives the mash step
   *  temperature; FG/ABV use fgShift, which lags this. */
  tempShift?: number;
  /** While true (honest-numbers beat in view), only the mash-temp chip grows. */
  honestActive?: boolean;
  /** When set, the mock renders THIS recipe instead of the hardcoded sample
   *  (the signed-in hero). The tour leaves it undefined, so the beats keep
   *  using the sample and are unaffected. */
  data?: V4MockData;
  /** When set, the chrome's right-hand pill becomes an "Open recipe →" Link
   *  to this href (matches the live homepage HeroBuilderCard). When unset
   *  the chrome shows the decorative "Save recipe →" pill (the tour). */
  openHref?: string;
  /** When set, a small close (X) button appears in the chrome beside the
   *  Open / Save pill. Used by the browse-preview panel; left undefined
   *  elsewhere so the homepage versions of the mock don't show it. */
  onClose?: () => void;
}

export function V4Mock({ activeTab, onSelectTab, grainFill = 1, waterFill = 1, fgShift = 0, tempShift = 0, honestActive = false, data, openHref, onClose }: Props) {
  const hopsActive = activeTab === "hops";
  const brewsheetActive = activeTab === "brewsheet";
  const waterActive = activeTab === "water";
  const otherActive = !hopsActive && !brewsheetActive && !waterActive;

  return (
    <div className="v4-scene" style={{ position: "relative", width: "100%" }}>
      {/* ── The builder card ─────────────────────────────────────────── */}
      <div
        data-v4="mock"
        style={{
          position: "relative",
          zIndex: 1,
          background: hsTokens.cream,
          border: `2px solid var(--hs-ink)`,
          borderRadius: 20,
          boxShadow: "6px 6px 0 var(--hs-ink)",
          padding: "18px 20px 20px",
          transformOrigin: "center center",
        }}
      >
        <div className="v4-dim">
          <MockHeader data={data} openHref={openHref} onClose={onClose} />
        </div>
        <div className="v4-dim">
          <MockStats grainFill={grainFill} fgShift={fgShift} data={data} />
        </div>
        <div className="v4-dim">
          <StyleGuidelines grainFill={grainFill} fgShift={fgShift} data={data} />
        </div>
        <div className="v4-dim">
          <MockTabBar active={activeTab} onSelect={onSelectTab} data={data} />
        </div>

        {/* Body — shows the active section. Sections are stacked; React
            toggles opacity so there are no mount/unmounts near the pins. */}
        {/* Content panel — connects to the tab bar (its bottom border is this
            panel's top edge) with side + bottom borders, like the real
            builder's active-section box. */}
        <div
          data-v4="mock-body"
          style={{
            position: "relative",
            // FIXED height (not minHeight): TabSections is designed for a
            // ~544x228 body, and every other section is `position: absolute,
            // inset: 0` — so the body's height drives its rendered height. If
            // we let the body's natural flow take over (only section-hops is
            // in-flow), the body shrinks/grows with the hop count — which
            // makes the Grain/Mash/Yeast/Fermentation/Water sections appear
            // SMALLER for recipes with fewer hops (the signed-in mock bug).
            // Fixed height = consistent rendered area across recipes + tabs.
            // Section internals (the hop bill, grain ledger) handle their own
            // overflow via overflowY:auto + minHeight:0 in the flex chain.
            // CSS var so callers (e.g. browse preview) can give the mock more
            // vertical room without forking the component.
            height: "var(--v4-mock-body-h, 240px)",
            // When the brew sheet is active it provides its own box outline,
            // so drop the body border here to avoid a double outline.
            borderLeft: brewsheetActive ? "none" : `2px solid ${hsTokens.ink}`,
            borderRight: brewsheetActive ? "none" : `2px solid ${hsTokens.ink}`,
            borderBottom: brewsheetActive ? "none" : `2px solid ${hsTokens.ink}`,
            borderRadius: "0 0 12px 12px",
            background: hsTokens.cream,
            overflow: "hidden",
          }}
        >
          {/* Hops section: hop bill shares a row with the flavor visualizer.
              The radar lives in the scene-level explode layer over its slot.
              `position: absolute, inset: 0` to match the other sections —
              the body's height is the source of truth, not the hop count.
              The section is a flex column: header at top, then a flex-1 row
              with the (scrollable) bill on the left and the (fixed) radar
              slot on the right — so recipes with many hops scroll the bill
              without moving the slot (which the scene-level radar overlays). */}
          <div
            data-v4="section-hops"
            style={{
              position: "absolute",
              inset: 0,
              // No bottom padding so the last row card reaches the body's
              // bottom border (overflow:hidden on the body clips the rounded
              // corner cleanly).
              padding: "10px 10px 0",
              opacity: hopsActive ? 1 : 0,
              transition: "opacity 0.25s ease",
              pointerEvents: hopsActive ? "auto" : "none",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="v4-dim">
              <SectionHead
                title="Hops."
                meta={`${data ? data.hops.length : 3} in the bill`}
                underline={hsTokens.hops}
              />
            </div>
            {/* Row: scrollable bill on the left, fixed radar slot on the
                right. NO `alignItems` override — the default `stretch` is
                what makes the bill div fill the row's height so its
                overflowY:auto can scroll. The radar slot has explicit
                112×112 so it stays put. */}
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 8,
                flex: 1,
                minHeight: 0,
              }}
            >
              <div
                className="v4-dim"
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
                  // 10px of bottom padding INSIDE the scroll container, so
                  // when the user scrolls to the end the last row card has
                  // breathing room above the body border (same gap as the
                  // non-scrolling sections).
                  paddingBottom: 10,
                }}
              >
                <HopBillTable data={data} />
              </div>
              <div
                data-v4="radar-slot"
                style={{ width: 112, height: 112, flexShrink: 0 }}
              />
            </div>
          </div>

          {/* Water: a scene-level [data-v4="water"] pop-out group renders the
              card over this slot (like the hops radar). The slot just marks the
              body area for measuring; the body drops its border when water-active
              so the popped card's own border shows. */}
          <div
            data-v4="section-water"
            style={{
              position: "absolute",
              inset: 0,
              opacity: waterActive ? 1 : 0,
              transition: "opacity 0.25s ease",
              pointerEvents: "none",
            }}
          >
            <div data-v4="water-slot" style={{ position: "absolute", inset: 0 }} />
          </div>

          {/* Other sections (fermentables / mash / yeast / fermentation) — real
              at-rest content so the tabs are usable. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: otherActive ? 1 : 0,
              transition: "opacity 0.25s ease",
              pointerEvents: otherActive ? "auto" : "none",
            }}
          >
            <TabSection active={activeTab} grainFill={grainFill} tempShift={tempShift} honestActive={honestActive} data={data} />
          </div>
        </div>
      </div>

      {/* Explode layer — scene-level. Focal content lives here so it can be
          pulled OUT independently while the mock recedes. */}
      <div
        data-v4="explode-layer"
        style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }}
      >
        <div
          data-v4="radar"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            opacity: hopsActive ? 1 : 0,
            transition: "opacity 0.25s ease",
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          <div
            style={{
              background: hsTokens.cream,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 12,
              boxShadow: "3px 3px 0 var(--hs-ink)",
              padding: 8,
            }}
          >
            <HopFlavorRadar size={96} variant="full" />
          </div>
        </div>
      </div>

      {/* Water — scene-level layer over the body slot, TRANSPARENT: the body's
          own border frames it, so at rest it reads as an integrated section (not
          a floating card). On the beat the mock recedes and the INNER pieces
          (controls / salts / ion-viz) spread apart + grow individually — like the
          hops radar, but EACH component pops. It's scene-level (not inside the
          mock) so the pieces aren't clipped by the body + don't recede with it.
          pointer-events auto so the big salt +/- stay clickable (the "flex"). */}
      <div
        data-v4="water"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 6,
          opacity: waterActive ? 1 : 0,
          transition: "opacity 0.25s ease",
          transformOrigin: "0 0",
          willChange: "transform",
          pointerEvents: waterActive ? "auto" : "none",
        }}
      >
        <div style={{ height: 196 }}>
          <WaterSection waterFill={waterFill} data={data?.water} />
        </div>
      </div>

      {/* Brew sheet — the whole section. Visible when its tab is active;
          grows out of its body slot on the brewsheet beat (GSAP transforms). */}
      <div
        data-v4="brewsheet"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 6,
          opacity: brewsheetActive ? 1 : 0,
          transition: "opacity 0.25s ease",
          transformOrigin: "0 0",
          willChange: "transform, opacity",
          // Display-only (scroll/GSAP-driven). Never intercept clicks — the
          // invisible box + nub otherwise overlay the tab bar + body and block
          // the tabs / interactive salts underneath.
          pointerEvents: "none",
        }}
      >
        {/* The "Brew sheet" tab nub — sticks out above the box and lifts with
            it (fades in during the beat), like grabbing the tab and pulling the
            whole section out. */}
        <div
          data-v4="bs-nub"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: -2,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 11px",
            background: hsTokens.cream,
            border: `2px solid var(--hs-ink)`,
            borderBottom: "none",
            borderRadius: "10px 10px 0 0",
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 700,
            color: hsTokens.ink,
            whiteSpace: "nowrap",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              background: hsTokens.ink,
              borderRadius: 2,
            }}
          />
          Brew sheet
        </div>

        {/* The bordered box — its HEIGHT grows to reveal content (a real box
            getting bigger, not an unmask). */}
        <div
          data-v4="bs-box"
          style={{
            overflow: "hidden",
            background: hsTokens.cream,
            border: `2px solid var(--hs-ink)`,
            borderRadius: "0 0 12px 12px",
            willChange: "height",
          }}
        >
          {/* Scaled-down so MORE fits in the collapsed box (and the exploded
              box fits the viewport at full width). */}
          <div
            data-v4="bs-inner"
            style={{
              width: "122%",
              transform: "scale(0.82)",
              transformOrigin: "0 0",
            }}
          >
            <BrewSheetPanelV4 framed={false} data={data?.brewSheet} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── mock chrome ─────────────────────────────────────────────────────────

function MockHeader({
  data,
  openHref,
  onClose,
}: {
  data?: V4MockData;
  openHref?: string;
  onClose?: () => void;
}) {
  const name = data?.name ?? "Citra Mosaic IPA";
  const style = data?.style ?? "American IPA · 21A";
  const batch = data?.batch ?? "5 gal · 60 min";
  const profile = data?.profile ?? "BIAB";
  // Pill style is shared — link variant adds hover via Next Link styling.
  const pillStyle: React.CSSProperties = {
    background: hsTokens.hops,
    color: hsTokens.cream,
    border: `2px solid ${hsTokens.ink}`,
    borderRadius: 999,
    padding: "8px 16px",
    fontFamily: hsTokens.body,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    boxShadow: "2px 2px 0 var(--hs-ink)",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  };
  // Back-link: a real Link to /recipes when openHref is set (signed-in mock),
  // decorative span otherwise (the tour — no real navigation context).
  const backStyle: React.CSSProperties = {
    fontFamily: hsTokens.body,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: hsTokens.muted,
    textDecoration: "none",
  };
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 10,
          borderBottom: `1.5px dashed color-mix(in oklch, ${hsTokens.ink} 20%, transparent)`,
        }}
      >
        {openHref ? (
          <Link href="/recipes" style={backStyle}>
            ← Back to recipes
          </Link>
        ) : (
          <span style={backStyle}>← Back to recipes</span>
        )}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {openHref ? (
            <Link href={openHref} style={pillStyle}>
              Open recipe →
            </Link>
          ) : (
            <span style={pillStyle}>Save recipe →</span>
          )}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: `2px solid ${hsTokens.ink}`,
                background: hsTokens.paper,
                color: hsTokens.ink,
                boxShadow: "2px 2px 0 var(--hs-ink)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                flexShrink: 0,
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <h2
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(26px, 3vw, 34px)",
          letterSpacing: "-0.035em",
          color: hsTokens.ink,
          margin: "14px 0 10px",
          lineHeight: 0.95,
        }}
      >
        {name}
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <PaperPill label="STYLE" value={`${style} ▾`} />
        <PaperPill label="BATCH" value={`${batch} ▾`} />
        <GhostPill>Profile · {profile} ▾</GhostPill>
        <GhostPill subdued>Advanced</GhostPill>
      </div>
    </div>
  );
}

function PaperPill({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 12px 5px 10px",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        whiteSpace: "nowrap",
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
      <span style={{ fontSize: 12, fontWeight: 600, color: hsTokens.ink }}>{value}</span>
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
        padding: subdued ? "4px 11px" : "5px 13px",
        background: "transparent",
        border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 35%, transparent)`,
        borderRadius: 999,
        fontFamily: hsTokens.body,
        fontSize: subdued ? 9 : 12,
        fontWeight: subdued ? 800 : 600,
        color: subdued ? hsTokens.muted : hsTokens.ink,
        letterSpacing: subdued ? "0.14em" : "0.01em",
        textTransform: subdued ? "uppercase" : "none",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function MockStats({ grainFill = 1, fgShift = 0, data }: { grainFill?: number; fgShift?: number; data?: V4MockData }) {
  // SRM isn't a stat cell here — the color lives in the Style Guidelines bar.
  // FG (and therefore ABV) respond to the honest-numbers beat's mash-temp sweep:
  // higher mash temp means less fermentable wort, so FG rises and ABV falls.
  // In data mode (signed-in hero) grainFill is 1 and fgShift 0, so the displayed
  // values equal the recipe's stats.
  const ogT = data ? data.stats.og : 1.062;
  const fgT = data ? data.stats.fg : 1.012;
  const og = 1 + (ogT - 1) * grainFill;
  const fg = 1 + (fgT - 1) * grainFill + 0.003 * fgShift * grainFill;
  const abv = (og - fg) * 131.25;
  const valueFor = (label: string, base: number, target: number) => {
    if (label === "FG") return fg;
    if (label === "ABV") return abv;
    if (label === "OG") return og;
    const t = data
      ? label === "IBU"
        ? data.stats.ibu
        : label === "CAL"
          ? data.stats.cal
          : target
      : target;
    return base + (t - base) * grainFill;
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 6,
        marginTop: 12,
      }}
    >
      {STATS.map((s) => (
        <div
          key={s.label}
          style={{
            position: "relative",
            background: hsTokens.paper,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 8,
            boxShadow: "2px 2px 0 var(--hs-ink)",
            padding: "8px 6px 7px",
            textAlign: "center",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span
            aria-hidden
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.accent }}
          />
          <div
            style={{
              fontFamily: hsTokens.body,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 18,
              letterSpacing: "-0.035em",
              color: hsTokens.ink,
              marginTop: 1,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {s.fmt(valueFor(s.label, s.base, s.target))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MockTabBar({
  active,
  onSelect,
  data,
}: {
  active: TabKey;
  onSelect: (key: TabKey) => void;
  data?: V4MockData;
}) {
  const countFor = (key: TabKey, fallback?: number): number | undefined => {
    if (!data) return fallback;
    switch (key) {
      case "fermentables":
        return data.grains.length;
      case "hops":
        return data.hops.length;
      case "mash":
        return data.mash ? 1 : 0;
      case "yeast":
        return data.yeast ? 1 : 0;
      case "fermentation":
        return data.fermentation.length;
      default:
        return fallback;
    }
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        marginTop: 16,
        borderBottom: `2px solid ${hsTokens.ink}`,
        paddingLeft: 2,
      }}
    >
      {TABS.map((tab) => (
        <TabButton
          key={tab.key}
          tab={{ ...tab, count: countFor(tab.key, tab.count) }}
          isActive={tab.key === active}
          onSelect={onSelect}
        />
      ))}
      {/* Brew sheet — rightmost, same tab shape as the rest (consistent). */}
      <TabButton
        tab={BREWSHEET_TAB}
        isActive={active === "brewsheet"}
        onSelect={onSelect}
        style={{ marginLeft: "auto" }}
      />
    </div>
  );
}

function TabButton({
  tab,
  isActive,
  onSelect,
  style,
}: {
  tab: TabDef;
  isActive: boolean;
  onSelect: (key: TabKey) => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      data-v4-tab={tab.key}
      onClick={() => onSelect(tab.key)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "5px 5px",
        fontFamily: hsTokens.body,
        fontSize: 10.5,
        fontWeight: isActive ? 700 : 600,
        color: isActive ? hsTokens.ink : hsTokens.muted,
        background: isActive ? hsTokens.paper : "transparent",
        border: isActive
          ? `2px solid ${hsTokens.ink}`
          : "2px solid transparent",
        borderBottom: isActive ? "2px solid transparent" : undefined,
        borderRadius: "9px 9px 0 0",
        marginBottom: -2,
        whiteSpace: "nowrap",
        cursor: "pointer",
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          background: tab.color,
          border: `1px solid ${hsTokens.ink}`,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      {tab.label}
      {typeof tab.count === "number" ? (
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 8,
            fontWeight: 700,
            color: isActive ? hsTokens.ink : hsTokens.muted,
            opacity: 0.7,
          }}
        >
          {tab.count}
        </span>
      ) : null}
    </button>
  );
}

function HopBillTable({ data }: { data?: V4MockData }) {
  const rows = data
    ? data.hops.map((h) => ({
        name: h.name,
        amount: h.amount,
        use: h.use,
        purpose: h.purpose,
        ibu: h.ibu,
        aa: h.aa,
      }))
    : HOPS.map((h) => ({ ...h, aa: "13.2% AA" }));
  return (
    <div
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "44px 1fr 1fr 60px 60px",
          gap: 8,
          padding: "8px 12px",
          background: `color-mix(in oklch, ${hsTokens.hops} 7%, ${hsTokens.cream})`,
          borderBottom: `2px solid ${hsTokens.ink}`,
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        <div>Flavor</div>
        <div>Hop</div>
        <div>Use</div>
        <div style={{ textAlign: "right" }}>Weight</div>
        <div style={{ textAlign: "right" }}>IBU</div>
      </div>
      {rows.map((hop, i) => (
        <div
          key={`${hop.name}-${i}`}
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 1fr 60px 60px",
            gap: 8,
            padding: "10px 12px",
            alignItems: "center",
            borderTop:
              i > 0
                ? `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`
                : "none",
            background:
              i % 2 === 1
                ? `color-mix(in oklch, ${hsTokens.ink} 2%, transparent)`
                : "transparent",
          }}
        >
          <HopFlavorRadar size={36} variant="mini" hopName={hop.name} />
          <div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontSize: 12,
                fontWeight: 700,
                color: hsTokens.ink,
              }}
            >
              {hop.name}
            </div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontSize: 9,
                color: hsTokens.muted,
                marginTop: 1,
              }}
            >
              {hop.purpose} · {hop.aa}
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                width: 7,
                height: 7,
                background: hsTokens.hops,
                borderRadius: 999,
              }}
            />
            <span
              style={{
                fontFamily: hsTokens.body,
                fontSize: 11,
                color: hsTokens.ink,
              }}
            >
              {hop.use}
            </span>
          </div>
          <div
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.ink,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hop.amount}
          </div>
          <div
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {hop.ibu}
          </div>
        </div>
      ))}
    </div>
  );
}
