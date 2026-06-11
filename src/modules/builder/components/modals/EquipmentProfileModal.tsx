"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { EquipmentProfile } from "@/modules/recipe/models/Equipment";
import { fuzzyIncludes } from "@/utils/ingredientMatching";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profile: EquipmentProfile) => void;
  onCreateCustom: () => void;
  profiles: EquipmentProfile[];
  currentProfileName: string | null;
}

type SourceFilter = "all" | "preset" | "custom";

export default function EquipmentProfileModal({
  isOpen,
  onClose,
  onSelect,
  onCreateCustom,
  profiles,
  currentProfileName,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const searchId = useId();
  const titleId = useId();

  const totalCount = profiles.length;
  const customCount = useMemo(
    () => profiles.filter((p) => p.isCustom).length,
    [profiles]
  );

  const filteredGrouped = useMemo(() => {
    const matches = profiles.filter((p) => {
      if (sourceFilter === "preset" && p.isCustom) return false;
      if (sourceFilter === "custom" && !p.isCustom) return false;
      return fuzzyIncludes(searchQuery, p.name, p.description);
    });
    const presets = matches.filter((p) => !p.isCustom);
    const customs = matches.filter((p) => p.isCustom);
    const groups: Array<{ label: string; items: EquipmentProfile[] }> = [];
    if (presets.length > 0) groups.push({ label: "Preset profiles", items: presets });
    if (customs.length > 0) groups.push({ label: "Custom profiles", items: customs });
    return groups;
  }, [profiles, searchQuery, sourceFilter]);

  const handleClose = () => {
    setSearchQuery("");
    setSourceFilter("all");
    onClose();
  };

  const handleSelect = (profile: EquipmentProfile) => {
    onSelect(profile);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      accent={hsTokens.muted}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Select equipment profile"
        kicker="pick your kit —"
        onClose={handleClose}
        titleId={titleId}
      />

      <div
        style={{
          padding: "14px 22px 14px",
          background: hsTokens.paper,
          display: "flex",
          flexDirection: "column",
          gap: 10,
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
          }}
        >
          <SearchIcon />
          <input
            id={searchId}
            type="text"
            placeholder="Search equipment profiles…"
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
        <FilterRow label="Source">
          <FilterChip
            active={sourceFilter === "all"}
            onClick={() => setSourceFilter("all")}
          >
            All ({totalCount})
          </FilterChip>
          <FilterChip
            active={sourceFilter === "preset"}
            onClick={() => setSourceFilter("preset")}
          >
            Presets
          </FilterChip>
          <FilterChip
            active={sourceFilter === "custom"}
            onClick={() => setSourceFilter("custom")}
            disabled={customCount === 0}
          >
            Custom ({customCount})
          </FilterChip>
        </FilterRow>
      </div>

      <HSModalBody padding={0}>
        {filteredGrouped.length === 0 ? (
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
            No profiles match those filters.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredGrouped.map((group) => (
              <div key={group.label}>
                <GroupHeader label={group.label} />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "10px 14px 14px",
                    gap: 6,
                  }}
                >
                  {group.items.map((profile) => (
                    <ProfileRow
                      key={profile.name}
                      profile={profile}
                      isCurrent={profile.name === currentProfileName}
                      onClick={() => handleSelect(profile)}
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
          {totalCount} {totalCount === 1 ? "profile" : "profiles"} saved
        </span>
        <HSButton onClick={onCreateCustom} color={hsTokens.honey} size="sm">
          + Create custom
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}

// ─── Internals ────────────────────────────────────────────────────

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

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
        paddingBottom: 6,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          flexShrink: 0,
          minWidth: 76,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 11px",
    background: active ? hsTokens.cream2 : hsTokens.paper,
    border: `1.5px solid ${hsTokens.ink}`,
    borderRadius: 999,
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.04em",
    color: disabled ? hsTokens.muted : hsTokens.ink,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: active ? hsTokens.sh1 : "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      aria-pressed={active}
      disabled={disabled}
    >
      {children}
    </button>
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

function ProfileRow({
  profile,
  isCurrent,
  onClick,
}: {
  profile: EquipmentProfile;
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        padding: "10px 12px",
        background: isCurrent ? hsTokens.cream2 : "transparent",
        border: isCurrent ? `1.5px solid ${hsTokens.ink}` : "1.5px solid transparent",
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        color: hsTokens.ink,
        transition: "background 90ms ease, border-color 90ms ease",
      }}
      onMouseEnter={(e) => {
        if (isCurrent) return;
        e.currentTarget.style.background = hsTokens.cream2;
      }}
      onMouseLeave={(e) => {
        if (isCurrent) return;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 15,
            fontWeight: 700,
            color: hsTokens.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {profile.name}
        </span>
        {profile.isCustom ? (
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              border: `1px solid ${hsTokens.ink}55`,
              padding: "1px 6px",
              borderRadius: 999,
              flexShrink: 0,
            }}
          >
            Custom
          </span>
        ) : null}
        {isCurrent ? (
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 15,
              color: hsTokens.muted,
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            in use
          </span>
        ) : null}
      </div>
      {profile.description ? (
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 12,
            color: hsTokens.muted,
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {profile.description}
        </p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
          gap: 4,
          marginTop: 2,
        }}
      >
        <Stat label="Batch" value={`${profile.batchSizeL.toFixed(1)} L`} />
        <Stat label="Boil" value={`${profile.boilTimeMin} min`} />
        <Stat label="Mash eff" value={`${profile.mashEfficiency}%`} />
        <Stat label="BH eff" value={`${profile.brewhouseEfficiency}%`} />
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
