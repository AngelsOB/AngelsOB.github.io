"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions
   -- card-as-tile pattern: the wrapper div is keyboard-focusable so users can
   tab to a card and press Enter to open. Mirrors HSBrowseCard. */

import { type CSSProperties } from "react";
import Link from "next/link";

import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import type { Recipe, RecipeCalculations } from "@/modules/beta-builder/domain/models/Recipe";

interface Props {
  recipe: Recipe;
  calc: RecipeCalculations;
  tilt?: number;
  /** When omitted, the X delete button is not rendered. Useful for read-only
   *  surfaces like the v4 signed-in hero. */
  onDelete?: (recipe: Recipe) => void;
  /** When true, click defers to onPreviewSelect instead of navigating. */
  previewMode?: boolean;
  /** True when THIS card is the currently-previewed one (honey highlight). */
  isPreviewSelected?: boolean;
  /** True when SOME card on the page is selected (shrink others). */
  anyPreviewSelected?: boolean;
  onPreviewSelect?: (recipe: Recipe) => void;
}

function colorMix(a: string, b: string, t: number) {
  return `color-mix(in oklch, ${a} ${Math.round(t * 100)}%, ${b})`;
}

export default function MyRecipeCard({
  recipe,
  calc,
  tilt = 0,
  onDelete,
  previewMode,
  isPreviewSelected,
  anyPreviewSelected,
  onPreviewSelect,
}: Props) {
  const previewActive = !!(previewMode && isPreviewSelected);
  const shrink = !!(previewMode && anyPreviewSelected && !isPreviewSelected);
  const srm = calc.srm ?? 0;
  const href = `/recipes/${recipe.id}`;

  const wrapperStyle: CSSProperties = {
    position: "relative",
    cursor: "pointer",
    outline: previewActive ? `6px solid ${hsTokens.honey}` : undefined,
    outlineOffset: previewActive ? 0 : undefined,
    borderRadius: 14,
    transform: shrink ? "scale(0.92)" : undefined,
    transformOrigin: "center center",
    transition:
      "transform 220ms cubic-bezier(0.4, 0, 0.2, 1), outline-color 180ms ease",
  };

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (previewMode && onPreviewSelect) {
      e.preventDefault();
      onPreviewSelect(recipe);
      return;
    }
    // Default: bubble to the invisible <Link> overlay below.
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter") return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (previewMode && onPreviewSelect) {
      e.preventDefault();
      onPreviewSelect(recipe);
      return;
    }
  }

  const stats: { label: string; value: string; accent: string }[] = [
    { label: "ABV", value: `${(calc.abv ?? 0).toFixed(1)}%`, accent: hsTokens.yeast },
    { label: "IBU", value: `${Math.round(calc.ibu ?? 0)}`, accent: hsTokens.hops },
    { label: "SRM", value: `${(calc.srm ?? 0).toFixed(0)}`, accent: hsTokens.roast },
    { label: "OG", value: `${(calc.og ?? 0).toFixed(3)}`, accent: hsTokens.malt },
  ];

  return (
    <div
      className="hs-lift-card"
      data-preview-selected={previewActive ? "true" : undefined}
      role="article"
      tabIndex={0}
      style={wrapperStyle}
      onClick={handleClick}
      onKeyDown={handleKey}
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden
        prefetch={false}
        onClick={(e) => {
          if (previewMode) e.preventDefault();
        }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: previewMode ? "none" : undefined,
        }}
      >
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          {recipe.name}
        </span>
      </Link>

      <HSCard shadow={3} tilt={tilt} padding={0} style={{ overflow: "hidden" }}>
        <div style={{ height: 18, background: srmToRgb(srm) }} aria-hidden />
        <div style={{ padding: "18px 20px 20px" }}>
          <div
            className="hs-browse-card-title"
            style={{
              fontFamily: hsTokens.display,
              fontSize: 22,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {recipe.name || "Untitled recipe"}
          </div>
          {recipe.subtitle ? (
            <div
              style={{
                fontFamily: hsTokens.script,
                fontSize: 17,
                lineHeight: 1.1,
                color: hsTokens.muted,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {recipe.subtitle}
            </div>
          ) : null}
          <div
            style={{
              fontStyle: "italic",
              fontSize: 13,
              color: hsTokens.muted,
              marginTop: 4,
              minHeight: 18,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {recipe.style || "no style set"}
          </div>

          {(recipe.tags ?? []).length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {(recipe.tags ?? []).slice(0, 3).map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: colorMix(hsTokens.hops, hsTokens.cream2, 0.25),
                    color: hsTokens.ink,
                    padding: "3px 10px",
                    borderRadius: 999,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  background: hsTokens.cream2,
                  borderTop: `3px solid ${s.accent}`,
                  borderRadius: 6,
                  padding: "8px 6px",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 15,
                    letterSpacing: "-0.03em",
                    marginTop: 2,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            <span style={{ fontFamily: hsTokens.mono, fontVariantNumeric: "tabular-nums" }}>
              {recipe.updatedAt ? new Date(recipe.updatedAt).toLocaleDateString() : "—"}
            </span>
          </div>
        </div>
      </HSCard>

      {onDelete ? (
        <button
          type="button"
          aria-label="Delete recipe"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(recipe);
          }}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            border: `1.5px solid ${hsTokens.ink}`,
            background: hsTokens.paper,
            borderRadius: 999,
            cursor: "pointer",
            color: hsTokens.ink,
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            boxShadow: hsTokens.sh1,
            zIndex: 25,
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
