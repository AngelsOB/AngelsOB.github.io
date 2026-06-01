"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";

import { hsTokens } from "../../tokens";
import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import HopPresetModal from "../modals/HopPresetModal";
import CustomHopModal from "../modals/CustomHopModal";
import { LedgerRowMotion, LedgerRowsAnimated } from "./LedgerRowMotion";

import { uid } from "@/utils/uid";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { usePresetStore } from "@/modules/beta-builder/presentation/stores/presetStore";
import { useRecipeCalculations } from "@/modules/beta-builder/presentation/hooks/useRecipeCalculations";
import { toast } from "@/stores/toastStore";
import { hopFlavorCalculationService } from "@/modules/beta-builder/domain/services/HopFlavorCalculationService";
import { hopEnrichmentService } from "@/modules/beta-builder/domain/services/HopEnrichmentService";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import type { Hop } from "@/modules/beta-builder/domain/models/Recipe";
import type {
  HopPreset,
  HopFlavorProfile,
} from "@/modules/beta-builder/domain/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/beta-builder/domain/models/Presets";

type Usage = Hop["type"];

const USAGE_ORDER: Usage[] = ["boil", "whirlpool", "dry hop", "first wort", "mash"];

const USAGE_LABEL: Record<Usage, string> = {
  boil: "Boil",
  whirlpool: "Whirlpool",
  "dry hop": "Dry hop",
  "first wort": "First wort",
  mash: "Mash",
};

/** Color associated with each usage type — used as the dot inside the
 *  UsageSelect pill and the row badge in the radar legend. */
const USAGE_COLOR: Record<Usage, string> = {
  boil: hsTokens.hops,
  whirlpool: hsTokens.honey,
  "dry hop": hsTokens.yeast,
  "first wort": "#6b9c5a",
  mash: hsTokens.roast,
};

/** Default field values when switching a hop to a new usage type. */
function defaultsForUsage(u: Usage): Partial<Hop> {
  switch (u) {
    case "boil":
      return { type: "boil", timeMinutes: 60 };
    case "whirlpool":
      return {
        type: "whirlpool",
        temperatureC: 80,
        whirlpoolTimeMinutes: 15,
      };
    case "dry hop":
      return { type: "dry hop", dryHopStartDay: 0, dryHopDays: 3 };
    case "first wort":
      return { type: "first wort" };
    case "mash":
      return { type: "mash" };
  }
}

/** Caption text describing the hop's purpose, based on AA%. */
function purposeOf(alphaAcid: number): "aroma" | "dual" | "bittering" {
  if (alphaAcid < 6) return "aroma";
  if (alphaAcid <= 10) return "dual";
  return "bittering";
}

export default function HopSection() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const addHop = useRecipeStore((s) => s.addHop);
  const updateHop = useRecipeStore((s) => s.updateHop);
  const removeHop = useRecipeStore((s) => s.removeHop);

  const hopPresetsGrouped = usePresetStore((s) => s.hopPresetsGrouped);
  const loadHopPresets = usePresetStore((s) => s.loadHopPresets);
  const saveHopPreset = usePresetStore((s) => s.saveHopPreset);
  const presetsLoading = usePresetStore((s) => s.isLoading);

  const calculations = useRecipeCalculations(currentRecipe);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Per-row mini-radar hover preview state + imperative cursor-follow refs.
  // Mirrors the modal's preview pattern (always-mounted portal, opacity-0
  // until hover; ref-driven transforms instead of state-per-mousemove).
  const [hoveredRowFlavor, setHoveredRowFlavor] = useState<{
    name: string;
    flavor: HopFlavorProfile;
  } | null>(null);
  const rowPreviewRef = useRef<HTMLDivElement | null>(null);
  const rowLastClientXRef = useRef<number | null>(null);
  const rowRestTimerRef = useRef<number | null>(null);

  const applyRowPreviewTransform = useCallback(
    (clientX: number, clientY: number, rotation: number) => {
      const t = rowPreviewRef.current;
      if (!t) return;
      const PREVIEW_W = 200;
      const OFFSET = 18;
      const willClipRight =
        typeof window !== "undefined" &&
        clientX + OFFSET + PREVIEW_W > window.innerWidth - 12;
      const x = willClipRight ? clientX - OFFSET - PREVIEW_W : clientX + OFFSET;
      const PREVIEW_HALF_H = 120;
      const minY = PREVIEW_HALF_H + 6;
      const maxY =
        typeof window !== "undefined"
          ? window.innerHeight - PREVIEW_HALF_H - 6
          : clientY;
      const y = Math.max(minY, Math.min(maxY, clientY));
      t.style.transform = `translate(${x}px, ${y}px) translateY(-50%) rotate(${rotation}deg)`;
    },
    []
  );

  const onRowCursorMove = useCallback(
    (e: React.MouseEvent) => {
      const t = rowPreviewRef.current;
      if (!t) return;
      const last = rowLastClientXRef.current;
      const isFirstMove = last === null;
      const dx = last !== null ? e.clientX - last : 0;
      rowLastClientXRef.current = e.clientX;
      const rotation = isFirstMove ? 0 : Math.max(-12, Math.min(12, -dx * 0.4));

      if (isFirstMove) {
        t.style.transition = "none";
        applyRowPreviewTransform(e.clientX, e.clientY, 0);
        void t.offsetHeight;
        t.style.transition = "opacity 140ms ease, transform 90ms ease-out";
      } else {
        applyRowPreviewTransform(e.clientX, e.clientY, rotation);
      }
      t.style.opacity = "1";
      if (rowRestTimerRef.current !== null)
        window.clearTimeout(rowRestTimerRef.current);
      const rx = e.clientX;
      const ry = e.clientY;
      rowRestTimerRef.current = window.setTimeout(
        () => applyRowPreviewTransform(rx, ry, 0),
        120
      );
    },
    [applyRowPreviewTransform]
  );

  const onRowCursorLeave = useCallback(() => {
    const t = rowPreviewRef.current;
    if (t) t.style.opacity = "0";
    setHoveredRowFlavor(null);
    rowLastClientXRef.current = null;
    if (rowRestTimerRef.current !== null) {
      window.clearTimeout(rowRestTimerRef.current);
      rowRestTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    loadHopPresets();
  }, [loadHopPresets]);

  const hops = useMemo(
    () => currentRecipe?.hops ?? [],
    [currentRecipe?.hops]
  );

  const totalGrams = hops.reduce((sum, h) => sum + h.grams, 0);

  const handleSelectPreset = (preset: HopPreset) => {
    const flavor =
      preset.flavor ?? hopEnrichmentService.getFlavorByName(preset.name);
    if (editingId) {
      updateHop(editingId, {
        name: preset.name,
        alphaAcid: preset.alphaAcidPercent,
        flavor,
      });
    } else {
      const next: Hop = {
        id: uid(),
        name: preset.name,
        alphaAcid: preset.alphaAcidPercent,
        grams: 28,
        type: "boil",
        timeMinutes: 60,
        flavor,
      };
      addHop(next);
    }
    setEditingId(null);
    setIsPickerOpen(false);
  };

  const handleSwapHop = (id: string) => {
    setEditingId(id);
    setIsPickerOpen(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setIsPickerOpen(true);
  };

  const handleSaveCustomPreset = (preset: HopPreset) => {
    saveHopPreset(preset);
    toast.success(`"${preset.name}" saved — select it from the list to add`);
  };

  const handleChangeUsage = (id: string, next: Usage) => {
    const defaults = defaultsForUsage(next);
    // Clear stale fields from the prior usage before applying new defaults.
    const cleared: Partial<Hop> = {
      timeMinutes: undefined,
      temperatureC: undefined,
      whirlpoolTimeMinutes: undefined,
      dryHopStartDay: undefined,
      dryHopDays: undefined,
    };
    updateHop(id, { ...cleared, ...defaults });
  };

  return (
    <section className="hs-hops-section" style={sectionFrameStyle}>
      <HopSectionStyles />

      <SectionTitle />

      {hops.length === 0 ? (
        <EmptyState onAdd={handleAddNew} />
      ) : (
        <div className="hs-hops-grid">
          <div className="hs-hops-grid-lhead">
            <LedgerHeaderRow
              entryCount={hops.length}
              ibu={calculations?.ibu ?? 0}
              onAdd={handleAddNew}
            />
          </div>

          <div className="hs-hops-grid-ltable">
            <Ledger
              hops={hops}
              totalGrams={totalGrams}
              og={calculations?.og ?? 1.05}
              batchVolumeGal={(currentRecipe?.batchVolumeL ?? 20) * 0.264172}
              onGramsChange={(id, v) =>
                updateHop(id, { grams: Math.max(0, v) })
              }
              onTimeMinutesChange={(id, v) =>
                updateHop(id, { timeMinutes: Math.max(0, v) })
              }
              onTemperatureChange={(id, v) =>
                updateHop(id, {
                  temperatureC: Math.max(0, Math.min(100, v)),
                })
              }
              onWhirlpoolTimeChange={(id, v) =>
                updateHop(id, { whirlpoolTimeMinutes: Math.max(0, v) })
              }
              onDryHopDaysChange={(id, v) =>
                updateHop(id, { dryHopDays: Math.max(0, v) })
              }
              onDryHopStartDayChange={(id, v) =>
                updateHop(id, { dryHopStartDay: Math.max(0, v) })
              }
              onSwap={handleSwapHop}
              onUsageChange={handleChangeUsage}
              onRemove={removeHop}
              onAdd={handleAddNew}
              onRowHoverStart={(name, flavor) =>
                setHoveredRowFlavor({ name, flavor })
              }
              onRowCursorMove={onRowCursorMove}
              onRowHoverEnd={onRowCursorLeave}
            />
          </div>

        </div>
      )}

      <HopPresetModal
        isOpen={isPickerOpen}
        editing={Boolean(editingId)}
        onClose={() => {
          setIsPickerOpen(false);
          setEditingId(null);
        }}
        onSelect={handleSelectPreset}
        onCreateCustom={() => setIsCustomOpen(true)}
        presetsGrouped={hopPresetsGrouped}
        isLoading={presetsLoading}
      />

      <CustomHopModal
        isOpen={isCustomOpen}
        onClose={() => setIsCustomOpen(false)}
        onSave={handleSaveCustomPreset}
      />

      {typeof document !== "undefined"
        ? createPortal(
            // Always-mounted cursor-follow preview wrapper. Imperative
            // transform updates (no setState per mousemove) keep the row
            // scroll buttery smooth on mouse-over.
            <div
              className="hs-theme"
              ref={rowPreviewRef}
              role="tooltip"
              aria-hidden={hoveredRowFlavor === null}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: 200,
                zIndex: 1000,
                pointerEvents: "none",
                opacity: 0,
                transition: "opacity 140ms ease, transform 90ms ease-out",
                background: "#f8f3dc",
                backgroundColor: "var(--hs-paper, #f8f3dc)",
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 10,
                boxShadow: hsTokens.sh3,
                padding: 12,
              }}
            >
              {hoveredRowFlavor ? (
                <RowHoverPreviewBody
                  name={hoveredRowFlavor.name}
                  flavor={hoveredRowFlavor.flavor}
                />
              ) : null}
            </div>,
            document.body
          )
        : null}
    </section>
  );
}

