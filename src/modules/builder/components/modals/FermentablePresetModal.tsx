"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSIngredientDot from "../HSIngredientDot";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { FermentablePreset } from "@/modules/recipe/models/Presets";
import { srmToRgb } from "@/modules/recipe/utils/srmColorUtils";
import { BREWING_ORIGINS, getCountryFlag } from "@/utils/flags";
import { fuzzyIncludes } from "@/utils/ingredientMatching";

type ColorCategory = "light" | "amber" | "dark" | "roasted";
type TypeFilter = "grain" | "extract" | "sugar" | "adjunct_mashable";

interface Props {
  isOpen: boolean;
  editing: boolean;
  onClose: () => void;
  onSelect: (preset: FermentablePreset) => void;
  onCreateCustom: () => void;
  presetsGrouped: Array<{ label: string; items: FermentablePreset[] }>;
  isLoading: boolean;
}

const TYPE_OPTIONS: Array<{ id: TypeFilter; label: string }> = [
  { id: "grain", label: "Grain" },
  { id: "extract", label: "Extract" },
  { id: "sugar", label: "Sugar" },
  { id: "adjunct_mashable", label: "Adjunct" },
];

const COLOR_OPTIONS: Array<{ id: ColorCategory; label: string }> = [
  { id: "light", label: "Light (<10°L)" },
  { id: "amber", label: "Amber (10–50°L)" },
  { id: "dark", label: "Dark (50–200°L)" },
  { id: "roasted", label: "Roasted (>200°L)" },
];

/** Malts every homebrew shop stocks, pinned above the full library so a
 *  newcomer's first scroll isn't a wall of single-maltster entries. Resolved
 *  against the live preset list by exact name — missing names just drop out. */
const COMMON_PICKS = [
  "Pale 2-Row",
  "Maris Otter Pale",
  "Pilsner",
  "Munich",
  "Vienna",
  "Wheat Malt",
  "Flaked Oats",
  "Caramel / Crystal 40L",
  "Caramel / Crystal 60L",
  "Carapils (Dextrine Malt)",
  "Chocolate Malt",
  "Roasted Barley",
];

function categorizeColor(l: number): ColorCategory {
  if (l < 10) return "light";
  if (l < 50) return "amber";
  if (l < 200) return "dark";
  return "roasted";
}

function categorizeType(p: FermentablePreset): TypeFilter {
  if (
    p.type === "grain" &&
    (p.name.toLowerCase().includes("adjunct") ||
      p.name.toLowerCase().includes("flak") ||
      p.name.toLowerCase().includes("torrified"))
  ) {
    return "adjunct_mashable";
  }
  return p.type as TypeFilter;
}

