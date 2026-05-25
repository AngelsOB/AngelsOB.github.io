"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import {
  COMMON_WATER_PROFILES,
  type WaterProfile,
} from "@/modules/beta-builder/domain/services/WaterChemistryService";

interface SourcePreset {
  name: string;
  profile: WaterProfile;
}

const ALL_PRESETS: SourcePreset[] = Object.entries(COMMON_WATER_PROFILES).map(
  ([name, profile]) => ({ name, profile })
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profile: WaterProfile, name: string) => void;
  onCreateCustom: () => void;
  currentName?: string;
}

export default function SourceWaterPresetModal({
  isOpen,
  onClose,
  onSelect,
  onCreateCustom,
  currentName,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchId = useId();
  const titleId = useId();

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_PRESETS;
    return ALL_PRESETS.filter((p) => p.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  const handleSelect = (preset: SourcePreset) => {
    onSelect(preset.profile, preset.name);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      accent={hsTokens.water}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Select source water"
        kicker="your tap, the well, the jug —"
        onClose={handleClose}
        titleId={titleId}
      />

      <div
        style={{
          padding: "14px 22px 0",
          background: hsTokens.paper,
        }}
      >
        <label
          htmlFor={searchId}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            background: hsTokens.cream2,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            boxShadow: hsTokens.sh1,
            width: "100%",
          }}
        >
          <SearchIcon />
          <input
            id={searchId}
            type="text"
            placeholder="Search water profiles…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-autofocus
            style={{
              flex: 1,
              fontFamily: hsTokens.body,
              fontSize: 14,
              background: "transparent",
              border: "none",
              outline: "none",
              color: hsTokens.ink,
              padding: 0,
            }}
          />
        </label>
      </div>

      <HSModalBody padding={0}>
        {filtered.length === 0 ? (
          <p
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.muted,
              padding: "24px 22px",
              textAlign: "center",
              margin: 0,
            }}
          >
            No source-water profiles match that search.
          </p>
        ) : (
          <div>
            <GroupHeader label="Source water profiles" />
            <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
              {filtered.map((preset) => (
                <PresetRow
                  key={preset.name}
                  preset={preset}
                  active={preset.name === currentName}
                  onClick={() => handleSelect(preset)}
                />
              ))}
            </div>
          </div>
        )}
      </HSModalBody>

      <HSModalFooter>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            color: hsTokens.muted,
            letterSpacing: "0.04em",
          }}
        >
          {ALL_PRESETS.length} profiles available
        </span>
        <HSButton onClick={() => { handleClose(); onCreateCustom(); }} color={hsTokens.water} size="sm">
          + Create custom
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ color: hsTokens.muted, flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function DropletIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={hsTokens.water}
      stroke={hsTokens.ink}
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M12 2.5c-3 4.2-7 8-7 12.2a7 7 0 0 0 14 0c0-4.2-4-8-7-12.2z" />
    </svg>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <h4
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1,
        margin: 0,
        padding: "8px 22px",
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
        background: hsTokens.cream,
        borderTop: `1px solid ${hsTokens.ink}`,
        borderBottom: `1px solid ${hsTokens.ink}`,
      }}
    >
      {label}
    </h4>
  );
}

function PresetRow({
  preset,
  active,
  onClick,
}: {
  preset: SourcePreset;
  active?: boolean;
  onClick: () => void;
}) {
  const baseStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    width: "100%",
    padding: "10px 12px",
    background: active ? hsTokens.cream2 : "transparent",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    textAlign: "left",
    color: hsTokens.ink,
    transition: "background 90ms ease",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={baseStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hsTokens.cream2;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? hsTokens.cream2 : "transparent";
      }}
    >
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <DropletIcon />
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              fontWeight: 700,
              color: hsTokens.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {preset.name}
          </span>
        </span>
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 12,
            color: hsTokens.muted,
            letterSpacing: "0.02em",
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Ca {preset.profile.Ca} · Cl {preset.profile.Cl} · SO₄ {preset.profile.SO4}
        </span>
      </span>
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 11,
          color: hsTokens.muted,
          fontVariantNumeric: "tabular-nums",
          paddingLeft: 24,
        }}
      >
        Mg {preset.profile.Mg} · Na {preset.profile.Na} · HCO₃ {preset.profile.HCO3}
      </span>
    </button>
  );
}
