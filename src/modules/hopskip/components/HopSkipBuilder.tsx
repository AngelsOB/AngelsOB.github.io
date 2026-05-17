"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../tokens";
import HSEyebrow from "./HSEyebrow";
import HSScriptNote from "./HSScriptNote";

import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { useRecipeCalculations } from "@/modules/beta-builder/presentation/hooks/useRecipeCalculations";
import FermentableSection from "@/modules/beta-builder/presentation/components/FermentableSection";
import HopSection from "@/modules/beta-builder/presentation/components/HopSection";
import MashScheduleSection from "@/modules/beta-builder/presentation/components/MashScheduleSection";
import WaterSection from "@/modules/beta-builder/presentation/components/WaterSection";
import YeastSection from "@/modules/beta-builder/presentation/components/YeastSection";
import FermentationSection from "@/modules/beta-builder/presentation/components/FermentationSection";
import BrewDayChecklistSection from "@/modules/beta-builder/presentation/components/BrewDayChecklistSection";
import { EquipmentSection } from "@/modules/beta-builder/presentation/components/EquipmentSection";
import StyleSelectorModal from "@/modules/beta-builder/presentation/components/StyleSelectorModal";
import StyleRangeComparison from "@/modules/beta-builder/presentation/components/StyleRangeComparison";
import { getBjcpStyleSpec } from "@/utils/bjcpSpecs";

const display: CSSProperties = {
  fontFamily: hsTokens.display,
  letterSpacing: "-0.035em",
  lineHeight: 0.92,
};

const BAND_PADDING_X = "clamp(20px, 4vw, 48px)";

type TabKey =
  | "fermentables"
  | "hops"
  | "mash"
  | "water"
  | "yeast"
  | "fermentation"
  | "brewsheet";

interface TabDef {
  k: TabKey;
  label: string;
  c: string;
  countFrom?: (totals: TabCounts) => number | null;
}

interface TabCounts {
  fermentables: number;
  hops: number;
  mash: number;
  yeasts: number;
  fermentation: number;
}

const TABS: TabDef[] = [
  { k: "fermentables", label: "Fermentables", c: hsTokens.malt, countFrom: (t) => t.fermentables },
  { k: "hops", label: "Hops", c: hsTokens.hops, countFrom: (t) => t.hops },
  { k: "mash", label: "Mash", c: hsTokens.roast, countFrom: (t) => t.mash },
  { k: "water", label: "Water", c: hsTokens.water },
  { k: "yeast", label: "Yeast", c: hsTokens.yeast, countFrom: (t) => t.yeasts },
  { k: "fermentation", label: "Fermentation", c: hsTokens.honey, countFrom: (t) => t.fermentation },
  { k: "brewsheet", label: "Brew sheet", c: hsTokens.ink },
];

interface Props {
  recipeId?: string;
}

