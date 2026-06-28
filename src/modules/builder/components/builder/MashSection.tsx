"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { hsTokens, hsAlpha, emptyStateTitleStyle } from "../../tokens";
import HSScriptNote from "../HSScriptNote";
import HSButton from "../HSButton";
import HSActionMenu from "../HSActionMenu";
import MashStepModal from "../modals/MashStepModal";

import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { useRecipeCalculations } from "@/modules/recipe/hooks/useRecipeCalculations";
import { mashScheduleService } from "@/modules/recipe/services/MashScheduleService";
import type { MashStep } from "@/modules/recipe/models/Recipe";

// ─── Color band per rest type ────────────────────────────────────
// Acid (cool) → straw; Beta (sacch low) → honey; Alpha (sacch high) → malt;
// Mash out (hot) → roast. Used by the chart and the step swatch.
function temperatureColor(tempC: number): string {
  if (tempC < 48) return "#cfa55c"; // acid: dim straw
  if (tempC < 60) return hsTokens.honey; // protein
  if (tempC < 66) return "#e8b94a"; // beta: deeper honey
  if (tempC < 72) return hsTokens.malt; // alpha
  return hsTokens.roast; // mash out
}

function temperatureBand(tempC: number): string {
  if (tempC < 48) return "Acid rest";
  if (tempC < 60) return "Protein";
  if (tempC < 66) return "Beta";
  if (tempC < 72) return "Alpha";
  return "Mash out";
}

interface StepDerived {
  step: MashStep;
  startMin: number;
  endMin: number;
  color: string;
  band: string;
}

export default function MashSection() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const addMashStep = useRecipeStore((s) => s.addMashStep);
  const updateMashStep = useRecipeStore((s) => s.updateMashStep);
  const removeMashStep = useRecipeStore((s) => s.removeMashStep);
  const reorderMashSteps = useRecipeStore((s) => s.reorderMashSteps);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<MashStep | undefined>(undefined);

  const mashSteps = useMemo(
    () => currentRecipe?.mashSteps ?? [],
    [currentRecipe?.mashSteps]
  );

  const totalGrainKg = useMemo(
    () => currentRecipe?.fermentables.reduce((sum, f) => sum + f.weightKg, 0) ?? 0,
    [currentRecipe?.fermentables]
  );

  const derived = useMemo<StepDerived[]>(() => {
    let cumulative = 0;
    return mashSteps.map((s) => {
      const startMin = cumulative;
      cumulative += s.durationMinutes;
      return {
        step: s,
        startMin,
        endMin: cumulative,
        color: temperatureColor(s.temperatureC),
        band: temperatureBand(s.temperatureC),
      };
    });
  }, [mashSteps]);

  const totalMinutes = derived.length > 0 ? derived[derived.length - 1].endMin : 0;

  const handleOpenAdd = () => {
    setEditingStep(undefined);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (step: MashStep) => {
    setEditingStep(step);
    setIsModalOpen(true);
  };

  const handleSave = (step: MashStep) => {
    if (editingStep) {
      updateMashStep(step.id, step);
    } else {
      addMashStep(step);
    }
  };

  const replaceSchedule = (steps: MashStep[], label: string) => {
    if (mashSteps.length > 0) {
      if (!confirm(`This will replace your current mash schedule with ${label}. Continue?`)) {
        return;
      }
      mashSteps.forEach((s) => removeMashStep(s.id));
    }
    steps.forEach((s) => addMashStep(s));
  };

  const generators = useMemo(
    () => [
      {
        label: "Single Infusion",
        sub: "67°C × 60 min",
        apply: () =>
          replaceSchedule(
            [mashScheduleService.generateDefaultSingleInfusion()],
            "a single infusion"
          ),
      },
      {
        label: "Step Mash",
        sub: "52 → 63 → 70 → 76",
        apply: () => replaceSchedule(mashScheduleService.generateStepMash(), "a step mash"),
      },
      {
        label: "Decoction",
        sub: "40 → 52 → 67 → 76",
        apply: () => replaceSchedule(mashScheduleService.generateDecoction(), "a decoction"),
      },
    ],
    // mashSteps is read inside replaceSchedule via the closure; eslint can't see it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mashSteps]
  );

  const handleNudge = (id: string, current: MashStep, dir: 1 | -1, field: "temp" | "time") => {
    if (field === "temp") {
      const next = Math.max(0, Math.min(100, parseFloat((current.temperatureC + dir * 0.5).toFixed(1))));
      if (next !== current.temperatureC) updateMashStep(id, { temperatureC: next });
    } else {
      const next = Math.max(1, current.durationMinutes + dir * 5);
      if (next !== current.durationMinutes) updateMashStep(id, { durationMinutes: next });
    }
  };

  if (!currentRecipe) return null;

  return (
    <section className="hs-mash-section" style={sectionFrameStyle}>
      <MashSectionStyles />

      <SectionTitle />

      {derived.length === 0 ? (
        <EmptyState
          onAdd={handleOpenAdd}
          generators={generators}
        />
      ) : (
        <div className="hs-mash-grid">
          <div className="hs-mash-grid-lhead">
            <LedgerHeaderRow
              entryCount={derived.length}
              totalMinutes={totalMinutes}
              onAdd={handleOpenAdd}
              generators={generators}
            />
          </div>

          <div className="hs-mash-grid-ltable">
            <Ledger
              derived={derived}
              onEditStep={handleOpenEdit}
              onRemoveStep={removeMashStep}
              onTempChange={(id, v) => updateMashStep(id, { temperatureC: v })}
              onTimeChange={(id, v) => updateMashStep(id, { durationMinutes: v })}
              onTempNudge={(id, step, dir) => handleNudge(id, step, dir, "temp")}
              onTimeNudge={(id, step, dir) => handleNudge(id, step, dir, "time")}
              onReorder={reorderMashSteps}
              onAdd={handleOpenAdd}
            />
          </div>

        </div>
      )}

      <MashStepModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        existingStep={editingStep}
        totalGrainKg={totalGrainKg}
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
        borderBottom: `2px solid ${hsTokens.roast}`,
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
        Mash.
      </h2>
    </header>
  );
}