/** Header + mini radar shown inside the row's cursor-follow preview. */
function RowHoverPreviewBody({
  name,
  flavor,
}: {
  name: string;
  flavor: HopFlavorProfile;
}) {
  // Same dominant-axis tint as RowMiniRadar so the polygon color matches
  // the row's leftmost glyph.
  let bestKey: (typeof HOP_FLAVOR_KEYS)[number] = HOP_FLAVOR_KEYS[0];
  let bestV = -1;
  for (const k of HOP_FLAVOR_KEYS) {
    const v = flavor[k] ?? 0;
    if (v > bestV) {
      bestV = v;
      bestKey = k;
    }
  }
  const accentColor = HOP_FLAVOR_COLOR[bestKey] ?? hsTokens.hops;
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: `1px solid ${hsTokens.ink}22`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: accentColor,
            border: `1px solid ${hsTokens.ink}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 13,
            color: hsTokens.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
      </div>
      <RowHoverMiniRadar flavor={flavor} color={accentColor} />
    </>
  );
}

/** Larger version of RowMiniRadar with axis labels — shown in the hover
 *  preview. Single-flavor 9-axis polygon at ~170px, no interactions. */
function RowHoverMiniRadar({
  flavor,
  color,
}: {
  flavor: HopFlavorProfile;
  color: string;
}) {
  const size = 170;
  const pad = 26;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;
  const max = 5;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const labelAt = (i: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = radius + 10;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");
  const polyPoints = HOP_FLAVOR_KEYS.map((k, i) =>
    pointAt(i, flavor[k] ?? 0).join(",")
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", margin: "0 auto" }}
      aria-hidden
    >
      {[0.5, 1].map((m) => (
        <polygon
          key={m}
          points={ringPoints(m)}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.4}
          opacity={m === 1 ? 0.3 : 0.18}
        />
      ))}
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [x, y] = pointAt(i, max);
        return (
          <line
            key={k}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--hs-ink)"
            strokeWidth={0.25}
            opacity={0.2}
          />
        );
      })}
      <polygon
        points={polyPoints}
        fill={color}
        fillOpacity={0.32}
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [lx, ly] = labelAt(i);
        return (
          <text
            key={`label-${k}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 7,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fill: HOP_FLAVOR_COLOR[k] ?? hsTokens.muted,
            }}
          >
            {HOP_FLAVOR_LABEL[k]?.split(" ")[0] ?? k}
          </text>
        );
      })}
    </svg>
  );
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

// ─── Section title (kicker + h2 + hops rule, no controls) ────────

