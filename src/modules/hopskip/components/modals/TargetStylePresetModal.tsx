"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import {
  BEER_STYLE_TARGETS,
  type BeerStyleTarget,
} from "@/modules/recipe/services/WaterChemistryService";
import { fuzzyIncludes } from "@/utils/ingredientMatching";

interface StylePreset {
  name: string;
  description: string;
  clToSo4Ratio: string;
  ca: number;
  cl: number;
  so4: number;
}

const STYLE_CATEGORIES: Record<string, string[]> = {
  "Hoppy Ales": ["West Coast IPA", "American IPA", "American Pale Ale", "NEIPA / Hazy IPA", "English IPA"],
  Lagers: ["Pilsner", "German Pilsner", "Munich Helles"],
  "Dark Ales": ["Stout / Porter", "Irish Stout", "Brown Ale"],
  "Belgian & Other": ["Belgian Ale", "Blonde / Cream Ale", "Balanced"],
};

function buildPresets(): { groups: { label: string; items: StylePreset[] }[]; all: StylePreset[] } {
  const groups: { label: string; items: StylePreset[] }[] = [];
  const all: StylePreset[] = [];
  for (const [category, styles] of Object.entries(STYLE_CATEGORIES)) {
    const items: StylePreset[] = [];
    for (const name of styles) {
      const t: BeerStyleTarget | undefined = BEER_STYLE_TARGETS[name];
      if (!t) continue;
      const preset: StylePreset = {
        name,
        description: t.description,
        clToSo4Ratio: t.clToSo4Ratio,
        ca: t.profile.Ca,
        cl: t.profile.Cl,
        so4: t.profile.SO4,
      };
      items.push(preset);
      all.push(preset);
    }
    groups.push({ label: category, items });
  }
  return { groups, all };
}

const { groups: ALL_GROUPS, all: ALL_PRESETS } = buildPresets();

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Pick a built-in BJCP style — caller resolves it via BEER_STYLE_TARGETS. */
  onSelect: (styleName: string) => void;
  onCreateCustom: () => void;
  /** Show a "BJCP auto-detect" row at top revealing the recipe-style match. */
  bjcpAutoDetectName?: string;
  onUseAutoDetect?: () => void;
  /** Current target style name (highlights matching row). */
  currentName?: string;
}

export default function TargetStylePresetModal({
  isOpen,
  onClose,
  onSelect,
  onCreateCustom,
  bjcpAutoDetectName,
  onUseAutoDetect,
  currentName,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchId = useId();
  const titleId = useId();

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return ALL_GROUPS;
    return ALL_GROUPS.map((g) => ({
      label: g.label,
      items: g.items.filter((s) =>
        fuzzyIncludes(searchQuery, s.name, s.description, g.label)
      ),
    })).filter((g) => g.items.length > 0);
  }, [searchQuery]);

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  const handleSelect = (preset: StylePreset) => {
    onSelect(preset.name);
    handleClose();
  };

  const handleAutoDetect = () => {
    if (onUseAutoDetect) onUseAutoDetect();
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
        title="Select target water style"
        kicker="aim for —"
        onClose={handleClose}
        titleId={titleId}
      />

      <div
        style={{
          padding: "14px 22px 14px",
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
            placeholder="Search styles…"
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
        {bjcpAutoDetectName && onUseAutoDetect && !searchQuery ? (
          <div style={{ padding: "10px 22px 0" }}>
            <button
              type="button"
              onClick={handleAutoDetect}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                width: "100%",
                padding: "12px 14px",
                background: `color-mix(in srgb, ${hsTokens.water} 14%, ${hsTokens.cream2})`,
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                color: hsTokens.ink,
                fontFamily: hsTokens.body,
                boxShadow: hsTokens.sh1,
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: hsTokens.water,
                  }}
                >
                  BJCP auto-detect
                </span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{bjcpAutoDetectName}</span>
              </span>
              <span style={{ fontSize: 12, color: hsTokens.muted }}>↺ use detected</span>
            </button>
          </div>
        ) : null}

        {filteredGroups.length === 0 ? (
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
            No styles match that search.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <GroupHeader label={group.label} />
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
                  {group.items.map((preset) => (
                    <PresetRow
                      key={`${group.label}-${preset.name}`}
                      preset={preset}
                      active={preset.name === currentName}
                      onClick={() => handleSelect(preset)}
                    />
                  ))}
                </div>
              </div>
            ))}
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
          {ALL_PRESETS.length} styles available
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
  preset: StylePreset;
  active?: boolean;
  onClick: () => void;
}) {
  const baseStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
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
      <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontFamily: hsTokens.body, fontSize: 14, fontWeight: 700, color: hsTokens.ink }}>
          {preset.name}
        </span>
        <span
          style={{
            display: "inline-flex",
            padding: "2px 9px",
            background: hsTokens.cream,
            border: `1px solid ${hsTokens.ink}55`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: hsTokens.ink,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {preset.clToSo4Ratio}
        </span>
      </span>
      <span style={{ fontFamily: hsTokens.body, fontSize: 12, color: hsTokens.muted, lineHeight: 1.4 }}>
        {preset.description}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 11,
          color: hsTokens.muted,
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        Ca {preset.ca} · Cl {preset.cl} · SO₄ {preset.so4}
      </span>
    </button>
  );
}