export default function HopSkipBuilder({ recipeId }: Props) {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const loadRecipe = useRecipeStore((s) => s.loadRecipe);
  const createNewRecipe = useRecipeStore((s) => s.createNewRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const saveCurrentRecipe = useRecipeStore((s) => s.saveCurrentRecipe);

  const [activeTab, setActiveTab] = useState<TabKey>("fermentables");
  const [tabDirection, setTabDirection] = useState<"left" | "right">("right");
  const [savedRecently, setSavedRecently] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [isEquipmentOpen, setIsEquipmentOpen] = useState(false);
  const [showStyleRanges, setShowStyleRanges] = useState(true);

  const switchTab = useCallback(
    (next: TabKey) => {
      if (next === activeTab) return;
      const prevIdx = TABS.findIndex((t) => t.k === activeTab);
      const nextIdx = TABS.findIndex((t) => t.k === next);
      setTabDirection(nextIdx > prevIdx ? "right" : "left");
      setActiveTab(next);
    },
    [activeTab]
  );

  const calc = useRecipeCalculations(currentRecipe);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (recipeId) loadRecipe(recipeId);
    else createNewRecipe();
  }, [recipeId, loadRecipe, createNewRecipe]);

  const handleSave = useCallback(() => {
    saveCurrentRecipe();
    setSavedRecently(true);
    const t = setTimeout(() => setSavedRecently(false), 2000);
    return () => clearTimeout(t);
  }, [saveCurrentRecipe]);

  if (!currentRecipe) {
    return (
      <section
        style={{
          padding: `80px ${BAND_PADDING_X}`,
          textAlign: "center",
          color: hsTokens.muted,
        }}
      >
        Loading recipe…
      </section>
    );
  }

  const totals: TabCounts = {
    fermentables: currentRecipe.fermentables.length,
    hops: currentRecipe.hops.length,
    mash: currentRecipe.mashSteps.length,
    yeasts: currentRecipe.yeasts.length,
    fermentation: currentRecipe.fermentationSteps.length,
  };

  const bjcpSpec = getBjcpStyleSpec(currentRecipe.style?.split(".")[0]?.trim());
  const rangeStr = (r?: [number, number], precision = 3, suffix = "") =>
    r ? `${r[0].toFixed(precision)}${suffix}–${r[1].toFixed(precision)}${suffix}` : "—";

  return (
    <>
      {/* ── Sub-header band ── */}
      <div
        style={{
          padding: `10px ${BAND_PADDING_X}`,
          background: hsTokens.cream2,
          borderBottom: `2px solid ${hsTokens.ink}`,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/recipes"
          style={{
            background: "transparent",
            color: hsTokens.muted,
            border: "none",
            padding: "6px 0",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
            fontFamily: hsTokens.body,
          }}
        >
          ← Back to recipes
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 12,
              color: savedRecently ? hsTokens.hops : hsTokens.muted,
              transition: "color 0.2s",
              fontFamily: hsTokens.body,
            }}
          >
            {savedRecently ? "✓ Saved!" : "Edits not saved"}
          </span>
          <Link
            href={recipeId ? `/betabuilder/recipes/${recipeId}` : "/betabuilder/recipes/new"}
            style={{
              background: hsTokens.paper,
              color: hsTokens.ink,
              border: `2px solid ${hsTokens.ink}`,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 999,
              boxShadow: hsTokens.sh1,
              fontFamily: hsTokens.body,
              textDecoration: "none",
            }}
          >
            Open in classic ↗
          </Link>
          <button
            type="button"
            onClick={handleSave}
            style={{
              background: hsTokens.hops,
              color: hsTokens.cream,
              border: `2px solid ${hsTokens.ink}`,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 999,
              boxShadow: hsTokens.sh2,
              cursor: "pointer",
              fontFamily: hsTokens.body,
            }}
          >
            Save recipe →
          </button>
        </div>
      </div>

      {/* ── Title band ── */}
      <section
        style={{
          padding: `28px ${BAND_PADDING_X} 20px`,
          borderBottom: `2px solid ${hsTokens.ink}`,
        }}
      >
        <HSScriptNote color={hsTokens.yeast} size={28}>
          recipe draft —
        </HSScriptNote>
        <div style={{ marginTop: 6 }}>
          <input
            type="text"
            value={currentRecipe.name ?? ""}
            onChange={(e) => updateRecipe({ name: e.target.value })}
            aria-label="Recipe name"
            placeholder="Untitled recipe"
            style={{
              ...display,
              fontSize: 72,
              border: "none",
              background: "transparent",
              fontFamily: hsTokens.display,
              color: hsTokens.ink,
              outline: "none",
              padding: 0,
              width: "100%",
              minWidth: 0,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 18,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <ClickableMetaPill
            label="STYLE"
            value={currentRecipe.style ?? "Add style…"}
            color={hsTokens.malt}
            onClick={() => setIsStyleModalOpen(true)}
          />
          <NumericMetaPill
            label="BATCH"
            value={currentRecipe.batchVolumeL}
            unit="L"
            color={hsTokens.water}
            step={0.5}
            min={1}
            max={500}
            onChange={(v) => updateRecipe({ batchVolumeL: v })}
          />
          <NumericMetaPill
            label="BOIL"
            value={currentRecipe.equipment?.boilTimeMin ?? 60}
            unit="min"
            color={hsTokens.roast}
            step={5}
            min={15}
            max={180}
            onChange={(v) =>
              updateRecipe({
                equipment: { ...currentRecipe.equipment, boilTimeMin: v },
              })
            }
          />
          <NumericMetaPill
            label="EFF"
            value={currentRecipe.equipment?.mashEfficiencyPercent ?? 75}
            unit="%"
            color={hsTokens.hops}
            step={1}
            min={30}
            max={100}
            onChange={(v) =>
              updateRecipe({
                equipment: { ...currentRecipe.equipment, mashEfficiencyPercent: v },
              })
            }
          />
          <button
            type="button"
            onClick={() => setIsEquipmentOpen((v) => !v)}
            aria-expanded={isEquipmentOpen}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: isEquipmentOpen ? hsTokens.ink : "transparent",
              color: isEquipmentOpen ? hsTokens.cream : hsTokens.muted,
              border: `1.5px solid ${
                isEquipmentOpen
                  ? hsTokens.ink
                  : `color-mix(in oklch, ${hsTokens.ink} 25%, transparent)`
              }`,
              borderRadius: 999,
              padding: "6px 14px 6px 12px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: hsTokens.body,
              cursor: "pointer",
            }}
          >
            <span>Advanced</span>
            <span style={{ marginLeft: 2 }}>{isEquipmentOpen ? "▲" : "▼"}</span>
          </button>
          {currentRecipe.style ? (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "transparent",
                color: hsTokens.muted,
                border: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 25%, transparent)`,
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                fontFamily: hsTokens.body,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={showStyleRanges}
                onChange={(e) => setShowStyleRanges(e.target.checked)}
                style={{
                  width: 13,
                  height: 13,
                  accentColor: hsTokens.ink,
                  margin: 0,
                  cursor: "pointer",
                }}
              />
              <span>Style ranges</span>
            </label>
          ) : null}
        </div>
      </section>

      {/* ── Advanced expander band ── */}
      <div
        className={`hs-collapse${isEquipmentOpen ? " is-open" : ""}`}
        aria-hidden={!isEquipmentOpen}
      >
        <div className="hs-collapse-inner">
          <section
            ref={(node) => {
              if (!node) return;
              node.querySelectorAll<HTMLDetailsElement>("details.equip-advanced").forEach((d) => {
                if (!d.open) d.open = true;
              });
            }}
            className="brew-theme hs-loose-section"
            style={{
              padding: `20px ${BAND_PADDING_X} 24px`,
              borderBottom: `2px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            <EquipmentSection />
          </section>
        </div>
      </div>

      {/* ── BJCP band ── */}
      {calc && currentRecipe.style ? (
        <div
          className={`hs-collapse${showStyleRanges ? " is-open" : ""}`}
          aria-hidden={!showStyleRanges}
        >
          <div className="hs-collapse-inner">
            <section
              className="brew-theme hs-bjcp"
              style={{
                padding: `18px ${BAND_PADDING_X}`,
                borderBottom: `2px solid ${hsTokens.ink}`,
                background: hsTokens.paper,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 10,
                }}
              >
                <HSEyebrow>BJCP style ranges</HSEyebrow>
                <span style={{ fontSize: 11, color: hsTokens.muted, fontFamily: hsTokens.body }}>
                  · {currentRecipe.style}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 1,
                    background: hsTokens.ink,
                    opacity: 0.18,
                  }}
                />
                <HSScriptNote color={hsTokens.yeast} size={16} rotate={-3}>
                  where you sit
                </HSScriptNote>
              </div>
              <div className="hs-bjcp-grid">
                <StyleRangeComparison
                  styleCode={currentRecipe.style}
                  abv={calc.abv}
                  og={calc.og}
                  fg={calc.fg}
                  ibu={calc.ibu}
                  srm={calc.srm}
                />
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {/* ── Live numbers band ── */}
      {calc ? (
        <section
          style={{
            padding: `20px ${BAND_PADDING_X}`,
            borderBottom: `2px solid ${hsTokens.ink}`,
            background: hsTokens.cream2,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <HSEyebrow>Live numbers</HSEyebrow>
            <HSScriptNote color={hsTokens.yeast} size={18} rotate={-2}>
              updates as you type ✦
            </HSScriptNote>
          </div>
          <div
            className="hs-livestats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 12,
            }}
          >
            <StatCard k="OG" v={calc.og.toFixed(3)} c={hsTokens.malt} range={rangeStr(bjcpSpec?.og, 3)} />
            <StatCard k="FG" v={calc.fg.toFixed(3)} c={hsTokens.malt} range={rangeStr(bjcpSpec?.fg, 3)} />
            <StatCard k="ABV" v={calc.abv.toFixed(1)} u="%" c={hsTokens.roast} range={rangeStr(bjcpSpec?.abv, 1, "%")} />
            <StatCard k="IBU" v={Math.round(calc.ibu).toString()} c={hsTokens.hops} range={rangeStr(bjcpSpec?.ibu, 0)} />
            <StatCard k="SRM" v={calc.srm.toFixed(1)} c={hsTokens.honey} range={rangeStr(bjcpSpec?.srm, 0)} />
            <StatCard k="pH" v={calc.estimatedMashPh?.toFixed(2) ?? "—"} c={hsTokens.water} range="5.2–5.6" />
            <StatCard k="Cal" v={Math.round(calc.calories ?? 0).toString()} u="/12oz" c={hsTokens.muted} range="—" />
          </div>
          <style>{`
            @media (max-width: 900px) {
              .hs-livestats { grid-template-columns: repeat(4, 1fr) !important; }
            }
            @media (max-width: 640px) {
              .hs-livestats { grid-template-columns: repeat(3, 1fr) !important; }
            }
          `}</style>
        </section>
      ) : null}

      {/* ── Tabs + section body band ── */}
      <section
        style={{
          padding: `0 ${BAND_PADDING_X} 32px`,
          background: hsTokens.cream2,
          borderBottom: `2px solid ${hsTokens.ink}`,
        }}
      >
        <div
          role="tablist"
          aria-label="Recipe sections"
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            overflowX: "auto",
            position: "relative",
            zIndex: 5,
            paddingTop: 18,
            marginBottom: -2,
          }}
          className="hs-no-scrollbar"
        >
          {(() => {
            const mainTabs = TABS.filter((t) => t.k !== "brewsheet");
            const rightTabs = TABS.filter((t) => t.k === "brewsheet");
            const renderTab = (t: TabDef, i: number, arr: TabDef[]) => {
              const isActive = t.k === activeTab;
              const count = t.countFrom ? t.countFrom(totals) : null;
              const isFirst = i === 0;
              const isLast = i === arr.length - 1;
              return (
                <button
                  key={t.k}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => switchTab(t.k)}
                  style={{
                    padding: "12px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    border: `2px solid ${hsTokens.ink}`,
                    borderLeft: isFirst ? `2px solid ${hsTokens.ink}` : `1px solid ${hsTokens.ink}`,
                    borderRight: isLast ? `2px solid ${hsTokens.ink}` : `1px solid ${hsTokens.ink}`,
                    borderBottom: isActive
                      ? `2px solid ${hsTokens.paper}`
                      : `2px solid ${hsTokens.ink}`,
                    borderTopLeftRadius: 10,
                    borderTopRightRadius: 10,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                    background: isActive ? hsTokens.paper : hsTokens.cream,
                    color: isActive ? hsTokens.ink : hsTokens.muted,
                    fontFamily: hsTokens.body,
                    whiteSpace: "nowrap",
                    flex: "0 0 auto",
                    cursor: "pointer",
                    position: "relative",
                    /* overflow: hidden so the active tab's absolute accent
                       strip is clipped at the inner border curve and never
                       bleeds into the 2px ink frame at the rounded top
                       corners. */
                    overflow: "hidden",
                    zIndex: isActive ? 2 : 1,
                    marginRight: isLast ? 0 : -1,
                    /* Inactive tabs scale down slightly; transform-origin at
                       bottom keeps the tab anchored to its connection point
                       with the section (so the 2px ink bottom border still
                       aligns with the row's bottom line). Active tab stays
                       full-size so it visually pops. */
                    transform: isActive ? "none" : "scaleY(0.92)",
                    transformOrigin: "center bottom",
                    transition: "transform 120ms ease, background 120ms ease",
                  }}
                >
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: t.c,
                        borderTopLeftRadius: 8,
                        borderTopRightRadius: 8,
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}
                  <span
                    aria-hidden
                    style={{
                      width: 10,
                      height: 10,
                      background: t.c,
                      borderRadius: 3,
                      border: `1.5px solid ${hsTokens.ink}`,
                      opacity: isActive ? 1 : 0.6,
                    }}
                  />
                  <span style={{ ...display, fontSize: 14 }}>{t.label}</span>
                  {count !== null && count !== undefined ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: hsTokens.muted,
                        fontVariantNumeric: "tabular-nums",
                        padding: "2px 7px",
                        background: isActive ? hsTokens.cream2 : hsTokens.paper,
                        border: `1px solid ${hsTokens.ink}22`,
                        borderRadius: 999,
                      }}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            };
            return (
              <>
                {mainTabs.map((t, i) => renderTab(t, i, mainTabs))}
                <div
                  aria-hidden="true"
                  style={{
                    flex: 1,
                    minWidth: 24,
                    borderBottom: `2px solid ${hsTokens.ink}`,
                    alignSelf: "stretch",
                  }}
                />
                {rightTabs.map((t, i) => renderTab(t, i, rightTabs))}
              </>
            );
          })()}
        </div>

        <div
          key={activeTab}
          className={`hs-section-frame brew-theme hs-tab-slide hs-tab-slide-${tabDirection}`}
          style={{ position: "relative" }}
        >
          {activeTab === "fermentables" ? <FermentableSection /> : null}
          {activeTab === "hops" ? <HopSection /> : null}
          {activeTab === "mash" ? <MashScheduleSection /> : null}
          {activeTab === "water" && calc ? <WaterSection recipe={currentRecipe} calculations={calc} /> : null}
          {activeTab === "yeast" ? <YeastSection /> : null}
          {activeTab === "fermentation" ? <FermentationSection /> : null}
          {activeTab === "brewsheet" && calc ? (
            <BrewDayChecklistSection recipe={currentRecipe} calculations={calc} />
          ) : null}
        </div>
      </section>

      <StyleSelectorModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        onSelect={(style: string) => updateRecipe({ style: style || undefined })}
      />
    </>
  );
}

