"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import FermentablePresetModal from "../modals/FermentablePresetModal";
import CustomFermentableModal from "../modals/CustomFermentableModal";

import { uid } from "@/utils/uid";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { usePresetStore } from "@/modules/beta-builder/presentation/stores/presetStore";
import { toast } from "@/stores/toastStore";
import { fermentableCalculationService } from "@/modules/beta-builder/domain/services/FermentableCalculationService";
import type { Fermentable } from "@/modules/beta-builder/domain/models/Recipe";
import type { FermentablePreset } from "@/modules/beta-builder/domain/models/Presets";
import { getFermentability } from "@/modules/beta-builder/data/fermentablePresets";
import { getCountryFlag, BREWING_ORIGINS } from "@/utils/flags";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

type Mode = "amount" | "percent";

type GrainCategory = "Base malt" | "Crystal" | "Specialty" | "Roasted" | "Adjunct" | "Sugar";

const CAT_COLOR: Record<GrainCategory, string> = {
  "Base malt": hsTokens.malt,
  Crystal: hsTokens.roast,
  Specialty: hsTokens.yeast,
  Roasted: hsTokens.ink,
  Adjunct: hsTokens.honey,
  Sugar: hsTokens.hops,
};

/** Heuristic: derive a category label from the Fermentable's Lovibond + name. */
function categorize(f: Fermentable): GrainCategory {
  const name = f.name.toLowerCase();
  if (
    name.includes("sugar") ||
    name.includes("honey") ||
    name.includes("dextrose") ||
    name.includes("syrup")
  ) {
    return "Sugar";
  }
  if (
    name.includes("flak") ||
    name.includes("torrified") ||
    name.includes("oat") ||
    name.includes("rice") ||
    name.includes("corn") ||
    name.includes("adjunct")
  ) {
    return "Adjunct";
  }
  const L = f.colorLovibond;
  if (L < 10) return "Base malt";
  if (L < 50) return "Crystal";
  if (L < 200) return "Specialty";
  return "Roasted";
}

