"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { HopFlavorRadar } from "./HopFlavorRadar";
import BrewSheetPanelV4 from "./BrewSheetPanelV4";
import { TabSection, SectionHead } from "./TabSections";
import { StyleGuidelines } from "./StyleGuidelines";

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
}

export function V4Mock({ activeTab, onSelectTab, grainFill = 1 }: Props) {
  const hopsActive = activeTab === "hops";
  const brewsheetActive = activeTab === "brewsheet";
  const otherActive = !hopsActive && !brewsheetActive;

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
          <MockHeader />
        </div>
        <div className="v4-dim">
          <MockStats grainFill={grainFill} />
        </div>
        <div className="v4-dim">
          <StyleGuidelines grainFill={grainFill} />
        </div>
        <div className="v4-dim">
          <MockTabBar active={activeTab} onSelect={onSelectTab} />
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
            minHeight: 176,
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
              The radar lives in the scene-level explode layer over its slot. */}
          <div
            data-v4="section-hops"
            style={{
              padding: 10,
              opacity: hopsActive ? 1 : 0,
              transition: "opacity 0.25s ease",
              pointerEvents: hopsActive ? "auto" : "none",
            }}
          >
            <div className="v4-dim">
              <SectionHead title="Hops." meta="3 in the bill · aroma" underline={hsTokens.hops} />
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginTop: 8 }}>
              <div className="v4-dim" style={{ flex: 1, minWidth: 0 }}>
                <HopBillTable />
              </div>
              <div
                data-v4="radar-slot"
                style={{ width: 112, height: 112, flexShrink: 0 }}
              />
            </div>
          </div>

          {/* Other sections (fermentables / mash / water / yeast / fermentation)
              — real at-rest content so the tabs are usable. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: otherActive ? 1 : 0,
              transition: "opacity 0.25s ease",
              pointerEvents: otherActive ? "auto" : "none",
            }}
          >
            <TabSection active={activeTab} grainFill={grainFill} />
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
            <BrewSheetPanelV4 framed={false} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── mock chrome ─────────────────────────────────────────────────────────

function MockHeader() {
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
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          ← Back to recipes
        </span>
        <span
          style={{
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
          }}
        >
          Save recipe →
        </span>
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
        Citra Mosaic IPA
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <PaperPill label="STYLE" value="American IPA · 21A ▾" />
        <PaperPill label="BATCH" value="5 gal · 60 min ▾" />
        <GhostPill>Profile · BIAB ▾</GhostPill>
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

function MockStats({ grainFill = 1 }: { grainFill?: number }) {
  const srm = 6.2 * grainFill;
  const srmColor = srmToRgb(Math.max(0.1, srm));
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto",
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
            {s.fmt(s.base + (s.target - s.base) * grainFill)}
          </div>
        </div>
      ))}
      <div
        style={{
          position: "relative",
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 8,
          boxShadow: "2px 2px 0 var(--hs-ink)",
          padding: "6px 10px 7px",
          minWidth: 0,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: srmColor }}
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
          SRM
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <BeerGlass color={srmColor} />
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 16,
              letterSpacing: "-0.035em",
              color: hsTokens.ink,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {srm.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function BeerGlass({ color }: { color: string }) {
  return (
    <svg width={16} height={20} viewBox="0 0 22 26" aria-hidden>
      <defs>
        <clipPath id="v4-glass-clip">
          <path d="M 3 2 L 19 2 L 17 24 L 5 24 Z" />
        </clipPath>
      </defs>
      <path
        d="M 3 2 L 19 2 L 17 24 L 5 24 Z"
        fill={hsTokens.paper}
        stroke={hsTokens.ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect x={3} y={6} width={16} height={18} fill={color} clipPath="url(#v4-glass-clip)" />
      <ellipse
        cx={11}
        cy={5}
        rx={7}
        ry={2}
        fill="#fff8e2"
        stroke={hsTokens.ink}
        strokeWidth={1}
        clipPath="url(#v4-glass-clip)"
      />
    </svg>
  );
}

function MockTabBar({
  active,
  onSelect,
}: {
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        marginTop: 16,
        borderBottom: `2px solid ${hsTokens.ink}`,
        paddingLeft: 2,
      }}
    >
      {TABS.map((tab) => (
        <TabButton
          key={tab.key}
          tab={tab}
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
        padding: "5px 7px",
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

function HopBillTable() {
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
      {HOPS.map((hop, i) => (
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
              {hop.purpose} · 13.2% AA
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
