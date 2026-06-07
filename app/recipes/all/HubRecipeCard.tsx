"use client";
/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions
   -- card-as-tile pattern in preview mode: wrapper is keyboard-focusable so
   users can tab to a card and press Enter to open. */

import Link from "next/link";
import { type CSSProperties } from "react";

import HSCard from "@/modules/hopskip/components/HSCard";
import HSCardLift from "@/modules/hopskip/components/HSCardLift";
import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";

interface Props {
  href: string;
  name: string;
  subtitle?: string;
  style: string;
  stats: {
    abv?: number;
    ibu?: number;
    og?: number;
    fg?: number;
    srm?: number;
  };
  /** Hidden on the My-recipes section (it's always you), shown on Browse. */
  ownerName?: string;
  tags?: string[];
  /** Subtle alternating rotation for visual rhythm — same trick the homepage uses. */
  tilt?: number;
  /** Optional small line shown under the title — e.g. "edited Mar 12" for My recipes. */
  trailingMeta?: string;
  /** When true, click defers to onPreviewSelect; the underlying Link is kept
   *  for SEO/middle-click but its click handler is preventDefault'd. */
  previewMode?: boolean;
  /** True when THIS card is the currently-previewed one. Gets honey ring. */
  isPreviewSelected?: boolean;
  /** True when SOME card on the page is previewed. Triggers shrink-down on the
   *  unselected siblings. */
  anyPreviewSelected?: boolean;
  onPreviewSelect?: () => void;
}

export default function HubRecipeCard({
  href,
  name,
  subtitle,
  style,
  stats,
  ownerName,
  tags,
  tilt = 0,
  trailingMeta,
  previewMode,
  isPreviewSelected,
  anyPreviewSelected,
  onPreviewSelect,
}: Props) {
  const srmColor = stats.srm != null ? srmToRgb(stats.srm) : "rgb(220, 190, 140)";
  const visibleTags = (tags ?? []).slice(0, 3);
  const extraTagCount = Math.max(0, (tags?.length ?? 0) - visibleTags.length);

  const body = (
    <HSCard shadow={3} tilt={tilt} padding={0} style={{ overflow: "hidden" }}>
        <div style={{ height: 14, background: srmColor }} aria-hidden />
        <div style={{ padding: "16px 18px 18px" }}>
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
            {name || "Untitled recipe"}
          </div>
          {subtitle ? (
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
              {subtitle}
            </div>
          ) : null}
          {style ? (
            <div
              style={{
                fontStyle: "italic",
                fontSize: 13,
                color: hsTokens.muted,
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {style}
            </div>
          ) : null}
          {ownerName || trailingMeta ? (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                fontFamily: hsTokens.body,
                fontSize: 12,
                color: hsTokens.muted,
              }}
            >
              {ownerName ? <span>by {ownerName}</span> : null}
              {ownerName && trailingMeta ? (
                <span aria-hidden style={{ opacity: 0.5 }}>·</span>
              ) : null}
              {trailingMeta ? (
                <span
                  style={{
                    fontFamily: hsTokens.mono,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {trailingMeta}
                </span>
              ) : null}
            </div>
          ) : null}

          {visibleTags.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {visibleTags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: `color-mix(in oklch, ${hsTokens.water} 22%, ${hsTokens.cream2})`,
                    color: hsTokens.ink,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`,
                  }}
                >
                  {t}
                </span>
              ))}
              {extraTagCount > 0 ? (
                <span
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: hsTokens.cream2,
                    color: hsTokens.muted,
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  +{extraTagCount}
                </span>
              ) : null}
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
            {[
              {
                label: "ABV",
                value: stats.abv != null ? `${stats.abv.toFixed(1)}%` : "—",
                accent: hsTokens.yeast,
              },
              {
                label: "IBU",
                value: stats.ibu != null ? `${Math.round(stats.ibu)}` : "—",
                accent: hsTokens.hops,
              },
              {
                label: "OG",
                value: stats.og != null ? stats.og.toFixed(3) : "—",
                accent: hsTokens.malt,
              },
              {
                label: "FG",
                value: stats.fg != null ? stats.fg.toFixed(3) : "—",
                accent: hsTokens.malt,
              },
            ].map((s) => (
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
                    fontSize: 14,
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
        </div>
      </HSCard>
  );

  if (previewMode) {
    const previewActive = !!isPreviewSelected;
    const shrink = !!(anyPreviewSelected && !isPreviewSelected);
    const wrapperStyle: CSSProperties = {
      position: "relative",
      cursor: "pointer",
      borderRadius: 14,
      outline: previewActive ? `6px solid ${hsTokens.honey}` : undefined,
      outlineOffset: previewActive ? 0 : undefined,
      transform: shrink ? "scale(0.92)" : undefined,
      transformOrigin: "center center",
      transition:
        "transform 220ms cubic-bezier(0.4, 0, 0.2, 1), outline-color 180ms ease",
    };
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button, a")) return;
      e.preventDefault();
      onPreviewSelect?.();
    };
    const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== "Enter") return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      e.preventDefault();
      onPreviewSelect?.();
    };
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
        {/* SEO + middle-click target. Disabled for normal clicks in preview mode. */}
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden
          prefetch={false}
          onClick={(e) => e.preventDefault()}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
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
            {name}
          </span>
        </Link>
        <div className="hs-lift-inner" style={{ position: "relative", zIndex: 1 }}>
          {body}
        </div>
      </div>
    );
  }

  return (
    <HSCardLift href={href} ariaLabel={name || "Untitled recipe"} ctaColor={hsTokens.hops}>
      {body}
    </HSCardLift>
  );
}

/** First-slot tile in the My Recipes grid — primary CTA for starting fresh.
 *  Visually distinct from a recipe card (malt fill, large + sign) so it
 *  doesn't read as a saved recipe. */
export function NewRecipeTile({ tilt = 0 }: { tilt?: number }) {
  return (
    <HSCardLift
      href="/recipes/new"
      ariaLabel="Start a new recipe"
      ctaColor={hsTokens.malt}
    >
      <HSCard
        shadow={3}
        tilt={tilt}
        padding={0}
        bg={hsTokens.malt}
        style={{ overflow: "hidden", height: "100%" }}
      >
        <div style={{ height: 14, background: hsTokens.ink }} aria-hidden />
        <div
          style={{
            padding: "28px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 14,
            minHeight: 220,
            color: hsTokens.ink,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: hsTokens.paper,
              border: `2px solid ${hsTokens.ink}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: hsTokens.body,
              fontWeight: 800,
              fontSize: 32,
              lineHeight: 1,
            }}
          >
            +
          </div>
          <div>
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 26,
                letterSpacing: "-0.035em",
                lineHeight: 1,
              }}
            >
              New recipe
            </div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontSize: 13,
                color: `color-mix(in oklch, ${hsTokens.ink} 70%, transparent)`,
                marginTop: 6,
              }}
            >
              Start from scratch.
            </div>
          </div>
        </div>
      </HSCard>
    </HSCardLift>
  );
}

export function HubRecipeCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="hs-hub-recipe-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 20,
        alignItems: "start",
      }}
    >
      {children}
      <style>{`
        @media (max-width: 1024px) {
          .hs-hub-recipe-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .hs-hub-recipe-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

export const HUB_CARD_TILTS = [-0.5, 0.4, -0.3, 0.5, -0.4, 0.3];
