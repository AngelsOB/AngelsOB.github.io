"use client";

import { useId, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSEyebrow from "../HSEyebrow";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { EquipmentProfile } from "@/modules/recipe/models/Equipment";
import { toast } from "@/stores/toastStore";

interface CurrentSettings {
  batchVolumeL: number;
  boilTimeMin: number;
  boilOffRateLPerHour: number;
  brewhouseEfficiencyPercent: number;
  mashThicknessLPerKg: number;
  grainAbsorptionLPerKg: number;
  mashTunDeadspaceLiters: number;
  mashTunLossLiters: number;
  kettleLossLiters: number;
  chillerLossLiters: number;
  fermenterLossLiters: number;
  coolingShrinkagePercent: number;
  hopsAbsorptionLPerKg: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: EquipmentProfile) => void;
  currentSettings: CurrentSettings;
}

export default function CustomEquipmentModal({
  isOpen,
  onClose,
  onSave,
  currentSettings,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const titleId = useId();

  const handleClose = () => {
    setName("");
    setDescription("");
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.warning("Please enter a profile name");
      return;
    }
    const profile: EquipmentProfile = {
      name: name.trim(),
      description: description.trim() || undefined,
      batchSizeL: currentSettings.batchVolumeL,
      boilTimeMin: currentSettings.boilTimeMin,
      boilOffRateL_hr: currentSettings.boilOffRateLPerHour,
      mashThicknessL_kg: currentSettings.mashThicknessLPerKg,
      mashTunDeadspaceL: currentSettings.mashTunDeadspaceLiters,
      mashTunLossL: currentSettings.mashTunLossLiters,
      kettleDeadspaceL: currentSettings.kettleLossLiters,
      chillerLossL: currentSettings.chillerLossLiters,
      fermenterLossL: currentSettings.fermenterLossLiters,
      coolingShrinkagePercent: currentSettings.coolingShrinkagePercent,
      grainAbsorptionL_kg: currentSettings.grainAbsorptionLPerKg,
      hopAbsorptionL_kg: currentSettings.hopsAbsorptionLPerKg,
      mashEfficiency: currentSettings.brewhouseEfficiencyPercent,
      brewhouseEfficiency: currentSettings.brewhouseEfficiencyPercent,
      isCustom: true,
    };
    onSave(profile);
    toast.success(`Saved "${profile.name}"`);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="md"
      accent={hsTokens.honey}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Save as custom profile"
        onClose={handleClose}
        titleId={titleId}
      />
      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FieldText
            label="Profile name"
            value={name}
            onChange={setName}
            placeholder="e.g., My Garage Setup"
            autoFocusOnMount
            required
          />
          <FieldTextarea
            label="Description"
            value={description}
            onChange={setDescription}
            placeholder="2-vessel · 19 L kettle · plate chiller"
            hint="optional — anything that helps you remember the kit"
            rows={3}
          />

          <SnapshotPreview settings={currentSettings} />
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton onClick={handleClose} variant="ghost" size="md">
          Cancel
        </HSButton>
        <HSButton onClick={handleSave} color={hsTokens.honey} size="md">
          Save profile
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}

// ─── Snapshot of the current settings being saved ─────────────────

function SnapshotPreview({ settings }: { settings: CurrentSettings }) {
  return (
    <div
      style={{
        background: hsTokens.cream2,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <HSEyebrow>What gets saved</HSEyebrow>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: 6,
        }}
      >
        <SnapStat label="Batch" value={`${settings.batchVolumeL.toFixed(1)} L`} />
        <SnapStat label="Boil" value={`${settings.boilTimeMin} min`} />
        <SnapStat label="Boil-off" value={`${settings.boilOffRateLPerHour.toFixed(1)} L/hr`} />
        <SnapStat label="Brewhouse eff" value={`${settings.brewhouseEfficiencyPercent}%`} />
        <SnapStat label="Thickness" value={`${settings.mashThicknessLPerKg.toFixed(1)} L/kg`} />
        <SnapStat label="Tun deadspace" value={`${settings.mashTunDeadspaceLiters.toFixed(1)} L`} />
        <SnapStat label="Kettle loss" value={`${settings.kettleLossLiters.toFixed(1)} L`} />
        <SnapStat label="Fermenter loss" value={`${settings.fermenterLossLiters.toFixed(1)} L`} />
      </div>
    </div>
  );
}

function SnapStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          lineHeight: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 12,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
    </div>
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

function FieldTextarea({
  label,
  value,
  onChange,
  placeholder,
  hint,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  rows?: number;
}) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          ...inputBaseStyle,
          resize: "vertical",
          minHeight: 70,
          fontFamily: hsTokens.body,
          lineHeight: 1.4,
        }}
      />
    </FieldShell>
  );
}
