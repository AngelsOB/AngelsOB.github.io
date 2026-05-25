"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import {
  BEER_STYLE_TARGETS,
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

const QUICK_STARTS = ["Balanced", "American IPA", "NEIPA / Hazy IPA", "Pilsner", "Stout / Porter"];

const DEFAULT_PROFILE: WaterProfile = { Ca: 75, Mg: 15, Na: 20, Cl: 75, SO4: 75, HCO3: 49 };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: WaterProfile, name: string) => void;
  initialProfile?: WaterProfile;
  initialName?: string;
}

export default function CustomTargetStyleModal({
  isOpen,
  onClose,
  onSave,
  initialProfile,
  initialName,
}: Props) {
  const [name, setName] = useState(initialName ?? "");
  const [profile, setProfile] = useState<WaterProfile>(initialProfile ?? DEFAULT_PROFILE);
  const titleId = useId();

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
    onSave(profile, name.trim() || "Custom target");
    handleClose();
  };

  const handleIonChange = (ion: keyof WaterProfile, raw: string) => {
    const v = parseFloat(raw);
    setProfile({ ...profile, [ion]: Number.isFinite(v) && v >= 0 ? v : 0 });
  };

  const ratio = profile.SO4 > 0 ? profile.Cl / profile.SO4 : Infinity;
  const ratioStr = profile.SO4 > 0 ? ratio.toFixed(1) : "∞";
  const ratioLabel = ratio > 1.5 ? "Malty" : ratio < 0.7 ? "Hoppy" : "Balanced";
  const ratioColor = ratioLabel === "Hoppy"
    ? hsTokens.hops
    : ratioLabel === "Malty"
      ? hsTokens.honey
      : hsTokens.water;

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="lg"
      accent={hsTokens.water}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Custom target water"
        kicker="design your own —"
        onClose={handleClose}
        titleId={titleId}
      />

      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <FieldText
            label="Target name"
            value={name}
            onChange={setName}
            placeholder="e.g. My hoppy target"
            autoFocus
          />

          <div>
            <Eyebrow>Quick start from style</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {QUICK_STARTS.map((styleName) => {
                const target = BEER_STYLE_TARGETS[styleName];
                if (!target) return null;
                return (
                  <button
                    key={styleName}
                    type="button"
                    onClick={() => {
                      setProfile(target.profile);
                      setName(styleName);
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
                    {styleName}
                  </button>
                );
              })}
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              background: `color-mix(in srgb, ${ratioColor} 14%, ${hsTokens.cream2})`,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 10,
              fontFamily: hsTokens.body,
            }}
          >
            <span style={{ fontSize: 12, color: hsTokens.muted, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 700 }}>
              Cl : SO₄ ratio
            </span>
            <span style={{ fontFamily: hsTokens.mono, fontSize: 16, fontWeight: 700, color: hsTokens.ink, fontVariantNumeric: "tabular-nums" }}>
              {ratioStr}:1
              <span style={{ marginLeft: 8, fontFamily: hsTokens.body, fontSize: 11, color: ratioColor, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {ratioLabel}
              </span>
            </span>
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
          Use target
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