// ─── Empty state ──────────────────────────────────────────────────

interface Generator {
  label: string;
  sub: string;
  apply: () => void;
}

function EmptyState({
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
      <HSScriptNote color={hsTokens.roast} rotate={-4} style={emptyStateTitleStyle}>
        Mash Schedule
      </HSScriptNote>
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
            className="hs-mash-gen-card"
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
      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 15,
          color: hsTokens.muted,
          margin: 0,
          maxWidth: 420,
          lineHeight: 1.4,
        }}
      >
        Pick a starting point and tweak. Most all-grain recipes do fine with a single
        infusion — step + decoction unlock specific flavors.
      </p>
      <HSButton onClick={onAdd} color={hsTokens.roast} size="md">
        Or add a custom step
      </HSButton>
    </div>
  );
}

// ─── Ledger header row ───────────────────────────────────────────

function LedgerHeaderRow({
  entryCount,
  totalMinutes,
  onAdd,
  generators,
}: {
  entryCount: number;
  totalMinutes: number;
  onAdd: () => void;
  generators: Generator[];
}) {
  return (
    <div
      className="hs-mash-ledger-head"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingTop: 2,
      }}
    >
      <Eyebrow size={11}>Mash schedule</Eyebrow>
      <HSScriptNote color={hsTokens.muted} size={15} rotate={-3}>
        drag to reorder
      </HSScriptNote>
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
      <HSScriptNote color={hsTokens.muted} size={16} rotate={-3}>
        {entryCount} {entryCount === 1 ? "step" : "steps"} · {totalMinutes} min
      </HSScriptNote>
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
        triggerStyle={{
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 999,
          padding: "6px 14px",
          width: "auto",
          height: "auto",
          boxShadow: hsTokens.sh1,
          color: hsTokens.ink,
          cursor: "pointer",
        }}
        items={generators.map((g) => ({
          label: `${g.label}  —  ${g.sub}`,
          onClick: g.apply,
        }))}
      />
      <HSButton onClick={onAdd} color={hsTokens.roast} size="sm">
        + Add step
      </HSButton>
    </div>
  );
}

