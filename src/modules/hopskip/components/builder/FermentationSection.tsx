"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import HSActionMenu from "../HSActionMenu";
import FermentationStepModal from "../modals/FermentationStepModal";

import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { uid } from "@/utils/uid";
import { packagingCalculationService as pkgCalc } from "@/modules/beta-builder/domain/services/PackagingCalculationService";
import type {
  FermentationStep,
  FermentationStepType,
  Packaging,
  PackagingMethod,
  PrimingSugarType,
} from "@/modules/beta-builder/domain/models/Recipe";

// Defaults used when the recipe hasn't explicitly configured `packaging` yet.
// Mirrors classic `PackagingSection.tsx` DEFAULT_PACKAGING but trimmed to the
// fields HS surfaces (bottle entries + carbonation method are deferred — they
// live in the brew sheet print, not the planning view).
const DEFAULT_PACKAGING: Packaging = {
  methods: ["bottle"],
  targetCo2Volumes: 2.4,
  primingSugarType: "corn-sugar",
  servingTempC: 4,
};

const SUGAR_OPTIONS: { value: PrimingSugarType; label: string; sub: string }[] = [
  { value: "corn-sugar", label: "Corn", sub: "dextrose · standard" },
  { value: "table-sugar", label: "Table", sub: "sucrose · pantry" },
  { value: "dme", label: "DME", sub: "dry malt extract" },
  { value: "honey", label: "Honey", sub: "adds character" },
];

// ─── Step type color + label ─────────────────────────────────────
// Color progression from warm gold (active) → cool blue (crash). Used by the
// row badge and (if a future visualization lands) any chart legend. Aligned
// with TYPE_PRESETS in FermentationStepModal.tsx.
function stepTypeColor(t: FermentationStepType): string {
  switch (t) {
    case "primary":
      return hsTokens.honey;
    case "secondary":
      return hsTokens.yeast;
    case "diacetyl-rest":
      return hsTokens.roast;
    case "conditioning":
      return hsTokens.malt;
    case "cold-crash":
      return "#7faec9";
    default:
      return hsTokens.honey;
  }
}

const STEP_TYPE_LABELS: Record<FermentationStepType, string> = {
  primary: "Primary",
  secondary: "Secondary",
  "diacetyl-rest": "Diacetyl rest",
  conditioning: "Conditioning",
  "cold-crash": "Cold crash",
};

// Whether the swatch is dark enough that the # numeral should be cream-on-dark
// rather than ink-on-light. Tuned per color.
function badgeIsDark(t: FermentationStepType): boolean {
  return t === "diacetyl-rest"; // roast is the only one that needs inverted text
}

interface StepDerived {
  step: FermentationStep;
  cumulativeDays: number;
  color: string;
  typeLabel: string;
}

interface Generator {
  label: string;
  sub: string;
  apply: () => void;
}

export default function FermentationSection() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<FermentationStep | null>(null);

  const steps = useMemo<FermentationStep[]>(
    () => currentRecipe?.fermentationSteps ?? [],
    [currentRecipe?.fermentationSteps]
  );

  const derived = useMemo<StepDerived[]>(() => {
    let cumulative = 0;
    return steps.map((s) => {
      cumulative += s.durationDays;
      return {
        step: s,
        cumulativeDays: cumulative,
        color: stepTypeColor(s.type),
        typeLabel: STEP_TYPE_LABELS[s.type] ?? s.type,
      };
    });
  }, [steps]);

  const totalDays = derived.length > 0 ? derived[derived.length - 1].cumulativeDays : 0;

  // Packaging-derived values
  const pkg = currentRecipe?.packaging ?? DEFAULT_PACKAGING;
  const updatePackaging = (partial: Partial<Packaging>) => {
    updateRecipe({
      packaging: {
        ...DEFAULT_PACKAGING,
        ...(currentRecipe?.packaging ?? {}),
        ...partial,
      },
    });
  };

  // Residual CO₂ uses the PEAK fermentation temperature, matching Noonan's
  // formula and the convention in BeerSmith / Brewfather / BrewersFriend.
  // Reasoning: vigorous fermentation saturates the beer at ~1 atm CO₂ at the
  // peak temp; cold-crashing typically draws outside air in through the
  // airlock (negative headspace pressure as the gas contracts), so the
  // theoretical "more dissolved CO₂ at cold temp" rarely materialises in
  // open-airlock setups. Using last-step temp would over-estimate residual
  // and lead to under-primed beer. Sealed/spunded fermenters are an advanced
  // case we don't try to model here.
  const peakFermTempC = useMemo(() => pkgCalc.highestFermTemp(steps), [steps]);
  const residualCo2 = useMemo(() => pkgCalc.residualCo2(peakFermTempC), [peakFermTempC]);
  const styleSuggestion = useMemo(() => {
    if (!currentRecipe?.style) return null;
    return pkgCalc.styleCo2Range(currentRecipe.style);
  }, [currentRecipe?.style]);
  const batchVolumeL = currentRecipe?.batchVolumeL ?? 0;
  const kegPsi = useMemo(
    () => pkgCalc.forcedCarbonationPsi(pkg.servingTempC ?? 4, pkg.targetCo2Volumes),
    [pkg.servingTempC, pkg.targetCo2Volumes]
  );
  const primingSugarG = useMemo(
    () =>
      pkgCalc.primingSugarGrams(
        pkg.targetCo2Volumes,
        residualCo2,
        batchVolumeL,
        pkg.primingSugarType ?? "corn-sugar"
      ),
    [pkg.targetCo2Volumes, residualCo2, batchVolumeL, pkg.primingSugarType]
  );

  const handleOpenAdd = () => {
    setEditingStep(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (step: FermentationStep) => {
    setEditingStep(step);
    setIsModalOpen(true);
  };

  const writeSteps = (next: FermentationStep[]) => {
    updateRecipe({ fermentationSteps: next });
  };

  const handleSave = (step: FermentationStep) => {
    if (editingStep) {
      writeSteps(steps.map((s) => (s.id === step.id ? step : s)));
    } else {
      writeSteps([...steps, step]);
    }
  };

  const handleRemove = (id: string) => {
    writeSteps(steps.filter((s) => s.id !== id));
  };

  const handleTempChange = (id: string, v: number) => {
    writeSteps(steps.map((s) => (s.id === id ? { ...s, temperatureC: v } : s)));
  };

  const handleDurationChange = (id: string, v: number) => {
    writeSteps(steps.map((s) => (s.id === id ? { ...s, durationDays: v } : s)));
  };

  const handleTempNudge = (id: string, current: FermentationStep, dir: 1 | -1) => {
    const next = Math.max(-5, Math.min(40, parseFloat((current.temperatureC + dir * 0.5).toFixed(1))));
    if (next !== current.temperatureC) handleTempChange(id, next);
  };

  const handleDurationNudge = (id: string, current: FermentationStep, dir: 1 | -1) => {
    const next = Math.max(0, current.durationDays + dir * 1);
    if (next !== current.durationDays) handleDurationChange(id, next);
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    writeSteps(next);
  };

  const replaceSchedule = (newSteps: Omit<FermentationStep, "id">[], label: string) => {
    if (steps.length > 0) {
      if (!confirm(`This will replace your current fermentation schedule with ${label}. Continue?`)) {
        return;
      }
    }
    writeSteps(newSteps.map((s) => ({ ...s, id: uid() })));
  };

  const generators = useMemo<Generator[]>(
    () => [
      {
        label: "Standard Ale",
        sub: "1 step · ~14 days",
        apply: () =>
          replaceSchedule(
            [
              { name: "Primary Fermentation", type: "primary", temperatureC: 19, durationDays: 14 },
            ],
            "a standard ale"
          ),
      },
      {
        label: "Lager",
        sub: "3 steps · ~28 days",
        apply: () =>
          replaceSchedule(
            [
              { name: "Primary Fermentation", type: "primary", temperatureC: 11, durationDays: 14 },
              { name: "Diacetyl Rest", type: "diacetyl-rest", temperatureC: 18, durationDays: 2 },
              { name: "Lagering", type: "conditioning", temperatureC: 2, durationDays: 21 },
            ],
            "a lager schedule"
          ),
      },
      {
        label: "Hazy IPA",
        sub: "3 steps · ~14 days",
        apply: () =>
          replaceSchedule(
            [
              { name: "Primary Fermentation", type: "primary", temperatureC: 20, durationDays: 7 },
              { name: "Dry Hop", type: "secondary", temperatureC: 18, durationDays: 4 },
              { name: "Cold Crash", type: "cold-crash", temperatureC: 2, durationDays: 3 },
            ],
            "a hazy IPA schedule"
          ),
      },
    ],
    // steps is read inside replaceSchedule via closure; eslint can't see it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps]
  );

  if (!currentRecipe) return null;

  return (
    <section className="hs-fermentation-section" style={sectionFrameStyle}>
      <FermentationSectionStyles />

      <SectionTitle />

      <div className="hs-fermentation-grid">
        <div className="hs-fermentation-grid-lhead">
          <BlockEyebrow
            label="The fermentation schedule"
            meta={
              derived.length > 0
                ? `${derived.length} ${derived.length === 1 ? "step" : "steps"} · ${totalDays} ${totalDays === 1 ? "day" : "days"}`
                : null
            }
            right={
              derived.length > 0 ? (
                <BlockHeaderActions>
                  <HSActionMenu
                    trigger={
                      <span
                        style={{
                          fontFamily: hsTokens.body,
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                        }}
                      >
                        Generate ▾
                      </span>
                    }
                    triggerAriaLabel="Replace with generated schedule"
                    triggerStyle={triggerPillStyle}
                    items={generators.map((g) => ({
                      label: `${g.label}  —  ${g.sub}`,
                      onClick: g.apply,
                    }))}
                  />
                  <HSButton onClick={handleOpenAdd} color={hsTokens.honey} size="sm">
                    + Add step
                  </HSButton>
                </BlockHeaderActions>
              ) : null
            }
          />
        </div>

        <div className="hs-fermentation-grid-main">
          <div className="hs-fermentation-block">
            {derived.length === 0 ? (
              <FermentationEmptyState onAdd={handleOpenAdd} generators={generators} />
            ) : (
              <Ledger
                derived={derived}
                onEditStep={handleOpenEdit}
                onRemoveStep={handleRemove}
                onTempChange={handleTempChange}
                onDurationChange={handleDurationChange}
                onTempNudge={(id, step, dir) => handleTempNudge(id, step, dir)}
                onDurationNudge={(id, step, dir) => handleDurationNudge(id, step, dir)}
                onMove={moveStep}
                onAdd={handleOpenAdd}
              />
            )}
          </div>

          <div className="hs-fermentation-block">
            <ConditioningBlock
              hasPackaging={!!currentRecipe.packaging}
              methods={currentRecipe.packaging?.methods ?? []}
              targetVols={pkg.targetCo2Volumes}
              residualVols={residualCo2}
              peakFermTempC={peakFermTempC}
              hasSteps={steps.length > 0}
              styleSuggestion={styleSuggestion}
              styleName={currentRecipe.style ?? null}
              servingTempC={pkg.servingTempC ?? 4}
              kegPsi={kegPsi}
              primingSugarG={primingSugarG}
              sugarType={pkg.primingSugarType ?? "corn-sugar"}
              carbMethod={pkg.carbonationMethod ?? "set-and-forget"}
              batchVolumeL={batchVolumeL}
              onPickMethod={(methods) =>
                updatePackaging({ methods })
              }
              onTargetChange={(v) => updatePackaging({ targetCo2Volumes: v })}
              onServingTempChange={(v) => updatePackaging({ servingTempC: v })}
              onSugarTypeChange={(v) => updatePackaging({ primingSugarType: v })}
              onCarbMethodChange={(v) => updatePackaging({ carbonationMethod: v })}
              onChangeMethod={() => updateRecipe({ packaging: undefined })}
            />
          </div>
        </div>

      </div>

      <FermentationStepModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        existingStep={editingStep}
      />
    </section>
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

// ─── Section title ───────────────────────────────────────────────

function SectionTitle() {
  return (
    <header
      style={{
        paddingBottom: 14,
        borderBottom: `2px solid ${hsTokens.honey}`,
      }}
    >
      <HSScriptNote color={hsTokens.honey} size={22} rotate={-3}>
        from pitch to package —
      </HSScriptNote>
      <h2
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(28px, 4.4vw, 44px)",
          letterSpacing: "-0.035em",
          lineHeight: 0.95,
          color: hsTokens.ink,
          margin: "4px 0 0",
        }}
      >
        Fermentation & Conditioning.
      </h2>
    </header>
  );
}

// ─── Block primitives (shared by schedule + conditioning blocks) ─

const triggerPillStyle: CSSProperties = {
  background: hsTokens.paper,
  border: `1.5px solid ${hsTokens.ink}`,
  borderRadius: 999,
  padding: "6px 14px",
  width: "auto",
  height: "auto",
  boxShadow: hsTokens.sh1,
  color: hsTokens.ink,
  cursor: "pointer",
};

function BlockEyebrow({
  label,
  meta,
  right,
}: {
  label: string;
  meta?: string | null;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 2,
      }}
    >
      <Eyebrow size={11}>{label}</Eyebrow>
      <span
        aria-hidden
        style={{
          flex: 1,
          minWidth: 20,
          height: 1.5,
          background: hsTokens.ink,
          opacity: 0.18,
        }}
      />
      {meta ? (
        <HSScriptNote color={hsTokens.muted} size={16} rotate={-3}>
          {meta}
        </HSScriptNote>
      ) : null}
      {right}
    </div>
  );
}

