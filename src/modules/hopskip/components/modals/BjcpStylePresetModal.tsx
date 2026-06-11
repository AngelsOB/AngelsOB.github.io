"use client";

import { useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSModal, { HSModalBody, HSModalFooter, HSModalHeader } from "./HSModal";

import { getBjcpCategories, type BjcpStyle } from "@/utils/bjcp";
import { getBjcpStyleSpec, type BjcpStyleSpec } from "@/utils/bjcpSpecs";
import { srmToRgb } from "@/modules/recipe/utils/srmColorUtils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called with `"{code}. {name}"` (e.g. `"21A. American IPA"`). */
  onSelect: (style: string) => void;
  /** Current style string (`"{code}. {name}"`); the matching row is highlighted. */
  currentStyle?: string;
}

const CATEGORIES = getBjcpCategories();
const TOTAL_STYLES = CATEGORIES.reduce((n, c) => n + c.styles.length, 0);

export default function BjcpStylePresetModal({
  isOpen,
  onClose,
  onSelect,
  currentStyle,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchId = useId();
  const titleId = useId();

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.map((cat) => ({
      ...cat,
      styles: cat.styles.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          cat.name.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.styles.length > 0);
  }, [searchQuery]);

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  const handleSelect = (style: BjcpStyle) => {
    onSelect(`${style.code}. ${style.name}`);
    handleClose();
  };

  const handleClear = () => {
    onSelect("");
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
        title="Select BJCP style"
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
            placeholder="Search by style name or code…"
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
        {filteredCategories.length === 0 ? (
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
            {filteredCategories.map((category) => (
              <div key={category.code}>
                <GroupHeader code={category.code} label={category.name} />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "6px 14px 12px",
                  }}
                >
                  {category.styles.map((style) => {
                    const styleString = `${style.code}. ${style.name}`;
                    return (
                      <StyleRow
                        key={style.code}
                        style={style}
                        active={currentStyle === styleString}
                        onClick={() => handleSelect(style)}
                      />
                    );
                  })}
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
          {TOTAL_STYLES} styles available
        </span>
        {currentStyle ? (
          <HSButton onClick={handleClear} color={hsTokens.roast} size="sm" variant="ghost">
            Clear style
          </HSButton>
        ) : null}
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

function GroupHeader({ code, label }: { code: string; label: string }) {
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
      {code} · {label}
    </h4>
  );
}

function StyleRow({
  style,
  active,
  onClick,
}: {
  style: BjcpStyle;
  active?: boolean;
  onClick: () => void;
}) {
  const spec = getBjcpStyleSpec(style.code);
  const chip = srmChipColors(spec?.srm);

  const baseStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
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
      <span
        title={spec?.srm ? `SRM ${spec.srm[0]}–${spec.srm[1]}` : undefined}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          height: 26,
          padding: "0 8px",
          background: chip.bg,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 6,
          fontFamily: hsTokens.display,
          fontSize: 12,
          letterSpacing: "0.02em",
          color: chip.fg,
          flexShrink: 0,
          fontVariantNumeric: "tabular-nums",
          boxShadow: hsTokens.sh1,
        }}
      >
        {style.code}
      </span>

      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 14,
          fontWeight: 700,
          color: hsTokens.ink,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {style.name}
      </span>

      {active ? (
        <span
          aria-hidden
          style={{
            fontFamily: hsTokens.script,
            fontSize: 16,
            color: hsTokens.malt,
            transform: "rotate(-4deg)",
            display: "inline-block",
            flexShrink: 0,
            whiteSpace: "nowrap",
            lineHeight: 1,
          }}
        >
          current!
        </span>
      ) : null}

      {spec ? (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
            paddingLeft: 8,
          }}
        >
          <StatColumn label="ABV" value={formatRange(spec.abv, (n) => n.toFixed(1))} suffix="%" />
          <StatColumn label="IBU" value={formatRange(spec.ibu, (n) => Math.round(n).toString())} />
          <StatColumn label="SRM" value={formatRange(spec.srm, (n) => formatSrm(n))} />
        </span>
      ) : null}
    </button>
  );
}

// Midpoint of the style's SRM range drives both chip fill and text color.
// Under SRM ~12 the gradient is still light gold/amber → keep ink text.
// At/above 12 it's getting toward copper/brown → flip to cream for contrast.
function srmChipColors(range?: [number, number]): { bg: string; fg: string } {
  if (!range) {
    return { bg: hsTokens.paper, fg: hsTokens.ink };
  }
  const mid = (range[0] + range[1]) / 2;
  const clamped = Math.max(1, Math.min(40, mid));
  return {
    bg: srmToRgb(clamped),
    fg: clamped >= 12 ? hsTokens.cream : hsTokens.ink,
  };
}

function StatColumn({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1,
        lineHeight: 1,
        minWidth: 50,
      }}
    >
      <span
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: hsTokens.muted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 12,
          fontWeight: 600,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        {value}
        {suffix && value !== "—" ? (
          <span style={{ color: hsTokens.muted, marginLeft: 1 }}>{suffix}</span>
        ) : null}
      </span>
    </span>
  );
}

function formatRange(
  range: BjcpStyleSpec["abv"],
  fmt: (n: number) => string
): string {
  if (!range) return "—";
  return `${fmt(range[0])}–${fmt(range[1])}`;
}

function formatSrm(n: number): string {
  return n >= 10 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
}
