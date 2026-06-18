"use client";

import { useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { FermentablePreset } from "@/modules/recipe/models/Presets";
import { toast } from "@/stores/toastStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: FermentablePreset) => void;
}

const TYPE_DEFAULTS: Record<FermentablePreset["type"], number> = {
  grain: 100,
  adjunct_mashable: 100,
  extract: 78,
  sugar: 100,
};

export default function CustomFermentableModal({ isOpen, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [potentialGu, setPotentialGu] = useState(37);
  const [colorLovibond, setColorLovibond] = useState(2);
  const [type, setType] = useState<FermentablePreset["type"]>("grain");
  const [fermentabilityPct, setFermentabilityPct] = useState(100);
  const titleId = useId();

  const handleClose = () => {
    setName("");
    setPotentialGu(37);
    setColorLovibond(2);
    setType("grain");
    setFermentabilityPct(100);
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please enter a fermentable name");
      return;
    }
    const preset: FermentablePreset = {
      name: name.trim(),
      potentialGu,
      colorLovibond,
      type,
      fermentability: fermentabilityPct / 100,
    };
    onSave(preset);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      accent={hsTokens.malt}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Create custom fermentable"
        onClose={handleClose}
        titleId={titleId}
      />
      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FieldText
            label="Fermentable name"
            value={name}
            onChange={setName}
            placeholder="e.g., Custom pale malt"
            autoFocusOnMount
            required
          />
          <FieldNumber
            label="Potential GU (PPG)"
            value={potentialGu}
            onChange={setPotentialGu}
            min={0}
            max={50}
            step={1}
            hint="Base malts 35–38 · Crystal 33–35 · Sugars 46"
          />
          <FieldNumber
            label="Color (°Lovibond)"
            value={colorLovibond}
            onChange={setColorLovibond}
            min={0}
            max={600}
            step={1}
            hint="Pale ~2°L · Crystal 20–120°L · Roasted 300–600°L"
          />
          <FieldSelect
            label="Type"
            value={type}
            onChange={(v) => {
              const next = v as FermentablePreset["type"];
              setType(next);
              setFermentabilityPct(TYPE_DEFAULTS[next]);
            }}
            options={[
              { value: "grain", label: "Grain (Malt)" },
              { value: "adjunct_mashable", label: "Adjunct (Mashable)" },
              { value: "extract", label: "Extract" },
              { value: "sugar", label: "Sugar" },
            ]}
          />
          <FieldNumber
            label="Fermentability"
            value={fermentabilityPct}
            onChange={(v) => setFermentabilityPct(Math.max(0, Math.min(100, v)))}
            min={0}
            max={100}
            step={1}
            suffix="%"
            hint="Base malt 100% · Crystal ~50% · Lactose 0%"
          />
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton onClick={handleClose} variant="ghost" size="md">
          Cancel
        </HSButton>
        <HSButton onClick={handleSave} color={hsTokens.malt} size="md">
          Save preset
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}

// ─── Field primitives (modal-scoped) ──────────────────────────────

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
  hint,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: ReactNode;
  suffix?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min={min}
          max={max}
          step={step}
          style={{
            ...inputBaseStyle,
            paddingRight: suffix ? 32 : 12,
            fontVariantNumeric: "tabular-nums",
          }}
        />
        {suffix ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 12,
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

function FieldSelect({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputBaseStyle,
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path d='M1 1l5 6 5-6' fill='none' stroke='%231a1612' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 12px center",
          paddingRight: 32,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
