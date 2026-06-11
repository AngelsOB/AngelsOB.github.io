"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { HopPreset } from "@/modules/recipe/models/Presets";
import { fuzzyIncludes } from "@/utils/ingredientMatching";
import { useHopHoverPreview } from "../builder/hopHoverPreview";

type PurposeFilter = "aroma" | "dual" | "bittering";
type FlavorFilter =
  | "citrus"
  | "tropicalFruit"
  | "stoneFruit"
  | "floral"
  | "herbal"
  | "spice"
  | "resinPine"
  | "grassy"
  | "berry";

interface Props {
  isOpen: boolean;
  editing: boolean;
  onClose: () => void;
  onSelect: (preset: HopPreset) => void;
  onCreateCustom: () => void;
  presetsGrouped: Array<{ label: string; items: HopPreset[] }>;
  isLoading: boolean;
}

const PURPOSE_OPTIONS: Array<{ id: PurposeFilter; label: string }> = [
  { id: "aroma", label: "Aroma (<6%)" },
  { id: "dual", label: "Dual (6–10%)" },
  { id: "bittering", label: "Bittering (>10%)" },
];

const FLAVOR_OPTIONS: Array<{ id: FlavorFilter; label: string }> = [
  { id: "citrus", label: "Citrus" },
  { id: "tropicalFruit", label: "Tropical" },
  { id: "stoneFruit", label: "Stone fruit" },
  { id: "berry", label: "Berry" },
  { id: "floral", label: "Floral" },
  { id: "herbal", label: "Herbal" },
  { id: "spice", label: "Spice" },
  { id: "resinPine", label: "Pine / Resin" },
  { id: "grassy", label: "Grassy" },
];

function purposeOf(p: HopPreset): PurposeFilter {
  const a = p.alphaAcidPercent;
  if (a < 6) return "aroma";
  if (a <= 10) return "dual";
  return "bittering";
}

function dominantFlavor(p: HopPreset): FlavorFilter | null {
  if (!p.flavor) return null;
  let best: FlavorFilter | null = null;
  let bestV = -1;
  (Object.entries(p.flavor) as Array<[FlavorFilter, number]>).forEach(([k, v]) => {
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  });
  return best;
}