function BlockHeaderActions({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {children}
    </div>
  );
}

// ─── Fermentation empty state ─────────────────────────────────────

function FermentationEmptyState({
  onAdd,
  generators,
}: {
  onAdd: () => void;
  generators: Generator[];
}) {
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
        gap: 16,
      }}
    >
      <HSScriptNote color={hsTokens.honey} size={24} rotate={-4}>
        nothing pitched yet —
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 15,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 460,
          lineHeight: 1.4,
        }}
      >
        Lay down a fermentation schedule. Most ales just need a single primary;
        lagers and hazies want more shape.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
          width: "100%",
          maxWidth: 580,
        }}
      >
        {generators.map((g) => (
          <button
            key={g.label}
            type="button"
            onClick={g.apply}
            className="hs-fermentation-gen-card"
            style={{
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 12,
              padding: "14px 16px",
              cursor: "pointer",
              boxShadow: hsTokens.sh2,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              textAlign: "left",
              fontFamily: hsTokens.body,
              color: hsTokens.ink,
              transition: "transform 90ms ease, box-shadow 90ms ease",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.01em",
                color: hsTokens.ink,
              }}
            >
              {g.label}
            </span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
              }}
            >
              {g.sub}
            </span>
          </button>
        ))}
      </div>
      <HSButton onClick={onAdd} color={hsTokens.honey} size="md">
        Or add a custom step
      </HSButton>
    </div>
  );
}

// ─── Ledger ──────────────────────────────────────────────────────

const LEDGER_COLS = "44px minmax(0, 1.5fr) 116px 116px 70px";

function Ledger({
  derived,
  onEditStep,
  onRemoveStep,
  onTempChange,
  onDurationChange,
  onTempNudge,
  onDurationNudge,
  onMove,
  onAdd,
}: {
  derived: StepDerived[];
  onEditStep: (step: FermentationStep) => void;
  onRemoveStep: (id: string) => void;
  onTempChange: (id: string, v: number) => void;
  onDurationChange: (id: string, v: number) => void;
  onTempNudge: (id: string, step: FermentationStep, dir: 1 | -1) => void;
  onDurationNudge: (id: string, step: FermentationStep, dir: 1 | -1) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="hs-fermentation-ledger"
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        overflow: "hidden",
      }}
    >
      <LedgerHead />
      {derived.map((d, i) => (
        <LedgerRow
          key={d.step.id}
          d={d}
          index={i}
          isLast={i === derived.length - 1}
          isFirst={i === 0}
          isOnlyOne={derived.length === 1}
          onEdit={() => onEditStep(d.step)}
          onRemove={() => onRemoveStep(d.step.id)}
          onTempChange={(v) => onTempChange(d.step.id, v)}
          onDurationChange={(v) => onDurationChange(d.step.id, v)}
          onTempNudge={(dir) => onTempNudge(d.step.id, d.step, dir)}
          onDurationNudge={(dir) => onDurationNudge(d.step.id, d.step, dir)}
          onMove={(dir) => onMove(i, dir)}
        />
      ))}
      <LedgerTotal totalDays={derived.length > 0 ? derived[derived.length - 1].cumulativeDays : 0} />
      <MobileAddRow onAdd={onAdd} />
    </div>
  );
}

function LedgerHead() {
  const cellStyle: CSSProperties = {
    display: "block",
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: hsTokens.muted,
    lineHeight: 1,
  };
  return (
    <div
      className="hs-fermentation-ledger-head-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "10px 18px 8px",
        borderBottom: `2px solid ${hsTokens.ink}`,
        // Section-tinted ledger head: ~7% honey mixed into cream.
        background: "color-mix(in srgb, var(--hs-cream) 96%, var(--hs-honey))",
        gap: 14,
        alignItems: "center",
      }}
    >
      <span style={{ ...cellStyle, textAlign: "center" }}>#</span>
      <span style={cellStyle}>Step</span>
      {/* The 28px right offset compensates for the EditableCell button's right
          stepper padding so the header centers over the visible glyphs. */}
      <span style={{ ...cellStyle, textAlign: "center", paddingRight: 28 }}>Temp</span>
      <span style={{ ...cellStyle, textAlign: "center", paddingRight: 28 }}>Days</span>
      <span style={{ ...cellStyle, textAlign: "right" }}>—</span>
    </div>
  );
}

