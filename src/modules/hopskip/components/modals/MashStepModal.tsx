"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSScriptNote from "../HSScriptNote";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import { uid } from "@/utils/uid";
import type { MashStep } from "@/modules/beta-builder/domain/models/Recipe";
import { mashScheduleService } from "@/modules/beta-builder/domain/services/MashScheduleService";
import { toast } from "@/stores/toastStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (step: MashStep) => void;
  existingStep?: MashStep;
  totalGrainKg: number;
}

interface Preset {
  name: string;
  temperatureC: number;
  durationMinutes: number;
  hint: string;
}

const PRESETS: Preset[] = [
  { name: "Acid Rest", temperatureC: 40, durationMinutes: 15, hint: "soften the husk" },
  { name: "Protein Rest", temperatureC: 52, durationMinutes: 15, hint: "thin the body" },
  { name: "Beta Rest", temperatureC: 63, durationMinutes: 30, hint: "drier finish" },
  { name: "Saccharification", temperatureC: 67, durationMinutes: 60, hint: "single infusion" },
  { name: "Alpha Rest", temperatureC: 70, durationMinutes: 15, hint: "fuller body" },
  { name: "Mash Out", temperatureC: 76, durationMinutes: 10, hint: "lock the enzymes" },
];

export default function MashStepModal({
  isOpen,
  onClose,
  onSave,
  existingStep,
  totalGrainKg,
}: Props) {
  const [name, setName] = useState("");
  const [temperatureC, setTemperatureC] = useState(67);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [decoctionVolumeL, setDecoctionVolumeL] = useState<number | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    if (existingStep) {
      setName(existingStep.name);
      setTemperatureC(existingStep.temperatureC);
      setDurationMinutes(existingStep.durationMinutes);
      setDecoctionVolumeL(existingStep.decoctionVolumeLiters ?? null);
    } else {
      setName("");
      setTemperatureC(67);
      setDurationMinutes(60);
      setDecoctionVolumeL(null);
    }
  }, [isOpen, existingStep]);

  const applyPreset = (p: Preset) => {
    setName(p.name);
    setTemperatureC(p.temperatureC);
    setDurationMinutes(p.durationMinutes);
  };

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please name this step");
      return;
    }
    const step: MashStep = {
      id: existingStep?.id ?? uid(),
      name: name.trim(),
      temperatureC,
      durationMinutes,
      ...(decoctionVolumeL != null && decoctionVolumeL > 0
        ? { decoctionVolumeLiters: decoctionVolumeL }
        : {}),
    };
    const errors = mashScheduleService.validateMashStep(step);
    if (errors.length > 0) {
      toast.error(errors.join(". "));
      return;
    }
    onSave(step);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      accent={hsTokens.roast}
      labelledById={titleId}
    >
      <HSModalHeader
        title={existingStep ? "Edit mash step" : "Add mash step"}
        kicker={existingStep ? "tweak the rest —" : "drop a rest —"}
        onClose={handleClose}
        titleId={titleId}
      />
      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FieldText
            label="Step name"
            value={name}
            onChange={setName}
            placeholder="e.g., Saccharification, Beta Rest"
            autoFocusOnMount
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
              min={0}
              max={100}
              step={0.5}
              suffix="°C"
              hint="Acid 40 · Beta 63 · Sacch 67 · Mash out 76"
            />
            <FieldNumber
              label="Duration"
              value={durationMinutes}
              onChange={(v) => setDurationMinutes(Math.max(1, Math.round(v)))}
              min={1}
              max={240}
              step={5}
              suffix="min"
              hint="Most rests sit 15–60 min."
            />
          </div>

          <FieldNumber
            label="Decoction volume"
            value={decoctionVolumeL ?? 0}
            onChange={(v) => setDecoctionVolumeL(v > 0 ? v : null)}
            min={0}
            max={50}
            step={0.5}
            suffix="L"
            hint="Optional — only for decoction steps."
          />

          <div>
            <Eyebrow size={10} style={{ marginBottom: 10, display: "block" }}>
              Common rests
            </Eyebrow>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 8,
              }}
            >
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="hs-mash-preset"
                  style={{
                    textAlign: "left",
                    background: hsTokens.cream2,
                    border: `1.5px solid ${hsTokens.ink}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    fontFamily: hsTokens.body,
                    color: hsTokens.ink,
                    boxShadow: hsTokens.sh1,
                    transition: "background 90ms ease, box-shadow 90ms ease",
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.1 }}>
                    {p.name}
                  </span>
                  <span
                    style={{
                      fontFamily: hsTokens.mono,
                      fontSize: 11,
                      color: hsTokens.muted,
                    }}
                  >
                    {p.temperatureC}°C · {p.durationMinutes} min
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
              ))}
            </div>
            <style>{`
              .hs-mash-preset:hover {
                background: ${hsTokens.paper};
                box-shadow: ${hsTokens.sh2};
              }
            `}</style>
          </div>

          {totalGrainKg === 0 ? (
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
              <HSScriptNote color={hsTokens.roast} size={18} rotate={-4}>
                heads up —
              </HSScriptNote>
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  color: hsTokens.muted,
                  lineHeight: 1.4,
                }}
              >
                Add a grain bill to unlock strike-temp + mash-pH math.
              </span>
            </div>
          ) : null}
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton onClick={handleClose} variant="ghost" size="md">
          Cancel
        </HSButton>
        <HSButton onClick={handleSave} color={hsTokens.roast} size="md">
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
        {required ? <span style={{ color: hsTokens.roast, marginLeft: 4 }}>*</span> : null}
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
  autoFocusOnMount,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocusOnMount?: boolean;
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
        data-autofocus={autoFocusOnMount ? "" : undefined}
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
            paddingRight: suffix ? 40 : 12,
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
