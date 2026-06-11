"use client";

import type { CSSProperties } from "react";

import { hsTokens } from "@/modules/builder/tokens";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (next: T) => void;
  accent?: string;
  ariaLabel?: string;
  size?: "sm" | "md";
}

export default function Segmented<T extends string>({
  value,
  options,
  onChange,
  accent = hsTokens.malt,
  ariaLabel,
  size = "md",
}: Props<T>) {
  const padding = size === "sm" ? "4px 10px" : "6px 14px";
  const fontSize = size === "sm" ? 10 : 11;
  const cellStyle = (active: boolean): CSSProperties => ({
    fontFamily: hsTokens.body,
    fontWeight: 700,
    fontSize,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding,
    border: "none",
    background: active ? accent : "transparent",
    color: hsTokens.ink,
    cursor: "pointer",
    transition: "background 120ms ease",
  });
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        display: "inline-flex",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        overflow: "hidden",
        boxShadow: hsTokens.sh1,
      }}
    >
      {options.map((opt, i) => (
        <span key={opt.value} style={{ display: "inline-flex" }}>
          {i > 0 ? (
            <span
              aria-hidden
              style={{
                width: 1.5,
                background: hsTokens.ink,
                alignSelf: "stretch",
              }}
            />
          ) : null}
          <button
            type="button"
            role="tab"
            aria-selected={value === opt.value}
            style={cellStyle(value === opt.value)}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        </span>
      ))}
    </div>
  );
}