// ─── Ledger ──────────────────────────────────────────────────────

const LEDGER_COLS = "44px minmax(0, 1.5fr) 132px 132px 40px";

function Ledger({
  derived,
  onEditStep,
  onRemoveStep,
  onTempChange,
  onTimeChange,
  onTempNudge,
  onTimeNudge,
  onReorder,
  onAdd,
}: {
  derived: StepDerived[];
  onEditStep: (step: MashStep) => void;
  onRemoveStep: (id: string) => void;
  onTempChange: (id: string, v: number) => void;
  onTimeChange: (id: string, v: number) => void;
  onTempNudge: (id: string, step: MashStep, dir: 1 | -1) => void;
  onTimeNudge: (id: string, step: MashStep, dir: 1 | -1) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  onAdd: () => void;
}) {
  const ids = derived.map((d) => d.step.id);

  // Whole row is the drag surface (no handle). Mouse: require 8px of travel
  // before drag starts so clicking the name / value / × still registers as
  // a click. Touch: 180ms press-and-hold so finger swipes scroll the page
  // and only a deliberate hold begins a drag. Keyboard sensor for a11y.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex, newIndex);
  };

  return (
    <div
      className="hs-mash-ledger"
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh3,
        overflow: "hidden",
      }}
    >
      <LedgerHead />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {derived.map((d, i) => (
            <LedgerRow
              key={d.step.id}
              d={d}
              index={i}
              isLast={i === derived.length - 1}
              isOnlyOne={derived.length === 1}
              onEdit={() => onEditStep(d.step)}
              onRemove={() => onRemoveStep(d.step.id)}
              onTempChange={(v) => onTempChange(d.step.id, v)}
              onTimeChange={(v) => onTimeChange(d.step.id, v)}
              onTempNudge={(dir) => onTempNudge(d.step.id, d.step, dir)}
              onTimeNudge={(dir) => onTimeNudge(d.step.id, d.step, dir)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <LedgerTotal derived={derived} />
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
      className="hs-mash-ledger-head-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "10px 18px 8px",
        borderBottom: `2px solid ${hsTokens.ink}`,
        // Section-tinted ledger head: ~7% roast mixed into cream.
        background: "color-mix(in srgb, var(--hs-cream) 96%, var(--hs-roast))",
        gap: 14,
        alignItems: "center",
      }}
    >
      <span style={{ ...cellStyle, textAlign: "center" }}>#</span>
      <span style={cellStyle}>Step</span>
      {/* Centered above the (also-centered) value chips below. The
          32px right offset compensates for the chip's right stepper
          padding so the header centers over the visible glyphs, not
          the button bbox. */}
      <span style={{ ...cellStyle, textAlign: "center", paddingRight: 32 }}>Temp</span>
      <span style={{ ...cellStyle, textAlign: "center", paddingRight: 32 }}>Time</span>
      <span style={{ ...cellStyle, textAlign: "right" }}>—</span>
    </div>
  );
}