function LedgerRow({
  d,
  index,
  isLast,
  isFirst,
  isOnlyOne,
  onEdit,
  onRemove,
  onTempChange,
  onDurationChange,
  onTempNudge,
  onDurationNudge,
  onMove,
}: {
  d: StepDerived;
  index: number;
  isLast: boolean;
  isFirst: boolean;
  isOnlyOne: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onTempChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  onTempNudge: (dir: 1 | -1) => void;
  onDurationNudge: (dir: 1 | -1) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const dark = badgeIsDark(d.step.type);
  return (
    <div
      className="hs-fermentation-ledger-row hs-fermentation-data-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 18px",
        borderBottom: isLast ? "none" : `1px solid ${hsTokens.ink}22`,
        alignItems: "center",
        gap: 14,
      }}
    >
      {/* Step badge (# + color swatch) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: d.color,
            border: `2px solid ${hsTokens.ink}`,
            boxShadow: hsTokens.sh1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: hsTokens.display,
            fontSize: 13,
            color: dark ? hsTokens.cream : hsTokens.ink,
            lineHeight: 1,
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* Step name (click to edit) + type caption */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${d.step.name}`}
          className="hs-fermentation-name-btn"
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            textAlign: "left",
            color: hsTokens.ink,
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 15,
            lineHeight: 1.15,
            letterSpacing: "0.01em",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minWidth: 0,
          }}
        >
          <span
            className="hs-fermentation-name"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {d.step.name}
          </span>
        </button>
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 14,
            color: hsTokens.muted,
            lineHeight: 1.15,
          }}
        >
          {d.typeLabel}
          {d.step.notes ? ` · ${d.step.notes}` : ""}
        </span>
      </div>

      {/* Temp (editable) */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={d.step.temperatureC}
          step={0.5}
          min={-5}
          max={40}
          format={(v) => v.toFixed(1)}
          suffix="°C"
          ariaLabel={`Temperature for ${d.step.name}`}
          onCommit={onTempChange}
          onNudge={onTempNudge}
        />
      </div>

      {/* Duration (editable) */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={d.step.durationDays}
          step={1}
          min={0}
          max={365}
          format={(v) => String(Math.round(v))}
          suffix="days"
          ariaLabel={`Duration for ${d.step.name}`}
          onCommit={onDurationChange}
          onNudge={onDurationNudge}
        />
      </div>

      {/* Actions: move ↑ ↓ + remove ×. Remove disabled when only one step. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 2,
        }}
      >
        <IconBtn
          ariaLabel={`Move ${d.step.name} up`}
          onClick={() => onMove(-1)}
          disabled={isFirst}
          className="hs-fermentation-move-btn"
        >
          <svg
            width="10"
            height="7"
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 5 5 1 9 5" />
          </svg>
        </IconBtn>
        <IconBtn
          ariaLabel={`Move ${d.step.name} down`}
          onClick={() => onMove(1)}
          disabled={isLast}
          className="hs-fermentation-move-btn"
        >
          <svg
            width="10"
            height="7"
            viewBox="0 0 10 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 1 5 5 9 1" />
          </svg>
        </IconBtn>
        <IconBtn
          ariaLabel={`Remove ${d.step.name}`}
          onClick={onRemove}
          disabled={isOnlyOne}
          className="hs-fermentation-remove-btn"
          danger
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </IconBtn>
      </div>
    </div>
  );
}

function LedgerTotal({ totalDays }: { totalDays: number }) {
  const cellLabelStyle: CSSProperties = {
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: hsTokens.muted,
  };
  return (
    <div
      className="hs-fermentation-total-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 18px",
        borderTop: `2px solid ${hsTokens.ink}`,
        // Section-tinted total band — same 7% honey mix as the ledger head.
        background: "color-mix(in srgb, var(--hs-cream-2) 96%, var(--hs-honey))",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span aria-hidden style={cellLabelStyle}>
        Σ
      </span>
      <span style={cellLabelStyle}>Total time</span>
      <span aria-hidden />
      <span
        style={{
          textAlign: "right",
          fontFamily: hsTokens.display,
          fontSize: 22,
          color: hsTokens.ink,
          letterSpacing: "-0.01em",
        }}
      >
        {totalDays}
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 12,
            color: hsTokens.muted,
            marginLeft: 4,
          }}
        >
          {totalDays === 1 ? "day" : "days"}
        </span>
      </span>
      <span aria-hidden />
    </div>
  );
}

// ─── Editable cell ────────────────────────────────────────────────

function EditableCell({
  value,
  onCommit,
  onNudge,
  step,
  min,
  max,
  format,
  suffix,
  ariaLabel,
}: {
  value: number;
  onCommit: (v: number) => void;
  onNudge: (dir: 1 | -1) => void;
  step: number;
  min?: number;
  max?: number;
  format: (v: number) => string;
  suffix?: string;
  ariaLabel: string;
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
      if (!Number.isNaN(parsed)) {
        const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, parsed));
        if (clamped !== value) onCommit(clamped);
      }
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
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
          border: `1.5px solid ${hsTokens.honey}`,
          outline: "none",
          fontFamily: hsTokens.script,
          fontWeight: 500,
          fontSize: 28,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
          padding: "2px 8px",
          margin: 0,
          appearance: "textfield",
          borderRadius: 6,
        }}
      />
    );
  }

  return (
    // The outer wrapper tracks hover purely to reveal the stepper buttons;
    // the inner button owns the keyboard contract. Suppress the a11y warning.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        type="button"
        onClick={enterEdit}
        aria-label={`Edit ${format(value)} ${suffix ?? ""}`}
        className="hs-fermentation-edit-btn"
        style={{
          background: "transparent",
          border: "none",
          borderBottom: `1.5px dotted ${hsTokens.ink}55`,
          padding: "2px 28px 2px 6px",
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
            fontSize: 28,
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
        onUp={() => onNudge(1)}
        onDown={() => onNudge(-1)}
      />
    </div>
  );
}

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
      className="hs-fermentation-steppers"
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
        e.currentTarget.style.background = hsTokens.honey;
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

function IconBtn({
  children,
  onClick,
  ariaLabel,
  disabled,
  className,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
      style={{
        width: 26,
        height: 26,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.25 : 0.55,
        color: danger ? hsTokens.roast : hsTokens.ink,
        padding: 0,
        transition: "opacity 90ms ease, background 90ms ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "1";
        e.currentTarget.style.background = danger
          ? "rgba(212, 69, 44, 0.12)"
          : hsTokens.cream2;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.opacity = "0.55";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ─── Conditioning block ──────────────────────────────────────────

interface MethodPickerCard {
  methods: PackagingMethod[];
  label: string;
  sub: string;
  blurb: string;
}

const METHOD_PICKERS: MethodPickerCard[] = [
  { methods: ["keg"], label: "Force carb", sub: "keg · set & forget", blurb: "Pressure-condition. Drinkable in days." },
  { methods: ["bottle"], label: "Bottle prime", sub: "old school · 1–4 weeks", blurb: "Add sugar before sealing. Yeast does the rest." },
  { methods: ["bottle", "keg"], label: "Split it", sub: "some kegged · some bottled", blurb: "Run both paths for a single batch." },
];

function ConditioningBlock({
  hasPackaging,
  methods,
  targetVols,
  residualVols,
  peakFermTempC,
  hasSteps,
  styleSuggestion,
  styleName,
  servingTempC,
  kegPsi,
  primingSugarG,
  sugarType,
  carbMethod,
  batchVolumeL,
  onPickMethod,
  onTargetChange,
  onServingTempChange,
  onSugarTypeChange,
  onCarbMethodChange,
  onChangeMethod,
}: {
  hasPackaging: boolean;
  methods: PackagingMethod[];
  targetVols: number;
  residualVols: number;
  peakFermTempC: number;
  hasSteps: boolean;
  styleSuggestion: { min: number; max: number; typical: number } | null;
  styleName: string | null;
  servingTempC: number;
  kegPsi: number;
  primingSugarG: number;
  sugarType: PrimingSugarType;
  carbMethod: "set-and-forget" | "burst";
  batchVolumeL: number;
  onPickMethod: (methods: PackagingMethod[]) => void;
  onTargetChange: (v: number) => void;
  onServingTempChange: (v: number) => void;
  onSugarTypeChange: (v: PrimingSugarType) => void;
  onCarbMethodChange: (v: "set-and-forget" | "burst") => void;
  onChangeMethod: () => void;
}) {
  const isKeg = methods.includes("keg");
  const isBottle = methods.includes("bottle");
  const methodLabel = isKeg && isBottle ? "Split — keg + bottle" : isKeg ? "Force carb · keg" : "Bottle prime";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BlockEyebrow
        label="The conditioning plan"
        meta={hasPackaging ? methodLabel : null}
        right={
          hasPackaging ? (
            <BlockHeaderActions>
              <button
                type="button"
                onClick={onChangeMethod}
                style={{
                  background: "transparent",
                  border: `1.5px dashed ${hsTokens.ink}55`,
                  borderRadius: 999,
                  padding: "5px 12px",
                  cursor: "pointer",
                  fontFamily: hsTokens.body,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                }}
              >
                Change method
              </button>
            </BlockHeaderActions>
          ) : null
        }
      />

      {!hasPackaging ? (
        <ConditioningEmptyState onPick={onPickMethod} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isKeg && isBottle ? "1fr 1fr" : "minmax(0, 1fr)",
            gap: 14,
            alignItems: "start",
          }}
        >
          <div style={{ gridColumn: isKeg && isBottle ? "1 / -1" : "auto" }}>
            <CO2TargetsCard
              targetVols={targetVols}
              residualVols={residualVols}
              peakFermTempC={peakFermTempC}
              hasSteps={hasSteps}
              styleSuggestion={styleSuggestion}
              styleName={styleName}
              onTargetChange={onTargetChange}
            />
          </div>
          {isKeg ? (
            <KegPsiCard
              psi={kegPsi}
              servingTempC={servingTempC}
              carbMethod={carbMethod}
              onServingTempChange={onServingTempChange}
              onCarbMethodChange={onCarbMethodChange}
            />
          ) : null}
          {isBottle ? (
            <PrimingSugarCard
              grams={primingSugarG}
              batchVolumeL={batchVolumeL}
              residualVols={residualVols}
              targetVols={targetVols}
              sugarType={sugarType}
              onSugarTypeChange={onSugarTypeChange}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConditioningEmptyState({
  onPick,
}: {
  onPick: (methods: PackagingMethod[]) => void;
}) {
  return (
    <div
      style={{
        background: hsTokens.cream2,
        border: `1.5px dashed ${hsTokens.ink}`,
        borderRadius: 10,
        padding: "26px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <HSScriptNote color={hsTokens.honey} size={22} rotate={-4}>
        no carb plan yet —
      </HSScriptNote>
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 14,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 460,
          lineHeight: 1.4,
        }}
      >
        Pick how you&apos;ll carbonate. You can change this later, or run both
        paths for a single batch.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: 10,
          width: "100%",
          maxWidth: 600,
        }}
      >
        {METHOD_PICKERS.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => onPick(m.methods)}
            className="hs-fermentation-method-card"
            style={{
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 12,
              padding: "14px 16px",
              cursor: "pointer",
              boxShadow: hsTokens.sh2,
              display: "flex",
              flexDirection: "column",
              gap: 3,
              textAlign: "left",
              fontFamily: hsTokens.body,
              color: hsTokens.ink,
              transition: "transform 90ms ease, box-shadow 90ms ease",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.01em",
                color: hsTokens.ink,
              }}
            >
              {m.label}
            </span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
              }}
            >
              {m.sub}
            </span>
            <span
              style={{
                fontFamily: hsTokens.script,
                fontSize: 14,
                color: hsTokens.muted,
                marginTop: 4,
                lineHeight: 1.3,
              }}
            >
              {m.blurb}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Summary card (sidebar) ──────────────────────────────────────

interface JourneySeg {
  kind: "ferment" | "carb-keg" | "carb-bottle";
  label: string;
  days: number;
  color: string;
  sub?: string;
}

// Carb duration estimates differ by method AND by carbonation approach.
// Burst keg-carb: ~24h at 30 psi + ~1d settle. Set-and-forget: ~5d at serving psi.
// Bottle conditioning: temperature-dependent (warm = faster, cool = slower) via
// packagingCalculationService.estimatedConditioningDays.
function carbDurations({
  isKeg,
  isBottle,
  carbMethod,
  conditioningTempC,
}: {
  isKeg: boolean;
  isBottle: boolean;
  carbMethod: "set-and-forget" | "burst";
  conditioningTempC: number;
}): { keg: number; bottle: number } {
  return {
    keg: isKeg ? (carbMethod === "burst" ? 2 : 5) : 0,
    bottle: isBottle ? pkgCalc.estimatedConditioningDays(conditioningTempC) : 0,
  };
}

function SummaryCard({
  steps,
  totalDays,
  hasPackaging,
  methods,
  targetVols,
  kegPsi,
  servingTempC,
  primingSugarG,
  sugarType,
  carbMethod,
  conditioningTempC,
  brewDate,
  onBrewDateUpdate,
}: {
  steps: FermentationStep[];
  totalDays: number;
  hasPackaging: boolean;
  methods: PackagingMethod[];
  targetVols: number;
  kegPsi: number;
  servingTempC: number;
  primingSugarG: number;
  sugarType: PrimingSugarType;
  carbMethod: "set-and-forget" | "burst";
  conditioningTempC: number;
  brewDate: Date | null;
  onBrewDateUpdate: (d: Date | null) => void;
}) {
  const hasSchedule = steps.length > 0;
  const isKeg = methods.includes("keg");
  const isBottle = methods.includes("bottle");
  const sugarLabel = SUGAR_OPTIONS.find((s) => s.value === sugarType)?.label.toLowerCase() ?? sugarType;

  const carbs = useMemo(
    () => carbDurations({ isKeg, isBottle, carbMethod, conditioningTempC }),
    [isKeg, isBottle, carbMethod, conditioningTempC]
  );

  const segments = useMemo<JourneySeg[]>(() => {
    const segs: JourneySeg[] = steps.map((s) => ({
      kind: "ferment",
      // Use the user's step name (e.g. "Dry Hop") rather than the canonical
      // type label (e.g. "Secondary"). The on-bar label + tooltip both read
      // this field, so renaming the ledger row flows through here.
      label: s.name || STEP_TYPE_LABELS[s.type] || s.type,
      days: s.durationDays,
      color: stepTypeColor(s.type),
      sub: `${s.temperatureC.toFixed(0)}°C`,
    }));
    if (!hasPackaging) return segs;

    if (isKeg && isBottle) {
      // Split — keg and bottle carb in PARALLEL starting at package day. Two
      // sibling segments so each gets its own hover + label + color. Widths
      // are carved from the LONGER (bottle) duration so the total carb time
      // on the bar = max(keg, bottle) = bottle. Labels drop day counts so the
      // user can't read "keg N + bottle M = N+M" — only "keg" / "bottle".
      const kegPart = Math.min(carbs.keg, carbs.bottle);
      const bottleRemainder = Math.max(0, carbs.bottle - kegPart);
      if (kegPart > 0) {
        segs.push({
          kind: "carb-keg",
          label: "Keg",
          days: kegPart,
          color: hsTokens.honey,
          sub: `ready ${carbs.keg}d after package`,
        });
      }
      if (bottleRemainder > 0) {
        segs.push({
          kind: "carb-bottle",
          label: "Bottle",
          days: bottleRemainder,
          color: hsTokens.malt,
          sub: `ready ${carbs.bottle}d after package`,
        });
      }
    } else if (isKeg) {
      segs.push({
        kind: "carb-keg",
        label: carbMethod === "burst" ? "Burst carb" : "Force carb",
        days: carbs.keg,
        color: hsTokens.honey,
        sub: `~${kegPsi.toFixed(0)} psi`,
      });
    } else if (isBottle) {
      segs.push({
        kind: "carb-bottle",
        label: "Bottle condition",
        days: carbs.bottle,
        color: hsTokens.malt,
        sub: `~${primingSugarG.toFixed(0)}g sugar`,
      });
    }
    return segs;
  }, [steps, hasPackaging, isKeg, isBottle, carbs, kegPsi, primingSugarG, carbMethod]);

  const packageDay = totalDays;
  const kegReadyDay = isKeg ? packageDay + carbs.keg : null;
  const bottleReadyDay = isBottle ? packageDay + carbs.bottle : null;
  const readyDay = segments.reduce((sum, s) => sum + s.days, 0);

  // Brew/ready calendar pickers. The brew date is the "anchor" — setting it
  // moves the ready date forward by totalJourneyDays. Setting ready date
  // back-calculates the brew date by subtracting that span. State persists
  // via the brewDate PROP fed from recipe.brewDate (set by the parent), so
  // it survives tab navigation + page refresh + Firestore sync.
  const totalJourneyDays = readyDay;
  const computedReadyDate = useMemo(
    () => (brewDate ? addDays(brewDate, totalJourneyDays) : null),
    [brewDate, totalJourneyDays]
  );
  const handleBrewDateChange = (d: Date | null) => {
    onBrewDateUpdate(d);
  };
  const handleReadyDateChange = (d: Date | null) => {
    if (!d) {
      onBrewDateUpdate(null);
      return;
    }
    onBrewDateUpdate(addDays(d, -totalJourneyDays));
  };

  const readyScript = !hasSchedule
    ? "no plan yet"
    : !hasPackaging
      ? `${totalDays} day${totalDays === 1 ? "" : "s"} on yeast`
      : isKeg && isBottle
        ? `keg ~${kegReadyDay}d · bottle ~${bottleReadyDay}d`
        : `ready ~day ${readyDay}`;

  return (
    <div
      className="hs-fermentation-summary"
      style={{
        // Subtle ingredient tint: ~5% honey in the bg AND ~15% mixed into
        // the ink border. Compound signal — neither dimension loud alone.
        background:
          "color-mix(in srgb, color-mix(in srgb, var(--hs-cream), var(--hs-cream-2)) 95%, var(--hs-honey))",
        border: `2px solid color-mix(in srgb, ${hsTokens.ink} 85%, var(--hs-honey))`,
        borderRadius: 12,
        boxShadow: hsTokens.sh3,
        padding: "16px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Eyebrow size={11}>At a glance</Eyebrow>
        <HSScriptNote color={hsTokens.muted} size={14} rotate={-3}>
          {readyScript}
        </HSScriptNote>
      </div>

      <JourneyTimeline
        segments={segments}
        hasSchedule={hasSchedule}
        packageDay={packageDay}
        hasPackaging={hasPackaging}
        kegReadyDay={kegReadyDay}
        isSplit={isKeg && isBottle}
        brewDate={brewDate}
        computedReadyDate={computedReadyDate}
        onBrewDateChange={handleBrewDateChange}
        onReadyDateChange={handleReadyDateChange}
        pillsEnabled={hasSchedule || hasPackaging}
      />

      {hasSchedule ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))",
            gap: 6,
            paddingTop: 8,
            borderTop: `1px solid ${hsTokens.ink}1a`,
          }}
        >
          {/* One tile per fermentation step — multi-tiered schedules (hazy IPA
              with dry-hop + cold-crash, lager with diacetyl + lagering) get a
              dedicated tile so brewers see each phase's temp + duration.
              Label uses the user-edited step name so "Dry Hop" reads as
              "Dry Hop" instead of the canonical "Secondary" type label. */}
          {steps.map((s) => (
            <StatTile
              key={s.id}
              label={s.name || STEP_TYPE_LABELS[s.type] || s.type}
              value={`${s.temperatureC.toFixed(0)}°C`}
              sub={`${s.durationDays}d`}
              accent={stepTypeColor(s.type)}
            />
          ))}
          {hasPackaging ? (
            <StatTile
              label="CO₂"
              value={targetVols.toFixed(1)}
              sub="vol"
            />
          ) : null}
          {isKeg ? (
            <StatTile
              label="Keg PSI"
              value={kegPsi.toFixed(1)}
              sub={`@ ${servingTempC.toFixed(0)}°C`}
            />
          ) : null}
          {isBottle ? (
            <StatTile
              label="Bottle"
              value={`${primingSugarG.toFixed(0)}g`}
              sub={sugarLabel}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Date helpers ────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + Math.round(days));
  return result;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateToInputValue(date: Date): string {
  // YYYY-MM-DD — native <input type="date"> wants this format. Use local
  // components so DST/timezone shifts don't bump the displayed day.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── Calendar pill (brew date + ready date pickers) ──────────────

function DatePill({
  label,
  date,
  enabled,
  alignRight,
  onChange,
}: {
  label: string;
  date: Date | null;
  enabled: boolean;
  alignRight?: boolean;
  onChange: (d: Date | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    const el = inputRef.current;
    if (!el) return;
    // Newer browsers expose `showPicker()` which pops the native calendar
    // without a visible input field. Fall back to click() for older engines.
    type ShowPicker = () => void;
    const sp = (el as HTMLInputElement & { showPicker?: ShowPicker }).showPicker;
    if (typeof sp === "function") sp.call(el);
    else el.click();
  };

  const placeholderText = `set ${label} date`;
  const text = date ? formatShortDate(date) : placeholderText;

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!enabled}
        aria-label={
          date ? `Change ${label} date — currently ${formatShortDate(date)}` : `Set ${label} date`
        }
        className="hs-fermentation-date-pill"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: date ? hsTokens.paper : "transparent",
          border: `1.5px solid ${date ? hsTokens.ink : "rgba(26, 22, 18, 0.4)"}`,
          borderStyle: date ? "solid" : "dashed",
          borderRadius: 999,
          padding: "5px 12px 5px 9px",
          cursor: enabled ? "pointer" : "not-allowed",
          opacity: enabled ? 1 : 0.4,
          height: 28,
          boxShadow: date ? hsTokens.sh1 : "none",
          fontFamily: hsTokens.body,
          color: hsTokens.ink,
        }}
      >
        <CalendarIcon />
        <span
          style={{
            fontFamily: date ? hsTokens.script : hsTokens.body,
            fontSize: date ? 17 : 10,
            fontWeight: date ? 500 : 700,
            letterSpacing: date ? "0" : "0.14em",
            textTransform: date ? "none" : "uppercase",
            color: date ? hsTokens.ink : hsTokens.muted,
            lineHeight: 1,
          }}
        >
          {text}
        </span>
        {date ? (
          <span
            role="button"
            aria-label={`Clear ${label} date`}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onChange(null);
              }
            }}
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.muted,
              cursor: "pointer",
              padding: "0 2px",
              lineHeight: 1,
            }}
          >
            ×
          </span>
        ) : null}
      </button>
      {/* Hidden native date input — triggered via showPicker() above. Position
          off-screen but keep mounted so the ref is stable. */}
      <input
        ref={inputRef}
        type="date"
        value={date ? dateToInputValue(date) : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onChange(null);
            return;
          }
          // Use local-midday to avoid timezone-edge day shifts.
          const [y, m, d] = v.split("-").map(Number);
          if (y && m && d) onChange(new Date(y, m - 1, d, 12));
        }}
        aria-hidden
        tabIndex={-1}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: "none",
          left: alignRight ? "auto" : 0,
          right: alignRight ? 0 : "auto",
          top: 28,
        }}
      />
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

// ─── Keg-ready callout (split-packaging only) ────────────────────

// Sharp off-angle leader line + Caveat-script "keg ready" label pointing at
// the keg/bottle boundary on the journey bar. Tells the brewer the date (or
// day-offset) when the kegged portion is drinkable — NOT when it was filled.
// Anchored absolutely on a `position: relative` parent — leftPct is the
// percentage offset within the bar where the keg→bottle dashed divider sits.
function KeggedCallout({
  leftPct,
  date,
  dayOffset,
}: {
  leftPct: number;
  date: Date | null;
  dayOffset: number | null;
}) {
  const subLabel = date
    ? formatShortDate(date)
    : dayOffset != null
      ? `+${dayOffset}d`
      : null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        bottom: "100%",
        height: 28,
        pointerEvents: "none",
      }}
    >
      {/* Single sharp diagonal leader line going UP and LEFT from the boundary
          toward the centre of the bar — away from the right-side calendar
          button. Anchored via `right: 0` so the line's bottom-right tip sits
          exactly at the keg/bottle boundary; the rest extends leftward. */}
      <svg
        width="20"
        height="18"
        viewBox="0 0 20 18"
        style={{
          position: "absolute",
          right: -1,
          bottom: -1,
          overflow: "visible",
        }}
      >
        <path
          d="M 19 17 L 2 1"
          stroke="var(--hs-ink)"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          right: 20,
          bottom: 10,
          fontFamily: hsTokens.script,
          fontSize: 14,
          color: hsTokens.ink,
          whiteSpace: "nowrap",
          transform: "rotate(-3deg)",
          transformOrigin: "right bottom",
          lineHeight: 1,
        }}
      >
        keg ready{subLabel ? ` ${subLabel}` : ""}
      </span>
    </div>
  );
}

// Compact stat tile — one per important number. Used as a row of dashboard-
// style peekers below the journey timeline. Optional `accent` paints a small
// colored top stripe (used for per-fermentation-step tiles to tie them to
// the ledger badge colors).
function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 10px",
        background: hsTokens.paper,
        border: `1px solid ${hsTokens.ink}33`,
        borderRadius: 8,
        minWidth: 0,
        borderTop: accent ? `3px solid ${accent}` : `1px solid ${hsTokens.ink}33`,
      }}
    >
      <Eyebrow size={9}>{label}</Eyebrow>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 18,
          color: hsTokens.ink,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      {sub ? (
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 10,
            color: hsTokens.muted,
            lineHeight: 1.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </span>
      ) : null}
    </div>
  );
}

// ─── Journey timeline (horizontal stacked bar) ───────────────────

function JourneyTimeline({
  segments,
  hasSchedule,
  packageDay,
  hasPackaging,
  kegReadyDay,
  isSplit,
  brewDate,
  computedReadyDate,
  onBrewDateChange,
  onReadyDateChange,
  pillsEnabled,
}: {
  segments: JourneySeg[];
  hasSchedule: boolean;
  packageDay: number;
  hasPackaging: boolean;
  kegReadyDay: number | null;
  isSplit: boolean;
  brewDate: Date | null;
  computedReadyDate: Date | null;
  onBrewDateChange: (d: Date | null) => void;
  onReadyDateChange: (d: Date | null) => void;
  pillsEnabled: boolean;
}) {
  const total = segments.reduce((sum, s) => sum + s.days, 0);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  // Cumulative start/end day for each segment — used by tooltip date ranges
  // (when brewDate is set) and by the "kegged" callout's X position.
  const segOffsets = useMemo(() => {
    let cum = 0;
    return segments.map((s) => {
      const start = cum;
      cum += s.days;
      return { startDay: start, endDay: cum };
    });
  }, [segments]);

  const hovered = hoveredIdx !== null ? segments[hoveredIdx] : null;
  const hoveredOffsets = hoveredIdx !== null ? segOffsets[hoveredIdx] : null;
  const hoveredDateRange =
    brewDate && hovered && hoveredOffsets
      ? `${formatShortDate(addDays(brewDate, hoveredOffsets.startDay))} – ${formatShortDate(addDays(brewDate, hoveredOffsets.endDay))}`
      : null;

  // For split packaging, find the keg/bottle boundary as a % of bar width so
  // the "kegged" SVG callout anchors at the right horizontal position.
  const kegBoundaryPct = useMemo(() => {
    if (!isSplit) return null;
    const kegIdx = segments.findIndex((s) => s.kind === "carb-keg");
    if (kegIdx < 0) return null;
    const endDay = segOffsets[kegIdx]?.endDay ?? 0;
    return total > 0 ? (endDay / total) * 100 : null;
  }, [isSplit, segments, segOffsets, total]);
  const kegReadyDate =
    brewDate && kegReadyDay != null ? addDays(brewDate, kegReadyDay) : null;

  function applyTransform(clientX: number, clientY: number, rotation: number) {
    const t = tooltipRef.current;
    if (!t) return;
    t.style.transform = `translate(${clientX}px, ${clientY - 14}px) translate(-50%, -100%) rotate(${rotation}deg)`;
  }

  function onBarMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    const t = tooltipRef.current;
    if (!t) return;
    const last = lastClientXRef.current;
    const isFirstMove = last === null;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = isFirstMove ? 0 : Math.max(-18, Math.min(18, -dx * 0.6));

    if (isFirstMove) {
      // Snap to cursor without transition on first appearance — otherwise it
      // shoots in from viewport origin (the BillStack lesson from Phase 2.1).
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

  if (!hasSchedule) {
    return (
      <div
        style={{
          height: 44,
          background: hsTokens.cream2,
          border: `1.5px dashed ${hsTokens.ink}66`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 15,
            color: hsTokens.muted,
            lineHeight: 1,
          }}
        >
          add a schedule to see the journey —
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Calendar pills row sits ABOVE the bar with comfortable padding.
          Pills are at L/R extremes; the keg-ready callout (absolute on the
          bar wrapper) sits at the keg/bottle boundary in the middle — they
          share the vertical band above the bar without horizontal collision. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
        }}
      >
        <DatePill
          label="brew"
          date={brewDate}
          enabled={pillsEnabled}
          onChange={onBrewDateChange}
        />
        <DatePill
          label="ready"
          date={computedReadyDate}
          enabled={pillsEnabled}
          alignRight
          onChange={onReadyDateChange}
        />
      </div>
      {/* Position-relative wrapper so the SVG callout can absolute-anchor at
          the keg-ready X% inside this stage rather than the document. */}
      <div style={{ position: "relative" }}>
        {kegBoundaryPct != null ? (
          <KeggedCallout
            leftPct={kegBoundaryPct}
            date={kegReadyDate}
            dayOffset={kegReadyDay}
          />
        ) : null}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className="hs-fermentation-journey-bar"
          onMouseMove={onBarMouseMove}
          onMouseLeave={onBarMouseLeave}
          style={{
            display: "flex",
            height: 36,
            background: hsTokens.paper,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: hsTokens.sh1,
          }}
        >
        {segments.map((seg, i) => {
          // When a carb-bottle segment follows a carb-keg, the boundary is the
          // "keg ready" point inside one parallel carb period — render it as a
          // gentle dashed line instead of the segment-edge solid border.
          const prev = i > 0 ? segments[i - 1] : null;
          const dashedLeftBorder =
            prev !== null &&
            prev.kind === "carb-keg" &&
            seg.kind === "carb-bottle";
          return (
            <JourneySegment
              key={`${seg.label}-${i}`}
              seg={seg}
              total={total}
              isFirst={i === 0}
              dashedLeftBorder={dashedLeftBorder}
              onHover={() => setHoveredIdx(i)}
            />
          );
        })}
        </div>
      </div>

      {/* Day axis — just a centered "package · Nd" marker with dotted lines
          on either side. Brew + ready dates live in the calendar pills above
          so they don't need to repeat here. */}
      <div
        style={{
          display: "flex",
          fontFamily: hsTokens.mono,
          fontSize: 10,
          color: hsTokens.muted,
          letterSpacing: "0.02em",
          lineHeight: 1,
          alignItems: "baseline",
          gap: 6,
        }}
      >
        <span aria-hidden style={{ flex: 1, borderTop: `1px dotted ${hsTokens.ink}33`, position: "relative", top: -3 }} />
        <span style={{ whiteSpace: "nowrap" }}>
          {hasPackaging ? `Ferment · ${packageDay}d` : `end · ${packageDay}d`}
        </span>
        <span aria-hidden style={{ flex: 1, borderTop: `1px dotted ${hsTokens.ink}33`, position: "relative", top: -3 }} />
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
              minWidth: 200,
              maxWidth: 280,
            }}
          >
            <HSScriptNote color={hovered.color} size={18}>
              {hovered.kind === "carb-keg"
                ? "force carb —"
                : hovered.kind === "carb-bottle"
                  ? "bottle condition —"
                  : "fermentation —"}
            </HSScriptNote>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 14,
                color: hsTokens.ink,
                marginTop: 4,
              }}
            >
              {hovered.label}
            </div>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 12,
                color: hsTokens.muted,
                marginTop: 2,
              }}
            >
              {hovered.days} {hovered.days === 1 ? "day" : "days"}
              {hovered.sub ? ` · ${hovered.sub}` : ""}
            </div>
            {hoveredDateRange ? (
              <div
                style={{
                  fontFamily: hsTokens.script,
                  fontSize: 15,
                  color: hsTokens.ink,
                  marginTop: 4,
                  lineHeight: 1.2,
                }}
              >
                {hoveredDateRange}
              </div>
            ) : null}
            {hovered.kind !== "ferment" ? (
              <div
                style={{
                  fontFamily: hsTokens.script,
                  fontSize: 13,
                  color: hsTokens.muted,
                  marginTop: 4,
                  lineHeight: 1.25,
                }}
              >
                estimate — tune in the conditioning block
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function JourneySegment({
  seg,
  total,
  isFirst,
  dashedLeftBorder,
  onHover,
}: {
  seg: JourneySeg;
  total: number;
  isFirst: boolean;
  dashedLeftBorder?: boolean;
  onHover: () => void;
}) {
  const pct = total > 0 ? (seg.days / total) * 100 : 0;
  const showLabel = pct >= 12;
  // Carb segment uses a subtle diagonal stripe overlay to signal "estimated".
  const isCarb = seg.kind !== "ferment";
  const stripeOverlay = isCarb
    ? `repeating-linear-gradient(135deg, transparent 0 6px, rgba(0,0,0,0.06) 6px 7px)`
    : undefined;
  const leftBorder = isFirst
    ? "none"
    : dashedLeftBorder
      ? // Can't append hex alpha to a CSS var (var(--hs-ink)66 is invalid);
        // use literal rgba ink at ~40% opacity for the gentle dashed boundary
        // between keg and bottle segments inside the parallel carb period.
        `2px dashed rgba(26, 22, 18, 0.4)`
      : `1.5px solid ${hsTokens.ink}`;
  return (
    // Presentational chart segment — hover-only, no click; the cursor-follow
    // tooltip handles the affordance. Suppress a11y warning per the same
    // BillStack pattern.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      onMouseEnter={onHover}
      style={{
        flex: `${seg.days} 0 0`,
        minWidth: 6,
        backgroundColor: seg.color,
        backgroundImage: stripeOverlay,
        borderLeft: leftBorder,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
    >
      {showLabel ? (
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: hsTokens.ink,
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            overflow: "hidden",
            padding: "0 6px",
            opacity: 0.85,
            pointerEvents: "none",
          }}
        >
          {seg.label}
        </span>
      ) : null}
    </div>
  );
}

// ─── Packaging cards ─────────────────────────────────────────────

const cardStyle: CSSProperties = {
  background: "color-mix(in srgb, var(--hs-cream), var(--hs-cream-2))",
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: 12,
  boxShadow: hsTokens.sh3,
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

function CO2TargetsCard({
  targetVols,
  residualVols,
  peakFermTempC,
  hasSteps,
  styleSuggestion,
  styleName,
  onTargetChange,
}: {
  targetVols: number;
  residualVols: number;
  peakFermTempC: number;
  hasSteps: boolean;
  styleSuggestion: { min: number; max: number; typical: number } | null;
  styleName: string | null;
  onTargetChange: (v: number) => void;
}) {
  const needed = Math.max(0, targetVols - residualVols);
  return (
    <div className="hs-fermentation-pkg-card" style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Eyebrow size={11}>CO₂ target</Eyebrow>
        <HSScriptNote color={hsTokens.muted} size={14} rotate={-3}>
          {hasSteps ? `from ${peakFermTempC.toFixed(0)}°C peak ferment` : "no steps yet"}
        </HSScriptNote>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          flexWrap: "wrap",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <RoundedStepper
            value={targetVols}
            onChange={onTargetChange}
            min={0.5}
            max={5}
            step={0.1}
            format={(v) => v.toFixed(1)}
            suffix="vol"
            label="Target"
          />
          <InlineReadout label="Residual" value={residualVols.toFixed(2)} unit="vol" />
          <InlineReadout label="Needed" value={needed.toFixed(2)} unit="vol" />
        </div>
        {styleSuggestion && styleName ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: hsTokens.muted,
              }}
            >
              Suggested:
            </span>
            <SuggestedStyleButton
              styleName={styleName}
              range={styleSuggestion}
              onApply={() => onTargetChange(styleSuggestion.typical)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// "Suggested:" button that surfaces the BJCP style + range on the right side
// of the CO₂ target row. Click applies the BJCP typical value. Compact form
// so the input group + readouts + button all fit on one row inside the card.
function SuggestedStyleButton({
  styleName,
  range,
  onApply,
}: {
  styleName: string;
  range: { min: number; max: number; typical: number };
  onApply: () => void;
}) {
  // Trim "15A. Irish Red Ale" → "Irish Red Ale" so the button stays narrow;
  // full code lives in the title tooltip.
  const trimmedName = styleName.replace(/^\d+[A-Z]?\.\s*/, "");
  return (
    <button
      type="button"
      onClick={onApply}
      className="hs-fermentation-style-chip"
      aria-label={`Apply BJCP typical ${range.typical} vol for ${styleName}`}
      title={`${styleName} — apply BJCP typical ${range.typical} vol (range ${range.min}–${range.max})`}
      style={{
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 10,
        padding: "0 12px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: hsTokens.body,
        fontSize: 12,
        color: hsTokens.ink,
        height: 32,
        boxShadow: hsTokens.sh1,
      }}
    >
      <span style={{ fontWeight: 700, letterSpacing: "0.01em" }}>{trimmedName}</span>
      <span style={{ fontFamily: hsTokens.mono, fontSize: 11, color: hsTokens.muted }}>
        {range.min}–{range.max}
      </span>
      <span
        style={{
          fontFamily: hsTokens.script,
          fontSize: 14,
          color: hsTokens.muted,
        }}
      >
        ↗{range.typical}
      </span>
    </button>
  );
}

function KegPsiCard({
  psi,
  servingTempC,
  carbMethod,
  onServingTempChange,
  onCarbMethodChange,
}: {
  psi: number;
  servingTempC: number;
  carbMethod: "set-and-forget" | "burst";
  onServingTempChange: (v: number) => void;
  onCarbMethodChange: (v: "set-and-forget" | "burst") => void;
}) {
  const taglineCopy =
    carbMethod === "burst"
      ? "30 psi for 24h, then drop to serving psi."
      : "Hold at serving psi 5–7 days.";
  return (
    <div className="hs-fermentation-pkg-card" style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Eyebrow size={11}>Keg · force carb</Eyebrow>
        <CarbMethodToggle method={carbMethod} onChange={onCarbMethodChange} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <RoundedStepper
          value={servingTempC}
          onChange={onServingTempChange}
          min={-2}
          max={20}
          step={0.5}
          format={(v) => v.toFixed(1)}
          suffix="°C"
          label="Serving"
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 4,
            textAlign: "right",
            flex: "0 1 auto",
            maxWidth: 180,
            minWidth: 0,
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontFamily: hsTokens.display,
                fontSize: 28,
                color: hsTokens.ink,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {psi.toFixed(1)}
            </span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 12,
                color: hsTokens.muted,
              }}
            >
              psi
            </span>
          </div>
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 13,
              color: hsTokens.muted,
              lineHeight: 1.25,
            }}
          >
            {taglineCopy}
          </span>
        </div>
      </div>
    </div>
  );
}

// Tiny segmented toggle that lives in the KegPsi card header. Switching it
// updates `packaging.carbonationMethod` AND the timeline's carb-duration
// estimate (burst ≈ 2d, set-and-forget ≈ 5d).
function CarbMethodToggle({
  method,
  onChange,
}: {
  method: "set-and-forget" | "burst";
  onChange: (v: "set-and-forget" | "burst") => void;
}) {
  const opts: { value: "set-and-forget" | "burst"; label: string; sub: string }[] = [
    { value: "set-and-forget", label: "Set & forget", sub: "~5d" },
    { value: "burst", label: "Burst", sub: "~2d" },
  ];
  return (
    <div
      role="group"
      aria-label="Carbonation method"
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        overflow: "hidden",
        height: 28,
      }}
    >
      {opts.map((opt, i) => {
        const selected = opt.value === method;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            style={{
              background: selected ? hsTokens.honey : "transparent",
              border: "none",
              borderLeft: i === 0 ? "none" : `1.5px solid ${hsTokens.ink}33`,
              padding: "0 10px",
              cursor: "pointer",
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: selected ? hsTokens.ink : hsTokens.muted,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              lineHeight: 1,
            }}
          >
            <span>{opt.label}</span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 9,
                opacity: 0.7,
                textTransform: "none",
                letterSpacing: "0.02em",
              }}
            >
              {opt.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PrimingSugarCard({
  grams,
  batchVolumeL,
  residualVols,
  targetVols,
  sugarType,
  onSugarTypeChange,
}: {
  grams: number;
  batchVolumeL: number;
  residualVols: number;
  targetVols: number;
  sugarType: PrimingSugarType;
  onSugarTypeChange: (v: PrimingSugarType) => void;
}) {
  const insufficient = targetVols <= residualVols;
  const oz = pkgCalc.gramsToOz(grams);
  const gPerL = batchVolumeL > 0 ? grams / batchVolumeL : 0;
  return (
    <div className="hs-fermentation-pkg-card" style={cardStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Eyebrow size={11}>Bottle · prime</Eyebrow>
        <HSScriptNote color={hsTokens.muted} size={14} rotate={-3}>
          {batchVolumeL > 0 ? `${batchVolumeL.toFixed(1)} L batch` : "no batch yet"}
        </HSScriptNote>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(78px, 1fr))",
          gap: 6,
        }}
      >
        {SUGAR_OPTIONS.map((opt) => {
          const selected = opt.value === sugarType;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSugarTypeChange(opt.value)}
              aria-pressed={selected}
              className="hs-fermentation-sugar-chip"
              style={{
                background: selected ? hsTokens.paper : "transparent",
                border: `1.5px solid ${selected ? hsTokens.ink : `${hsTokens.ink}55`}`,
                borderRadius: 8,
                padding: "5px 8px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                alignItems: "flex-start",
                boxShadow: selected ? hsTokens.sh1 : "none",
                transition: "background 90ms ease, border-color 90ms ease",
              }}
            >
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 11,
                  color: hsTokens.ink,
                  letterSpacing: "0.02em",
                }}
              >
                {opt.label}
              </span>
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 9,
                  color: hsTokens.muted,
                  lineHeight: 1.1,
                }}
              >
                {opt.sub}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 4,
          borderTop: `1px solid ${hsTokens.ink}22`,
        }}
      >
        <Eyebrow size={9}>Add</Eyebrow>
        {insufficient ? (
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 16,
              color: hsTokens.muted,
              lineHeight: 1,
            }}
          >
            already over target —
          </span>
        ) : (
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontFamily: hsTokens.display,
                fontSize: 26,
                color: hsTokens.ink,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {grams.toFixed(0)}
            </span>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 12,
                color: hsTokens.muted,
              }}
            >
              g · {oz.toFixed(2)} oz · {gPerL.toFixed(1)} g/L
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

// Rounded-rect stepper — the input pattern for sidebar/card fields. Borrows
// the +/- nudge UX from the original MiniStepper but with `border-radius: 10`
// (rect) instead of `999` (pill). A small "label" eyebrow renders inside the
// stepper on the left so the field name and value sit on the same line.
function RoundedStepper({
  value,
  onChange,
  min,
  max,
  step,
  format,
  suffix,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  suffix?: string;
  label?: string;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const nudge = (dir: 1 | -1) => {
    const next = clamp(parseFloat((value + dir * step).toFixed(4)));
    if (next !== value) onChange(next);
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "stretch",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 10,
        boxShadow: hsTokens.sh1,
        overflow: "hidden",
        height: 32,
      }}
    >
      {label ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0 10px",
            background: hsTokens.cream2,
            borderRight: `1.5px solid ${hsTokens.ink}33`,
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            lineHeight: 1,
          }}
        >
          {label}
        </span>
      ) : null}
      <RoundedStepperBtn onClick={() => nudge(-1)} label="Decrease" symbol="−" />
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const parsed = parseFloat(e.target.value);
          if (Number.isFinite(parsed)) onChange(clamp(parsed));
        }}
        step={step}
        min={min}
        max={max}
        aria-label={label ?? suffix ?? "value"}
        style={{
          width: 52,
          textAlign: "center",
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 14,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          padding: 0,
          MozAppearance: "textfield",
        }}
      />
      {suffix ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            paddingRight: 4,
            fontFamily: hsTokens.mono,
            fontSize: 10,
            color: hsTokens.muted,
          }}
        >
          {suffix}
        </span>
      ) : null}
      <RoundedStepperBtn onClick={() => nudge(1)} label="Increase" symbol="+" />
      <span hidden>{format(value)}</span>
    </div>
  );
}

function RoundedStepperBtn({
  onClick,
  label,
  symbol,
}: {
  onClick: () => void;
  label: string;
  symbol: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="hs-fermentation-stepper-btn"
      style={{
        width: 24,
        background: "transparent",
        border: "none",
        borderLeft: `1px solid ${hsTokens.ink}22`,
        cursor: "pointer",
        fontFamily: hsTokens.body,
        fontSize: 14,
        fontWeight: 700,
        color: hsTokens.ink,
        padding: 0,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {symbol}
    </button>
  );
}

// Inline readout — label + value on one row, used when a card packs several
// metrics on a single row (e.g. CO2 target's Residual + Needed). Different
// from the vertical-stack MiniReadout it replaces.
function InlineReadout({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4 }}>
      <Eyebrow size={9}>{label}</Eyebrow>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 15,
          color: hsTokens.ink,
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10,
          color: hsTokens.muted,
        }}
      >
        {unit}
      </span>
    </span>
  );
}


// ─── Eyebrow ──────────────────────────────────────────────────────

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

// ─── Mobile add row (chunky dashed border via SVG) ────────────────

function dashedBorderBg(
  color: string,
  opts: { dash: number; gap: number; strokeWidth: number; radius: number }
) {
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
const MOBILE_ADD_DASH = 12;
const MOBILE_ADD_GAP = 8;
const MOBILE_ADD_STROKE = 1.75;

function MobileAddRow({ onAdd }: { onAdd: () => void }) {
  const restBg = "color-mix(in srgb, var(--hs-cream-2) 65%, transparent)";
  const restBorder = dashedBorderBg("#5a4f42", {
    dash: MOBILE_ADD_DASH,
    gap: MOBILE_ADD_GAP,
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  const hoverBorder = dashedBorderBg("#1a1612", {
    dash: MOBILE_ADD_DASH,
    gap: MOBILE_ADD_GAP,
    strokeWidth: MOBILE_ADD_STROKE,
    radius: MOBILE_ADD_RADIUS,
  });
  return (
    <button
      type="button"
      className="hs-fermentation-mobile-add"
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
        e.currentTarget.style.backgroundColor = hsTokens.paper;
        e.currentTarget.style.color = hsTokens.ink;
        e.currentTarget.style.backgroundImage = hoverBorder;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = restBg;
        e.currentTarget.style.color = hsTokens.muted;
        e.currentTarget.style.backgroundImage = restBorder;
      }}
    >
      + Add another step
    </button>
  );
}

// ─── Styles (responsive + row hover) ──────────────────────────────

function FermentationSectionStyles() {
  return (
    <style>{`
      /* Single-column layout — the aside (summary + notes) has been
         hoisted to the parent HopSkipBuilder grid so it can morph
         between tabs. */
      .hs-fermentation-section .hs-fermentation-grid {
        display: flex;
        flex-direction: column;
        row-gap: 16px;
        min-width: 0;
      }
      .hs-fermentation-section .hs-fermentation-grid-lhead {
        min-width: 0;
      }
      .hs-fermentation-section .hs-fermentation-grid-main {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .hs-fermentation-section .hs-fermentation-block {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .hs-fermentation-section .hs-fermentation-sugar-chip:hover {
        background: ${hsTokens.paper};
      }
      .hs-fermentation-section .hs-fermentation-style-chip:hover {
        background: ${hsTokens.cream2};
      }
      .hs-fermentation-section .hs-fermentation-method-card:hover {
        transform: translate(-1px, -1px);
        box-shadow: ${hsTokens.sh3};
      }
      /* Hide Webkit number-input spinners — we have our own +/− buttons. */
      .hs-fermentation-section .hs-fermentation-pkg-card input[type="number"]::-webkit-outer-spin-button,
      .hs-fermentation-section .hs-fermentation-pkg-card input[type="number"]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      @media (max-width: 900px) {
        .hs-fermentation-section .hs-fermentation-grid {
          row-gap: 14px;
        }
      }

      @media (min-width: 641px) and (hover: hover) {
        .hs-fermentation-section .hs-fermentation-data-row {
          transition: background 90ms ease;
        }
        .hs-fermentation-section .hs-fermentation-data-row:hover {
          /* Section-tinted hover: ~2% honey mixed into a paper/cream-2 base —
             lighter overall than pure cream-2 so the hover lifts. */
          background: color-mix(in srgb, color-mix(in srgb, var(--hs-paper) 20%, var(--hs-cream-2)) 98%, var(--hs-honey));
        }
        .hs-fermentation-section .hs-fermentation-name-btn:hover .hs-fermentation-name {
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .hs-fermentation-section .hs-fermentation-edit-btn:hover {
          background: ${hsTokens.cream2};
          border-bottom-style: solid !important;
        }
        .hs-fermentation-section .hs-fermentation-gen-card:hover {
          transform: translate(-1px, -1px);
          box-shadow: ${hsTokens.sh3};
        }
      }

      @media (max-width: 640px) {
        .hs-fermentation-section .hs-fermentation-mobile-add {
          display: flex !important;
        }

        .hs-fermentation-section .hs-fermentation-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 0 !important;
        }
        .hs-fermentation-section .hs-fermentation-steppers button {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          width: 26px !important;
          height: 22px !important;
          color: ${hsTokens.muted} !important;
        }
        .hs-fermentation-section .hs-fermentation-steppers button svg {
          width: 14px !important;
          height: 9px !important;
          stroke-width: 2 !important;
        }
        .hs-fermentation-section .hs-fermentation-move-btn,
        .hs-fermentation-section .hs-fermentation-remove-btn {
          opacity: 1 !important;
        }
        .hs-fermentation-section .hs-fermentation-ledger {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .hs-fermentation-section .hs-fermentation-ledger-head-row {
          display: none !important;
        }
        .hs-fermentation-section .hs-fermentation-data-row {
          display: grid !important;
          grid-template-columns: 44px minmax(0, 1fr) auto !important;
          grid-template-areas:
            "badge name  actions"
            "badge band  band"
            "temp  temp  time" !important;
          column-gap: 12px !important;
          row-gap: 8px !important;
          padding: 16px 0 !important;
          border-bottom: 1px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-fermentation-section .hs-fermentation-data-row:last-of-type {
          border-bottom: none !important;
        }
        .hs-fermentation-section .hs-fermentation-data-row > :nth-child(1) {
          grid-area: badge;
        }
        .hs-fermentation-section .hs-fermentation-data-row > :nth-child(2) {
          grid-area: name;
          min-width: 0;
        }
        .hs-fermentation-section .hs-fermentation-data-row > :nth-child(3) {
          grid-area: temp !important;
          justify-self: start !important;
          justify-content: flex-start;
        }
        .hs-fermentation-section .hs-fermentation-data-row > :nth-child(4) {
          grid-area: time !important;
          justify-self: end !important;
          justify-content: flex-end;
        }
        .hs-fermentation-section .hs-fermentation-data-row > :nth-child(5) {
          grid-area: actions;
          justify-self: end;
        }
        .hs-fermentation-section .hs-fermentation-edit-btn {
          padding: 4px 36px 4px 8px !important;
        }
        .hs-fermentation-section .hs-fermentation-edit-btn > span:first-child {
          font-size: 32px !important;
        }
        .hs-fermentation-section .hs-fermentation-total-row {
          display: flex !important;
          justify-content: space-between !important;
          align-items: baseline !important;
          padding: 16px 0 !important;
          border-top: 2px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-fermentation-section .hs-fermentation-total-row > * {
          padding: 0 !important;
        }
        .hs-fermentation-section .hs-fermentation-total-row > :nth-child(1),
        .hs-fermentation-section .hs-fermentation-total-row > :nth-child(3),
        .hs-fermentation-section .hs-fermentation-total-row > :nth-child(5) {
          display: none !important;
        }
        .hs-fermentation-section {
          padding: 18px 14px !important;
        }
        .hs-fermentation-section .hs-fermentation-ledger-head {
          flex-wrap: wrap;
        }
      }
    `}</style>
  );
}

// ─── Helper-card container (mounted by HelperCardMorph) ───────────

export function FermentationHelperCard() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const steps = useMemo<FermentationStep[]>(
    () => currentRecipe?.fermentationSteps ?? [],
    [currentRecipe?.fermentationSteps]
  );
  const totalDays = steps.reduce((acc, s) => acc + s.durationDays, 0);
  const pkg = currentRecipe?.packaging ?? DEFAULT_PACKAGING;
  const peakFermTempC = useMemo(() => pkgCalc.highestFermTemp(steps), [steps]);
  const residualCo2 = useMemo(() => pkgCalc.residualCo2(peakFermTempC), [peakFermTempC]);
  const batchVolumeL = currentRecipe?.batchVolumeL ?? 0;
  const kegPsi = useMemo(
    () => pkgCalc.forcedCarbonationPsi(pkg.servingTempC ?? 4, pkg.targetCo2Volumes),
    [pkg.servingTempC, pkg.targetCo2Volumes]
  );
  const primingSugarG = useMemo(
    () =>
      pkgCalc.primingSugarGrams(
        pkg.targetCo2Volumes,
        residualCo2,
        batchVolumeL,
        pkg.primingSugarType ?? "corn-sugar"
      ),
    [pkg.targetCo2Volumes, residualCo2, batchVolumeL, pkg.primingSugarType]
  );
  const brewDate = useMemo(() => {
    const s = currentRecipe?.brewDate;
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12);
  }, [currentRecipe?.brewDate]);
  const handleBrewDateUpdate = (d: Date | null) => {
    updateRecipe({ brewDate: d ? dateToInputValue(d) : undefined });
  };
  if (!currentRecipe || steps.length === 0) return null;
  return (
    <SummaryCard
      steps={steps}
      totalDays={totalDays}
      hasPackaging={!!currentRecipe.packaging}
      methods={currentRecipe.packaging?.methods ?? []}
      targetVols={pkg.targetCo2Volumes}
      kegPsi={kegPsi}
      servingTempC={pkg.servingTempC ?? 4}
      primingSugarG={primingSugarG}
      sugarType={pkg.primingSugarType ?? "corn-sugar"}
      carbMethod={pkg.carbonationMethod ?? "set-and-forget"}
      conditioningTempC={pkg.conditioningTempC ?? 20}
      brewDate={brewDate}
      onBrewDateUpdate={handleBrewDateUpdate}
    />
  );
}