export default function FermentableSection() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const addFermentable = useRecipeStore((s) => s.addFermentable);
  const updateFermentable = useRecipeStore((s) => s.updateFermentable);
  const removeFermentable = useRecipeStore((s) => s.removeFermentable);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);

  const fermentablePresetsGrouped = usePresetStore((s) => s.fermentablePresetsGrouped);
  const loadFermentablePresets = usePresetStore((s) => s.loadFermentablePresets);
  const saveFermentablePreset = usePresetStore((s) => s.saveFermentablePreset);
  const presetsLoading = usePresetStore((s) => s.isLoading);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("amount");
  const [targetABV, setTargetABV] = useState(5.0);
  const [percentById, setPercentById] = useState<Record<string, number>>({});

  useEffect(() => {
    loadFermentablePresets();
  }, [loadFermentablePresets]);

  const handleSelectPreset = (preset: FermentablePreset) => {
    if (editingId) {
      updateFermentable(editingId, {
        name: preset.name,
        colorLovibond: preset.colorLovibond,
        ppg: preset.potentialGu,
        efficiencyPercent:
          preset.type === "extract" || preset.type === "sugar" ? 100 : 75,
        originCode: preset.originCode,
        fermentability: getFermentability(preset),
      });
    } else {
      const next: Fermentable = {
        id: uid(),
        name: preset.name,
        weightKg: 1.0,
        colorLovibond: preset.colorLovibond,
        ppg: preset.potentialGu,
        efficiencyPercent:
          preset.type === "extract" || preset.type === "sugar" ? 100 : 75,
        originCode: preset.originCode,
        fermentability: getFermentability(preset),
      };
      addFermentable(next);
    }
    setEditingId(null);
    setIsPickerOpen(false);
  };

  const handleSwapFermentable = (id: string) => {
    setEditingId(id);
    setIsPickerOpen(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setIsPickerOpen(true);
  };

  const handleSaveCustomPreset = (preset: FermentablePreset) => {
    saveFermentablePreset(preset);
    toast.success(`"${preset.name}" saved — select it from the list to add`);
  };

  const totalGrainKg =
    currentRecipe?.fermentables.reduce((sum, f) => sum + f.weightKg, 0) ?? 0;

  useEffect(() => {
    if (mode !== "percent" || !currentRecipe) return;
    const percents = fermentableCalculationService.calculatePercentsFromWeights(
      currentRecipe.fermentables
    );
    setPercentById((prev) => ({ ...percents, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentRecipe?.fermentables]);

  useEffect(() => {
    if (mode !== "percent" || !currentRecipe) return;
    const updated = fermentableCalculationService.calculateWeightsFromPercentsAndABV(
      currentRecipe.fermentables,
      percentById,
      targetABV,
      currentRecipe.batchVolumeL,
      currentRecipe.equipment.mashEfficiencyPercent || 75,
      currentRecipe.yeasts?.[0]?.attenuation || 0.75
    );
    updated.forEach((f) => {
      const current = currentRecipe.fermentables.find((cf) => cf.id === f.id);
      if (current && Math.abs(f.weightKg - current.weightKg) > 0.001) {
        updateFermentable(f.id, { weightKg: f.weightKg });
      }
    });
  }, [mode, currentRecipe, percentById, targetABV, updateFermentable]);

  const totalPercent = useMemo(() => {
    if (mode !== "percent" || !currentRecipe) return 0;
    return fermentableCalculationService.calculateTotalPercent(
      currentRecipe.fermentables,
      percentById
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentRecipe?.fermentables, percentById]);

  const fermentables = useMemo(
    () => currentRecipe?.fermentables ?? [],
    [currentRecipe?.fermentables]
  );

  // Rows enriched with derived display data — used by both BillStack + Ledger.
  const rows = useMemo<RowData[]>(() => {
    return fermentables.map((f) => {
      const pct = totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
      return {
        f,
        pct,
        srmColor: srmToRgb(f.colorLovibond),
        category: categorize(f),
      };
    });
  }, [fermentables, totalGrainKg]);

  return (
    <section className="hs-ferm-section" style={sectionFrameStyle}>
      <FermentableSectionStyles />

      <SectionTitle />

      {fermentables.length === 0 ? (
        <EmptyState onAdd={handleAddNew} />
      ) : (
        <div className="hs-ferm-grid">
          {/* Row 1 (desktop): ledger header on left, empty on right. The
              sidebar aside starts in row 2 so it aligns with the top of
              the ledger table, not the header buttons. */}
          <div className="hs-ferm-grid-lhead">
            <LedgerHeaderRow
              entryCount={fermentables.length}
              mode={mode}
              onModeChange={setMode}
              targetABV={targetABV}
              onTargetABVChange={setTargetABV}
              totalPercent={totalPercent}
              onAdd={handleAddNew}
            />
          </div>

          <div className="hs-ferm-grid-ltable">
            <Ledger
              rows={rows}
              mode={mode}
              percentById={percentById}
              totalGrainKg={totalGrainKg}
              totalPercent={totalPercent}
              onWeightChange={(id, v) =>
                updateFermentable(id, { weightKg: Math.max(0, v) })
              }
              onPercentChange={(id, v) =>
                setPercentById((prev) => ({
                  ...prev,
                  [id]: Math.max(0, Math.min(100, v)),
                }))
              }
              onSwap={handleSwapFermentable}
              onRemove={removeFermentable}
              onAdd={handleAddNew}
            />
          </div>

          <aside className="hs-ferm-grid-aside">
            <div className="hs-ferm-grid-bill">
              <BillStack rows={rows} totalGrainKg={totalGrainKg} />
            </div>
            <div className="hs-ferm-grid-notes">
              <BrewersNotesCard
                notes={currentRecipe?.notes ?? ""}
                tags={currentRecipe?.tags ?? []}
                onNotesChange={(v) => updateRecipe({ notes: v || undefined })}
                onTagsChange={(v) =>
                  updateRecipe({ tags: v.length ? v : undefined })
                }
              />
            </div>
          </aside>
        </div>
      )}

      <FermentablePresetModal
        isOpen={isPickerOpen}
        editing={Boolean(editingId)}
        onClose={() => {
          setIsPickerOpen(false);
          setEditingId(null);
        }}
        onSelect={handleSelectPreset}
        onCreateCustom={() => setIsCustomOpen(true)}
        presetsGrouped={fermentablePresetsGrouped}
        isLoading={presetsLoading}
      />

      <CustomFermentableModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
        onSave={handleSaveCustomPreset}
      />
    </section>
  );
}

// ─── Row data shape ──────────────────────────────────────────────

interface RowData {
  f: Fermentable;
  pct: number;
  srmColor: string;
  category: GrainCategory;
}

// ─── Outer frame ──────────────────────────────────────────────────

const sectionFrameStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 22,
  padding: 24,
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: "0 0 14px 14px",
  boxShadow: hsTokens.sh3,
  position: "relative",
};

// ─── Section title (kicker + h2 + malt rule, no controls) ────────

function SectionTitle() {
  return (
    <header
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${hsTokens.malt}`,
      }}
    >
      <HSScriptNote color={hsTokens.malt} size={22} rotate={-3}>
        your grain bill —
      </HSScriptNote>
      <h2
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(32px, 4.6vw, 44px)",
          letterSpacing: "-0.035em",
          lineHeight: 0.95,
          color: hsTokens.ink,
          margin: "4px 0 0",
        }}
      >
        Fermentables.
      </h2>
    </header>
  );
}

// ─── Bill stack — colored % visualization of the whole grain bill ─

/** Pick a short label for a segment overlay — strips brand prefixes like
 *  "1886 Malt House - " or "Muntons - " so the malt name is what shows. */
function shortName(full: string): string {
  if (full.includes(" - ")) {
    const after = full.split(" - ").slice(-1)[0].trim();
    return after.split(" ").slice(0, 2).join(" ");
  }
  return full.split(" ").slice(0, 2).join(" ");
}

function BillStack({
  rows,
  totalGrainKg,
}: {
  rows: RowData[];
  totalGrainKg: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const hovered = hoveredIdx !== null ? rows[hoveredIdx] : null;

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    t.style.transform = `translate(${clientX}px, ${clientY - 14}px) translate(-50%, -100%) rotate(${rotation}deg)`;
  }

  function onBarMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove ? 0 : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
      // Snap to cursor on first appearance — no transform transition from
      // the prior resting position (otherwise it shoots in from viewport origin).
      t.style.transition = "none";
      applyTransform(e.clientX, e.clientY, 0);
      void t.offsetHeight;
      t.style.transition = "opacity 140ms ease, transform 90ms ease-out";
    } else {
      applyTransform(e.clientX, e.clientY, rotation);
    }
    t.style.opacity = "1";
    if (restTimerRef.current !== null) window.clearTimeout(restTimerRef.current);
    const restClientX = e.clientX;
    const restClientY = e.clientY;
    restTimerRef.current = window.setTimeout(
      () => applyTransform(restClientX, restClientY, 0),
      120
    );
  }

  function onBarMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    setHoveredIdx(null);
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  return (
    <div
      className="hs-ferm-bill-stack"
      style={{
        // 50/50 mix between cream + cream2 — slightly lighter than the
        // header band so the sidebar card sits a touch quieter than the
        // ledger header but still warmer than paper.
        background: "color-mix(in srgb, var(--hs-cream), var(--hs-cream-2))",
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        padding: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <Eyebrow size={11}>The bill</Eyebrow>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 14,
            color: hsTokens.ink,
          }}
        >
          {totalGrainKg.toFixed(2)} kg{" "}
          <span style={{ color: hsTokens.muted, fontWeight: 400 }}>
            · {rows.length} grain{rows.length === 1 ? "" : "s"}
          </span>
        </span>
      </div>
      {/* Bill bar is a presentational chart; hover events drive the cursor-
          follow tooltip below. Segment buttons aren't appropriate (they
          aren't activatable beyond hovering — clicking does nothing). */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="hs-ferm-bill-bar"
        onMouseMove={onBarMouseMove}
        onMouseLeave={onBarMouseLeave}
        style={{
          display: "flex",
          height: 64,
          borderRadius: 6,
          border: `2px solid ${hsTokens.ink}`,
          overflow: "hidden",
          boxShadow: hsTokens.sh1,
          background: hsTokens.cream2,
        }}
      >
        {rows.map((r, i) => {
          const dark = r.f.colorLovibond > 25;
          // Match mockup: only the dominant slice carries a percentage +
          // name label. Smaller slices are pure color so the eye can rest.
          const showLabel = r.pct >= 25;
          const showName = r.pct >= 30;
          return (
            // Presentational segment — hover updates the cursor-follow tooltip;
            // no click behaviour, so no role is appropriate here.
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
              key={r.f.id}
              onMouseEnter={() => setHoveredIdx(i)}
              style={{
                width: `${r.pct}%`,
                background: r.srmColor,
                borderRight:
                  i < rows.length - 1 ? `2px solid ${hsTokens.ink}` : "none",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 4,
                overflow: "hidden",
                cursor: "default",
              }}
            >
              {showLabel ? (
                <div
                  style={{
                    textAlign: "center",
                    color: dark ? "#fff" : hsTokens.ink,
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      fontFamily: hsTokens.display,
                      fontSize: r.pct >= 30 ? 24 : 16,
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                    }}
                  >
                    {Math.round(r.pct)}%
                  </div>
                  {showName ? (
                    <div
                      style={{
                        fontFamily: hsTokens.body,
                        fontWeight: 700,
                        fontSize: 9,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginTop: 3,
                        opacity: 0.92,
                      }}
                    >
                      {shortName(r.f.name)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {/* Mono weight legend — each weight sits at the start of its slice. */}
      <div style={{ display: "flex", marginTop: 8 }}>
        {rows.map((r) => (
          <div
            key={r.f.id}
            style={{
              width: `${r.pct}%`,
              fontFamily: hsTokens.mono,
              fontSize: 10,
              color: hsTokens.muted,
              paddingLeft: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.f.weightKg.toFixed(2)}kg
          </div>
        ))}
      </div>

      {/* Cursor-following tooltip — appears on segment hover. */}
      <div
        ref={tooltipRef}
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 100,
          transition: "opacity 140ms ease, transform 90ms ease-out",
          willChange: "transform, opacity",
        }}
      >
        {hovered ? (
          <div
            style={{
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 10,
              boxShadow: hsTokens.sh2,
              padding: "10px 14px",
              minWidth: 220,
              maxWidth: 320,
            }}
          >
            <HSScriptNote color={hovered.srmColor} size={18}>
              {hovered.category.toLowerCase()} —
            </HSScriptNote>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 14,
                color: hsTokens.ink,
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {hovered.f.name}
              {hovered.f.originCode ? (
                <span style={{ marginLeft: 6 }}>
                  {getCountryFlag(hovered.f.originCode)}
                </span>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: hsTokens.body,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: hsTokens.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {hovered.pct.toFixed(1)}% of grain bill ·{" "}
              {hovered.f.weightKg.toFixed(2)} kg
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
                letterSpacing: "0.02em",
              }}
            >
              {hovered.f.colorLovibond}°L · {hovered.f.ppg} PPG ·{" "}
              {(hovered.f.colorLovibond * 1.97).toFixed(1)} EBC
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Ledger header row — eyebrow + entries + toggle + ABV + add ──

function LedgerHeaderRow({
  entryCount,
  mode,
  onModeChange,
  targetABV,
  onTargetABVChange,
  totalPercent,
  onAdd,
}: {
  entryCount: number;
  mode: Mode;
  onModeChange: (m: Mode) => void;
  targetABV: number;
  onTargetABVChange: (v: number) => void;
  totalPercent: number;
  onAdd: () => void;
}) {
  return (
    <div
      className="hs-ferm-ledger-head"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 2,
      }}
    >
      <Eyebrow size={11}>The grain ledger</Eyebrow>
      <span
        aria-hidden
        style={{
          flex: 1,
          minWidth: 20,
          height: 1,
          background: hsTokens.ink,
          opacity: 0.22,
        }}
      />
      <HSScriptNote color={hsTokens.muted} size={16} rotate={-3}>
        {entryCount} entr{entryCount === 1 ? "y" : "ies"}
      </HSScriptNote>
      {mode === "percent" ? (
        <TargetABVPill
          value={targetABV}
          onChange={onTargetABVChange}
          totalPercent={totalPercent}
        />
      ) : null}
      <ModeToggle mode={mode} onChange={onModeChange} />
      <HSButton onClick={onAdd} color={hsTokens.malt} size="sm">
        + Add fermentable
      </HSButton>
    </div>
  );
}

// ─── Mode toggle (segmented) ─────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const cellStyle = (active: boolean): CSSProperties => ({
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "6px 14px",
    border: "none",
    background: active ? hsTokens.malt : "transparent",
    color: hsTokens.ink,
    cursor: "pointer",
    transition: "background 120ms ease",
  });
  return (
    <div
      role="tablist"
      aria-label="Editing mode"
      style={{
        display: "inline-flex",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        overflow: "hidden",
        boxShadow: hsTokens.sh1,
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "amount"}
        style={cellStyle(mode === "amount")}
        onClick={() => onChange("amount")}
      >
        Amount
      </button>
      <span
        aria-hidden
        style={{ width: 1.5, background: hsTokens.ink, alignSelf: "stretch" }}
      />
      <button
        type="button"
        role="tab"
        aria-selected={mode === "percent"}
        style={cellStyle(mode === "percent")}
        onClick={() => onChange("percent")}
      >
        %
      </button>
    </div>
  );
}

// ─── Target ABV pill (% mode only) ───────────────────────────────

function TargetABVPill({
  value,
  onChange,
  totalPercent,
}: {
  value: number;
  onChange: (v: number) => void;
  totalPercent: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 14px 5px 16px",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: hsTokens.sh1,
      }}
    >
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
        Target ABV
      </span>
      <InlineNumberValue
        value={value}
        onCommit={onChange}
        step={0.1}
        min={0}
        precision={1}
        format={(v) => v.toFixed(1)}
        suffix="%"
        ariaLabel="Target ABV percentage"
      />
      <span
        style={{
          fontFamily: hsTokens.script,
          fontSize: 14,
          color: hsTokens.muted,
          transform: "rotate(-2deg)",
          display: "inline-block",
          whiteSpace: "nowrap",
        }}
      >
        sum {totalPercent.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Ledger (paper card with header + rows + total) ──────────────

const LEDGER_COLS = "62px minmax(0, 1.7fr) 140px 86px 32px";

function Ledger({
  rows,
  mode,
  percentById,
  totalGrainKg,
  totalPercent,
  onWeightChange,
  onPercentChange,
  onSwap,
  onRemove,
  onAdd,
}: {
  rows: RowData[];
  mode: Mode;
  percentById: Record<string, number>;
  totalGrainKg: number;
  totalPercent: number;
  onWeightChange: (id: string, v: number) => void;
  onPercentChange: (id: string, v: number) => void;
  onSwap: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  const totalEbc = Math.round(srmFromGrainBill(rows) * 1.97);
  return (
    <div
      className="hs-ferm-ledger"
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        overflow: "hidden",
      }}
    >
      <LedgerHead mode={mode} />
      {rows.map((r, i) => (
        <LedgerRow
          key={r.f.id}
          row={r}
          isLast={i === rows.length - 1}
          mode={mode}
          percentValue={percentById[r.f.id] ?? r.pct}
          onWeightChange={(v) => onWeightChange(r.f.id, v)}
          onPercentChange={(v) => onPercentChange(r.f.id, v)}
          onSwap={() => onSwap(r.f.id)}
          onRemove={() => onRemove(r.f.id)}
        />
      ))}
      <LedgerTotal
        mode={mode}
        totalGrainKg={totalGrainKg}
        totalPercent={totalPercent}
        totalEbc={totalEbc}
      />
      {/* Dashed empty-row CTA — mobile only. Saves a scroll-up to reach
          the Add button in the (now offscreen) ledger header row. */}
      <MobileAddRow onAdd={onAdd} />
    </div>
  );
}

/**
 * SVG background-image as a faux dashed border. CSS native `border-style:
 * dashed` doesn't let you control dash length or gap — modern browsers
 * pick those proportionally to the stroke. SVG's `stroke-dasharray`
 * lets us pick exact values, and the SVG scales to the button via 100%
 * width/height so the dash rhythm stays consistent at any width.
 */
function dashedBorderBg(color: string, opts: { dash: number; gap: number; strokeWidth: number; radius: number }) {
  const { dash, gap, strokeWidth, radius } = opts;
  const c = color.replace("#", "%23");
  const half = strokeWidth / 2;
  return (
    `url("data:image/svg+xml;utf8,` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' preserveAspectRatio='none'>` +
    `<rect x='${half}' y='${half}' ` +
    `width='calc(100%25 - ${strokeWidth}px)' height='calc(100%25 - ${strokeWidth}px)' ` +
    `rx='${radius - half}' ry='${radius - half}' ` +
    `fill='none' stroke='${c}' stroke-width='${strokeWidth}' ` +
    `stroke-dasharray='${dash} ${gap}'/>` +
    `</svg>")`
  );
}

const MOBILE_ADD_RADIUS = 12;
const MOBILE_ADD_DASH = "12";
const MOBILE_ADD_GAP = "8";
const MOBILE_ADD_STROKE = 1.75;

function MobileAddRow({ onAdd }: { onAdd: () => void }) {
  // Use longhand `borderWidth/Style/Color` patterns elsewhere — but here
  // we draw the border via SVG so dashes can be visibly longer with
  // proportional gaps (CSS native dashed is too cramped). At rest we
  // also tint with a gentle cream2 bg so it reads as a clickable cell.
  const restBg = "color-mix(in srgb, var(--hs-cream-2) 65%, transparent)";
  const restBorder = dashedBorderBg("#5a4f42" /* hs-muted literal for SVG */, {
    dash: Number(MOBILE_ADD_DASH),
    gap: Number(MOBILE_ADD_GAP),
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  const hoverBorder = dashedBorderBg("#1a1612" /* hs-ink literal */, {
    dash: Number(MOBILE_ADD_DASH),
    gap: Number(MOBILE_ADD_GAP),
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  return (
    <button
      type="button"
      className="hs-ferm-mobile-add"
      onClick={onAdd}
      style={{
        display: "none",
        width: "100%",
        border: "none",
        backgroundColor: restBg,
        backgroundImage: restBorder,
        backgroundRepeat: "no-repeat",
        borderRadius: MOBILE_ADD_RADIUS,
        padding: "16px 14px",
        margin: "10px 0 2px",
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
        cursor: "pointer",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "background-color 90ms ease, color 90ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hsTokens.cream2;
        e.currentTarget.style.backgroundImage = hoverBorder;
        e.currentTarget.style.color = hsTokens.ink;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = restBg;
        e.currentTarget.style.backgroundImage = restBorder;
        e.currentTarget.style.color = hsTokens.muted;
      }}
    >
      + Add another fermentable
    </button>
  );
}

function LedgerHead({ mode }: { mode: Mode }) {
  return (
    <div
      className="hs-ferm-ledger-row hs-ferm-ledger-head-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "10px 18px",
        background: hsTokens.cream,
        borderBottom: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 14,
      }}
    >
      <Eyebrow size={9} style={{ display: "block", textAlign: "center" }}>
        °L · PPG
      </Eyebrow>
      <Eyebrow size={10}>
        Grain
        <span
          style={{
            color: hsTokens.ink,
            opacity: 0.4,
            marginLeft: 8,
            fontWeight: 600,
            textTransform: "none",
            letterSpacing: "0.04em",
            fontSize: 10,
          }}
        >
          click name to swap
        </span>
      </Eyebrow>
      {/* Editable + computed columns: center the header above the (also-
          centered) value cell. The 28px paddingRight on the editable
          header compensates for the EditableCell's stepper padding so
          the header centers over the visible glyphs, not the button bbox. */}
      <Eyebrow
        size={10}
        style={{ display: "block", textAlign: "center", paddingRight: 28 }}
      >
        {mode === "amount" ? "Weight" : "Percent"}
      </Eyebrow>
      <Eyebrow size={10} style={{ display: "block", textAlign: "center" }}>
        {mode === "amount" ? "Share" : "Weight"}
      </Eyebrow>
      <span />
    </div>
  );
}

function LedgerRow({
  row,
  isLast,
  mode,
  percentValue,
  onWeightChange,
  onPercentChange,
  onSwap,
  onRemove,
}: {
  row: RowData;
  isLast: boolean;
  mode: Mode;
  percentValue: number;
  onWeightChange: (v: number) => void;
  onPercentChange: (v: number) => void;
  onSwap: () => void;
  onRemove: () => void;
}) {
  const { f, pct, srmColor, category } = row;
  const editableValue = mode === "amount" ? f.weightKg : percentValue;
  const computedDisplay =
    mode === "amount" ? `${pct.toFixed(1)}` : `${f.weightKg.toFixed(2)}`;
  const computedSuffix = mode === "amount" ? "%" : "kg";
  const step = mode === "amount" ? 0.5 : 1;
  const editPrecision = mode === "amount" ? 2 : 1;
  const editSuffix = mode === "amount" ? "kg" : "%";
  return (
    <div
      className="hs-ferm-ledger-row hs-ferm-data-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 18px",
        borderBottom: isLast ? "none" : `1px solid ${hsTokens.ink}22`,
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* Swatch + PPG */}
      <div
        className="hs-ferm-swatch-cell"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Swatch color={srmColor} L={f.colorLovibond} ppg={f.ppg} />
      </div>

      {/* Grain — click name to swap */}
      <button
        type="button"
        className="hs-ferm-name-btn"
        onClick={onSwap}
        aria-label={`Swap ${f.name}`}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          cursor: "pointer",
          minWidth: 0,
          color: "inherit",
          fontFamily: "inherit",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <span
            className="hs-ferm-name"
            style={{
              fontFamily: hsTokens.body,
              fontSize: 15,
              fontWeight: 600,
              color: hsTokens.ink,
              lineHeight: 1.2,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={f.name}
          >
            {f.name}
          </span>
          {f.originCode ? (
            <span
              title={BREWING_ORIGINS[f.originCode] ?? f.originCode}
              style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
            >
              {getCountryFlag(f.originCode)}
            </span>
          ) : null}
          <CategoryPill category={category} />
        </div>
      </button>

      {/* Editable value (Weight in amount mode, % in percent mode) */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={editableValue}
          step={step}
          min={0}
          max={mode === "percent" ? 100 : undefined}
          precision={editPrecision}
          suffix={editSuffix}
          format={(v) => (mode === "amount" ? v.toFixed(2) : v.toFixed(1))}
          ariaLabel={mode === "amount" ? "Weight in kg" : "Percentage"}
          onCommit={(v) => {
            if (mode === "amount") onWeightChange(v);
            else onPercentChange(v);
          }}
        />
      </div>

      {/* Computed value (Share in amount mode, kg in percent mode) — read-only. */}
      <div
        style={{
          textAlign: "center",
          fontFamily: hsTokens.body,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            color: hsTokens.ink,
          }}
        >
          {computedDisplay}
        </span>
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 11,
            color: hsTokens.muted,
            marginLeft: 2,
          }}
        >
          {computedSuffix}
        </span>
      </div>

      {/* Remove — ghost × that fades in on row hover. */}
      <button
        type="button"
        className="hs-ferm-remove-btn"
        onClick={onRemove}
        aria-label={`Remove ${f.name}`}
        style={{
          width: 28,
          height: 28,
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          color: hsTokens.roast,
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
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
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}

function LedgerTotal({
  mode,
  totalGrainKg,
  totalPercent,
  totalEbc,
}: {
  mode: Mode;
  totalGrainKg: number;
  totalPercent: number;
  totalEbc: number;
}) {
  return (
    <div
      className="hs-ferm-ledger-row hs-ferm-total-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 18px",
        background: hsTokens.cream2,
        borderTop: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 14,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          color: hsTokens.muted,
          textAlign: "center",
        }}
      >
        ~{totalEbc} EBC
      </span>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 16,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        Total grain bill
      </span>
      <div
        style={{ display: "flex", justifyContent: "center", paddingRight: 28 }}
      >
        <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 20,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "-0.01em",
              color: hsTokens.ink,
            }}
          >
            {mode === "amount" ? totalGrainKg.toFixed(2) : totalPercent.toFixed(1)}
          </span>
          <span
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            {mode === "amount" ? "kg" : "%"}
          </span>
        </span>
      </div>
      <span
        style={{
          display: "block",
          textAlign: "center",
          fontFamily: hsTokens.display,
          fontSize: 16,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {mode === "amount" ? "100%" : `${totalGrainKg.toFixed(2)} kg`}
      </span>
      <span />
    </div>
  );
}

// Pure utility: rough SRM total via Morey's weighted-MCU heuristic.
// We don't have batchVolume here — use the recipe sum approximation
// (sum(weightKg * L) / total weight) which yields a "grain bill SRM"
// good enough for an EBC caption in the total row.
function srmFromGrainBill(rows: RowData[]): number {
  const totalW = rows.reduce((s, r) => s + r.f.weightKg, 0);
  if (totalW === 0) return 0;
  const weightedL =
    rows.reduce((s, r) => s + r.f.weightKg * r.f.colorLovibond, 0) / totalW;
  // Rough conversion grain-bill °L → final SRM via Morey-ish factor.
  return Math.max(0, 1.4922 * Math.pow(weightedL, 0.6859));
}

// ─── Swatch ──────────────────────────────────────────────────────

function Swatch({
  color,
  L,
  ppg,
}: {
  color: string;
  L: number;
  ppg: number;
}) {
  const dark = L > 30;
  return (
    <>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 7,
          background: color,
          border: `1.5px solid ${hsTokens.ink}`,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          boxShadow: hsTokens.sh1,
          position: "relative",
        }}
        title={`${L}°L · ${ppg} PPG`}
      >
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 10,
            fontWeight: 600,
            color: dark ? "#fff" : hsTokens.ink,
            opacity: 0.92,
            letterSpacing: "0.02em",
          }}
        >
          {L}°
        </span>
      </div>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 9,
          color: hsTokens.muted,
          letterSpacing: "0.05em",
        }}
      >
        {ppg} PPG
      </span>
    </>
  );
}

// ─── Category pill ───────────────────────────────────────────────

function CategoryPill({ category }: { category: GrainCategory }) {
  const dark = category === "Roasted";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "3px 8px",
        background: CAT_COLOR[category],
        color: dark ? hsTokens.cream : hsTokens.ink,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        whiteSpace: "nowrap",
        lineHeight: 1.1,
        flexShrink: 0,
      }}
    >
      {category}
    </span>
  );
}

