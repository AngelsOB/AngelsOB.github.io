"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens, hsAlpha } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { getYeastLabFavicon } from "@/modules/recipe/utils/yeastLabIcons";
import { fuzzyIncludes, rankBySearch } from "@/utils/ingredientMatching";
import { yeastSearchText } from "@/modules/ingredients/searchText";
import { useYeastHoverPreview } from "../builder/yeastHoverPreview";

type AttenuationBand = "low" | "med" | "high";

interface Props {
  isOpen: boolean;
  editing: boolean;
  onClose: () => void;
  onSelect: (preset: YeastPreset) => void;
  onCreateCustom: () => void;
  presetsGrouped: Array<{ label: string; items: YeastPreset[] }>;
  isLoading: boolean;
}

const ATTENUATION_OPTIONS: Array<{ id: AttenuationBand; label: string }> = [
  { id: "low", label: "Low (<72%)" },
  { id: "med", label: "Med (72–76%)" },
  { id: "high", label: "High (>76%)" },
];

function categorizeAttenuation(p: YeastPreset): AttenuationBand | "unknown" {
  if (!p.attenuationPercent) return "unknown";
  const att = p.attenuationPercent * 100;
  if (att < 72) return "low";
  if (att <= 76) return "med";
  return "high";
}

export default function YeastPresetModal({
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
    brands: string[];
    attenuation: AttenuationBand[];
  }>({ brands: [], attenuation: [] });
  const searchId = useId();
  const titleId = useId();

  // Flattened library — feeds peer/substitute resolution inside the
  // shared hover preview. Built once per modal render.
  const flatLibrary = useMemo<YeastPreset[]>(() => {
    const out: YeastPreset[] = [];
    for (const group of presetsGrouped) {
      for (const p of group.items) out.push(p);
    }
    return out;
  }, [presetsGrouped]);

  // Picker uses a short dwell + cursor-right placement — long enough
  // to filter a quick sweep down the list, short enough to still feel
  // responsive when the brewer wants to compare two adjacent rows.
  // The builder strain card uses the longer default dwell since the
  // card has editable inputs that need to NOT pop the preview.
  const { portal: previewPortal, getTriggerProps, clear: clearPreview } =
    useYeastHoverPreview(flatLibrary, {
      showDelay: 650,
      placement: "cursor-right",
    });

  useEffect(() => {
    if (!isOpen) clearPreview();
  }, [isOpen, clearPreview]);

  const availableBrands = useMemo(
    () => presetsGrouped.map((g) => g.label).sort(),
    [presetsGrouped]
  );

  const filteredGrouped = useMemo(() => {
    return presetsGrouped
      .map((group) => ({
        ...group,
        items: group.items.filter((p) => {
          // Same haystack as the /yeast page — name, lab, id, strain group,
          // cross-lab aliases, styles. This is why "us 05" also finds the
          // Chico-family strains that list it as an equivalent.
          if (!fuzzyIncludes(searchQuery, yeastSearchText(p))) {
            return false;
          }
          if (
            activeFilters.brands.length &&
            !activeFilters.brands.includes(group.label)
          ) {
            return false;
          }
          if (activeFilters.attenuation.length) {
            const band = categorizeAttenuation(p);
            if (band === "unknown") return false;
            if (!activeFilters.attenuation.includes(band)) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [presetsGrouped, searchQuery, activeFilters]);

  // While searching, collapse the lab groups into one relevance-ranked list so
  // the best match leads (searching "us 05" surfaces SafAle US-05 first, not
  // whichever lab group renders first). Browsing — no query — keeps the groups.
  const searching = searchQuery.trim().length > 0;
  const flatResults = useMemo(() => {
    if (!searching) return [];
    const ranked = rankBySearch(
      filteredGrouped.flatMap((g) => g.items),
      searchQuery,
      (p) => [p.name, p.labProductId, yeastSearchText(p)]
    );
    // "Strong" = the query hit the strain's name or lab code. A row that only
    // matched via a cross-lab alias, style, or producer is dimmed.
    return ranked.map((preset) => ({
      preset,
      strong: fuzzyIncludes(searchQuery, preset.name, preset.labProductId),
    }));
  }, [filteredGrouped, searchQuery, searching]);

  const totalCount = presetsGrouped.reduce((s, g) => s + g.items.length, 0);

  const toggleBrand = (label: string) => {
    setActiveFilters((prev) => ({
      ...prev,
      brands: prev.brands.includes(label)
        ? prev.brands.filter((x) => x !== label)
        : [...prev.brands, label],
    }));
  };

  const toggleAttenuation = (band: AttenuationBand) => {
    setActiveFilters((prev) => ({
      ...prev,
      attenuation: prev.attenuation.includes(band)
        ? prev.attenuation.filter((x) => x !== band)
        : [...prev.attenuation, band],
    }));
  };

  const handleClose = () => {
    setSearchQuery("");
    setShowFilters(false);
    setActiveFilters({ brands: [], attenuation: [] });
    onClose();
  };

  const handleSelect = (preset: YeastPreset) => {
    onSelect(preset);
    handleClose();
  };

  return (
    <>
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      accent={hsTokens.yeast}
      labelledById={titleId}
    >
      <HSModalHeader
        title={editing ? "Swap yeast strain" : "Select yeast strain"}
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
              placeholder="Search yeasts…"
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
            <FilterRow label="Attenuation">
              {ATTENUATION_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  active={activeFilters.attenuation.includes(opt.id)}
                  onClick={() => toggleAttenuation(opt.id)}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </FilterRow>
            {availableBrands.length > 0 ? (
              <FilterRow label="Brand" scrollable>
                {availableBrands.map((label) => (
                  <FilterChip
                    key={label}
                    active={activeFilters.brands.includes(label)}
                    onClick={() => toggleBrand(label)}
                  >
                    {label}
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
            No yeasts match those filters.
          </p>
        ) : searching ? (
          <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
            {flatResults.map(({ preset, strong }) => (
              <PresetRow
                key={`${preset.category ?? ""}-${preset.name}`}
                preset={preset}
                dimmed={!strong}
                onClick={() => handleSelect(preset)}
                hoverProps={getTriggerProps(preset)}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredGrouped.map((group) => (
              <div key={group.label}>
                <GroupHeader label={group.label} />
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
                  {group.items.map((preset) => (
                    <PresetRow
                      key={`${group.label}-${preset.name}`}
                      preset={preset}
                      onClick={() => handleSelect(preset)}
                      hoverProps={getTriggerProps(preset)}
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
          {totalCount} strains available
        </span>
        <HSButton onClick={onCreateCustom} color={hsTokens.yeast} size="sm">
          + Create custom
        </HSButton>
      </HSModalFooter>
    </HSModal>
    {isOpen ? previewPortal : null}
    </>
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
        background: active ? hsTokens.yeast : hsTokens.paper,
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
          minWidth: 76,
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
    background: active ? hsTokens.yeast : hsTokens.paper,
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
  hoverProps,
  dimmed,
}: {
  preset: YeastPreset;
  onClick: () => void;
  hoverProps: {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseLeave?: () => void;
  };
  dimmed?: boolean;
}) {
  const favicon = getYeastLabFavicon(preset.category);
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
        // Weaker matches (hit via alias/style, not the name or code) read as
        // present but secondary.
        opacity: dimmed ? 0.55 : 1,
        transition: "background 90ms ease, opacity 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hsTokens.cream2;
        hoverProps.onMouseEnter?.(e);
      }}
      onMouseMove={(e) => {
        hoverProps.onMouseMove?.(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        hoverProps.onMouseLeave?.();
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
        <LabBadge laboratory={preset.category} favicon={favicon} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        }}
      >
        {preset.attenuationPercent
          ? `${Math.round(preset.attenuationPercent * 100)}% att`
          : "—"}
      </span>
    </button>
  );
}

function LabBadge({
  laboratory,
  favicon,
}: {
  laboratory?: string;
  favicon: string | null;
}) {
  if (favicon) {
    return (
      <img
        src={favicon}
        alt={laboratory || "Yeast lab"}
        width={20}
        height={20}
        style={{
          width: 20,
          height: 20,
          objectFit: "contain",
          borderRadius: 5,
          background: hsTokens.cream,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 20,
        height: 20,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: hsTokens.cream,
        border: `1px solid ${hsAlpha(hsTokens.ink, 20)}`,
        borderRadius: 5,
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        color: hsTokens.muted,
        flexShrink: 0,
      }}
    >
      {laboratory?.charAt(0).toUpperCase() || "Y"}
    </span>
  );
}
