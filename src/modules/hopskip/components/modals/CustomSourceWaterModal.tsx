"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import {
  COMMON_WATER_PROFILES,
  type WaterProfile,
} from "@/modules/beta-builder/domain/services/WaterChemistryService";

const ION_FIELDS: Array<{ key: keyof WaterProfile; label: string; hint: string }> = [
  { key: "Ca", label: "Calcium (Ca)", hint: "50–200 ppm typical" },
  { key: "Mg", label: "Magnesium (Mg)", hint: "15–30 ppm typical" },
  { key: "Na", label: "Sodium (Na)", hint: "<100 ppm typical" },
  { key: "Cl", label: "Chloride (Cl)", hint: "50–200 ppm typical" },
  { key: "SO4", label: "Sulfate (SO₄)", hint: "0–500 ppm (style dependent)" },
  { key: "HCO3", label: "Bicarbonate (HCO₃)", hint: "0–300 ppm typical" },
];

const DEFAULT_PROFILE: WaterProfile = { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: WaterProfile, name: string) => void;
  initialProfile?: WaterProfile;
  initialName?: string;
}

export default function CustomSourceWaterModal({
  isOpen,
  onClose,
  onSave,
  initialProfile,
  initialName,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [profile, setProfile] = useState<WaterProfile>(initialProfile ?? DEFAULT_PROFILE);
  const titleId = useId();

  // Reset state when modal transitions closed → open
  useEffect(() => {
    if (isOpen) {
      setName(initialName ?? "");
      setProfile(initialProfile ?? DEFAULT_PROFILE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    onSave(profile, name.trim() || "Custom");
    handleClose();
  };

  const handleIonChange = (ion: keyof WaterProfile, raw: string) => {
    const v = parseFloat(raw);
    setProfile({ ...profile, [ion]: Number.isFinite(v) && v >= 0 ? v : 0 });
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      accent={hsTokens.water}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Custom source water"
        kicker="dial it in —"
        onClose={handleClose}
        titleId={titleId}
      />

      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FieldText
            label="Profile name"
            value={name}
            onChange={setName}
            placeholder="e.g. My well water"
            autoFocus
          />

          <div>
            <Eyebrow>Quick start from preset</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {Object.entries(COMMON_WATER_PROFILES).map(([n, p]) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setProfile(p);
                    setName(n);
                  }}
                  style={{
                    padding: "4px 11px",
                    background: hsTokens.paper,
                    border: `1.5px solid ${hsTokens.ink}`,
                    borderRadius: 999,
                    fontFamily: hsTokens.body,
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    color: hsTokens.ink,
                    cursor: "pointer",
                    boxShadow: hsTokens.sh1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hsTokens.water;
                    e.currentTarget.style.color = hsTokens.cream;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hsTokens.paper;
                    e.currentTarget.style.color = hsTokens.ink;
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Eyebrow>Ion concentrations</Eyebrow>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
                marginTop: 8,
              }}
            >
              {ION_FIELDS.map(({ key, label, hint }) => (
                <FieldNumber
                  key={key}
                  label={label}
                  value={profile[key]}
                  onChange={(v) => handleIonChange(key, v)}
                  suffix="ppm"
                  hint={hint}
                />
              ))}
            </div>
          </div>
        </div>
      </HSModalBody>

      <HSModalFooter>
        <button
          type="button"
          onClick={handleClose}
          style={{
            background: "transparent",
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            padding: "8px 16px",
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: hsTokens.ink,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <HSButton onClick={handleSave} color={hsTokens.water} size="sm">
          Use profile
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
      }}
    >
      {children}
    </span>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", marginBottom: 6 }}>
        <Eyebrow>{label}</Eyebrow>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? "" : undefined}
        style={inputStyle}
      />
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (raw: string) => void;
  suffix?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", marginBottom: 4 }}>
        <Eyebrow>{label}</Eyebrow>
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={value || ""}
          placeholder="0"
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, paddingRight: suffix ? 44 : inputStyle.padding }}
        />
        {suffix ? (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              fontFamily: hsTokens.body,
              fontSize: 11,
              color: hsTokens.muted,
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            color: hsTokens.muted,
            margin: "4px 0 0",
          }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: hsTokens.cream2,
  border: `1.5px solid ${hsTokens.ink}`,
  borderRadius: 8,
  fontFamily: hsTokens.body,
  fontSize: 13,
  color: hsTokens.ink,
  outline: "none",
  fontVariantNumeric: "tabular-nums",
};
