"use client";

import { useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { toast } from "@/stores/toastStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: YeastPreset) => void;
}

export default function CustomYeastModal({ isOpen, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Custom");
  const [attenuationPct, setAttenuationPct] = useState(75);
  const titleId = useId();

  const handleClose = () => {
    setName("");
    setCategory("Custom");
    setAttenuationPct(75);
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please enter a yeast name");
      return;
    }
    const preset: YeastPreset = {
      name: name.trim(),
      category: category.trim() || "Custom",
      attenuationPercent: attenuationPct / 100,
    };
    onSave(preset);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      accent={hsTokens.yeast}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Create custom yeast"
        onClose={handleClose}
        titleId={titleId}
      />
      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FieldText
            label="Yeast name"
            value={name}
            onChange={setName}
            placeholder="e.g., House Saison Blend"
            autoFocusOnMount
            required
          />
          <FieldText
            label="Lab / Brand"
            value={category}
            onChange={setCategory}
            placeholder="Custom, Homebrew, House Blend…"
          />
          <FieldNumber
            label="Attenuation"
            value={attenuationPct}
            onChange={(v) => setAttenuationPct(Math.max(50, Math.min(95, v)))}
            min={50}
            max={95}
            step={1}
            suffix="%"
            hint="Low 65–70% · Medium 70–75% · High 75–85%"
          />
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton onClick={handleClose} variant="ghost" size="md">
          Cancel
        </HSButton>
        <HSButton onClick={handleSave} color={hsTokens.yeast} size="md">
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
