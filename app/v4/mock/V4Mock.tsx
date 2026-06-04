"use client";

import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { HopFlavorRadar } from "./HopFlavorRadar";
import BrewSheetPanelV4 from "./BrewSheetPanelV4";

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
  { key: "fermentables", label: "Fermentables", color: hsTokens.malt, count: 4 },
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

const STATS = [
  { label: "OG", value: "1.062" },
  { label: "FG", value: "1.012" },
  { label: "ABV", value: "6.6%" },
  { label: "IBU", value: "52" },
  { label: "CAL", value: "198" },
];

const HOPS = [
  { name: "Citra", amount: "0.5oz", use: "boil 60", purpose: "Aroma", ibu: 14 },
  { name: "Mosaic", amount: "1.5oz", use: "boil 60", purpose: "Aroma", ibu: 28 },
  { name: "Citra", amount: "1.0oz", use: "whirlpool", purpose: "Aroma", ibu: 10 },
];

interface Props {
  activeTab: TabKey;
  onSelectTab: (key: TabKey) => void;
}

export function V4Mock({ activeTab, onSelectTab }: Props) {
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
          <MockStats />
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
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
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
              — simplified placeholder so the tabs are usable at rest. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: otherActive ? 1 : 0,
              transition: "opacity 0.25s ease",
              pointerEvents: otherActive ? "auto" : "none",
            }}
          >
            <SectionPlaceholder active={activeTab} />
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
          fontSize: "clamp(28px, 3.4vw, 40px)",
          letterSpacing: "-0.03em",
          color: hsTokens.ink,
          margin: "14px 0 10px",
          lineHeight: 0.95,
        }}
      >
        Citra Mosaic IPA
      </h2>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <PaperPill label="STYLE" value="American IPA · 21A ▾" color={hsTokens.malt} />
        <PaperPill label="BATCH" value="5 gal · 60 min ▾" color={hsTokens.water} />
        <PaperPill label="" value="Profile · BIAB ▾" color={hsTokens.roast} />
      </div>
    </div>
  );
}

function PaperPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px 8px 10px",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
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
          width: 8,
          height: 8,
          background: color,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 2,
          flexShrink: 0,
        }}
      />
      {label ? (
        <span
          style={{
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontSize: 9,
          }}
        >
          {label}
        </span>
      ) : null}
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 13,
          color: hsTokens.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </span>
  );
}

function MockStats() {
  const srm = 6.2;
  const srmColor = srmToRgb(srm);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto",
        gap: 8,
        marginTop: 14,
      }}
    >
      {STATS.map((s) => (
        <div
          key={s.label}
          style={{
            background: hsTokens.paper,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 8,
            boxShadow: "2px 2px 0 var(--hs-ink)",
            padding: "10px 12px 12px",
            minWidth: 0,
          }}
        >
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
              fontSize: 24,
              letterSpacing: "-0.03em",
              color: hsTokens.ink,
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
      <div
        style={{
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 8,
          boxShadow: "2px 2px 0 var(--hs-ink)",
          padding: "10px 14px 12px",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <span
            aria-hidden
            style={{
              width: 16,
              height: 16,
              background: srmColor,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 3,
            }}
          />
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 24,
              letterSpacing: "-0.03em",
              color: hsTokens.ink,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {srm}
          </span>
        </div>
      </div>
    </div>
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

// Minimal stand-in for the not-yet-built sections, so the tabs are usable.
function SectionPlaceholder({ active }: { active: TabKey }) {
  const label =
    TABS.find((t) => t.key === active)?.label ??
    BREWSHEET_TAB.label;
  return (
    <div
      style={{
        height: "100%",
        minHeight: 150,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: `color-mix(in oklch, ${hsTokens.ink} 3%, transparent)`,
        border: `2px dashed color-mix(in oklch, ${hsTokens.ink} 22%, transparent)`,
        borderRadius: 12,
      }}
    >
      <div
        style={{
          fontFamily: hsTokens.display,
          fontSize: 22,
          letterSpacing: "-0.02em",
          color: hsTokens.ink,
        }}
      >
        {label}.
      </div>
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 11,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        section
      </div>
    </div>
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
