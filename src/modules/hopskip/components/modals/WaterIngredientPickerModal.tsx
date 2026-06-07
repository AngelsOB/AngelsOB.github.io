"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { OtherIngredientCategory } from "@/modules/beta-builder/domain/models/Recipe";
import { fuzzyIncludes } from "@/utils/ingredientMatching";
import { OTHER_INGREDIENT_PRESETS } from "@/utils/presets";

const CATEGORY_LABELS: Record<OtherIngredientCategory, string> = {
  "water-agent": "Water Agents",
  fining: "Finings",
  spice: "Spices",
  flavor: "Flavors",
  herb: "Herbs",
  other: "Other",
};

const CATEGORY_ORDER: OtherIngredientCategory[] = [
  "water-agent",
  "fining",
  "spice",
  "flavor",
  "herb",
  "other",
];

const CATEGORY_COLOR: Record<OtherIngredientCategory, string> = {
  "water-agent": hsTokens.water,
  fining: hsTokens.yeast,
  spice: hsTokens.honey,
  flavor: hsTokens.malt,
  herb: hsTokens.hops,
  other: hsTokens.muted,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (name: string, category: OtherIngredientCategory) => void;
  onCreateCustom: () => void;
}

export default function WaterIngredientPickerModal({
  isOpen,
  onClose,
  onSelect,
  onCreateCustom,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<OtherIngredientCategory | "all">("all");
  const searchId = useId();
  const titleId = useId();

  const filteredGroups = useMemo(() => {
    return CATEGORY_ORDER
      .filter((cat) => activeCategory === "all" || activeCategory === cat)
      .map((cat) => ({
        category: cat,
        label: CATEGORY_LABELS[cat],
        items: (OTHER_INGREDIENT_PRESETS[cat] || []).filter((name) =>
          fuzzyIncludes(searchQuery, name, CATEGORY_LABELS[cat])
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [searchQuery, activeCategory]);

  const totalCount = filteredGroups.reduce((s, g) => s + g.items.length, 0);

  const handleClose = () => {
    setSearchQuery("");
    setActiveCategory("all");
    onClose();
  };

  const handleSelect = (name: string, category: OtherIngredientCategory) => {
    onSelect(name, category);
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
        title="Add an ingredient"
        kicker="finings, spices, agents —"
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
            width: "100%",
          }}
        >
          <SearchIcon />
          <input
            id={searchId}
            type="text"
            placeholder="Search ingredients…"
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 4 }}>
          <FilterChip
            active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
            color={hsTokens.ink}
          >
            All
          </FilterChip>
          {CATEGORY_ORDER.map((cat) => (
            <FilterChip
              key={cat}
              active={activeCategory === cat}
              onClick={() => setActiveCategory(cat)}
              color={CATEGORY_COLOR[cat]}
            >
              {CATEGORY_LABELS[cat]}
            </FilterChip>
          ))}
        </div>
      </div>

      <HSModalBody padding={0}>
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
            No ingredients match that search.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredGroups.map((group) => (
              <div key={group.category}>
                <GroupHeader label={group.label} dotColor={CATEGORY_COLOR[group.category]} />
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 14px 12px" }}>
                  {group.items.map((name) => (
                    <PresetRow
                      key={`${group.category}-${name}`}
                      name={name}
                      dotColor={CATEGORY_COLOR[group.category]}
                      onClick={() => handleSelect(name, group.category)}
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
          {totalCount} ingredients
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

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  children: React.ReactNode;
}) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 11px",
    background: active ? color : hsTokens.paper,
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
      {children}
    </button>
  );
}

function GroupHeader({ label, dotColor }: { label: string; dotColor: string }) {
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
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dotColor,
          border: `1px solid ${hsTokens.ink}`,
        }}
      />
      {label}
    </h4>
  );
}

function PresetRow({
  name,
  dotColor,
  onClick,
}: {
  name: string;
  dotColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
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
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: dotColor,
          border: `1px solid ${hsTokens.ink}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 13,
          fontWeight: 600,
          color: hsTokens.ink,
        }}
      >
        {name}
      </span>
    </button>
  );
}