/* ─────────────────────────── primitives ─────────────────────────── */

function ClickableMetaPill({
  label,
  value,
  color,
  onClick,
}: {
  label: string;
  value: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        boxShadow: hsTokens.sh1,
        borderRadius: 999,
        padding: "6px 14px 6px 10px",
        cursor: "pointer",
        fontFamily: hsTokens.body,
        color: hsTokens.ink,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <HSEyebrow>{label}</HSEyebrow>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{value}</span>
      <span style={{ fontSize: 10, color: hsTokens.muted, marginLeft: 2 }}>⌄</span>
    </button>
  );
}

interface NumericMetaPillProps {
  label: string;
  value: number;
  unit: string;
  color: string;
  step?: number;
  min?: number;
  max?: number;
  onChange: (n: number) => void;
}

function NumericMetaPill({
  label,
  value,
  unit,
  color,
  step,
  min,
  max,
  onChange,
}: NumericMetaPillProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        boxShadow: hsTokens.sh1,
        borderRadius: 999,
        padding: "6px 14px 6px 10px",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <HSEyebrow>{label}</HSEyebrow>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        inputMode="decimal"
        aria-label={label}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        style={{
          fontSize: 12,
          fontWeight: 600,
          border: "none",
          background: "transparent",
          fontFamily: hsTokens.body,
          color: hsTokens.ink,
          outline: "none",
          padding: 0,
          width: 56,
          fontVariantNumeric: "tabular-nums",
        }}
      />
      <span style={{ fontSize: 11, color: hsTokens.muted }}>{unit}</span>
    </div>
  );
}

function StatCard({
  k,
  v,
  u,
  c,
  range,
}: {
  k: string;
  v: string;
  u?: string;
  c: string;
  range: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh2,
        padding: "12px 14px",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: c,
          /* Inner radius = parent radius (12) − parent border (2px) = 10 */
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          pointerEvents: "none",
        }}
      />
      <HSEyebrow>{k}</HSEyebrow>
      <div
        style={{
          ...display,
          fontSize: 26,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {v}
        {u ? (
          <span style={{ fontSize: 11, color: hsTokens.muted, marginLeft: 3 }}>{u}</span>
        ) : null}
      </div>
      <div
        style={{
          fontSize: 10,
          color: hsTokens.muted,
          marginTop: 4,
          fontVariantNumeric: "tabular-nums",
          fontFamily: hsTokens.mono,
        }}
      >
        {range}
      </div>
    </div>
  );
}
