"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type {
  HopPreset,
  HopFlavorProfile,
} from "@/modules/beta-builder/domain/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/beta-builder/domain/models/Presets";

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
  const [hoveredPreset, setHoveredPreset] = useState<HopPreset | null>(null);
  const searchId = useId();
  const titleId = useId();

  // Cursor-follow tooltip refs (imperative transforms, no setState per move
  // — matches the compare page's BarRow + HopSection radar pattern).
  const previewRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  /** Position the preview near (clientX, clientY) with optional rotation.
   *  Flips to the left of the cursor if it would clip the viewport edge. */
  const applyTransform = useCallback(
    (clientX: number, clientY: number, rotation: number) => {
      const t = previewRef.current;
      if (!t) return;
      const PREVIEW_W = 188;
      const OFFSET = 18;
      const willClipRight =
        typeof window !== "undefined" &&
        clientX + OFFSET + PREVIEW_W > window.innerWidth - 12;
      const x = willClipRight ? clientX - OFFSET - PREVIEW_W : clientX + OFFSET;
      // Clamp Y so the preview never spills past viewport top/bottom.
      const PREVIEW_HALF_H = 110;
      const minY = PREVIEW_HALF_H + 6;
      const maxY =
        typeof window !== "undefined"
          ? window.innerHeight - PREVIEW_HALF_H - 6
          : clientY;
      const y = Math.max(minY, Math.min(maxY, clientY));
      t.style.transform = `translate(${x}px, ${y}px) translateY(-50%) rotate(${rotation}deg)`;
    },
    []
  );

  const onCursorMove = useCallback(
    (e: React.MouseEvent) => {
      const t = previewRef.current;
      if (!t) return;
      const last = lastClientXRef.current;
      const isFirstMove = last === null;
      const dx = last !== null ? e.clientX - last : 0;
      lastClientXRef.current = e.clientX;
      // Velocity rotation, capped so it stays subtle.
      const rotation = isFirstMove ? 0 : Math.max(-12, Math.min(12, -dx * 0.4));

      if (isFirstMove) {
        // First-show snap — disable transition for one frame so the tooltip
        // appears AT the cursor instead of animating in from viewport origin.
        t.style.transition = "none";
        applyTransform(e.clientX, e.clientY, 0);
        void t.offsetHeight; // force reflow so the snap commits before re-enable
        t.style.transition = "opacity 140ms ease, transform 90ms ease-out";
      } else {
        applyTransform(e.clientX, e.clientY, rotation);
      }
      t.style.opacity = "1";
      if (restTimerRef.current !== null)
        window.clearTimeout(restTimerRef.current);
      const rx = e.clientX;
      const ry = e.clientY;
      restTimerRef.current = window.setTimeout(
        () => applyTransform(rx, ry, 0),
        120
      );
    },
    [applyTransform]
  );

  const onCursorLeave = useCallback(() => {
    const t = previewRef.current;
    if (t) t.style.opacity = "0";
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }, []);

  // Clear the preview when the modal closes so it doesn't linger.
  useEffect(() => {
    if (!isOpen) {
      setHoveredPreset(null);
      onCursorLeave();
    }
  }, [isOpen, onCursorLeave]);

  const filteredGrouped = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return presetsGrouped
      .map((group) => ({
        ...group,
        items: group.items.filter((p) => {
          if (q && !p.name.toLowerCase().includes(q)) return false;
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
          padding: "14px 22px 0",
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
            {filteredGrouped.map((group) => (
              <div key={group.label}>
                <GroupHeader label={group.label} />
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
                  {group.items.map((preset) => (
                    <PresetRow
                      key={`${group.label}-${preset.name}`}
                      preset={preset}
                      onClick={() => handleSelect(preset)}
                      onHoverStart={(p) => setHoveredPreset(p)}
                      onCursorMove={onCursorMove}
                      onHoverEnd={() => {
                        setHoveredPreset(null);
                        onCursorLeave();
                      }}
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
    {isOpen && typeof document !== "undefined"
      ? createPortal(
          // Wrap in .hs-theme so the CSS custom properties (var(--hs-paper)
          // etc.) cascade into the portal. Otherwise the preview can read as
          // transparent on screens where the theme class lives on a deeper
          // element than the portal target.
          <div
            className="hs-theme"
            ref={previewRef}
            role="tooltip"
            aria-hidden={hoveredPreset === null}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: 188,
              zIndex: 1000,
              pointerEvents: "none",
              opacity: 0,
              transition: "opacity 140ms ease, transform 90ms ease-out",
              background: "#f8f3dc",
              backgroundColor: "var(--hs-paper, #f8f3dc)",
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 10,
              boxShadow: hsTokens.sh3,
              padding: 10,
            }}
          >
            {hoveredPreset?.flavor ? (
              <PreviewBody preset={hoveredPreset} />
            ) : null}
          </div>,
          document.body
        )
      : null}
    </>
  );
}

/** Inner content of the cursor-follow preview — name header + mini radar. */
function PreviewBody({ preset }: { preset: HopPreset }) {
  if (!preset.flavor) return null;
  const dom = dominantFlavor(preset);
  const accentColor = dom ? FLAVOR_COLOR[dom] : hsTokens.hops;
  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 4,
          paddingBottom: 4,
          borderBottom: `1px solid ${hsTokens.ink}22`,
        }}
      >
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
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 12,
            color: hsTokens.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {preset.name}
        </span>
      </div>
      <PresetMiniRadar flavor={preset.flavor} color={accentColor} />
    </>
  );
}

/** Single-flavor 9-axis polygon, designed for the modal hover preview.
 *  Smaller + simpler than HopSection's main radar; no hover tooltips. */
function PresetMiniRadar({
  flavor,
  color,
}: {
  flavor: HopFlavorProfile;
  color: string;
}) {
  const size = 150;
  const max = 5;
  const pad = 22;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const labelAt = (i: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = radius + 10;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };

  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  const polyPoints = HOP_FLAVOR_KEYS.map((k, i) =>
    pointAt(i, flavor[k] ?? 0).join(",")
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", margin: "0 auto" }}
      aria-hidden
    >
      {[0.5, 1].map((m) => (
        <polygon
          key={m}
          points={ringPoints(m)}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.4}
          opacity={m === 1 ? 0.3 : 0.18}
        />
      ))}
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [x, y] = pointAt(i, max);
        return (
          <line
            key={k}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--hs-ink)"
            strokeWidth={0.25}
            opacity={0.2}
          />
        );
      })}
      <polygon
        points={polyPoints}
        fill={color}
        fillOpacity={0.32}
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [lx, ly] = labelAt(i);
        return (
          <text
            key={`label-${k}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 6,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fill: FLAVOR_COLOR[k as FlavorFilter] ?? hsTokens.muted,
            }}
          >
            {FLAVOR_LABEL[k as FlavorFilter]?.split(" ")[0] ?? k}
          </text>
        );
      })}
    </svg>
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
  onHoverStart,
  onCursorMove,
  onHoverEnd,
}: {
  preset: HopPreset;
  onClick: () => void;
  onHoverStart?: (preset: HopPreset) => void;
  onCursorMove?: (e: React.MouseEvent) => void;
  onHoverEnd?: () => void;
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
        if (!preset.flavor) return;
        onHoverStart?.(preset);
        // Pass through the cursor-follow handler so the snap-on-first-move
        // pattern can lock onto the initial position.
        onCursorMove?.(e);
      }}
      onMouseMove={(e) => {
        if (!preset.flavor) return;
        onCursorMove?.(e);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        onHoverEnd?.();
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
