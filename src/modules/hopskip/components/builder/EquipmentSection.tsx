"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSScriptNote from "../HSScriptNote";
import HSActionMenu from "../HSActionMenu";
import EquipmentProfileModal from "../modals/EquipmentProfileModal";
import CustomEquipmentModal from "../modals/CustomEquipmentModal";

import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { useEquipmentStore } from "@/modules/beta-builder/presentation/stores/equipmentStore";
import { useHoldToRepeat } from "@/hooks/useHoldToRepeat";
import type { EquipmentProfile } from "@/modules/beta-builder/domain/models/Equipment";

// Equipment is the kit-settings tab. One substrate frame (HS signature),
// no per-field chrome, click-to-edit values, hover-revealed steppers.
// Groups laid out in a responsive 2-col grid so the page reads as one
// compact block instead of a long vertical list. Set and forget.

export default function EquipmentSection() {
  const recipe = useRecipeStore((s) => s.currentRecipe);
  const updateRecipe = useRecipeStore((s) => s.updateRecipe);
  const profiles = useEquipmentStore((s) => s.profiles);
  const loadProfiles = useEquipmentStore((s) => s.loadProfiles);
  const saveCustomProfile = useEquipmentStore((s) => s.saveCustomProfile);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const currentProfile = useMemo(
    () =>
      recipe?.equipmentProfileName
        ? profiles.find((p) => p.name === recipe.equipmentProfileName) ?? null
        : null,
    [profiles, recipe?.equipmentProfileName]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!currentProfile || !recipe) return false;
    const eq = recipe.equipment;
    return (
      recipe.batchVolumeL !== currentProfile.batchSizeL ||
      eq.boilTimeMin !== currentProfile.boilTimeMin ||
      eq.boilOffRateLPerHour !== currentProfile.boilOffRateL_hr ||
      eq.mashEfficiencyPercent !== currentProfile.mashEfficiency ||
      eq.mashThicknessLPerKg !== currentProfile.mashThicknessL_kg ||
      eq.grainAbsorptionLPerKg !== currentProfile.grainAbsorptionL_kg ||
      eq.mashTunDeadspaceLiters !== currentProfile.mashTunDeadspaceL ||
      (eq.mashTunLossLiters ?? 0) !== currentProfile.mashTunLossL ||
      eq.kettleLossLiters !== currentProfile.kettleDeadspaceL ||
      eq.chillerLossLiters !== currentProfile.chillerLossL ||
      eq.fermenterLossLiters !== currentProfile.fermenterLossL ||
      eq.coolingShrinkagePercent !== currentProfile.coolingShrinkagePercent ||
      Math.abs(eq.hopsAbsorptionLPerKg - currentProfile.hopAbsorptionL_kg) > 0.01
    );
  }, [currentProfile, recipe]);

  if (!recipe) return null;

  const handleSelectProfile = (profile: EquipmentProfile) => {
    updateRecipe({
      equipmentProfileName: profile.name,
      batchVolumeL: profile.batchSizeL,
      equipment: {
        ...recipe.equipment,
        boilTimeMin: profile.boilTimeMin,
        boilOffRateLPerHour: profile.boilOffRateL_hr,
        mashEfficiencyPercent: profile.mashEfficiency,
        mashThicknessLPerKg: profile.mashThicknessL_kg,
        grainAbsorptionLPerKg: profile.grainAbsorptionL_kg,
        mashTunDeadspaceLiters: profile.mashTunDeadspaceL,
        mashTunLossLiters: profile.mashTunLossL,
        kettleLossLiters: profile.kettleDeadspaceL,
        chillerLossLiters: profile.chillerLossL,
        fermenterLossLiters: profile.fermenterLossL,
        coolingShrinkagePercent: profile.coolingShrinkagePercent,
        hopsAbsorptionLPerKg: profile.hopAbsorptionL_kg,
      },
    });
    setIsPickerOpen(false);
  };

  const handleSaveCustomProfile = async (profile: EquipmentProfile) => {
    await saveCustomProfile(profile);
    updateRecipe({ equipmentProfileName: profile.name });
  };

  const updateEquip = (field: string, value: number) => {
    updateRecipe({
      equipment: { ...recipe.equipment, [field]: value },
    });
  };

  return (
    <section style={sectionStyle}>
      <EquipmentSectionStyles />
      <TitleRow
        currentProfileName={currentProfile?.name ?? null}
        profiles={profiles}
        hasUnsavedChanges={hasUnsavedChanges}
        onOpenPicker={() => setIsPickerOpen(true)}
        onOpenCustom={() => setIsCustomModalOpen(true)}
        onSelectProfile={handleSelectProfile}
      />

      <p
        style={{
          fontFamily: hsTokens.body,
          fontSize: 12.5,
          lineHeight: 1.45,
          color: hsTokens.muted,
          margin: 0,
        }}
      >
        <span style={{ fontWeight: 600, color: hsTokens.ink }}>
          Heads up —
        </span>{" "}
        batch volume here is your{" "}
        <span style={{ fontWeight: 600, color: hsTokens.ink }}>
          final packaged
        </span>{" "}
        beer (what ends up in the keg or bottles). Most calculators ask for the
        volume into the fermenter; we work backward from your target. Fermenter,
        chiller and cooling losses are added on top.
      </p>

      <div className="hs-equip-grid">
        <Group label="Batch & boil">
          <FieldRow
            id="hs-equip-batch"
            label="Batch volume"
            unit="L"
            value={recipe.batchVolumeL}
            onChange={(v) => updateRecipe({ batchVolumeL: v })}
            step={0.1}
            min={0}
            decimals={1}
          />
          <FieldRow
            id="hs-equip-efficiency"
            label="Mash efficiency"
            unit="%"
            value={recipe.equipment.mashEfficiencyPercent}
            onChange={(v) => updateEquip("mashEfficiencyPercent", v)}
            step={1}
            min={0}
            max={100}
            decimals={0}
          />
          <FieldRow
            id="hs-equip-boil-time"
            label="Boil time"
            unit="min"
            value={recipe.equipment.boilTimeMin}
            onChange={(v) => updateEquip("boilTimeMin", v)}
            step={1}
            min={0}
            decimals={0}
          />
        </Group>

        <Group label="Mash system">
          <FieldRow
            id="hs-equip-mash-thickness"
            label="Thickness"
            unit="L/kg"
            value={recipe.equipment.mashThicknessLPerKg}
            onChange={(v) => updateEquip("mashThicknessLPerKg", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
          <FieldRow
            id="hs-equip-grain-absorb"
            label="Grain absorption"
            unit="L/kg"
            value={recipe.equipment.grainAbsorptionLPerKg}
            onChange={(v) => updateEquip("grainAbsorptionLPerKg", v)}
            step={0.01}
            min={0}
            decimals={2}
          />
          <FieldRow
            id="hs-equip-tun-deadspace"
            label="Tun deadspace"
            unit="L"
            value={recipe.equipment.mashTunDeadspaceLiters}
            onChange={(v) => updateEquip("mashTunDeadspaceLiters", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
          <FieldRow
            id="hs-equip-tun-loss"
            label="Tun loss"
            unit="L"
            value={recipe.equipment.mashTunLossLiters ?? 0}
            onChange={(v) => updateEquip("mashTunLossLiters", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
        </Group>

        <Group label="Kettle">
          <FieldRow
            id="hs-equip-boil-off"
            label="Boil-off rate"
            unit="L/hr"
            value={recipe.equipment.boilOffRateLPerHour}
            onChange={(v) => updateEquip("boilOffRateLPerHour", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
          <FieldRow
            id="hs-equip-kettle-loss"
            label="Kettle loss"
            unit="L"
            value={recipe.equipment.kettleLossLiters}
            onChange={(v) => updateEquip("kettleLossLiters", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
          <FieldRow
            id="hs-equip-hop-absorb"
            label="Hop absorption"
            unit="L/kg"
            value={recipe.equipment.hopsAbsorptionLPerKg}
            onChange={(v) => updateEquip("hopsAbsorptionLPerKg", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
        </Group>

        <Group label="Cooling & fermenter">
          <FieldRow
            id="hs-equip-chiller-loss"
            label="Chiller loss"
            unit="L"
            value={recipe.equipment.chillerLossLiters}
            onChange={(v) => updateEquip("chillerLossLiters", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
          <FieldRow
            id="hs-equip-fermenter-loss"
            label="Fermenter loss"
            unit="L"
            value={recipe.equipment.fermenterLossLiters}
            onChange={(v) => updateEquip("fermenterLossLiters", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
          <FieldRow
            id="hs-equip-shrinkage"
            label="Cooling shrinkage"
            unit="%"
            value={recipe.equipment.coolingShrinkagePercent}
            onChange={(v) => updateEquip("coolingShrinkagePercent", v)}
            step={0.1}
            min={0}
            decimals={1}
          />
        </Group>
      </div>

      <EquipmentProfileModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleSelectProfile}
        onCreateCustom={() => {
          setIsPickerOpen(false);
          setIsCustomModalOpen(true);
        }}
        profiles={profiles}
        currentProfileName={currentProfile?.name ?? null}
      />

      <CustomEquipmentModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSave={handleSaveCustomProfile}
        currentSettings={{
          batchVolumeL: recipe.batchVolumeL,
          boilTimeMin: recipe.equipment.boilTimeMin,
          boilOffRateLPerHour: recipe.equipment.boilOffRateLPerHour,
          mashEfficiencyPercent: recipe.equipment.mashEfficiencyPercent,
          mashThicknessLPerKg: recipe.equipment.mashThicknessLPerKg,
          grainAbsorptionLPerKg: recipe.equipment.grainAbsorptionLPerKg,
          mashTunDeadspaceLiters: recipe.equipment.mashTunDeadspaceLiters,
          mashTunLossLiters: recipe.equipment.mashTunLossLiters ?? 0,
          kettleLossLiters: recipe.equipment.kettleLossLiters,
          chillerLossLiters: recipe.equipment.chillerLossLiters,
          fermenterLossLiters: recipe.equipment.fermenterLossLiters,
          coolingShrinkagePercent: recipe.equipment.coolingShrinkagePercent,
          hopsAbsorptionLPerKg: recipe.equipment.hopsAbsorptionLPerKg,
        }}
      />
    </section>
  );
}

// ─── Outer shell ──────────────────────────────────────────────────
// One substrate frame (HS signature). Inside: a 2-col grid of groups so
// the page reads as one compact block, not a long vertical list.

const sectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: "18px 22px 20px",
  background: hsTokens.paper,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: 14,
  boxShadow: hsTokens.sh3,
  position: "relative",
};

// Grid: 2 columns at ≥ 720px, single column below.
// Steppers + dashed value-underline appear on row hover or focus-within.

function EquipmentSectionStyles() {
  return (
    <style>{`
      .hs-equip-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 28px;
        row-gap: 14px;
      }
      @media (max-width: 720px) {
        .hs-equip-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .hs-equip-row .hs-equip-stepper {
        opacity: 0;
        pointer-events: none;
        transition: opacity 120ms ease, color 120ms ease;
      }
      .hs-equip-row:hover .hs-equip-stepper,
      .hs-equip-row:focus-within .hs-equip-stepper {
        opacity: 0.7;
        pointer-events: auto;
      }
      .hs-equip-row .hs-equip-stepper:hover {
        opacity: 1;
        color: var(--hs-ink);
      }
      .hs-equip-row:hover .hs-equip-value,
      .hs-equip-row:focus-within .hs-equip-value {
        border-bottom-color: color-mix(in srgb, var(--hs-ink) 35%, transparent);
      }
    `}</style>
  );
}

// ─── Title row (heading + profile picker + save-as-custom) ────────

function TitleRow({
  currentProfileName,
  profiles,
  hasUnsavedChanges,
  onOpenPicker,
  onOpenCustom,
  onSelectProfile,
}: {
  currentProfileName: string | null;
  profiles: EquipmentProfile[];
  hasUnsavedChanges: boolean;
  onOpenPicker: () => void;
  onOpenCustom: () => void;
  onSelectProfile: (profile: EquipmentProfile) => void;
}) {
  const items = useMemo(
    () => [
      ...profiles.map((p) => ({
        label: `${p.name}${p.isCustom ? "  (custom)" : ""}`,
        onClick: () => onSelectProfile(p),
      })),
      { label: "Browse the full library", onClick: onOpenPicker },
    ],
    [profiles, onSelectProfile, onOpenPicker]
  );

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        paddingBottom: 10,
        borderBottom: `2px solid ${hsTokens.muted}`,
      }}
    >
      <h2
        style={{
          fontFamily: hsTokens.display,
          fontSize: 24,
          letterSpacing: "-0.025em",
          lineHeight: 0.95,
          color: hsTokens.ink,
          margin: 0,
        }}
      >
        Equipment.
      </h2>
      <span aria-hidden style={{ flex: 1, minWidth: 12 }} />
      <HSScriptNote color={hsTokens.muted} size={16} rotate={-3}>
        your kit —
      </HSScriptNote>
      <HSActionMenu
        trigger={
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 12,
              letterSpacing: "0.02em",
              display: "inline-flex",
              alignItems: "baseline",
              gap: 6,
            }}
          >
            <span style={{ color: hsTokens.muted }}>Profile ·</span>
            <span
              style={{
                fontWeight: 600,
                color: currentProfileName ? hsTokens.ink : hsTokens.muted,
              }}
            >
              {currentProfileName ?? "none selected"}
            </span>
            <span style={{ color: hsTokens.muted, marginLeft: 2 }}>▾</span>
          </span>
        }
        triggerAriaLabel={
          currentProfileName
            ? `Switch equipment profile (current: ${currentProfileName})`
            : "Pick equipment profile"
        }
        triggerStyle={{
          background: "transparent",
          border: `1px solid ${hsTokens.muted}`,
          borderRadius: 999,
          padding: "4px 12px",
          width: "auto",
          height: "auto",
          boxShadow: "none",
          color: hsTokens.ink,
          cursor: "pointer",
        }}
        items={items}
      />
      {hasUnsavedChanges ? (
        <HSButton onClick={onOpenCustom} color={hsTokens.honey} size="sm">
          Save as custom
        </HSButton>
      ) : null}
    </header>
  );
}

// ─── Group (eyebrow + hairline + list of rows) ────────────────────

function Group({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: hsTokens.muted,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <span
          aria-hidden
          style={{
            flex: 1,
            height: 1,
            background: hsTokens.muted,
            opacity: 0.3,
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </div>
  );
}

// ─── Field row (click-to-edit value, optional hover steppers) ─────

function FieldRow({
  id,
  label,
  unit,
  value,
  onChange,
  step,
  min = 0,
  max,
  decimals = 1,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
}) {
  const [editing, setEditing] = useState(false);

  const nudge = (dir: 1 | -1) => {
    const next = value + dir * step;
    const rounded = parseFloat(next.toFixed(decimals));
    if (rounded < min) return;
    if (max != null && rounded > max) return;
    onChange(rounded);
  };
  const holdDown = useHoldToRepeat(() => nudge(-1));
  const holdUp = useHoldToRepeat(() => nudge(1));

  return (
    <div
      className="hs-equip-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 10,
        padding: "5px 0",
        borderBottom: `1px dotted color-mix(in srgb, ${hsTokens.muted} 35%, transparent)`,
      }}
    >
      <label
        htmlFor={id}
        style={{
          fontFamily: hsTokens.body,
          fontSize: 13,
          color: hsTokens.ink,
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          justifyContent: "flex-end",
        }}
      >
        <StepperBtn glyph="minus" {...holdDown} label={`Decrease ${label}`} />
        {editing ? (
          <EditingInput
            id={id}
            value={value}
            decimals={decimals}
            onChange={onChange}
            onCommit={() => setEditing(false)}
            step={step}
            min={min}
            max={max}
            unit={unit}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${label}`}
            className="hs-equip-value"
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 4,
              background: "transparent",
              border: "none",
              padding: "1px 4px",
              cursor: "text",
              fontFamily: hsTokens.body,
              fontWeight: 600,
              fontSize: 14,
              color: hsTokens.ink,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0",
              borderBottom: "1px dashed transparent",
              transition: "border-bottom-color 120ms ease",
              minWidth: 56,
              justifyContent: "flex-end",
            }}
          >
            <span>{value.toFixed(decimals)}</span>
            <span
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 400,
                fontSize: 11,
                color: hsTokens.muted,
              }}
            >
              {unit}
            </span>
          </button>
        )}
        <StepperBtn glyph="plus" {...holdUp} label={`Increase ${label}`} />
      </div>
    </div>
  );
}

function EditingInput({
  id,
  value,
  decimals,
  onChange,
  onCommit,
  step,
  min,
  max,
  unit,
}: {
  id: string;
  value: number;
  decimals: number;
  onChange: (v: number) => void;
  onCommit: () => void;
  step: number;
  min?: number;
  max?: number;
  unit: string;
}) {
  const [draft, setDraft] = useState<string>(value.toFixed(decimals));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const commit = () => {
    const parsed = parseFloat(draft);
    if (Number.isNaN(parsed)) {
      onCommit();
      return;
    }
    let next = parseFloat(parsed.toFixed(decimals));
    if (min != null && next < min) next = min;
    if (max != null && next > max) next = max;
    if (next !== value) onChange(next);
    onCommit();
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 4,
        padding: "1px 4px",
        borderBottom: `1px solid ${hsTokens.ink}`,
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="number"
        inputMode="decimal"
        value={draft}
        step={step}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(value.toFixed(decimals));
            onCommit();
          }
        }}
        style={{
          width: 56,
          background: "transparent",
          border: "none",
          outline: "none",
          textAlign: "right",
          fontFamily: hsTokens.body,
          fontSize: 14,
          fontWeight: 600,
          color: hsTokens.ink,
          padding: 0,
          appearance: "textfield",
          MozAppearance: "textfield",
          fontVariantNumeric: "tabular-nums",
        }}
      />
      <span
        style={{
          fontFamily: hsTokens.body,
          fontWeight: 400,
          fontSize: 11,
          color: hsTokens.muted,
        }}
      >
        {unit}
      </span>
    </div>
  );
}

function StepperBtn({
  glyph,
  label,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: {
  glyph: "minus" | "plus";
  label: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="hs-equip-stepper"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      style={{
        width: 18,
        height: 18,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
        color: hsTokens.muted,
        padding: 0,
        lineHeight: 1,
        fontFamily: hsTokens.body,
        fontSize: 14,
        fontWeight: 400,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {glyph === "minus" ? "−" : "+"}
    </button>
  );
}