export default function FermentablePresetModal({
  isOpen,
  editing,
  onClose,
  onSelect,
  onCreateCustom,
  presetsGrouped,
  isLoading,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<{
    origins: string[];
    types: TypeFilter[];
    colors: ColorCategory[];
  }>({ origins: [], types: [], colors: [] });
  const searchId = useId();
  const titleId = useId();

  const availableOrigins = useMemo(() => {
    const set = new Set<string>();
    presetsGrouped.forEach((g) => {
      g.items.forEach((i) => {
        if (i.originCode) set.add(i.originCode);
      });
    });
    return Array.from(set).sort();
  }, [presetsGrouped]);

  const filteredGrouped = useMemo(() => {
    return presetsGrouped
      .map((group) => ({
        ...group,
        items: group.items.filter((p) => {
          if (!fuzzyIncludes(searchQuery, p.name, group.label)) return false;
          if (activeFilters.origins.length) {
            if (!p.originCode || !activeFilters.origins.includes(p.originCode)) return false;
          }
          if (activeFilters.types.length) {
            if (!activeFilters.types.includes(categorizeType(p))) return false;
          }
          if (activeFilters.colors.length) {
            if (!activeFilters.colors.includes(categorizeColor(p.colorLovibond))) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [presetsGrouped, searchQuery, activeFilters]);

  const totalCount = presetsGrouped.reduce((s, g) => s + g.items.length, 0);

  const commonPicks = useMemo(() => {
    const byName = new Map<string, FermentablePreset>();
    presetsGrouped.forEach((g) =>
      g.items.forEach((i) => {
        if (!byName.has(i.name)) byName.set(i.name, i);
      })
    );
    return COMMON_PICKS.map((n) => byName.get(n)).filter(
      (p): p is FermentablePreset => !!p
    );
  }, [presetsGrouped]);

  // Only pin the common-picks group on the untouched modal — as soon as the
  // user searches or filters, results speak for themselves.
  const filtersIdle =
    !searchQuery.trim() &&
    !activeFilters.origins.length &&
    !activeFilters.types.length &&
    !activeFilters.colors.length;

  const toggleFilter = <K extends keyof typeof activeFilters>(
    key: K,
    value: (typeof activeFilters)[K][number]
  ) => {
    setActiveFilters((prev) => {
      const arr = prev[key] as string[];
      const next = arr.includes(value)
        ? arr.filter((x) => x !== value)
        : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const handleClose = () => {
    setSearchQuery("");
    setShowFilters(false);
    setActiveFilters({ origins: [], types: [], colors: [] });
    onClose();
  };

  const handleSelect = (preset: FermentablePreset) => {
    onSelect(preset);
    handleClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      accent={hsTokens.malt}
      labelledById={titleId}
    >
      <HSModalHeader
        title={editing ? "Swap fermentable" : "Select fermentable"}
        onClose={handleClose}
        titleId={titleId}
      />

      {/* Search + filter toggle */}
      <div
        style={{
          padding: "14px 22px 14px",
          background: hsTokens.paper,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <label
            htmlFor={searchId}
            style={{
              flex: 1,
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
              placeholder="Search fermentables…"
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
          <FilterToggleButton
            active={showFilters}
            onClick={() => setShowFilters((s) => !s)}
          />
        </div>

        {showFilters ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingBottom: 6 }}>
            <FilterRow label="Type">
              {TYPE_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  active={activeFilters.types.includes(opt.id)}
                  onClick={() => toggleFilter("types", opt.id)}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </FilterRow>
            <FilterRow label="Color">
              {COLOR_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  active={activeFilters.colors.includes(opt.id)}
                  onClick={() => toggleFilter("colors", opt.id)}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </FilterRow>
            {availableOrigins.length > 0 ? (
              <FilterRow label="Origin" scrollable>
                {availableOrigins.map((code) => (
                  <FilterChip
                    key={code}
                    active={activeFilters.origins.includes(code)}
                    onClick={() => toggleFilter("origins", code)}
                  >
                    <span style={{ marginRight: 4 }}>{getCountryFlag(code)}</span>
                    {BREWING_ORIGINS[code] ?? code}
                  </FilterChip>
                ))}
              </FilterRow>
            ) : null}
          </div>
        ) : null}
      </div>

      <HSModalBody padding={0}>
        {isLoading ? (
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
            Loading presets…
          </p>
        ) : filteredGrouped.length === 0 ? (
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
            No fermentables match those filters.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filtersIdle && commonPicks.length > 0 ? (
              <div>
                <GroupHeader label="Common picks" />
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
                  {commonPicks.map((preset) => (
                    <PresetRow
                      key={`common-${preset.name}`}
                      preset={preset}
                      onClick={() => handleSelect(preset)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {filteredGrouped.map((group) => (
              <div key={group.label}>
                <GroupHeader label={group.label} />
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
                  {group.items.map((preset) => (
                    <PresetRow
                      key={`${group.label}-${preset.name}`}
                      preset={preset}
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
          {totalCount} presets available
        </span>
        <HSButton onClick={onCreateCustom} color={hsTokens.malt} size="sm">
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

function FilterToggleButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      aria-label="Toggle filters"
      title="Toggle filters"
      style={{
        width: 40,
        height: 40,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? hsTokens.malt : hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: hsTokens.sh1,
        cursor: "pointer",
        color: hsTokens.ink,
        flexShrink: 0,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
      </svg>
    </button>
  );
}

function FilterRow({
  label,
  children,
  scrollable,
}: {
  label: string;
  children: React.ReactNode;
  scrollable?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minWidth: 0,
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
          minWidth: 50,
        }}
      >
        {label}
      </span>
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: scrollable ? "nowrap" : "wrap",
          overflowX: scrollable ? "auto" : "visible",
          flex: 1,
          minWidth: 0,
          paddingBottom: scrollable ? 2 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 11px",
    background: active ? hsTokens.malt : hsTokens.paper,
    border: `1.5px solid ${hsTokens.ink}`,
    borderRadius: 999,
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.04em",
    color: hsTokens.ink,
    cursor: "pointer",
    boxShadow: active ? hsTokens.sh1 : "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  return (
    <button type="button" onClick={onClick} style={style} aria-pressed={active}>
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

function PresetRow({
  preset,
  onClick,
}: {
  preset: FermentablePreset;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        padding: "8px 10px",
        background: "transparent",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        textAlign: "left",
        color: hsTokens.ink,
        transition: "background 90ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hsTokens.cream2;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          fontFamily: hsTokens.body,
          fontSize: 14,
          fontWeight: 600,
          color: hsTokens.ink,
          minWidth: 0,
        }}
      >
        <HSIngredientDot
          color={srmToRgb(preset.colorLovibond)}
          size={12}
          title={`${preset.colorLovibond}°L`}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preset.name}
        </span>
        {preset.originCode ? (
          <span
            title={BREWING_ORIGINS[preset.originCode] ?? preset.originCode}
            style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}
          >
            {getCountryFlag(preset.originCode)}
          </span>
        ) : null}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 12,
          color: hsTokens.muted,
          letterSpacing: "0.02em",
          flexShrink: 0,
        }}
      >
        {preset.colorLovibond}°L · {preset.potentialGu} PPG
      </span>
    </button>
  );
}