function SectionTitle() {
  return (
    <header
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${hsTokens.hops}`,
      }}
    >
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
        Hops.
      </h2>
    </header>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "44px 18px",
        background: hsTokens.cream2,
        border: `1.5px dashed ${hsTokens.ink}`,
        borderRadius: 14,
        textAlign: "center",
      }}
    >
      <HSScriptNote color={hsTokens.hops} size={20} rotate={-3}>
        empty bill —
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 14,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 380,
          lineHeight: 1.4,
        }}
      >
        Bitterness, aroma, dry-hop punch — pick the varieties that shape your
        beer and the section will fill in IBU + flavor live.
      </p>
      <HSButton onClick={onAdd} color={hsTokens.hops} size="md">
        + Add your first hop
      </HSButton>
    </div>
  );
}

// ─── Ledger header row ────────────────────────────────────────────

function LedgerHeaderRow({
  entryCount,
  ibu,
  onAdd,
}: {
  entryCount: number;
  ibu: number;
  onAdd: () => void;
}) {
  return (
    <div
      className="hs-hops-ledger-head"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 2,
      }}
    >
      <Eyebrow size={11}>The hop bill</Eyebrow>
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
      <IbuPill value={ibu} />
      <HSButton onClick={onAdd} color={hsTokens.hops} size="sm">
        + Add hop
      </HSButton>
    </div>
  );
}

function IbuPill({ value }: { value: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
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
        IBU
      </span>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 17,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        {Math.round(value)}
      </span>
    </span>
  );
}

// ─── Ledger ───────────────────────────────────────────────────────

/** Column layout: [mini radar | name+caption | use | time | weight | IBU | ×]. */
const LEDGER_COLS = "52px minmax(0, 1.3fr) 116px 128px 88px 64px 32px";

/** Darker, slightly tinted background applied to the IBU column so it
 *  reads as a "summary readout" column distinct from the editable cells. */
// Section-tinted IBU column background — ink-on-paper base + ~4% hops tint.
const IBU_CELL_BG =
  "color-mix(in srgb, color-mix(in srgb, var(--hs-ink) 5%, var(--hs-paper)) 96%, var(--hs-hops))";

function Ledger({
  hops,
  totalGrams,
  og,
  batchVolumeGal,
  onGramsChange,
  onTimeMinutesChange,
  onTemperatureChange,
  onWhirlpoolTimeChange,
  onDryHopDaysChange,
  onDryHopStartDayChange,
  onSwap,
  onUsageChange,
  onRemove,
  onAdd,
  onRowHoverStart,
  onRowCursorMove,
  onRowHoverEnd,
}: {
  hops: Hop[];
  totalGrams: number;
  og: number;
  batchVolumeGal: number;
  onGramsChange: (id: string, v: number) => void;
  onTimeMinutesChange: (id: string, v: number) => void;
  onTemperatureChange: (id: string, v: number) => void;
  onWhirlpoolTimeChange: (id: string, v: number) => void;
  onDryHopDaysChange: (id: string, v: number) => void;
  onDryHopStartDayChange: (id: string, v: number) => void;
  onSwap: (id: string) => void;
  onUsageChange: (id: string, next: Usage) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onRowHoverStart: (name: string, flavor: HopFlavorProfile) => void;
  onRowCursorMove: (e: React.MouseEvent) => void;
  onRowHoverEnd: () => void;
}) {
  return (
    <>
      <div
        className="hs-hops-ledger"
        style={{
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 14,
          boxShadow: hsTokens.sh3,
          overflow: "hidden",
        }}
      >
        <LedgerHead />
        {(() => {
          let totalIbu = 0;
          const rows = hops.map((h, i) => {
            const ibuContribution =
              recipeCalculationService.calculateSingleHopIBU(h, og, batchVolumeGal);
            totalIbu += ibuContribution;
            return (
              <LedgerRowMotion key={h.id}>
                <LedgerRow
                  hop={h}
                  ibuContribution={ibuContribution}
                  isLast={i === hops.length - 1}
                  onGramsChange={(v) => onGramsChange(h.id, v)}
                  onTimeMinutesChange={(v) => onTimeMinutesChange(h.id, v)}
                  onTemperatureChange={(v) => onTemperatureChange(h.id, v)}
                  onWhirlpoolTimeChange={(v) => onWhirlpoolTimeChange(h.id, v)}
                  onDryHopDaysChange={(v) => onDryHopDaysChange(h.id, v)}
                  onDryHopStartDayChange={(v) =>
                    onDryHopStartDayChange(h.id, v)
                  }
                  onSwap={() => onSwap(h.id)}
                  onUsageChange={(next) => onUsageChange(h.id, next)}
                  onRemove={() => onRemove(h.id)}
                  onRowHoverStart={onRowHoverStart}
                  onRowCursorMove={onRowCursorMove}
                  onRowHoverEnd={onRowHoverEnd}
                />
              </LedgerRowMotion>
            );
          });
          return (
            <>
              <LedgerRowsAnimated>{rows}</LedgerRowsAnimated>
              <LedgerTotal
                totalGrams={totalGrams}
                totalIbu={totalIbu}
                entries={hops.length}
              />
            </>
          );
        })()}
      </div>
      <MobileAddRow onAdd={onAdd} />
    </>
  );
}

function LedgerHead() {
  return (
    <div
      className="hs-hops-ledger-row hs-hops-ledger-head-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "10px 14px 10px 18px",
        // Section-tinted ledger head: ~7% hops-green mixed into cream so each
        // section's main table band feels distinct while staying in harmony.
        background: "color-mix(in srgb, var(--hs-cream) 96%, var(--hs-hops))",
        borderBottom: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 12,
      }}
    >
      <Eyebrow size={9} style={{ display: "block", textAlign: "center" }}>
        Flavor
      </Eyebrow>
      <Eyebrow size={10}>
        Hop
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
      <Eyebrow size={10} style={{ display: "block", textAlign: "center" }}>
        Use
      </Eyebrow>
      <Eyebrow size={10} style={{ display: "block", textAlign: "center" }}>
        Time
      </Eyebrow>
      <Eyebrow
        size={10}
        style={{ display: "block", textAlign: "center", paddingRight: 28 }}
      >
        Weight
      </Eyebrow>
      {/* Wrapper div carries the IBU bg + alignSelf stretch so the colored
          band fills the head's full vertical extent (matching the data + total
          rows). Negative horizontal margins consume the full column gap on
          each side. */}
      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: IBU_CELL_BG,
          padding: "10px 12px",
          margin: "-10px -12px",
        }}
      >
        <Eyebrow size={10} style={{ letterSpacing: "0.18em" }}>
          IBU
        </Eyebrow>
      </div>
      <span />
    </div>
  );
}

function LedgerRow({
  hop,
  ibuContribution,
  isLast,
  onGramsChange,
  onTimeMinutesChange,
  onTemperatureChange,
  onWhirlpoolTimeChange,
  onDryHopDaysChange,
  onDryHopStartDayChange,
  onSwap,
  onUsageChange,
  onRemove,
  onRowHoverStart,
  onRowCursorMove,
  onRowHoverEnd,
}: {
  hop: Hop;
  ibuContribution: number;
  isLast: boolean;
  onGramsChange: (v: number) => void;
  onTimeMinutesChange: (v: number) => void;
  onTemperatureChange: (v: number) => void;
  onWhirlpoolTimeChange: (v: number) => void;
  onDryHopDaysChange: (v: number) => void;
  onDryHopStartDayChange: (v: number) => void;
  onSwap: () => void;
  onUsageChange: (next: Usage) => void;
  onRemove: () => void;
  onRowHoverStart: (name: string, flavor: HopFlavorProfile) => void;
  onRowCursorMove: (e: React.MouseEvent) => void;
  onRowHoverEnd: () => void;
}) {
  const purpose = purposeOf(hop.alphaAcid);
  const hopFlavor =
    hop.flavor ?? hopEnrichmentService.getFlavorByName(hop.name) ?? null;
  return (
    <div
      className="hs-hops-ledger-row hs-hops-data-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 14px 14px 18px",
        borderBottom: isLast ? "none" : `1px solid ${hsTokens.ink}22`,
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Per-hop mini flavor radar — replaces the colored use-badge.
          Hover triggers a cursor-follow preview that mirrors the modal
          preset preview (large radar + name header). */}
      <div
        className="hs-hops-radar-cell"
        style={{ display: "flex", justifyContent: "center" }}
      >
        <RowMiniRadar
          flavor={hopFlavor}
          hopName={hop.name}
          onHoverStart={onRowHoverStart}
          onCursorMove={onRowCursorMove}
          onHoverEnd={onRowHoverEnd}
        />
      </div>

      {/* Hop name — click to swap */}
      <button
        type="button"
        className="hs-hops-name-btn"
        onClick={onSwap}
        aria-label={`Swap ${hop.name}`}
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
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
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
              className="hs-hops-name"
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
              title={hop.name}
            >
              {hop.name}
            </span>
            <PurposePill purpose={purpose} />
          </div>
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 14,
              color: hsTokens.muted,
              transform: "rotate(-1deg)",
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {hop.alphaAcid.toFixed(1)}% AA
          </span>
        </div>
      </button>

      {/* Use selector — styled pill with portal'd menu. */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <UsageSelect usage={hop.type} onChange={onUsageChange} />
      </div>

      {/* Timing — varies by usage type */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <TimingCell
          hop={hop}
          onTimeMinutesChange={onTimeMinutesChange}
          onTemperatureChange={onTemperatureChange}
          onWhirlpoolTimeChange={onWhirlpoolTimeChange}
          onDryHopDaysChange={onDryHopDaysChange}
          onDryHopStartDayChange={onDryHopStartDayChange}
        />
      </div>

      {/* Weight (always editable) */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={hop.grams}
          step={1}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="g"
          ariaLabel="Hop weight in grams"
          onCommit={onGramsChange}
        />
      </div>

      {/* IBU contribution — skinny darker readout cell. Negative horizontal
          margins (-12px each side) consume the full row column-gap so the
          tinted bg meets the Weight cell's right edge and the Actions cell's
          left edge. alignSelf stretch + the negative vertical margin makes
          the cell fill the row's full height (overriding the row's
          align-items: center which would otherwise center-shrink the cell). */}
      <div
        className="hs-hops-ibu-cell"
        style={{
          alignSelf: "stretch",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: IBU_CELL_BG,
          padding: "14px 12px",
          margin: "-14px -12px",
        }}
        title={`Estimated IBU contribution from this addition`}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 18,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            color: ibuContribution > 0.05 ? hsTokens.ink : hsTokens.muted,
            lineHeight: 1,
          }}
        >
          {ibuContribution > 0.05 ? ibuContribution.toFixed(1) : "—"}
        </span>
      </div>

      {/* Remove — ghost × that fades in on row hover. */}
      <button
        type="button"
        className="hs-hops-remove-btn"
        onClick={onRemove}
        aria-label={`Remove ${hop.name}`}
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
  totalGrams,
  totalIbu,
  entries,
}: {
  totalGrams: number;
  totalIbu: number;
  entries: number;
}) {
  return (
    <div
      className="hs-hops-ledger-row hs-hops-total-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 14px 14px 18px",
        // Section-tinted total band — same 7% hops mix as the ledger head.
        background: "color-mix(in srgb, var(--hs-cream-2) 96%, var(--hs-hops))",
        borderTop: `2px solid ${hsTokens.ink}`,
        alignItems: "center",
        gap: 12,
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
        {entries}
      </span>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 16,
          letterSpacing: "-0.01em",
          color: hsTokens.ink,
        }}
      >
        Total hops
      </span>
      <span />
      <span />
      <div style={{ display: "flex", justifyContent: "center" }}>
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
            {totalGrams.toFixed(0)}
          </span>
          <span
            style={{
              fontFamily: hsTokens.mono,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            g
          </span>
        </span>
      </div>
      <div
        className="hs-hops-ibu-cell"
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Section-tinted darker stripe: ~4% hops layered onto the ink-on-cream2
          // base so the column reads as "this section's read-only column".
          background: "color-mix(in srgb, color-mix(in srgb, var(--hs-ink) 9%, var(--hs-cream-2)) 96%, var(--hs-hops))",
          padding: "14px 12px",
          margin: "-14px -12px",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.display,
            fontSize: 20,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "-0.01em",
            color: hsTokens.ink,
          }}
        >
          {totalIbu.toFixed(0)}
        </span>
      </div>
      <span />
    </div>
  );
}

// ─── Usage select (pill dropdown) ────────────────────────────────

/** Bespoke select-style menu (not HSActionMenu) — the shared primitive uses
 *  position: absolute which gets clipped by the ledger's overflow: hidden.
 *  This variant portals the panel to document.body and positions via fixed
 *  coords from the trigger's getBoundingClientRect. Renders as a normal
 *  dropdown pill (colored dot + label + caret), not a colored square. */
function UsageSelect({
  usage,
  onChange,
}: {
  usage: Usage;
  onChange: (next: Usage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const color = USAGE_COLOR[usage];

  // Open: compute fixed coords from the trigger rect.
  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 6, left: rect.left });
    setOpen(true);
  };

  // Outside click + ESC + scroll-close.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onScrollOrResize = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCoords({ top: rect.bottom + 6, left: rect.left });
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Change use (currently ${USAGE_LABEL[usage]})`}
        title={`Use: ${USAGE_LABEL[usage]}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px 6px 10px",
          background: hsTokens.cream2,
          color: hsTokens.ink,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 999,
          boxShadow: hsTokens.sh1,
          cursor: "pointer",
          minWidth: 100,
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: color,
              border: `1.5px solid ${hsTokens.ink}`,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 12,
              fontWeight: 600,
              color: hsTokens.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {USAGE_LABEL[usage]}
          </span>
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ color: hsTokens.muted, flexShrink: 0 }}
        >
          <path d="M1 1 5 5 9 1" />
        </svg>
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            // .hs-theme wrapper ensures CSS custom properties (var(--hs-paper)
            // etc.) cascade into the portal. Without it, the panel can render
            // with no background when the theme class lives deeper in the tree
            // than the portal target. Literal hex fallback on the bg as a
            // belt-and-braces guard.
            <div
              className="hs-theme"
              ref={panelRef}
              role="menu"
              aria-label="Change hop use"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                minWidth: 168,
                background: "#f8f3dc",
                backgroundColor: "var(--hs-paper, #f8f3dc)",
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 8,
                boxShadow: hsTokens.sh2,
                zIndex: 200,
                overflow: "hidden",
                fontFamily: hsTokens.body,
              }}
            >
              {USAGE_ORDER.map((u) => {
                const active = u === usage;
                return (
                  <button
                    key={u}
                    type="button"
                    role="menuitem"
                    disabled={active}
                    onClick={() => {
                      if (!active) onChange(u);
                      setOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (active) return;
                      e.currentTarget.style.background = hsTokens.cream2;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 14px",
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      background: "transparent",
                      color: hsTokens.ink,
                      border: "none",
                      cursor: active ? "default" : "pointer",
                      opacity: active ? 0.55 : 1,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: USAGE_COLOR[u],
                        border: `1.5px solid ${hsTokens.ink}`,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1 }}>{USAGE_LABEL[u]}</span>
                    {active ? (
                      <span
                        style={{
                          fontFamily: hsTokens.mono,
                          fontSize: 9,
                          color: hsTokens.muted,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        current
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

// ─── Per-row mini hop flavor radar ────────────────────────────────

/** Tiny inline SVG (~44px) showing THIS hop's flavor polygon. Replaces the
 *  colored use-square as the leftmost column. Hovering it shows a larger
 *  cursor-follow flavor preview (mirroring the modal's preset preview). */
function RowMiniRadar({
  flavor,
  hopName,
  onHoverStart,
  onCursorMove,
  onHoverEnd,
}: {
  flavor: HopFlavorProfile | null;
  hopName: string;
  onHoverStart?: (name: string, flavor: HopFlavorProfile) => void;
  onCursorMove?: (e: React.MouseEvent) => void;
  onHoverEnd?: () => void;
}) {
  const size = 44;
  const pad = 4;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;

  // Wrap the SVG in a button so it's hoverable AND keyboard-focusable.
  // Bare-bones styling — no background, no border, just a hit area.
  const hoverHandlers = flavor
    ? {
        onMouseEnter: (e: React.MouseEvent) => {
          onHoverStart?.(hopName, flavor);
          onCursorMove?.(e);
        },
        onMouseMove: (e: React.MouseEvent) => onCursorMove?.(e),
        onMouseLeave: () => onHoverEnd?.(),
      }
    : {};

  if (!flavor) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        focusable="false"
      >
        <title>No flavor data</title>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
          opacity={0.35}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fontFamily: hsTokens.script,
            fontSize: 14,
            fill: hsTokens.muted,
          }}
        >
          ?
        </text>
      </svg>
    );
  }

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / 5) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const ringPoints = HOP_FLAVOR_KEYS.map((_, i) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
  const polyPoints = HOP_FLAVOR_KEYS.map((k, i) =>
    pointAt(i, flavor[k] ?? 0).join(",")
  ).join(" ");

  let bestKey: (typeof HOP_FLAVOR_KEYS)[number] = HOP_FLAVOR_KEYS[0];
  let bestV = -1;
  for (const k of HOP_FLAVOR_KEYS) {
    const v = flavor[k] ?? 0;
    if (v > bestV) {
      bestV = v;
      bestKey = k;
    }
  }
  const color = HOP_FLAVOR_COLOR[bestKey] ?? hsTokens.hops;

  return (
    <button
      type="button"
      aria-label={`${hopName} flavor profile`}
      {...hoverHandlers}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        margin: 0,
        cursor: "default",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        lineHeight: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        focusable="false"
      >
        <polygon
          points={ringPoints}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.5}
          opacity={0.25}
        />
        <polygon
          points={polyPoints}
          fill={color}
          fillOpacity={0.32}
          stroke={color}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// ─── Timing cell (per-row, shapeshifts by usage type) ─────────────

function TimingCell({
  hop,
  onTimeMinutesChange,
  onTemperatureChange,
  onWhirlpoolTimeChange,
  onDryHopDaysChange,
  onDryHopStartDayChange,
}: {
  hop: Hop;
  onTimeMinutesChange: (v: number) => void;
  onTemperatureChange: (v: number) => void;
  onWhirlpoolTimeChange: (v: number) => void;
  onDryHopDaysChange: (v: number) => void;
  onDryHopStartDayChange: (v: number) => void;
}) {
  if (hop.type === "boil") {
    return (
      <EditableCell
        value={hop.timeMinutes ?? 0}
        step={5}
        min={0}
        precision={0}
        format={(v) => v.toFixed(0)}
        suffix="min"
        ariaLabel="Boil time in minutes"
        onCommit={onTimeMinutesChange}
      />
    );
  }
  if (hop.type === "whirlpool") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          alignItems: "flex-start",
        }}
      >
        <EditableCell
          value={hop.whirlpoolTimeMinutes ?? 15}
          step={5}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="min"
          ariaLabel="Whirlpool time in minutes"
          onCommit={onWhirlpoolTimeChange}
          compact
        />
        <EditableCell
          value={hop.temperatureC ?? 80}
          step={5}
          min={40}
          max={100}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="°C"
          ariaLabel="Whirlpool temperature"
          onCommit={onTemperatureChange}
          compact
          muted
        />
      </div>
    );
  }
  if (hop.type === "dry hop") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          alignItems: "flex-start",
        }}
      >
        <EditableCell
          value={hop.dryHopDays ?? 3}
          step={1}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="days"
          ariaLabel="Dry hop duration in days"
          onCommit={onDryHopDaysChange}
          compact
        />
        <EditableCell
          value={hop.dryHopStartDay ?? 0}
          step={1}
          min={0}
          precision={0}
          format={(v) => v.toFixed(0)}
          suffix="day in"
          ariaLabel="Dry hop start day"
          onCommit={onDryHopStartDayChange}
          compact
          muted
        />
      </div>
    );
  }
  // first wort or mash — no timing
  return (
    <span
      style={{
        fontFamily: hsTokens.script,
        fontSize: 17,
        color: hsTokens.muted,
        transform: "rotate(-1deg)",
        display: "inline-block",
        opacity: 0.85,
      }}
      title={
        hop.type === "first wort"
          ? "Added before boil — no timing"
          : "Added to mash — no timing"
      }
    >
      no timing
    </span>
  );
}

// ─── Purpose pill (aroma / dual / bittering) ──────────────────────

function PurposePill({
  purpose,
}: {
  purpose: "aroma" | "dual" | "bittering";
}) {
  const color =
    purpose === "aroma"
      ? hsTokens.honey
      : purpose === "dual"
        ? hsTokens.hops
        : "#3a6e30";
  const dark = purpose === "bittering";
  const label =
    purpose === "aroma" ? "Aroma" : purpose === "dual" ? "Dual" : "Bittering";
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
        background: color,
        color: dark ? hsTokens.cream : hsTokens.ink,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        whiteSpace: "nowrap",
        lineHeight: 1.1,
        flexShrink: 0,
      }}
    >
      {label}
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
  compact,
  muted,
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
  compact?: boolean;
  muted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const valueFontSize = compact ? (muted ? 18 : 22) : 30;
  const editFontSize = compact ? 22 : 28;

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
          border: `1.5px solid ${hsTokens.hops}`,
          outline: "none",
          fontFamily: hsTokens.script,
          fontWeight: 500,
          fontSize: editFontSize,
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
        className="hs-hops-edit-btn"
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
            fontSize: valueFontSize,
            lineHeight: 1.05,
            color: muted ? hsTokens.muted : hsTokens.ink,
            opacity: muted ? 0.92 : 1,
          }}
        >
          {format(value)}
        </span>
        {suffix ? (
          <span
            style={{
              fontFamily: hsTokens.mono,
              fontSize: compact ? 10 : 11,
              color: hsTokens.muted,
            }}
          >
            {suffix}
          </span>
        ) : null}
      </button>
      <HoverSteppers
        visible={hovered}
        compact={compact}
        onUp={() => nudge(1)}
        onDown={() => nudge(-1)}
      />
    </div>
  );
}

// ─── Hover steppers ───────────────────────────────────────────────

function HoverSteppers({
  visible,
  compact,
  onUp,
  onDown,
}: {
  visible: boolean;
  compact?: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div
      className="hs-hops-steppers"
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
      <StepperBtn onClick={onUp} direction="up" label="Increase" compact={compact} />
      <StepperBtn onClick={onDown} direction="down" label="Decrease" compact={compact} />
    </div>
  );
}

function StepperBtn({
  onClick,
  direction,
  label,
  compact,
}: {
  onClick: () => void;
  direction: "up" | "down";
  label: string;
  compact?: boolean;
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
        width: compact ? 14 : 16,
        height: compact ? 12 : 14,
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
        e.currentTarget.style.background = hsTokens.hops;
        e.currentTarget.style.color = hsTokens.cream;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.muted;
      }}
    >
      <svg
        width={compact ? 8 : 10}
        height={compact ? 5 : 6}
        viewBox="0 0 10 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "up" ? <path d="M1 5 5 1 9 5" /> : <path d="M1 1 5 5 9 1" />}
      </svg>
    </button>
  );
}

// ─── Hop flavor radar card (sidebar visualizer) ───────────────────

const HOP_FLAVOR_LABEL: Record<string, string> = {
  citrus: "Citrus",
  tropicalFruit: "Tropical",
  stoneFruit: "Stone fruit",
  berry: "Berry",
  floral: "Floral",
  grassy: "Grassy",
  herbal: "Herbal",
  spice: "Spice",
  resinPine: "Pine",
};

const HOP_FLAVOR_COLOR: Record<string, string> = {
  citrus: "#facc15",
  tropicalFruit: "#fb923c",
  stoneFruit: "#f97316",
  berry: "#a855f7",
  floral: "#f472b6",
  grassy: "#84cc16",
  herbal: "#22c55e",
  spice: "#ef4444",
  resinPine: "#16a34a",
};

/** Distinct palette for individual hop polygons (cycled by index). Chosen
 *  to read against the cream-2 card background and stay visually separable
 *  when 4-6 hops overlap. */
const HOP_SERIES_PALETTE = [
  "#2b6fb8", // water blue
  "#d4452c", // roast red
  "#ee7755", // yeast peach
  "#a855f7", // berry purple
  "#facc15", // citrus yellow
  "#0e7f7a", // teal
];

type RadarMode = "estimated" | "individual" | "both";

interface HopSeries {
  /** Stable id (hop.id for individual entries, "__estimated__" for aggregate). */
  id: string;
  name: string;
  flavor: HopFlavorProfile;
  grams?: number;
  color: string;
  isEstimated: boolean;
}

function HopFlavorRadarCard({
  hops,
  batchVolumeL,
}: {
  hops: Hop[];
  batchVolumeL: number;
}) {
  const [mode, setMode] = useState<RadarMode>("estimated");
  const [hoveredSeriesId, setHoveredSeriesId] = useState<string | null>(null);

  const flavorByName = useMemo(() => {
    const map = new Map<string, HopFlavorProfile>();
    for (const h of hops) {
      const fromInline = h.flavor;
      const fromEnrich = hopEnrichmentService.getFlavorByName(h.name);
      const flavor = fromInline ?? fromEnrich;
      if (flavor) map.set(h.name, flavor);
    }
    return map;
  }, [hops]);

  const aggregateFlavor = useMemo(() => {
    if (flavorByName.size === 0) return null;
    return hopFlavorCalculationService.calculateCombinedFlavor(
      hops,
      flavorByName,
      batchVolumeL
    );
  }, [hops, flavorByName, batchVolumeL]);

  /** Individual hop series — one per UNIQUE variety with flavor data, in
   *  first-seen order. Grams sum across all additions of the same hop so
   *  the legend reads "Citra 49g" not "Citra · Citra · Citra". */
  const individualSeries = useMemo<HopSeries[]>(() => {
    const byName = new Map<
      string,
      { flavor: HopFlavorProfile; totalGrams: number; firstId: string }
    >();
    for (const h of hops) {
      const flavor = flavorByName.get(h.name);
      if (!flavor) continue;
      const existing = byName.get(h.name);
      if (existing) {
        existing.totalGrams += h.grams;
      } else {
        byName.set(h.name, {
          flavor,
          totalGrams: h.grams,
          firstId: h.id,
        });
      }
    }
    const out: HopSeries[] = [];
    let i = 0;
    for (const [name, info] of byName.entries()) {
      out.push({
        id: info.firstId,
        name,
        flavor: info.flavor,
        grams: info.totalGrams,
        color: HOP_SERIES_PALETTE[i % HOP_SERIES_PALETTE.length],
        isEstimated: false,
      });
      i += 1;
    }
    return out;
  }, [hops, flavorByName]);

  const estimatedSeries = useMemo<HopSeries | null>(() => {
    if (!aggregateFlavor) return null;
    return {
      id: "__estimated__",
      name: "Estimated",
      flavor: aggregateFlavor,
      color: hsTokens.hops,
      isEstimated: true,
    };
  }, [aggregateFlavor]);

  // Active series for the current mode. The render layer reads strokes/fills
  // off each series to layer multiple polygons cleanly.
  const activeSeries = useMemo<HopSeries[]>(() => {
    if (!estimatedSeries) return [];
    if (mode === "estimated") return [estimatedSeries];
    if (mode === "individual") return individualSeries;
    // "both": estimated last so it draws ON TOP of individuals (heavier stroke).
    return [...individualSeries, estimatedSeries];
  }, [mode, estimatedSeries, individualSeries]);

  // Dominant contributor per axis (for the hover tooltip).
  const dominantPerAxis = useMemo(() => {
    const out: Record<string, { name: string; value: number } | null> = {};
    for (const k of HOP_FLAVOR_KEYS) out[k] = null;
    if (flavorByName.size === 0) return out;
    for (const h of hops) {
      const profile = flavorByName.get(h.name);
      if (!profile) continue;
      const gpl = batchVolumeL > 0 ? h.grams / batchVolumeL : 0;
      if (gpl <= 0) continue;
      for (const k of HOP_FLAVOR_KEYS) {
        const contrib = (profile[k] ?? 0) * gpl;
        const prior = out[k];
        if (!prior || contrib > prior.value) {
          out[k] = { name: h.name, value: contrib };
        }
      }
    }
    return out;
  }, [hops, flavorByName, batchVolumeL]);

  return (
    <div
      className="hs-hops-radar-card"
      style={{
        // Subtle ingredient tint: ~5% hops-green in the bg AND ~15% mixed
        // into the ink border. Compound signal — neither loud on its own.
        background:
          "color-mix(in srgb, color-mix(in srgb, var(--hs-cream), var(--hs-cream-2)) 95%, var(--hs-hops))",
        border: `2px solid color-mix(in srgb, ${hsTokens.ink} 85%, var(--hs-hops))`,
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
        <Eyebrow size={11}>Flavor profile</Eyebrow>
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
          aroma-weighted
        </span>
        <span aria-hidden style={{ flex: 1 }} />
        {individualSeries.length >= 1 && estimatedSeries ? (
          <RadarModeToggle mode={mode} onChange={setMode} />
        ) : null}
      </div>
      {estimatedSeries ? (
        <>
          <HopFlavorRadarSvg
            series={activeSeries}
            dominantPerAxis={dominantPerAxis}
            mode={mode}
            hoveredSeriesId={hoveredSeriesId}
          />
          <RadarLegend
            mode={mode}
            individualSeries={individualSeries}
            estimatedSeries={estimatedSeries}
            hoveredSeriesId={hoveredSeriesId}
            onHoverSeries={setHoveredSeriesId}
          />
        </>
      ) : (
        <RadarEmpty hops={hops} />
      )}
    </div>
  );
}

/** Segmented toggle (Estimated · All · Both). Mirrors the fermentables
 *  Amount/% ModeToggle shape with a hops-green active state. */
function RadarModeToggle({
  mode,
  onChange,
}: {
  mode: RadarMode;
  onChange: (m: RadarMode) => void;
}) {
  const cellStyle = (active: boolean): CSSProperties => ({
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "4px 9px",
    border: "none",
    background: active ? hsTokens.hops : "transparent",
    color: active ? hsTokens.cream : hsTokens.ink,
    cursor: "pointer",
    transition: "background 120ms ease",
  });
  const opts: Array<{ id: RadarMode; label: string }> = [
    { id: "estimated", label: "Est." },
    { id: "both", label: "Both" },
    { id: "individual", label: "Each" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Radar series mode"
      style={{
        display: "inline-flex",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        overflow: "hidden",
        boxShadow: hsTokens.sh1,
      }}
    >
      {opts.map((o, i) => (
        <span key={o.id} style={{ display: "inline-flex" }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === o.id}
            style={cellStyle(mode === o.id)}
            onClick={() => onChange(o.id)}
          >
            {o.label}
          </button>
          {i < opts.length - 1 ? (
            <span
              aria-hidden
              style={{ width: 1.5, background: hsTokens.ink, alignSelf: "stretch" }}
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}

/** Legend strip below the radar — color swatch + name + grams per series.
 *  Hovering an entry highlights the matching polygon in the radar (bulge +
 *  full opacity) and dims the others. A compact cursor-follow stats card
 *  appears BELOW the cursor (anchored to the cursor's top-center) so it
 *  never covers the radar sitting above the legend. Tilt-on-velocity
 *  plumbing is borrowed from BillStack in FermentableSection. */
function RadarLegend({
  mode,
  individualSeries,
  estimatedSeries,
  hoveredSeriesId,
  onHoverSeries,
}: {
  mode: RadarMode;
  individualSeries: HopSeries[];
  estimatedSeries: HopSeries;
  hoveredSeriesId: string | null;
  onHoverSeries: (id: string | null) => void;
}) {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const entries: HopSeries[] =
    mode === "estimated"
      ? [estimatedSeries]
      : mode === "individual"
        ? individualSeries
        : [estimatedSeries, ...individualSeries];

  const hovered =
    hoveredSeriesId !== null
      ? entries.find((e) => e.id === hoveredSeriesId) ?? null
      : null;

  // Every flavor note present on the hovered series, sorted strongest first.
  // Hop presets store integer 0-5 scores (0 = absent), so `> 0` is the
  // natural "exists" threshold. Combined/estimated profiles may carry
  // tiny fractional residues — anything > 0 still represents a real
  // contribution and shows up on the radar polygon, so we list it too.
  const topNotes = useMemo(() => {
    if (!hovered) return [] as Array<{ k: string; v: number }>;
    return HOP_FLAVOR_KEYS.map((k) => ({
      k,
      v: hovered.flavor[k] ?? 0,
    }))
      .filter((e) => e.v > 0)
      .sort((a, b) => b.v - a.v);
  }, [hovered]);

  // For an "Estimated" hover, grams = sum across all individuals (the
  // estimated series itself doesn't carry grams).
  const totalGrams = useMemo(
    () => individualSeries.reduce((sum, s) => sum + (s.grams ?? 0), 0),
    [individualSeries]
  );
  const hoveredGrams = hovered
    ? hovered.isEstimated
      ? totalGrams
      : hovered.grams ?? 0
    : 0;

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    // Tooltip's top-center anchored 14px below the cursor — keeps the radar
    // above completely unobscured even when the user hovers the topmost
    // legend row.
    t.style.transform = `translate(${clientX}px, ${clientY + 14}px) translate(-50%, 0%) rotate(${rotation}deg)`;
  }

  function onItemMouseMove(e: React.MouseEvent<HTMLElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove ? 0 : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
      // Snap to cursor on first appearance so the card doesn't fly in from
      // the prior resting position (which would otherwise be the viewport
      // origin, since the tooltip is position:fixed at 0,0).
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

  function onWrapperMouseLeave() {
    onHoverSeries(null);
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 10,
        borderTop: `1px solid ${hsTokens.ink}22`,
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 10px",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseLeave={onWrapperMouseLeave}
    >
      {entries.map((s) => {
        const isDimmed = hoveredSeriesId !== null && hoveredSeriesId !== s.id;
        return (
        <span
          key={s.id}
          onMouseEnter={() => onHoverSeries(s.id)}
          onMouseMove={onItemMouseMove}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: hsTokens.body,
            fontSize: 12,
            color: hsTokens.ink,
            lineHeight: 1.1,
            cursor: "pointer",
            opacity: isDimmed ? 0.4 : 1,
            transition: "opacity 180ms ease",
            // Pad the hit area so flicking the cursor along the legend strip
            // catches each entry without pixel-hunting. Vertical padding
            // dominates because the chips are already comfortably wide.
            padding: "8px 6px",
            borderRadius: 6,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 14,
              height: 10,
              borderRadius: 3,
              background: s.color,
              border: `1.5px solid ${hsTokens.ink}`,
              opacity: s.isEstimated ? 0.95 : 0.6,
              flexShrink: 0,
            }}
          />
          <span style={{ fontWeight: s.isEstimated ? 700 : 600 }}>{s.name}</span>
          {s.isEstimated ? null : s.grams !== undefined ? (
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 10,
                color: hsTokens.muted,
              }}
            >
              {s.grams.toFixed(0)}g
            </span>
          ) : null}
        </span>
        );
      })}
      {/* Compact cursor-following stats card for the hovered legend entry.
          Vertically lean (2 short rows) and anchored BELOW the cursor so it
          never blocks the radar above. */}
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
              padding: "8px 12px",
              minWidth: 180,
              maxWidth: 260,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 13,
                  color: hsTokens.ink,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {hovered.name}
                {null}
              </span>
              {hoveredGrams > 0 ? (
                <span
                  style={{
                    fontFamily: hsTokens.mono,
                    fontSize: 11,
                    color: hsTokens.muted,
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {hoveredGrams.toFixed(0)}g
                </span>
              ) : null}
            </div>
            {topNotes.length > 0 ? (
              <div
                style={{
                  marginTop: 5,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "3px 8px",
                  fontFamily: hsTokens.body,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                }}
              >
                {topNotes.map((n) => (
                  <span
                    key={n.k}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background:
                          HOP_FLAVOR_COLOR[n.k] ?? hsTokens.muted,
                        flexShrink: 0,
                      }}
                    />
                    <span>
                      {HOP_FLAVOR_LABEL[n.k]?.split(" ")[0] ?? n.k}
                    </span>
                    <span
                      style={{
                        fontFamily: hsTokens.mono,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0,
                        color: hsTokens.ink,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {n.v.toFixed(1)}
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <div
                style={{
                  marginTop: 5,
                  fontFamily: hsTokens.script,
                  fontSize: 12,
                  color: hsTokens.muted,
                }}
              >
                no standout flavor notes
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RadarEmpty({ hops }: { hops: Hop[] }) {
  return (
    <p
      style={{
        fontFamily: hsTokens.script,
        fontSize: 16,
        color: hsTokens.muted,
        lineHeight: 1.4,
        margin: 0,
        textAlign: "center",
        padding: "32px 8px",
      }}
    >
      {hops.length === 0
        ? "Add a hop with flavor data and the radar will fill in."
        : "These hops don't have flavor data yet — try one from the picker."}
    </p>
  );
}

function HopFlavorRadarSvg({
  series,
  dominantPerAxis,
  mode,
  hoveredSeriesId,
}: {
  series: HopSeries[];
  dominantPerAxis: Record<string, { name: string; value: number } | null>;
  /** Mode is appended to series keys so toggling between estimated/all/both
   *  remounts the visible polygons and replays the bounce-in animation. */
  mode: string;
  /** When non-null, the matching polygon bulges + stays opaque while the
   *  other polygons fade back. Driven by legend hover in the parent. */
  hoveredSeriesId: string | null;
}) {
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const size = 240;
  const max = 5;
  const pad = 32;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const labelPointAt = (i: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = radius + 14;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  /** Polygon points for a given flavor profile (string form for `points` attr). */
  const flavorPolyPoints = (flavor: HopFlavorProfile) =>
    HOP_FLAVOR_KEYS.map((k, i) => pointAt(i, flavor[k] ?? 0).join(","))
      .join(" ");

  /** Vertex coords for the data dots — only rendered for the estimated polygon. */
  const estimatedPoints = useMemo(() => {
    const est = series.find((s) => s.isEstimated);
    if (!est) return [] as Array<readonly [number, number]>;
    return HOP_FLAVOR_KEYS.map((k, i) => pointAt(i, est.flavor[k] ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series]);

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    t.style.transform = `translate(${clientX}px, ${clientY - 14}px) translate(-50%, -100%) rotate(${rotation}deg)`;
  }

  function onAxisMouseMove(e: React.MouseEvent<SVGElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove ? 0 : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
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

  function onAxisMouseLeave() {
    if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
    setHoveredAxis(null);
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  // Tooltip data comes from the estimated series if present, otherwise the
  // sum of selected individuals on the hovered axis.
  const hoveredKey = hoveredAxis as keyof HopFlavorProfile | null;
  const estSeries = series.find((s) => s.isEstimated) ?? null;
  const hoveredValue = hoveredKey
    ? estSeries
      ? estSeries.flavor[hoveredKey] ?? 0
      : series.reduce((acc, s) => acc + (s.flavor[hoveredKey] ?? 0), 0) /
        Math.max(1, series.length)
    : 0;
  const hoveredDom = hoveredKey ? dominantPerAxis[hoveredKey] : null;

  return (
    <>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="auto"
        preserveAspectRatio="xMidYMid meet"
        style={{ maxWidth: size, display: "block", margin: "0 auto" }}
        aria-label="Estimated hop flavor profile"
      >
        {/* Rings + axes wrapped in a single fading group — the group's
            opacity goes 0 → 1, multiplied by each child's natural opacity
            attribute. After animation: group at 1, rings at 0.35/0.2,
            axes at 0.25 — identical to the static pre-animation state. */}
        <g className="hs-hops-radar-grid">
          {[0.25, 0.5, 0.75, 1].map((mult) => (
            <polygon
              key={mult}
              points={ringPoints(mult)}
              fill="none"
              stroke="var(--hs-ink)"
              strokeWidth={0.5}
              opacity={mult === 1 ? 0.35 : 0.2}
            />
          ))}
          {HOP_FLAVOR_KEYS.map((k, i) => {
            const [x, y] = pointAt(i, max);
            return (
              <line
                key={k}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="var(--hs-ink)"
                strokeWidth={0.3}
                opacity={0.25}
              />
            );
          })}
        </g>
        {/* series polygons — individual hops draw first at lower opacity,
            estimated draws last so its heavier stroke sits on top. Each
            series scale-bounces in (staggered 120ms by series index) and
            then subtly breathes via the inner polygon animation. Keyed by
            id so toggling view mode (est/both/each) replays the entrance
            on freshly-mounted series. */}
        {series.map((s, si) => {
          const isHovered = hoveredSeriesId === s.id;
          const isDimmed = hoveredSeriesId !== null && !isHovered;
          return (
            <g
              key={`${mode}-${s.id}`}
              className="hs-hops-radar-series"
              style={{
                animationDelay: `${si * 120}ms`,
                transformOrigin: `${cx}px ${cy}px`,
              }}
            >
              {/* Inner wrapper handles the legend-hover bulge + dim. The
                  entrance animation rides on the OUTER group so the two
                  transforms compose without fighting. */}
              <g
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  transform: isHovered ? "scale(1.07)" : "scale(1)",
                  opacity: isDimmed ? 0.22 : 1,
                  transition:
                    "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
                }}
              >
                <polygon
                  points={flavorPolyPoints(s.flavor)}
                  fill={s.color}
                  fillOpacity={
                    isHovered
                      ? s.isEstimated
                        ? 0.5
                        : 0.36
                      : s.isEstimated
                        ? 0.32
                        : 0.18
                  }
                  stroke={s.color}
                  strokeWidth={
                    isHovered
                      ? s.isEstimated
                        ? 2.4
                        : 1.8
                      : s.isEstimated
                        ? 1.8
                        : 1.2
                  }
                  strokeLinejoin="round"
                  strokeDasharray={s.isEstimated ? undefined : "3 3"}
                  style={{
                    transition:
                      "fill-opacity 200ms ease, stroke-width 200ms ease",
                  }}
                />
              </g>
            </g>
          );
        })}
        {/* Estimated vertex dots — scale-in staggered AFTER the grid + series
            have settled (start at 600ms, 40ms per dot clockwise). The wrapping
            group mirrors the estimated polygon's hover state so the dots ride
            outward with the bulge instead of being orphaned inside the
            scaled polygon. */}
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            transform:
              hoveredSeriesId === "__estimated__" ? "scale(1.07)" : "scale(1)",
            opacity:
              hoveredSeriesId !== null && hoveredSeriesId !== "__estimated__"
                ? 0.22
                : 1,
            transition:
              "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
          }}
        >
          {estimatedPoints.map(([x, y], i) => (
            <circle
              key={i}
              className="hs-hops-radar-dot"
              style={{ animationDelay: `${600 + i * 40}ms` }}
              cx={x}
              cy={y}
              r={2.2}
              fill={hsTokens.hops}
              stroke="var(--hs-ink)"
              strokeWidth={0.5}
            />
          ))}
        </g>
        {/* axis labels + invisible hover hit areas. */}
        {HOP_FLAVOR_KEYS.map((k, i) => {
          const [lx, ly] = labelPointAt(i);
          const labelColor = HOP_FLAVOR_COLOR[k];
          return (
            <g key={`label-${k}`}>
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fill: labelColor,
                  pointerEvents: "none",
                }}
              >
                {HOP_FLAVOR_LABEL[k]}
              </text>
              <circle
                cx={lx}
                cy={ly}
                r={24}
                fill="transparent"
                onMouseEnter={() => setHoveredAxis(k)}
                onMouseMove={onAxisMouseMove}
                onMouseLeave={onAxisMouseLeave}
                style={{ cursor: "default" }}
              />
            </g>
          );
        })}
      </svg>

      {/* Cursor-following tooltip. position: fixed escapes the card's
          overflow: hidden bounding. */}
      <div
        ref={tooltipRef}
        role="tooltip"
        aria-hidden={hoveredAxis === null}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 100,
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 140ms ease, transform 90ms ease-out",
          padding: "10px 14px",
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 10,
          boxShadow: hsTokens.sh3,
          maxWidth: 240,
        }}
      >
        {hoveredAxis ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: hsTokens.script,
                fontSize: 15,
                color: HOP_FLAVOR_COLOR[hoveredAxis] ?? hsTokens.ink,
                transform: "rotate(-2deg)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: HOP_FLAVOR_COLOR[hoveredAxis],
                  border: `1px solid ${hsTokens.ink}`,
                }}
              />
              {HOP_FLAVOR_LABEL[hoveredAxis]}
            </div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 14,
                color: hsTokens.ink,
              }}
            >
              {hoveredValue.toFixed(1)}
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 11,
                  color: hsTokens.muted,
                  marginLeft: 4,
                }}
              >
                / 5
              </span>
            </div>
            {hoveredDom ? (
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 12,
                  color: hsTokens.muted,
                }}
              >
                most from{" "}
                <span style={{ color: hsTokens.ink, fontWeight: 600 }}>
                  {hoveredDom.name}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

// ─── Mobile add row (dashed-border "add another" CTA) ─────────────

function dashedBorderBg(
  color: string,
  opts: { dash: number; gap: number; strokeWidth: number; radius: number }
) {
  const { dash, gap, strokeWidth, radius } = opts;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100%'><rect width='100%' height='100%' rx='${radius}' ry='${radius}' fill='none' stroke='${color}' stroke-width='${strokeWidth}' stroke-dasharray='${dash} ${gap}'/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const MOBILE_ADD_RADIUS = 12;
const MOBILE_ADD_DASH = 12;
const MOBILE_ADD_GAP = 8;
const MOBILE_ADD_STROKE = 1.75;

function MobileAddRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label="Add another hop"
      className="hs-hops-mobile-add"
      style={{
        display: "none",
        marginTop: 14,
        width: "100%",
        padding: "16px 12px",
        background: hsTokens.cream2,
        backgroundImage: dashedBorderBg(hsTokens.ink, {
          dash: MOBILE_ADD_DASH,
          gap: MOBILE_ADD_GAP,
          strokeWidth: MOBILE_ADD_STROKE,
          radius: MOBILE_ADD_RADIUS,
        }),
        backgroundRepeat: "no-repeat",
        border: "none",
        borderRadius: MOBILE_ADD_RADIUS,
        cursor: "pointer",
        fontFamily: hsTokens.script,
        fontSize: 18,
        color: hsTokens.hops,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      + Add another hop
    </button>
  );
}

// ─── Section styles ───────────────────────────────────────────────

function HopSectionStyles() {
  return (
    <style>{`
      /* ── Radar chart entrance animations (ported from classic
         OLD_HopFlavorRadar) ── Rings + axes fade in, series polygons
         scale-bounce in with stagger. Entrance-only — no perpetual
         animation, and CRUCIALLY no persistent style changes (the classic
         used stroke-dasharray for the rings to draw-in, but that
         dasharray persisted after the animation and changed how the ring
         outlines render — subtle artifacts at the closing vertex). Using
         pure opacity entrance keeps the settled static state identical to
         pre-animation. */
      /* Animate a wrapping group's opacity (0 → 1) rather than each
         element's opacity. The group's opacity compounds with each
         child's opacity attribute (0.35 for outer ring / 0.2 for inner
         rings / 0.25 for axes), so the settled compounded opacity equals
         the original attribute value. Animating the GROUP avoids the
         "fill-mode both forces opacity to 1" problem that bit a prior
         attempt at per-element fades. */
      @keyframes hs-hops-radar-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes hs-hops-radar-enter {
        0%   { opacity: 0; transform: scale(0.3); }
        60%  { opacity: 1; transform: scale(1.04); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes hs-hops-radar-dot-in {
        0%   { opacity: 0; transform: scale(0); }
        100% { opacity: 1; transform: scale(1); }
      }
      .hs-hops-radar-grid {
        animation: hs-hops-radar-fade-in 500ms ease-out both;
      }
      .hs-hops-radar-series {
        animation: hs-hops-radar-enter 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }
      /* transform-box + transform-origin let SVG circles scale from their
         own center (default would be SVG root origin). */
      .hs-hops-radar-dot {
        transform-box: fill-box;
        transform-origin: center;
        animation: hs-hops-radar-dot-in 320ms ease-out both;
      }
      @media (prefers-reduced-motion: reduce) {
        .hs-hops-radar-grid,
        .hs-hops-radar-series,
        .hs-hops-radar-dot {
          animation: none !important;
        }
      }

      /* Desktop: 2-col grid. Row 1 = ledger header + empty. Row 2 =
         ledger table + aside (radar + notes packed via flex). Aside top
         aligns with the top of the ledger TABLE, not the header row. */
      /* Single-column layout — the aside (radar + notes) has been hoisted
         to the parent HopSkipBuilder grid so it can morph between tabs. */
      .hs-hops-section .hs-hops-grid {
        display: flex;
        flex-direction: column;
        row-gap: 16px;
        min-width: 0;
      }
      .hs-hops-section .hs-hops-grid-lhead { min-width: 0; }
      .hs-hops-section .hs-hops-grid-ltable { min-width: 0; }

      @media (max-width: 900px) {
        .hs-hops-section .hs-hops-grid {
          row-gap: 12px;
        }
      }

      /* Desktop hover — subtle cream-2 tint across the ledger row, plus
         fades in the ghost × remove button. */
      @media (min-width: 641px) and (hover: hover) {
        .hs-hops-section .hs-hops-data-row {
          transition: background 90ms ease;
        }
        .hs-hops-section .hs-hops-data-row:hover {
          /* Section-tinted hover: ~2% hops mixed into a paper/cream-2 base.
             Lighter overall than a pure cream-2 hover so the hover lifts
             rather than darkens, while still tagging the row with the
             section accent. */
          background: color-mix(in srgb, color-mix(in srgb, var(--hs-paper) 20%, var(--hs-cream-2)) 98%, var(--hs-hops));
        }
        .hs-hops-section .hs-hops-remove-btn {
          opacity: 0.32;
          transition: opacity 90ms ease, background 90ms ease;
        }
        .hs-hops-section .hs-hops-data-row:hover .hs-hops-remove-btn {
          opacity: 1;
        }
        .hs-hops-section .hs-hops-remove-btn:hover {
          background: rgba(212, 69, 44, 0.12);
        }
        .hs-hops-section .hs-hops-name-btn:hover .hs-hops-name {
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .hs-hops-section .hs-hops-edit-btn:hover {
          background: ${hsTokens.cream2};
          border-bottom-style: solid !important;
        }
      }

      /* Mobile (≤640px) — collapse ledger into per-hop cards, always-
         visible steppers, no per-cell hover tints. */
      @media (max-width: 640px) {
        .hs-hops-section .hs-hops-mobile-add {
          display: flex !important;
        }

        .hs-hops-section .hs-hops-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 0 !important;
        }
        .hs-hops-section .hs-hops-steppers button {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          width: 26px !important;
          height: 22px !important;
          color: ${hsTokens.muted} !important;
        }
        .hs-hops-section .hs-hops-steppers button svg {
          width: 14px !important;
          height: 9px !important;
          stroke-width: 2 !important;
        }
        .hs-hops-section .hs-hops-remove-btn {
          opacity: 1 !important;
        }
        .hs-hops-section .hs-hops-ledger {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .hs-hops-section .hs-hops-ledger-head-row {
          display: none !important;
        }
        /* Mobile reflow for the 7-column desktop ledger (mini radar / name /
           use / time / weight / IBU / remove). Stacks into 3 rows so each
           pair of related controls (use+time, weight+IBU) sits inline. */
        .hs-hops-section .hs-hops-data-row {
          display: grid !important;
          grid-template-columns: 52px minmax(0, 1fr) auto !important;
          grid-template-areas:
            "radar  name    remove"
            "radar  usecell timecell"
            "weight weight  ibucell" !important;
          column-gap: 12px !important;
          row-gap: 10px !important;
          padding: 16px 0 !important;
          border-bottom: 1px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-hops-section .hs-hops-data-row:last-of-type {
          border-bottom: none !important;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(1) {
          grid-area: radar;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(2) {
          grid-area: name;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(3) {
          grid-area: usecell;
          display: flex !important;
          justify-content: flex-start;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(4) {
          grid-area: timecell;
          display: flex !important;
          justify-content: flex-end;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(5) {
          grid-area: weight;
          display: flex !important;
          align-items: center;
          justify-content: flex-start;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(6) {
          grid-area: ibucell;
          margin: 0 !important;
          padding: 8px 14px !important;
          border-radius: 8px;
          min-height: 0 !important;
        }
        .hs-hops-section .hs-hops-data-row > :nth-child(7) {
          grid-area: remove;
          justify-self: end;
        }
        .hs-hops-section .hs-hops-edit-btn {
          padding: 4px 38px 4px 8px !important;
        }
        /* Mobile total: collapse to a 3-cell row "Total hops · Σg · ΣIBU".
           Hides the index, use/time placeholders, and the actions cell. */
        .hs-hops-section .hs-hops-total-row {
          display: grid !important;
          grid-template-columns: 1fr auto auto !important;
          column-gap: 14px !important;
          align-items: baseline !important;
          padding: 16px 0 !important;
          border-top: 2px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-hops-section .hs-hops-total-row > * {
          padding: 0 !important;
        }
        /* Hide entry count (col 1), use placeholder (col 3), time placeholder
           (col 4), and actions placeholder (col 7). Visible: name (2), grams
           (5), ibu total (6). */
        .hs-hops-section .hs-hops-total-row > :nth-child(1),
        .hs-hops-section .hs-hops-total-row > :nth-child(3),
        .hs-hops-section .hs-hops-total-row > :nth-child(4),
        .hs-hops-section .hs-hops-total-row > :nth-child(7) {
          display: none !important;
        }
        /* IBU total cell on mobile: keep its tinted bg as a chip. */
        .hs-hops-section .hs-hops-total-row > :nth-child(6) {
          margin: 0 !important;
          padding: 6px 12px !important;
          border-radius: 8px;
          min-height: 0 !important;
        }
        .hs-hops-section {
          padding: 18px 14px !important;
        }
        .hs-hops-radar-card {
          padding: 12px !important;
        }
        .hs-hops-ledger-head {
          flex-wrap: wrap;
        }
      }
    `}</style>
  );
}

// ─── Helper-card container (mounted by HelperCardMorph) ───────────

export function HopHelperCard() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const hops = currentRecipe?.hops ?? [];
  if (hops.length === 0) return null;
  return (
    <HopFlavorRadarCard
      hops={hops}
      batchVolumeL={currentRecipe?.batchVolumeL ?? 20}
    />
  );
}

