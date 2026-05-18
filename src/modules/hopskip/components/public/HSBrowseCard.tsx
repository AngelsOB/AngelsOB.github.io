"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";

import { db, auth } from "@/config/firebase";
import { uid } from "@/utils/uid";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { findSeedRecipe, SEED_SLUG_MAP } from "@/data/seed-recipes";
import {
  downloadTextFile,
  generateBeerXml,
  generateRecipeMarkdown,
  sanitizeFileName,
} from "@/modules/beta-builder/presentation/utils/recipeExport";
import { RecipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { useAuthStore } from "@/modules/auth/authStore";
import { useUserTier } from "@/modules/auth/useUserTier";
import { canAccess } from "@/modules/auth/tierAccess";
import UpgradeModal from "@/modules/auth/components/UpgradeModal";
import { toast } from "@/stores/toastStore";
import type { Recipe } from "@/modules/beta-builder/domain/models/Recipe";

import { hsTokens } from "../../tokens";
import HSCard from "../HSCard";
import HSScriptNote from "../HSScriptNote";
import HSActionMenu, { type HSActionMenuItem } from "../HSActionMenu";
import { useCursorFollowCard } from "../useCursorFollowCard";

const calcService = new RecipeCalculationService();

export type BrowseRecipe = {
  id: string;
  name: string;
  style: string;
  ownerName: string;
  ownerId?: string;
  shareSlug: string;
  stats: { og?: number; fg?: number; ibu?: number; srm?: number; abv?: number };
  tags: string[];
  hopNames: string[];
  publishedAt: string;
  forkCount: number;
  ratingSum?: number;
  ratingAvg?: number;
  ratingCount?: number;
  source?: "official" | "community";
  labelUrl?: string;
};

interface Props {
  recipe: BrowseRecipe;
  isNavigating?: boolean;
  onNavigate?: () => void;
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  tilt?: number;
}

export default function HSBrowseCard({
  recipe,
  isNavigating,
  onNavigate,
  compareMode,
  isSelected,
  onToggleSelect,
  tilt = 0,
}: Props) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const { userState } = useUserTier();
  const exportAllowed = canAccess("export", userState);
  const [isBusy, setIsBusy] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const { setWrapper, ctaRef, onMouseMove, onMouseLeave } = useCursorFollowCard({
    disabled: compareMode,
  });

  const srmColor = recipe.stats.srm != null ? srmToRgb(recipe.stats.srm) : "rgb(220, 190, 140)";
  const cardPath =
    recipe.source === "official"
      ? `/r/${SEED_SLUG_MAP[recipe.id] || recipe.id}`
      : `/r/${recipe.shareSlug}`;

  async function getFullRecipe(): Promise<Recipe | null> {
    if (recipe.source === "official") {
      return findSeedRecipe(recipe.id) ?? null;
    }
    const snap = await getDoc(doc(db, "recipes", recipe.id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Recipe;
  }

  async function handleFork(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      try {
        await signInWithGoogle();
      } catch {
        return;
      }
      return;
    }
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setIsBusy(true);
    try {
      const full = await getFullRecipe();
      if (!full) {
        toast.error("Could not load recipe");
        return;
      }
      const now = new Date().toISOString();
      const newId = uid();
      const {
        isPublic: _isPublic,
        shareSlug: _shareSlug,
        publishedAt: _publishedAt,
        ownerId: _ownerId,
        ...fields
      } = full as Recipe & { ownerId?: string };
      const forkedData = JSON.parse(
        JSON.stringify({
          ...fields,
          ownerId: currentUser.uid,
          name: `${full.name} (Fork)`,
          isPublic: false,
          currentVersion: 1,
          parentRecipeId: recipe.id,
          parentVersionNumber: full.currentVersion || 1,
          parentRecipeName: full.name,
          parentRecipeOwnerName: recipe.ownerName,
          parentRecipeShareSlug: recipe.shareSlug || undefined,
          createdAt: now,
          updatedAt: now,
        }),
      );
      await setDoc(doc(db, "recipes", newId), forkedData);
      if (recipe.source !== "official") {
        try {
          await updateDoc(doc(db, "publicRecipeIndex", recipe.id), {
            forkCount: increment(1),
          });
        } catch {
          /* best effort */
        }
      }
      toast.success(`Forked "${recipe.name}" to your recipes`);
      router.push(`/recipes/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fork failed");
    } finally {
      setIsBusy(false);
    }
  }

  function handleCopyShareLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const path =
      recipe.source === "official"
        ? `/r/${SEED_SLUG_MAP[recipe.id] || recipe.id}`
        : `/r/${recipe.shareSlug}`;
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success("Share link copied");
  }

  async function handleExport(
    format: "markdown" | "json" | "beerxml" | "copy-md",
    e: React.MouseEvent,
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (!exportAllowed) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setIsBusy(true);
    try {
      const full = await getFullRecipe();
      if (!full) {
        toast.error("Could not load recipe data");
        return;
      }
      const calculations = calcService.calculate(full);
      const filename = sanitizeFileName(full.name);
      switch (format) {
        case "markdown":
          downloadTextFile(`${filename}.md`, generateRecipeMarkdown(full, calculations));
          break;
        case "copy-md":
          await navigator.clipboard.writeText(generateRecipeMarkdown(full, calculations));
          toast.success("Markdown copied to clipboard");
          break;
        case "json":
          downloadTextFile(
            `${filename}.json`,
            JSON.stringify(full, null, 2),
            "application/json",
          );
          break;
        case "beerxml":
          downloadTextFile(`${filename}.xml`, generateBeerXml(full), "text/xml");
          break;
      }
    } catch {
      toast.error("Export failed");
    } finally {
      setIsBusy(false);
    }
  }

  const menuItems: HSActionMenuItem[] = [
    {
      label: user ? "Fork to My Recipes" : "Sign in to Fork",
      onClick: (e) => void handleFork(e),
    },
    { label: "Copy Share Link", onClick: handleCopyShareLink },
    {
      label: "Export Markdown",
      separator: true,
      disabled: !exportAllowed,
      onClick: (e) => void handleExport("markdown", e),
    },
    {
      label: "Copy Markdown",
      disabled: !exportAllowed,
      onClick: (e) => void handleExport("copy-md", e),
    },
    {
      label: "Export JSON",
      disabled: !exportAllowed,
      onClick: (e) => void handleExport("json", e),
    },
    {
      label: "Export BeerXML",
      disabled: !exportAllowed,
      onClick: (e) => void handleExport("beerxml", e),
    },
  ];

  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button, a, [role=menu], [role=menuitem]")) return;
    if (compareMode) {
      e.preventDefault();
      onToggleSelect?.(recipe.id);
      return;
    }
    onNavigate?.();
    router.push(cardPath);
  }

  function handleCardKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter") return;
    if ((e.target as HTMLElement).closest("button, a, [role=menu], [role=menuitem]")) return;
    if (compareMode) {
      e.preventDefault();
      onToggleSelect?.(recipe.id);
      return;
    }
    onNavigate?.();
    router.push(cardPath);
  }

  const stats: { label: string; value: string; accent: string }[] = [
    {
      label: "ABV",
      value: recipe.stats.abv != null ? `${recipe.stats.abv.toFixed(1)}%` : "—",
      accent: hsTokens.yeast,
    },
    {
      label: "IBU",
      value: recipe.stats.ibu != null ? `${Math.round(recipe.stats.ibu)}` : "—",
      accent: hsTokens.hops,
    },
    {
      label: "OG",
      value: recipe.stats.og != null ? recipe.stats.og.toFixed(3) : "—",
      accent: hsTokens.malt,
    },
    {
      label: "FG",
      value: recipe.stats.fg != null ? recipe.stats.fg.toFixed(3) : "—",
      accent: hsTokens.malt,
    },
  ];

  const selectIndicatorStyle: CSSProperties = {
    position: "absolute",
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 999,
    border: `2px solid ${isSelected ? hsTokens.water : hsTokens.muted}`,
    background: isSelected ? hsTokens.water : hsTokens.paper,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
    pointerEvents: "none",
  };

  const wrapperStyle: CSSProperties = {
    position: "relative",
    cursor: "pointer",
    outline: compareMode && isSelected ? `2px solid ${hsTokens.water}` : undefined,
    outlineOffset: compareMode && isSelected ? 4 : undefined,
    borderRadius: 14,
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- card-as-tile pattern, mirrors classic BrowseCard
    <div ref={setWrapper} className="hs-lift-card" role="article" tabIndex={0} style={wrapperStyle} onClick={handleCardClick} onKeyDown={handleCardKey} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      <Link
        href={cardPath}
        tabIndex={-1}
        aria-hidden
        prefetch={false}
        onClick={(e) => {
          if (compareMode) e.preventDefault();
        }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: compareMode ? "none" : undefined,
        }}
      >
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          {recipe.name}
        </span>
      </Link>

      <HSCard className="hs-lift-inner" shadow={3} tilt={tilt} padding={0} style={{ overflow: "hidden" }}>
        <div style={{ height: 14, background: srmColor }} aria-hidden />

        <div style={{ padding: "16px 18px 18px", position: "relative" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {recipe.labelUrl ? (
              <img
                src={recipe.labelUrl}
                alt={`${recipe.name} beer label`}
                loading="lazy"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  objectFit: "cover",
                  border: `1.5px solid ${hsTokens.ink}`,
                  flexShrink: 0,
                }}
              />
            ) : null}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 22,
                    letterSpacing: "-0.035em",
                    lineHeight: 1.05,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {recipe.name}
                </div>
                {recipe.source === "official" ? (
                  <span
                    style={{
                      fontFamily: hsTokens.body,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      background: `color-mix(in oklch, ${hsTokens.water} 22%, ${hsTokens.cream2})`,
                      color: hsTokens.ink,
                      padding: "3px 8px",
                      borderRadius: 999,
                      border: `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`,
                      whiteSpace: "nowrap",
                      marginTop: 4,
                    }}
                  >
                    Example
                  </span>
                ) : null}
              </div>
              {recipe.style ? (
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
                  {recipe.style}
                </div>
              ) : null}
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
                <span>
                  by{" "}
                  {recipe.ownerId ? (
                    <Link
                      href={`/u/${recipe.ownerId}`}
                      prefetch={false}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: hsTokens.ink, textDecoration: "underline" }}
                    >
                      {recipe.ownerName}
                    </Link>
                  ) : (
                    recipe.ownerName
                  )}
                </span>
                {recipe.forkCount > 0 ? (
                  <>
                    <span aria-hidden style={{ opacity: 0.5 }}>·</span>
                    <span
                      style={{
                        fontFamily: hsTokens.mono,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {recipe.forkCount} {recipe.forkCount === 1 ? "fork" : "forks"}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
                flexShrink: 0,
                marginTop: 28,
                minWidth: 40,
              }}
            >
              {(recipe.ratingCount ?? 0) > 0 ? (
                <>
                  <div style={{ display: "inline-flex", gap: 3 }}>
                    {[1, 2, 3, 4, 5].map((star, idx) => {
                      const avg = recipe.ratingAvg ?? 0;
                      const fraction = Math.min(1, Math.max(0, avg - (star - 1)));
                      const pct = Math.round(fraction * 100);
                      const gradientId = `hs-star-${recipe.id}-${star}`;
                      const variants = [
                        "16 3.6 19.8 12.4 29.4 13.2 21.7 19.4 24.6 28.6 16 23.1 7.6 28.9 10.5 19.5 2.7 13.4 12.4 12.6",
                        "15.8 4.1 19.4 12.7 29 13.5 21.4 19.7 24.5 28.7 16 22.8 7.4 28.6 10.6 19.4 3.1 13.1 12.6 12.5",
                        "16.2 3.8 19.6 12.6 29.2 13 21.5 19.6 24.4 28.5 15.9 23 7.5 28.7 10.4 19.6 2.9 13.3 12.5 12.7",
                      ];
                      const rotations = [-4, 2, -1, 3, -2];
                      const points = variants[idx % variants.length];
                      const rotation = rotations[idx % rotations.length];
                      const filled = pct === 100;
                      return (
                        <svg
                          key={star}
                          width="22"
                          height="22"
                          viewBox="0 0 32 32"
                          aria-hidden="true"
                          style={{
                            transform: `rotate(${rotation}deg)`,
                            transformOrigin: "center",
                            overflow: "visible",
                          }}
                        >
                          {pct > 0 && pct < 100 ? (
                            <defs>
                              <linearGradient id={gradientId}>
                                <stop offset={`${pct}%`} stopColor={hsTokens.honey} />
                                <stop offset={`${pct}%`} stopColor="transparent" />
                              </linearGradient>
                            </defs>
                          ) : null}
                          <polygon
                            points={points}
                            fill={filled ? hsTokens.honey : pct > 0 ? `url(#${gradientId})` : "none"}
                            stroke={hsTokens.ink}
                            strokeWidth={1.7}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                        </svg>
                      );
                    })}
                  </div>
                  <span
                    style={{
                      fontFamily: hsTokens.script,
                      fontSize: 16,
                      fontWeight: 500,
                      color: hsTokens.ink,
                      whiteSpace: "nowrap",
                      lineHeight: 1,
                    }}
                  >
                    {(recipe.ratingAvg ?? 0).toFixed(1)}
                    <span style={{ marginLeft: 4, color: hsTokens.muted }}>
                      ({recipe.ratingCount})
                    </span>
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {recipe.tags.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {recipe.tags.slice(0, 3).map((t) => (
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
              {recipe.tags.length > 3 ? (
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
                  +{recipe.tags.length - 3}
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

          <div style={{ marginTop: 12 }}>
            <span
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {recipe.publishedAt
                ? new Date(recipe.publishedAt).toISOString().slice(0, 10)
                : ""}
            </span>
          </div>
        </div>
      </HSCard>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pure-handler wrapper to stop card click bubbling; HSActionMenu trigger handles its own keyboard. */}
      <div
        style={{ position: "absolute", top: 12, right: 12, zIndex: 25 }}
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

      {compareMode ? (
        <div style={selectIndicatorStyle}>
          {isSelected ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : null}
        </div>
      ) : null}

      <div
        ref={ctaRef}
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          opacity: 0,
          pointerEvents: "none",
          zIndex: 28,
          transform: "translate(0, 0)",
          transition: "opacity 140ms ease, transform 90ms ease-out",
          willChange: "transform, opacity",
        }}
      >
        <HSScriptNote color={hsTokens.water} size={20}>
          open →
        </HSScriptNote>
      </div>

      {(isNavigating || isBusy) ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.05)",
            borderRadius: 14,
            zIndex: 24,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              border: `3px solid ${hsTokens.muted}`,
              borderTopColor: hsTokens.ink,
              animation: "hs-spin 0.7s linear infinite",
            }}
          />
          <style>{`@keyframes hs-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : null}

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        reason="Export is a Premium feature."
      />
    </div>
  );
}
