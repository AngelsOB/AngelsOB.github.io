"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSScriptNote from "../HSScriptNote";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import { uid } from "@/utils/uid";
import type {
  FermentationStep,
  FermentationStepType,
} from "@/modules/recipe/models/Recipe";
import { toast } from "@/stores/toastStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: FermentationStep) => void;
  existingStep?: FermentationStep | null;
}

interface TypePreset {
  type: FermentationStepType;
  label: string;
  defaultName: string;
  defaultTemp: number;
  defaultDays: number;
  hint: string;
  color: string;
}

// Step type color + defaults. Used by both the type-chip row in this modal and
// by FermentationSection's row badge — keep these aligned with stepTypeColor()
// in FermentationSection.tsx.
const TYPE_PRESETS: TypePreset[] = [
  { type: "primary", label: "Primary", defaultName: "Primary Fermentation", defaultTemp: 19, defaultDays: 14, hint: "the loud days", color: hsTokens.honey },
  { type: "secondary", label: "Secondary", defaultName: "Secondary", defaultTemp: 19, defaultDays: 7, hint: "let it ride out", color: hsTokens.yeast },
  { type: "diacetyl-rest", label: "Diacetyl rest", defaultName: "Diacetyl Rest", defaultTemp: 21, defaultDays: 2, hint: "clean up buttery notes", color: hsTokens.roast },
  { type: "conditioning", label: "Conditioning", defaultName: "Conditioning", defaultTemp: 4, defaultDays: 14, hint: "round out flavor", color: hsTokens.malt },
  { type: "cold-crash", label: "Cold crash", defaultName: "Cold Crash", defaultTemp: 2, defaultDays: 3, hint: "drop the yeast", color: "#7faec9" },
];

function findPreset(type: FermentationStepType): TypePreset {
  return TYPE_PRESETS.find((p) => p.type === type) ?? TYPE_PRESETS[0];
}