// ─── Eyebrow primitive ───────────────────────────────────────────

function Eyebrow({
  children,
  size = 10,
  color = hsTokens.muted,
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily: hsTokens.body,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color,
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ─── Editable cell — Caveat handwritten value with dotted underline ─

function EditableCell({
  value,
  onCommit,
  step,
  min,
  max,
  format,
  suffix,
  ariaLabel,
  precision,
}: {
  value: number;
  onCommit: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  format: (v: number) => string;
  suffix?: string;
  ariaLabel: string;
  precision?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enterEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  const nudge = (dir: 1 | -1) => {
    const raw = value + dir * step;
    const decimals =
      precision ?? Math.max(0, (String(step).split(".")[1] ?? "").length);
    const rounded = parseFloat(raw.toFixed(decimals));
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, rounded));
    if (clamped !== value) onCommit(clamped);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        step={step}
        min={min}
        max={max}
        aria-label={ariaLabel}
        style={{
          width: "100%",
          background: hsTokens.cream,
          border: `1.5px solid ${hsTokens.malt}`,
          outline: "none",
          fontFamily: hsTokens.script,
          fontWeight: 500,
          fontSize: 28,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          textAlign: "left",
          padding: "2px 8px",
          margin: 0,
          appearance: "textfield",
          borderRadius: 6,
        }}
      />
    );
  }

  return (
    // Presentational wrapper for hover-stepper visibility. The interactive
    // children (edit button + stepper buttons) handle all keyboard/touch input.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        type="button"
        onClick={enterEdit}
        aria-label={`Edit ${format(value)}${suffix ?? ""}`}
        className="hs-ferm-edit-btn"
        style={{
          background: "transparent",
          border: "none",
          borderBottom: `1.5px dotted ${hsTokens.ink}55`,
          padding: "2px 30px 2px 6px",
          margin: 0,
          cursor: "text",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 5,
          color: "inherit",
          fontFamily: "inherit",
          borderRadius: 0,
          transition: "background 90ms ease, border-bottom-style 90ms ease",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.script,
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1,
            color: hsTokens.ink,
          }}
        >
          {format(value)}
        </span>
        {suffix ? (
          <span
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            {suffix}
          </span>
        ) : null}
      </button>
      <HoverSteppers
        visible={hovered}
        onUp={() => nudge(1)}
        onDown={() => nudge(-1)}
      />
    </div>
  );
}

