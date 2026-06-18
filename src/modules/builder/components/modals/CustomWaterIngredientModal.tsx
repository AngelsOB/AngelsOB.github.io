"use client";

import { useEffect, useId, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import type { OtherIngredientCategory } from "@/modules/recipe/models/Recipe";

const CATEGORY_LABELS: Record<OtherIngredientCategory, string> = {
  "water-agent": "Water Agent",
  fining: "Fining",
  spice: "Spice",
  flavor: "Flavor",
  herb: "Herb",
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string, category: OtherIngredientCategory) => void;
}

export default function CustomWaterIngredientModal({ isOpen, onClose, onAdd }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OtherIngredientCategory>("other");
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      setName("");
      setCategory("other");
    }
  }, [isOpen]);

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, category);
    onClose();
  };

  return (
    <HSModal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      accent={hsTokens.water}
      labelledById={titleId}
    >
      <HSModalHeader
        title="Custom ingredient"
        onClose={onClose}
        titleId={titleId}
      />

      <HSModalBody>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FieldText
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Ingredient name"
            autoFocus
            onEnter={handleAdd}
          />

          <FieldSelect
            label="Category"
            value={category}
            onChange={(v) => setCategory(v as OtherIngredientCategory)}
            options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
        </div>
      </HSModalBody>

      <HSModalFooter>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent",
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            padding: "8px 16px",
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: hsTokens.ink,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <HSButton
          onClick={handleAdd}
          color={hsTokens.water}
          size="sm"
          disabled={!name.trim()}
        >
          Add
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: hsTokens.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
      }}
    >
      {children}
    </span>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", marginBottom: 6 }}>
        <Eyebrow>{label}</Eyebrow>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        data-autofocus={autoFocus ? "" : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
        style={inputStyle}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={{ display: "block", marginBottom: 6 }}>
        <Eyebrow>{label}</Eyebrow>
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: hsTokens.cream2,
  border: `1.5px solid ${hsTokens.ink}`,
  borderRadius: 8,
  fontFamily: hsTokens.body,
  fontSize: 13,
  color: hsTokens.ink,
  outline: "none",
};
