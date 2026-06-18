"use client";

import { useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { HopPreset } from "@/modules/recipe/models/Presets";
import { toast } from "@/stores/toastStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (preset: HopPreset) => void;
}

const CATEGORY_OPTIONS = [
  { value: "Custom Hops", label: "Custom" },
  { value: "US Hops", label: "United States" },
  { value: "German Hops", label: "Germany" },
  { value: "Czech Hops", label: "Czech / Saaz" },
  { value: "UK Hops", label: "United Kingdom" },
  { value: "Australian / New Zealand Hops", label: "Australia / NZ" },
  { value: "Noble Hops", label: "Noble" },
  { value: "Other", label: "Other" },
];

export default function CustomHopModal({ isOpen, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [alphaAcid, setAlphaAcid] = useState(10);
  const [betaAcid, setBetaAcid] = useState(5);
  const [category, setCategory] = useState<string>("Custom Hops");
  const titleId = useId();

  const handleClose = () => {
    setName("");
    setAlphaAcid(10);
    setBetaAcid(5);
    setCategory("Custom Hops");
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please enter a hop name");
      return;
    }
    const preset: HopPreset = {
      name: name.trim(),
      alphaAcidPercent: alphaAcid,
      category,
    };
    onSave(preset);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      accent={hsTokens.hops}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Create custom hop"
        onClose={handleClose}
        titleId={titleId}
      />
      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FieldText
            label="Hop name"
            value={name}
            onChange={setName}
            placeholder="e.g., Garden-fresh Cascade"
            autoFocusOnMount
            required
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <FieldNumber
              label="Alpha acid"
              value={alphaAcid}
              onChange={(v) => setAlphaAcid(Math.max(0, Math.min(25, v)))}
              min={0}
              max={25}
              step={0.1}
              suffix="%"
              hint="Aroma 2–6 · Dual 6–10 · Bittering 10–18"
            />
            <FieldNumber
              label="Beta acid"
              value={betaAcid}
              onChange={(v) => setBetaAcid(Math.max(0, Math.min(20, v)))}
              min={0}
              max={20}
              step={0.1}
              suffix="%"
              hint="Often 3–8% · used in storage curve"
            />
          </div>
          <FieldSelect
            label="Category"
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS}
            hint="Used to group this hop in the picker"
          />
          <p
            style={{
              fontFamily: hsTokens.script,
              fontSize: 14,
              color: hsTokens.muted,
              margin: 0,
              lineHeight: 1.35,
            }}
          >
            flavor profile fields stay defaulted; tune the radar later from the
            hop row after you&apos;ve brewed with it.
          </p>
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton onClick={handleClose} variant="ghost" size="md">
          Cancel
        </HSButton>
        <HSButton onClick={handleSave} color={hsTokens.hops} size="md">
          Save hop
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