// ─── Hover steppers ───────────────────────────────────────────────

function HoverSteppers({
  visible,
  onUp,
  onDown,
}: {
  visible: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div
      className="hs-ferm-steppers"
      aria-hidden={!visible}
      style={{
        position: "absolute",
        right: 2,
        top: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 1,
        opacity: visible ? 1 : 0,
        transition: "opacity 90ms ease",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <StepperBtn onClick={onUp} direction="up" label="Increase" />
      <StepperBtn onClick={onDown} direction="down" label="Decrease" />
    </div>
  );
}

function StepperBtn({
  onClick,
  direction,
  label,
}: {
  onClick: () => void;
  direction: "up" | "down";
  label: string;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      style={{
        width: 16,
        height: 14,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: hsTokens.paper,
        border: `1px solid ${hsTokens.ink}`,
        borderRadius: 3,
        cursor: "pointer",
        color: hsTokens.muted,
        padding: 0,
        lineHeight: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hsTokens.malt;
        e.currentTarget.style.color = hsTokens.ink;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.muted;
      }}
    >
      <svg
        width="9"
        height="6"
        viewBox="0 0 10 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "up" ? <path d="M1 5 5 1 9 5" /> : <path d="M1 1 5 5 9 1" />}
      </svg>
    </button>
  );
}

// ─── Inline number value (Target ABV pill) ───────────────────────

function InlineNumberValue({
  value,
  onCommit,
  step,
  min,
  max,
  format,
  suffix,
  ariaLabel,
  precision,
}: {
  value: number;
  onCommit: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  format: (v: number) => string;
  suffix?: string;
  ariaLabel: string;
  precision?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const enterEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed);
    }
    setEditing(false);
  };
  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
  };
  const nudge = (dir: 1 | -1) => {
    const raw = value + dir * step;
    const decimals =
      precision ?? Math.max(0, (String(step).split(".")[1] ?? "").length);
    const rounded = parseFloat(raw.toFixed(decimals));
    const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, rounded));
    if (clamped !== value) onCommit(clamped);
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        minWidth: 72,
        height: 26,
        justifyContent: "flex-end",
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          step={step}
          min={min}
          max={max}
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            background: hsTokens.cream,
            border: "none",
            outline: `2px solid ${hsTokens.malt}`,
            outlineOffset: -2,
            fontFamily: hsTokens.script,
            fontWeight: 500,
            fontSize: 22,
            color: hsTokens.ink,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
            padding: "0 8px",
            margin: 0,
            appearance: "textfield",
            borderRadius: 4,
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={enterEdit}
            aria-label={`Edit ${format(value)}${suffix ?? ""}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              padding: "0 26px 0 8px",
              margin: 0,
              cursor: "text",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
              color: hsTokens.ink,
            }}
          >
            <span
              style={{
                fontFamily: hsTokens.script,
                fontWeight: 500,
                fontSize: 22,
                lineHeight: 1,
                color: hsTokens.ink,
              }}
            >
              {format(value)}
            </span>
            {suffix ? (
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 12,
                  color: hsTokens.muted,
                }}
              >
                {suffix}
              </span>
            ) : null}
          </button>
          <HoverSteppers
            visible={hovered}
            onUp={() => nudge(1)}
            onDown={() => nudge(-1)}
          />
        </>
      )}
    </div>
  );
}

// ─── Styles (row hover, mobile responsive, touch always-on steppers) ─

function FermentableSectionStyles() {
  return (
    <style>{`
      /* Desktop: 2-col grid. Row 1 = ledger header + empty. Row 2 =
         ledger table + aside (bill+notes packed via flex). The aside's
         top therefore aligns with the top of the ledger TABLE, not the
         header row controls. */
      .hs-ferm-section .hs-ferm-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
        grid-template-areas:
          "lhead  ."
          "ltable aside";
        column-gap: 20px;
        row-gap: 16px;
        align-items: start;
      }
      .hs-ferm-section .hs-ferm-grid-lhead { grid-area: lhead; min-width: 0; }
      .hs-ferm-section .hs-ferm-grid-ltable { grid-area: ltable; min-width: 0; }
      .hs-ferm-section .hs-ferm-grid-aside {
        grid-area: aside;
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 0;
      }

      /* Mobile: collapse to single column. Use display:contents on aside
         so bill + notes can claim their own grid slots and split — bill
         hoists to the top (chart still leads visually), notes anchors to
         the bottom under the ledger. */
      @media (max-width: 900px) {
        .hs-ferm-section .hs-ferm-grid {
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas:
            "bill"
            "lhead"
            "ltable"
            "notes";
          row-gap: 12px;
        }
        .hs-ferm-section .hs-ferm-grid-aside {
          display: contents;
        }
        .hs-ferm-section .hs-ferm-grid-bill { grid-area: bill; }
        .hs-ferm-section .hs-ferm-grid-notes { grid-area: notes; }
      }

      /* Desktop hover — subtle cream-2 tint across the ledger row,
         plus fades in the ghost × remove button. */
      @media (min-width: 641px) and (hover: hover) {
        .hs-ferm-section .hs-ferm-data-row {
          transition: background 90ms ease;
        }
        .hs-ferm-section .hs-ferm-data-row:hover {
          background: ${hsTokens.cream2};
        }
        .hs-ferm-section .hs-ferm-remove-btn {
          opacity: 0.32;
          transition: opacity 90ms ease, background 90ms ease;
        }
        .hs-ferm-section .hs-ferm-data-row:hover .hs-ferm-remove-btn {
          opacity: 1;
        }
        .hs-ferm-section .hs-ferm-remove-btn:hover {
          background: rgba(212, 69, 44, 0.12);
        }
        .hs-ferm-section .hs-ferm-name-btn:hover .hs-ferm-name {
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .hs-ferm-section .hs-ferm-edit-btn:hover {
          background: ${hsTokens.cream2};
          border-bottom-style: solid !important;
        }
      }

      /* Mobile (≤640px) — collapse ledger into per-grain cards,
         always-visible steppers, no per-cell hover tints. */
      @media (max-width: 640px) {
        /* Mobile-only: show dashed "add another" row at the bottom of
           the ledger so brewers don't have to scroll up to the header. */
        .hs-ferm-section .hs-ferm-mobile-add {
          display: flex !important;
        }

        /* Always-visible bare steppers (touch can't hover). */
        .hs-ferm-section .hs-ferm-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 0 !important;
        }
        .hs-ferm-section .hs-ferm-steppers button {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          width: 26px !important;
          height: 22px !important;
          color: ${hsTokens.muted} !important;
        }
        .hs-ferm-section .hs-ferm-steppers button svg {
          width: 14px !important;
          height: 9px !important;
          stroke-width: 2 !important;
        }
        .hs-ferm-section .hs-ferm-remove-btn {
          opacity: 1 !important;
        }
        /* Always show the remove button on mobile (no hover).
           Reveal layout: each grain becomes a stacked card. */
        .hs-ferm-section .hs-ferm-ledger {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .hs-ferm-section .hs-ferm-ledger-head-row {
          display: none !important;
        }
        .hs-ferm-section .hs-ferm-data-row {
          display: grid !important;
          grid-template-columns: 56px minmax(0, 1fr) auto !important;
          grid-template-areas:
            "swatch name remove"
            "swatch info  info"
            "value  value value" !important;
          column-gap: 14px !important;
          row-gap: 10px !important;
          padding: 16px 0 !important;
          border-bottom: 1px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-ferm-section .hs-ferm-data-row:last-of-type {
          border-bottom: none !important;
        }
        .hs-ferm-section .hs-ferm-data-row > :nth-child(1) {
          grid-area: swatch;
        }
        .hs-ferm-section .hs-ferm-data-row > :nth-child(2) {
          grid-area: name;
        }
        /* Editable + computed both in the bottom row, side-by-side. */
        .hs-ferm-section .hs-ferm-data-row > :nth-child(3) {
          grid-area: value;
          display: flex !important;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
        }
        .hs-ferm-section .hs-ferm-data-row > :nth-child(4) {
          grid-area: info;
          text-align: left !important;
          font-size: 13px !important;
        }
        .hs-ferm-section .hs-ferm-data-row > :nth-child(5) {
          grid-area: remove;
          justify-self: end;
        }
        .hs-ferm-section .hs-ferm-edit-btn {
          padding: 4px 38px 4px 8px !important;
        }
        .hs-ferm-section .hs-ferm-edit-btn > span:first-child {
          font-size: 34px !important;
        }
        /* Total row: simple label-on-left, value-on-right flex. */
        .hs-ferm-section .hs-ferm-total-row {
          display: flex !important;
          justify-content: space-between !important;
          align-items: baseline !important;
          padding: 16px 0 !important;
          border-top: 2px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-ferm-section .hs-ferm-total-row > * {
          padding: 0 !important;
        }
        .hs-ferm-section .hs-ferm-total-row > :nth-child(1),
        .hs-ferm-section .hs-ferm-total-row > :nth-child(4),
        .hs-ferm-section .hs-ferm-total-row > :nth-child(5) {
          display: none !important;
        }
        /* Section frame: tighter on mobile. */
        .hs-ferm-section {
          padding: 18px 14px !important;
        }
        .hs-ferm-bill-stack {
          padding: 12px !important;
        }
        .hs-ferm-ledger-head {
          flex-wrap: wrap;
        }
      }
    `}</style>
  );
}

// ─── Brewer's notes card (right sidebar) ─────────────────────────

function BrewersNotesCard({
  notes,
  tags,
  onNotesChange,
  onTagsChange,
}: {
  notes: string;
  tags: string[];
  onNotesChange: (v: string) => void;
  onTagsChange: (v: string[]) => void;
}) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftNotes, setDraftNotes] = useState(notes);
  const [editingTags, setEditingTags] = useState(false);
  const [draftTags, setDraftTags] = useState(tags.join(" "));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNotes) {
      setDraftNotes(notes);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [editingNotes, notes]);

  useEffect(() => {
    if (editingTags) {
      setDraftTags(tags.join(" "));
      requestAnimationFrame(() => tagInputRef.current?.focus());
    }
  }, [editingTags, tags]);

  const commitNotes = () => {
    const next = draftNotes.trim();
    if (next !== notes) onNotesChange(next);
    setEditingNotes(false);
  };
  const cancelNotes = () => {
    setDraftNotes(notes);
    setEditingNotes(false);
  };
  const commitTags = () => {
    const next = draftTags
      .split(/\s+/)
      .map((t) => t.replace(/^#+/, "").trim().toLowerCase())
      .filter(Boolean);
    if (next.join(" ") !== tags.join(" ")) onTagsChange(next);
    setEditingTags(false);
  };
  const cancelTags = () => {
    setDraftTags(tags.join(" "));
    setEditingTags(false);
  };

  return (
    <div
      className="hs-ferm-notes-card"
      style={{
        // Yellowed beige — cream2 warmed with a subtle hint of honey
        // so the notes card reads visually distinct from the rest of
        // the section without becoming a heavy accent block.
        background:
          "color-mix(in srgb, var(--hs-cream-2) 86%, var(--hs-honey))",
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          borderBottom: `1px solid ${hsTokens.ink}22`,
          paddingBottom: 8,
        }}
      >
        <Eyebrow size={11}>Brewer&apos;s notes</Eyebrow>
        <button
          type="button"
          onClick={() => setEditingNotes((v) => !v)}
          aria-label={editingNotes ? "Save notes" : "Edit notes"}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "2px 6px",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            borderRadius: 4,
          }}
        >
          {editingNotes ? "Save" : "Edit"}{" "}
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>
      </div>

      {editingNotes ? (
        <textarea
          ref={textareaRef}
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          onBlur={commitNotes}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              cancelNotes();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitNotes();
            }
          }}
          placeholder="Last brew leaned a little thin — bump up the crystal next time…"
          rows={4}
          style={{
            width: "100%",
            background: hsTokens.paper,
            border: `1.5px solid ${hsTokens.malt}`,
            borderRadius: 8,
            padding: "10px 12px",
            fontFamily: hsTokens.script,
            fontSize: 19,
            lineHeight: 1.35,
            color: hsTokens.ink,
            outline: "none",
            resize: "vertical",
            minHeight: 90,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditingNotes(true)}
          aria-label="Edit brewer's notes"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            cursor: "text",
            textAlign: "left",
            display: "block",
            width: "100%",
            color: "inherit",
            fontFamily: "inherit",
          }}
        >
          <p
            style={{
              fontFamily: hsTokens.script,
              fontSize: 19,
              lineHeight: 1.35,
              color: notes ? hsTokens.ink : hsTokens.muted,
              margin: 0,
              whiteSpace: "pre-wrap",
              opacity: notes ? 1 : 0.7,
            }}
          >
            {notes ||
              "Last brew leaned a little thin — bump up the crystal next time…"}
          </p>
        </button>
      )}

      {/* Tags row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        {editingTags ? (
          <input
            ref={tagInputRef}
            type="text"
            value={draftTags}
            onChange={(e) => setDraftTags(e.target.value)}
            onBlur={commitTags}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                cancelTags();
              } else if (e.key === "Enter") {
                e.preventDefault();
                commitTags();
              }
            }}
            placeholder="#irish-red #malty"
            style={{
              flex: 1,
              minWidth: 0,
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.malt}`,
              borderRadius: 999,
              padding: "5px 10px",
              fontFamily: hsTokens.body,
              fontSize: 12,
              color: hsTokens.ink,
              outline: "none",
            }}
          />
        ) : (
          <>
            {tags.length > 0 ? (
              tags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    background: hsTokens.paper,
                    border: `1.5px solid ${hsTokens.ink}`,
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontFamily: hsTokens.body,
                    fontWeight: 600,
                    fontSize: 11,
                    color: hsTokens.ink,
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{t}
                </span>
              ))
            ) : (
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 11,
                  color: hsTokens.muted,
                  letterSpacing: "0.02em",
                }}
              >
                No tags yet —
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditingTags(true)}
              aria-label="Edit tags"
              style={{
                background: "transparent",
                border: `1.5px dashed ${hsTokens.ink}44`,
                borderRadius: 999,
                padding: "2px 9px",
                fontFamily: hsTokens.body,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: hsTokens.muted,
                cursor: "pointer",
              }}
            >
              + tag
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        background: hsTokens.cream2,
        border: `1.5px dashed ${hsTokens.ink}`,
        borderRadius: 10,
        padding: "32px 28px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <HSScriptNote color={hsTokens.malt} size={24} rotate={-4}>
        empty bill —
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 15,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 380,
          lineHeight: 1.4,
        }}
      >
        Start with your base malt, then layer in specialty grains. The picker has every common
        fermentable.
      </p>
      <HSButton onClick={onAdd} color={hsTokens.malt} size="md">
        Add your first fermentable
      </HSButton>
    </div>
  );
}