export default function FermentationStepModal({
  isOpen,
  onClose,
  onSave,
  existingStep,
}: Props) {
  const [type, setType] = useState<FermentationStepType>("primary");
  const [name, setName] = useState("");
  const [temperatureC, setTemperatureC] = useState(19);
  const [durationDays, setDurationDays] = useState(14);
  const [notes, setNotes] = useState("");
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    if (existingStep) {
      setType(existingStep.type);
      setName(existingStep.name);
      setTemperatureC(existingStep.temperatureC);
      setDurationDays(existingStep.durationDays);
      setNotes(existingStep.notes ?? "");
    } else {
      const p = TYPE_PRESETS[0];
      setType(p.type);
      setName(p.defaultName);
      setTemperatureC(p.defaultTemp);
      setDurationDays(p.defaultDays);
      setNotes("");
    }
  }, [isOpen, existingStep]);

  // Only auto-fill defaults on type-switch when adding new — preserve edits
  // mid-edit, matching the classic FermentationStepModal behavior.
  const handleTypeChange = (next: FermentationStepType) => {
    setType(next);
    if (!existingStep) {
      const p = findPreset(next);
      setName(p.defaultName);
      setTemperatureC(p.defaultTemp);
      setDurationDays(p.defaultDays);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.warning("Please name this step");
      return;
    }
    if (durationDays <= 0) {
      toast.error("Duration must be greater than 0 days");
      return;
    }
    const step: FermentationStep = {
      id: existingStep?.id ?? uid(),
      name: trimmedName,
      type,
      durationDays,
      temperatureC,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    onSave(step);
    handleClose();
  };

  const accent = hsTokens.honey;

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      accent={accent}
      labelledById={titleId}
    >
      <HSModalHeader
        title={existingStep ? "Edit fermentation step" : "Add fermentation step"}
        onClose={handleClose}
        titleId={titleId}
      />
      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Step type chips */}
          <div>
            <Eyebrow size={10} style={{ marginBottom: 10, display: "block" }}>
              Step type
            </Eyebrow>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {TYPE_PRESETS.map((p) => {
                const selected = p.type === type;
                return (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => handleTypeChange(p.type)}
                    className="hs-fermentation-type-chip"
                    aria-pressed={selected}
                    style={{
                      textAlign: "left",
                      background: selected ? hsTokens.paper : hsTokens.cream2,
                      border: `1.5px solid ${hsTokens.ink}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      fontFamily: hsTokens.body,
                      color: hsTokens.ink,
                      boxShadow: selected ? hsTokens.sh2 : hsTokens.sh1,
                      transition:
                        "background 90ms ease, box-shadow 90ms ease, transform 90ms ease",
                      position: "relative",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 10,
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: p.color,
                        border: `1.5px solid ${hsTokens.ink}`,
                      }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.1, paddingRight: 18 }}>
                      {p.label}
                    </span>
                    <span
                      style={{
                        fontFamily: hsTokens.mono,
                        fontSize: 11,
                        color: hsTokens.muted,
                      }}
                    >
                      {p.defaultTemp}°C · {p.defaultDays} d
                    </span>
                    <span
                      style={{
                        fontFamily: hsTokens.script,
                        fontSize: 14,
                        color: hsTokens.muted,
                        marginTop: 2,
                      }}
                    >
                      {p.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <style>{`
              .hs-fermentation-type-chip:hover {
                background: ${hsTokens.paper};
                box-shadow: ${hsTokens.sh2};
              }
              .hs-fermentation-type-chip[aria-pressed="true"] {
                background: ${hsTokens.paper};
              }
            `}</style>
          </div>

          <FieldText
            label="Step name"
            value={name}
            onChange={setName}
            placeholder="e.g., Primary Fermentation, Dry Hop"
            required
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
            }}
          >
            <FieldNumber
              label="Temperature"
              value={temperatureC}
              onChange={setTemperatureC}
              min={-5}
              max={40}
              step={0.5}
              suffix="°C"
              hint="Ale 18–22 · Lager 8–12 · Crash 0–4"
            />
            <FieldNumber
              label="Duration"
              value={durationDays}
              onChange={(v) => setDurationDays(Math.max(0, v))}
              min={0}
              max={365}
              step={1}
              suffix="days"
              hint="Primary 7–14 · Crash 2–4 · Lager weeks"
            />
          </div>

          <FieldTextarea
            label="Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Add dry hops on day 7, cold crash before packaging…"
          />

          <div
            style={{
              background: hsTokens.cream2,
              border: `1.5px dashed ${hsTokens.ink}`,
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              gap: 10,
              alignItems: "center",
            }}
          >
            <HSScriptNote color={accent} size={18} rotate={-4}>
              tip —
            </HSScriptNote>
            <span
              style={{
                fontFamily: hsTokens.body,
                fontSize: 13,
                color: hsTokens.muted,
                lineHeight: 1.4,
              }}
            >
              Order matters: steps run top to bottom. Primary first, crash last.
            </span>
          </div>
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton onClick={handleClose} variant="ghost" size="md">
          Cancel
        </HSButton>
        <HSButton onClick={handleSave} color={accent} size="md">
          {existingStep ? "Save step" : "Add step"}
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}

// ─── Field primitives (modal-scoped) ──────────────────────────────

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

function FieldShell({
  label,
  htmlFor,
  hint,
  children,
  required,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: hsTokens.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
        {required ? <span style={{ color: hsTokens.honey, marginLeft: 4 }}>*</span> : null}
      </label>
      {children}
      {hint ? (
        <span
          style={{
            fontFamily: hsTokens.script,
            fontSize: 13,
            color: hsTokens.muted,
            lineHeight: 1.2,
          }}
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}

const inputBaseStyle: CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 15,
  background: hsTokens.cream2,
  border: `1.5px solid ${hsTokens.ink}`,
  borderRadius: 10,
  padding: "10px 12px",
  color: hsTokens.ink,
  outline: "none",
  width: "100%",
  boxShadow: hsTokens.sh1,
};

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} required={required}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputBaseStyle}
      />
    </FieldShell>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          style={{
            ...inputBaseStyle,
            paddingRight: suffix ? 56 : 12,
            fontVariantNumeric: "tabular-nums",
          }}
        />
        {suffix ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: hsTokens.mono,
              fontSize: 13,
              color: hsTokens.muted,
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          ...inputBaseStyle,
          fontFamily: hsTokens.script,
          fontSize: 18,
          lineHeight: 1.3,
          resize: "vertical",
          minHeight: 72,
        }}
      />
    </FieldShell>
  );
}