function LedgerRow({
  d,
  index,
  isLast,
  isOnlyOne,
  onEdit,
  onRemove,
  onTempChange,
  onTimeChange,
  onTempNudge,
  onTimeNudge,
}: {
  d: StepDerived;
  index: number;
  isLast: boolean;
  isOnlyOne: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onTempChange: (v: number) => void;
  onTimeChange: (v: number) => void;
  onTempNudge: (dir: 1 | -1) => void;
  onTimeNudge: (dir: 1 | -1) => void;
}) {
  const dark = d.step.temperatureC >= 72;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: d.step.id });
  return (
    <div
      ref={setNodeRef}
      className="hs-mash-ledger-row hs-mash-data-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 18px",
        borderBottom: isLast ? "none" : `1px solid ${hsAlpha(hsTokens.ink, 13)}`,
        alignItems: "center",
        gap: 14,
        transform: CSS.Transform.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 5 : undefined,
        opacity: isDragging ? 0.92 : 1,
        background: isDragging ? hsTokens.paper : undefined,
        boxShadow: isDragging ? hsTokens.sh3 : undefined,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      {...attributes}
      {...listeners}
    >
      {/* Step badge (# + temperature swatch) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span
          aria-hidden
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: d.color,
            border: `2px solid ${hsTokens.ink}`,
            boxShadow: hsTokens.sh1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: hsTokens.display,
            fontSize: 14,
            color: dark ? hsTokens.cream : hsTokens.ink,
            lineHeight: 1,
          }}
        >
          {index + 1}
        </span>
      </div>

      {/* Step name (click → edit) + band caption */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${d.step.name}`}
          className="hs-mash-name-btn"
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
            className="hs-mash-name"
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
          {d.band}
          {d.step.decoctionVolumeLiters && d.step.decoctionVolumeLiters > 0
            ? ` · decoction ${d.step.decoctionVolumeLiters} L`
            : ""}
        </span>
      </div>

      {/* Temperature chip */}
      <div className="hs-mash-edit-cell" style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={d.step.temperatureC}
          step={0.5}
          min={0}
          max={100}
          format={(v) => v.toFixed(1)}
          suffix="°C"
          ariaLabel={`Temperature for ${d.step.name}`}
          onCommit={onTempChange}
          onNudge={onTempNudge}
        />
      </div>

      {/* Duration chip */}
      <div className="hs-mash-edit-cell" style={{ display: "flex", justifyContent: "center" }}>
        <EditableCell
          value={d.step.durationMinutes}
          step={5}
          min={1}
          max={240}
          format={(v) => String(Math.round(v))}
          suffix="min"
          ariaLabel={`Duration for ${d.step.name}`}
          onCommit={onTimeChange}
          onNudge={onTimeNudge}
        />
      </div>

      {/* Remove × (the whole row is the drag surface — no move chevrons). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <IconBtn
          ariaLabel={`Remove ${d.step.name}`}
          onClick={onRemove}
          disabled={isOnlyOne}
          className="hs-mash-remove-btn"
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

function LedgerTotal({ derived }: { derived: StepDerived[] }) {
  const totalMin = derived.length > 0 ? derived[derived.length - 1].endMin : 0;
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
      className="hs-mash-total-row"
      style={{
        display: "grid",
        gridTemplateColumns: LEDGER_COLS,
        padding: "14px 18px",
        borderTop: `2px solid ${hsTokens.ink}`,
        // Section-tinted total band — same 7% roast mix as the ledger head.
        background: "color-mix(in srgb, var(--hs-cream-2) 96%, var(--hs-roast))",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span aria-hidden style={cellLabelStyle}>
        Σ
      </span>
      <span style={cellLabelStyle}>Total mash time</span>
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
        {totalMin}
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 12,
            color: hsTokens.muted,
            marginLeft: 4,
          }}
        >
          min
        </span>
      </span>
      <span aria-hidden />
    </div>
  );
}

// ─── Editable chip — paper bg, script numerals, roast-bordered input ─

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
          width: 96,
          background: hsTokens.cream,
          border: `1.5px solid ${hsTokens.roast}`,
          outline: "none",
          fontFamily: hsTokens.script,
          fontWeight: 500,
          fontSize: 23,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          textAlign: "left",
          padding: "4px 9px",
          margin: 0,
          appearance: "textfield",
          borderRadius: 7,
        }}
      />
    );
  }

  return (
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
        className="hs-mash-edit-btn"
        style={{
          background: hsTokens.paper,
          border: `1.5px solid ${hsTokens.ink}`,
          padding: "3px 32px 3px 11px",
          margin: 0,
          cursor: "text",
          display: "inline-flex",
          alignItems: "baseline",
          gap: 5,
          color: "inherit",
          fontFamily: "inherit",
          borderRadius: 7,
          boxShadow: hsTokens.sh1,
          transition: "background 90ms ease, box-shadow 90ms ease",
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.script,
            fontWeight: 500,
            fontSize: 25,
            lineHeight: 1.05,
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
      className="hs-mash-steppers"
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
        e.currentTarget.style.background = hsTokens.roast;
        e.currentTarget.style.color = hsTokens.cream;
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

// ─── Mash readout (sidebar context card) ──────────────────────────

function MashReadout({
  strikeTempC,
  mashWaterL,
  spargeWaterL,
  firstStepTempC,
}: {
  strikeTempC: number | null;
  mashWaterL: number | null;
  spargeWaterL: number | null;
  firstStepTempC: number | null;
}) {
  const strikeStr = strikeTempC != null ? `${strikeTempC.toFixed(1)} °C` : "—";
  const mashStr =
    mashWaterL != null && mashWaterL > 0 ? `${mashWaterL.toFixed(1)} L` : "—";
  const spargeStr =
    spargeWaterL != null && spargeWaterL > 0 ? `${spargeWaterL.toFixed(1)} L` : "—";
  return (
    <div
      className="hs-mash-readout"
      style={{
        background: "color-mix(in srgb, var(--hs-cream), var(--hs-cream-2))",
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 12,
        boxShadow: hsTokens.sh3,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <ReadoutRow
        label="Strike"
        sub={firstStepTempC != null ? `for ${firstStepTempC.toFixed(0)}°C` : null}
        value={strikeStr}
      />
      <ReadoutRow label="Mash" value={mashStr} />
      <ReadoutRow label="Sparge" value={spargeStr} />
    </div>
  );
}

function ReadoutRow({
  label,
  sub,
  value,
}: {
  label: string;
  sub?: string | null;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        padding: "3px 0",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 8,
          minWidth: 0,
        }}
      >
        <Eyebrow size={10}>{label}</Eyebrow>
        {sub ? (
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 13,
              color: hsTokens.muted,
              lineHeight: 1,
            }}
          >
            {sub}
          </span>
        ) : null}
      </div>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 17,
          color: hsTokens.ink,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
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
      className="hs-mash-mobile-add"
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

function MashSectionStyles() {
  return (
    <style>{`
      .hs-mash-section .hs-mash-grid {
        display: flex;
        flex-direction: column;
        row-gap: 16px;
        min-width: 0;
      }
      .hs-mash-section .hs-mash-grid-lhead { min-width: 0; }
      .hs-mash-section .hs-mash-grid-ltable { min-width: 0; }
      .hs-mash-section .hs-mash-list-wrap { min-width: 0; }

      @media (max-width: 900px) {
        .hs-mash-section .hs-mash-grid { row-gap: 12px; }
      }

      /* Desktop hover — subtle row tint (Hop-style ledger), not card lift. */
      @media (min-width: 641px) and (hover: hover) {
        .hs-mash-section .hs-mash-data-row {
          transition: background 90ms ease;
        }
        .hs-mash-section .hs-mash-data-row:hover {
          background: color-mix(in srgb, color-mix(in srgb, var(--hs-paper) 20%, var(--hs-cream-2)) 98%, var(--hs-roast));
        }
        .hs-mash-section .hs-mash-name-btn:hover .hs-mash-name {
          text-decoration: underline;
          text-decoration-thickness: 1.5px;
          text-underline-offset: 3px;
        }
        .hs-mash-section .hs-mash-edit-btn:hover {
          background: ${hsTokens.cream2};
        }
        .hs-mash-section .hs-mash-gen-card:hover {
          transform: translate(-1px, -1px);
          box-shadow: ${hsTokens.sh3};
        }
      }

      /* Mobile (≤640px) — collapse ledger to stacked rows, always-on
         steppers and move/remove buttons. */
      @media (max-width: 640px) {
        .hs-mash-section .hs-mash-mobile-add { display: flex !important; }

        .hs-mash-section .hs-mash-steppers {
          opacity: 1 !important;
          pointer-events: auto !important;
          gap: 2px !important;
          right: 0 !important;
        }
        .hs-mash-section .hs-mash-steppers button {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          width: 26px !important;
          height: 22px !important;
          color: ${hsTokens.muted} !important;
        }
        .hs-mash-section .hs-mash-steppers button svg {
          width: 14px !important;
          height: 9px !important;
          stroke-width: 2 !important;
        }
        .hs-mash-section .hs-mash-remove-btn {
          opacity: 1 !important;
        }
        .hs-mash-section .hs-mash-ledger {
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          border-radius: 0 !important;
          overflow: visible !important;
        }
        .hs-mash-section .hs-mash-ledger-head-row {
          display: none !important;
        }
        .hs-mash-section .hs-mash-data-row {
          display: grid !important;
          grid-template-columns: 44px minmax(0, 1fr) auto !important;
          grid-template-areas:
            "badge name actions"
            "temp  temp time" !important;
          column-gap: 12px !important;
          row-gap: 8px !important;
          padding: 16px 0 !important;
          border-bottom: 1px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-mash-section .hs-mash-data-row:last-of-type {
          border-bottom: none !important;
        }
        .hs-mash-section .hs-mash-data-row > :nth-child(1) {
          grid-area: badge;
        }
        .hs-mash-section .hs-mash-data-row > :nth-child(2) {
          grid-area: name;
          min-width: 0;
        }
        .hs-mash-section .hs-mash-data-row > :nth-child(3) {
          grid-area: temp !important;
          justify-self: start !important;
          justify-content: flex-start;
        }
        .hs-mash-section .hs-mash-data-row > :nth-child(4) {
          grid-area: time !important;
          justify-self: end !important;
          justify-content: flex-end;
        }
        .hs-mash-section .hs-mash-data-row > :nth-child(5) {
          grid-area: actions;
          justify-self: end;
        }
        .hs-mash-section .hs-mash-total-row {
          display: flex !important;
          justify-content: space-between !important;
          align-items: baseline !important;
          padding: 16px 0 !important;
          border-top: 2px solid ${hsTokens.ink} !important;
          background: transparent !important;
        }
        .hs-mash-section .hs-mash-total-row > * {
          padding: 0 !important;
        }
        .hs-mash-section .hs-mash-total-row > :nth-child(1),
        .hs-mash-section .hs-mash-total-row > :nth-child(3),
        .hs-mash-section .hs-mash-total-row > :nth-child(5) {
          display: none !important;
        }
        .hs-mash-section { padding: 18px 14px !important; }
        .hs-mash-section .hs-mash-ledger-head { flex-wrap: wrap; }
      }
    `}</style>
  );
}

// ─── Helper-card container (mounted by HelperCardMorph) ───────────

export function MashHelperCard() {
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);
  const calcs = useRecipeCalculations(currentRecipe);
  const mashSteps = currentRecipe?.mashSteps ?? [];
  if (mashSteps.length === 0) return null;
  const firstStepTempC = mashSteps[0]?.temperatureC ?? null;
  return (
    <MashReadout
      strikeTempC={calcs?.strikeTempC ?? null}
      mashWaterL={calcs?.mashWaterL ?? null}
      spargeWaterL={calcs?.spargeWaterL ?? null}
      firstStepTempC={firstStepTempC}
    />
  );
}
