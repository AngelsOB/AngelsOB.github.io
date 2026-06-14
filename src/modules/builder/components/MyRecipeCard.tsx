"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions
   -- card-as-tile pattern: the wrapper div is keyboard-focusable so users can
   tab to a card and press Enter to open. Mirrors HSBrowseCard. */

import { type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";
import HSActionMenu, { type HSActionMenuItem } from "@/modules/builder/components/HSActionMenu";
import { srmToRgb } from "@/modules/recipe/utils/srmColorUtils";
import { humanizeDate } from "@/utils/relativeDate";
import {
  downloadTextFile,
  generateBeerXml,
  generateRecipeMarkdown,
  sanitizeFileName,
} from "@/modules/recipe/utils/recipeExport";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { useUserTier } from "@/modules/auth/useUserTier";
import { canAccess } from "@/modules/auth/tierAccess";
import { toast } from "@/stores/toastStore";
import type { Recipe, RecipeCalculations } from "@/modules/recipe/models/Recipe";

interface Props {
  recipe: Recipe;
  calc: RecipeCalculations;
  tilt?: number;
  /** When omitted, the "..." action menu is not rendered. Useful for
   *  read-only surfaces like the homepage signed-in hero. */
  onDelete?: (recipe: Recipe) => void;
  /** True when the recipe lives only in this device's localStorage (created
   *  while signed out). Shows an "on this device" badge. */
  isLocal?: boolean;
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
  isLocal,
  previewMode,
  isPreviewSelected,
  anyPreviewSelected,
  onPreviewSelect,
}: Props) {
  const router = useRouter();
  const duplicateRecipe = useRecipeStore((s) => s.duplicateRecipe);
  const { userState } = useUserTier();
  const exportAllowed = canAccess("export", userState);
  const previewActive = !!(previewMode && isPreviewSelected);
  const shrink = !!(previewMode && anyPreviewSelected && !isPreviewSelected);
  const srm = calc.srm ?? 0;
  const href = `/recipes/${recipe.id}`;

  // Share links only exist for published cloud recipes.
  const sharePath =
    recipe.isPublic !== false && recipe.shareSlug ? `/r/${recipe.shareSlug}` : null;

  function handleExport(format: "markdown" | "json" | "beerxml" | "copy-md") {
    if (!exportAllowed) return;
    try {
      const filename = sanitizeFileName(recipe.name || "untitled-recipe");
      switch (format) {
        case "markdown":
          downloadTextFile(`${filename}.md`, generateRecipeMarkdown(recipe, calc));
          break;
        case "copy-md":
          void navigator.clipboard
            .writeText(generateRecipeMarkdown(recipe, calc))
            .then(() => toast.success("Markdown copied to clipboard"));
          break;
        case "json":
          downloadTextFile(`${filename}.json`, JSON.stringify(recipe, null, 2), "application/json");
          break;
        case "beerxml":
          downloadTextFile(`${filename}.xml`, generateBeerXml(recipe), "text/xml");
          break;
      }
    } catch {
      toast.error("Export failed");
    }
  }

  const menuItems: HSActionMenuItem[] = [
    { label: "Duplicate", onClick: () => duplicateRecipe(recipe.id) },
    {
      label: "Copy Share Link",
      disabled: !sharePath,
      onClick: () => {
        navigator.clipboard.writeText(`${window.location.origin}${sharePath}`);
        toast.success("Share link copied");
      },
    },
    {
      label: "Export Markdown",
      separator: true,
      disabled: !exportAllowed,
      onClick: () => handleExport("markdown"),
    },
    {
      label: "Copy Markdown",
      disabled: !exportAllowed,
      onClick: () => handleExport("copy-md"),
    },
    {
      label: "Export JSON",
      disabled: !exportAllowed,
      onClick: () => handleExport("json"),
    },
    {
      label: "Export BeerXML",
      disabled: !exportAllowed,
      onClick: () => handleExport("beerxml"),
    },
    ...(onDelete
      ? [
          {
            label: "Delete",
            separator: true,
            destructive: true,
            onClick: () => onDelete(recipe),
          } satisfies HSActionMenuItem,
        ]
      : []),
  ];

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
    if ((e.target as HTMLElement).closest("button, a, [role=menu], [role=menuitem]")) return;
    if (previewMode && onPreviewSelect) {
      e.preventDefault();
      onPreviewSelect(recipe);
      return;
    }
    // The HSCard (position:relative + tilt transform) paints above the overlay
    // <Link>, so the link itself never receives the click. Navigate
    // programmatically, the same way HSBrowseCard does.
    router.push(href);
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter") return;
    if ((e.target as HTMLElement).closest("button, a, [role=menu], [role=menuitem]")) return;
    if (previewMode && onPreviewSelect) {
      e.preventDefault();
      onPreviewSelect(recipe);
      return;
    }
    router.push(href);
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
              {recipe.updatedAt ? humanizeDate(recipe.updatedAt) : "—"}
            </span>
            {isLocal ? (
              <span
                title="Saved only in this browser — open and save it to move it to your account."
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                  border: `1px solid color-mix(in oklch, ${hsTokens.ink} 25%, transparent)`,
                  borderRadius: 999,
                  padding: "2px 8px",
                  whiteSpace: "nowrap",
                }}
              >
                On this device
              </span>
            ) : null}
          </div>
        </div>
      </HSCard>

      {onDelete ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pure-handler wrapper to stop card click bubbling; HSActionMenu trigger handles its own keyboard. Mirrors HSBrowseCard.
        <div
          style={{ position: "absolute", top: 10, right: 10, zIndex: 25 }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <HSActionMenu
            triggerTitle="Recipe actions"
            triggerAriaLabel="Recipe actions"
            trigger={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            }
            items={menuItems}
          />
        </div>
      ) : null}
    </div>
  );
}