function topFlavorAxes(p: HopPreset, n: number): FlavorFilter[] {
  if (!p.flavor) return [];
  const entries = Object.entries(p.flavor) as Array<[FlavorFilter, number]>;
  return entries
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

const FLAVOR_COLOR: Record<FlavorFilter, string> = {
  citrus: "#facc15",
  tropicalFruit: "#fb923c",
  stoneFruit: "#f97316",
  berry: "#a855f7",
  floral: "#f472b6",
  grassy: "#84cc16",
  herbal: "#22c55e",
  spice: "#ef4444",
  resinPine: "#16a34a",
};

const FLAVOR_LABEL: Record<FlavorFilter, string> = {
  citrus: "citrus",
  tropicalFruit: "tropical",
  stoneFruit: "stone fruit",
  berry: "berry",
  floral: "floral",
  grassy: "grassy",
  herbal: "herbal",
  spice: "spice",
  resinPine: "pine",
};

/** Varieties every homebrew shop stocks, pinned above the full library so a
 *  newcomer isn't dropped into 200+ alphabetical rows. Spans modern American,
 *  noble, English, and a clean bitterer. Resolved against the live preset
 *  list by exact name — missing names just drop out. */
const COMMON_PICKS = [
  "Citra",
  "Mosaic",
  "Simcoe",
  "Amarillo",
  "Cascade",
  "Centennial",
  "Galaxy",
  "Nelson Sauvin",
  "Saaz",
  "Hallertau Mittelfrüh",
  "East Kent Goldings",
  "Magnum",
];

export default function HopPresetModal({
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
    purposes: PurposeFilter[];
    flavors: FlavorFilter[];
  }>({ purposes: [], flavors: [] });
  const searchId = useId();
  const titleId = useId();

  // Flat library — feeds similar-hops cosine lookups in the preview.
  const flatLibrary = useMemo<HopPreset[]>(() => {
    const out: HopPreset[] = [];
    for (const group of presetsGrouped) {
      for (const p of group.items) out.push(p);
    }
    return out;
  }, [presetsGrouped]);

  // Shared hover hook — short dwell + cursor-right placement so the
  // panel doesn't flicker through every row on a quick sweep, but
  // still feels responsive when comparing two adjacent rows. Builder
  // rows use the longer default dwell + anchored-above placement so
  // the hovered row stays visible.
  const { portal: previewPortal, getTriggerProps, clear: clearPreview } =
    useHopHoverPreview(flatLibrary, {
      showDelay: 650,
      placement: "cursor-right",
    });

  useEffect(() => {
    if (!isOpen) clearPreview();
  }, [isOpen, clearPreview]);

  const filteredGrouped = useMemo(() => {
    return presetsGrouped
      .map((group) => ({
        ...group,
        items: group.items.filter((p) => {
          if (!fuzzyIncludes(searchQuery, p.name, group.label)) return false;
          if (activeFilters.purposes.length) {
            if (!activeFilters.purposes.includes(purposeOf(p))) return false;
          }
          if (activeFilters.flavors.length) {
            const top = topFlavorAxes(p, 3);
            if (!activeFilters.flavors.some((f) => top.includes(f))) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [presetsGrouped, searchQuery, activeFilters]);

  const totalCount = presetsGrouped.reduce((s, g) => s + g.items.length, 0);

  const commonPicks = useMemo(() => {
    const byName = new Map<string, HopPreset>();
    flatLibrary.forEach((p) => {
      if (!byName.has(p.name)) byName.set(p.name, p);
    });
    return COMMON_PICKS.map((n) => byName.get(n)).filter(
      (p): p is HopPreset => !!p
    );
  }, [flatLibrary]);

  // Only pin the common-picks group on the untouched modal — as soon as the
  // user searches or filters, results speak for themselves.
  const filtersIdle =
    !searchQuery.trim() &&
    !activeFilters.purposes.length &&
    !activeFilters.flavors.length;

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
    setActiveFilters({ purposes: [], flavors: [] });
    onClose();
  };

  const handleSelect = (preset: HopPreset) => {
    onSelect(preset);
    handleClose();
  };

  return (
    <>
    <HSModal
      isOpen={isOpen}
      onClose={handleClose}
      size="3xl"
      accent={hsTokens.hops}
      labelledById={titleId}
    >
      <HSModalHeader
        title={editing ? "Swap hop" : "Select hop"}
        kicker={editing ? "swap —" : "pick a variety —"}
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
              placeholder="Search hops…"
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
            <FilterRow label="Purpose">
              {PURPOSE_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  active={activeFilters.purposes.includes(opt.id)}
                  onClick={() => toggleFilter("purposes", opt.id)}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </FilterRow>
            <FilterRow label="Flavor" scrollable>
              {FLAVOR_OPTIONS.map((opt) => (
                <FilterChip
                  key={opt.id}
                  active={activeFilters.flavors.includes(opt.id)}
                  onClick={() => toggleFilter("flavors", opt.id)}
                  accentColor={FLAVOR_COLOR[opt.id]}
                >
                  {opt.label}
                </FilterChip>
              ))}
            </FilterRow>
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
            No hops match those filters.
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
                      hoverProps={getTriggerProps(preset)}
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
          {totalCount} presets available
        </span>
        <HSButton onClick={onCreateCustom} color={hsTokens.hops} size="sm">
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
        background: active ? hsTokens.hops : hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: hsTokens.sh1,
        cursor: "pointer",
        color: active ? hsTokens.cream : hsTokens.ink,
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
  accentColor,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accentColor?: string;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "4px 11px",
    background: active ? hsTokens.hops : hsTokens.paper,
    border: `1.5px solid ${hsTokens.ink}`,
    borderRadius: 999,
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.04em",
    color: active ? hsTokens.cream : hsTokens.ink,
    cursor: "pointer",
    boxShadow: active ? hsTokens.sh1 : "none",
    whiteSpace: "nowrap",
    flexShrink: 0,
  };
  return (
    <button type="button" onClick={onClick} style={style} aria-pressed={active}>
      {accentColor ? (
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: accentColor,
            border: `1px solid ${hsTokens.ink}`,
            flexShrink: 0,
          }}
        />
      ) : null}
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
}: {
  preset: HopPreset;
  onClick: () => void;
  hoverProps: {
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseMove?: (e: React.MouseEvent) => void;
    onMouseLeave?: () => void;
  };
}) {
  const purpose = purposeOf(preset);
  const dom = dominantFlavor(preset);
  const dotColor = dom ? FLAVOR_COLOR[dom] : hsTokens.hops;
  const topAxes = topFlavorAxes(preset, 3);
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
        <span
          aria-hidden
          title={dom ? FLAVOR_LABEL[dom] : "no flavor data"}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: dotColor,
            border: `1.5px solid ${hsTokens.ink}`,
            flexShrink: 0,
          }}
        />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {preset.name}
        </span>
        {topAxes.length > 0 ? (
          <span
            style={{
              fontFamily: hsTokens.script,
              fontSize: 14,
              color: hsTokens.muted,
              transform: "rotate(-1deg)",
              display: "inline-block",
              whiteSpace: "nowrap",
            }}
          >
            {topAxes.map((a) => FLAVOR_LABEL[a]).join(" · ")}
          </span>
        ) : null}
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          {purpose}
        </span>
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 12,
            color: hsTokens.muted,
            letterSpacing: "0.02em",
          }}
        >
          {preset.alphaAcidPercent.toFixed(1)}% AA
        </span>
      </span>
    </button>
  );
}
