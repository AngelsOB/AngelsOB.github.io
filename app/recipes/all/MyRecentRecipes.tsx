"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { recipeCalculationService } from "@/modules/recipe/services/RecipeCalculationService";
import HSCard from "@/modules/builder/components/HSCard";
import { hsTokens } from "@/modules/builder/tokens";
import { toast } from "@/stores/toastStore";
import type { PreviewSelection } from "@/modules/builder/components/public/usePreviewState";

import HubRecipeCard, {
  HubRecipeCardGrid,
  HUB_CARD_TILTS,
  NewRecipeTile,
} from "./HubRecipeCard";

interface Props {
  /** Pass-through preview state from the parent client wrapper. When
   *  `previewMode` is true, card clicks open the preview panel instead of
   *  navigating. */
  previewMode?: boolean;
  previewSelectedId?: string | undefined;
  anyPreviewSelected?: boolean;
  onPreviewSelect?: (selection: PreviewSelection) => Promise<void>;
}

// New tile occupies slot 0, so we render 5 recent recipes to keep the
// total at 6 visible cards (a clean 2-row × 3-col grid on desktop).
const RECIPE_PREVIEW_COUNT = 5;

function formatDate(iso?: string) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MyRecentRecipes({
  previewMode,
  previewSelectedId,
  anyPreviewSelected,
  onPreviewSelect,
}: Props = {}) {
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const recipes = useRecipeStore((s) => s.recipes);
  const recipesLoaded = useRecipeStore((s) => s.recipesLoaded);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);

  // Always try to load — recipeStore.loadRecipes falls through to
  // localStorage when there's no signed-in user, so anonymous-session
  // recipes show up here just the same.
  useEffect(() => {
    if (!recipesLoaded) loadRecipes();
  }, [recipesLoaded, loadRecipes]);

  const recent = useMemo(() => {
    const sorted = [...recipes].sort((a, b) =>
      (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
    );
    return sorted
      .slice(0, RECIPE_PREVIEW_COUNT)
      .map((r) => ({ r, calc: recipeCalculationService.calculate(r) }));
  }, [recipes]);

  async function handleSignIn() {
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      const message =
        code === "auth/unauthorized-domain"
          ? "This domain isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains."
          : code === "auth/network-request-failed"
            ? "Network error during sign-in. Check your connection."
            : `Sign-in failed${code ? ` (${code})` : ""}`;
      toast.error(message);
    }
  }

  const sectionHeader = (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 18,
      }}
    >
      <div>
        <h2
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(28px, 3vw, 38px)",
            letterSpacing: "-0.03em",
            lineHeight: 1,
            color: hsTokens.ink,
            margin: "6px 0 0",
          }}
        >
          My recipes
        </h2>
      </div>
      {recent.length > 0 ? (
        <Link
          href="/recipes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            background: hsTokens.paper,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.02em",
            color: hsTokens.ink,
            textDecoration: "none",
          }}
        >
          Open all
          <span aria-hidden style={{ fontSize: 14 }}>→</span>
        </Link>
      ) : null}
    </div>
  );

  // Empty/empty-ish states — distinct cases:
  //   1. Not signed in AND no local recipes: nudge to sign in (the only path
  //      that adds recipes for anonymous users on a fresh device).
  //   2. Recipes still loading on first paint: quiet shimmer to hold space.
  //   3. Signed in / unauthed with localStorage recipes: render the grid.
  //   4. Loaded but truly empty: new-tile + muted prompt (handled below).
  if (!user && recent.length === 0 && recipesLoaded) {
    return (
      <section style={{ marginBottom: 48 }}>
        {sectionHeader}
        <HSCard shadow={2} padding="28px 28px" bg={hsTokens.cream2}>
          <p
            style={{
              fontFamily: hsTokens.body,
              fontSize: 15,
              color: hsTokens.muted,
              margin: 0,
              maxWidth: 540,
              lineHeight: 1.55,
            }}
          >
            Sign in to see your own recipes here, or start a new one and we&apos;ll
            save it locally for now.
          </p>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => void handleSignIn()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                background: hsTokens.ink,
                color: hsTokens.cream,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                fontFamily: hsTokens.body,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in
            </button>
            <Link
              href="/recipes/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                background: hsTokens.paper,
                color: hsTokens.ink,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                fontFamily: hsTokens.body,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                textDecoration: "none",
              }}
            >
              Start a new recipe
              <span aria-hidden style={{ fontSize: 16 }}>→</span>
            </Link>
          </div>
        </HSCard>
      </section>
    );
  }

  if (!recipesLoaded) {
    return (
      <section style={{ marginBottom: 48 }}>
        {sectionHeader}
        <HubRecipeCardGrid>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              aria-hidden
              style={{
                height: 260,
                background: hsTokens.cream2,
                border: `2px solid color-mix(in oklch, ${hsTokens.ink} 14%, transparent)`,
                borderRadius: 14,
                opacity: 0.6,
              }}
            />
          ))}
        </HubRecipeCardGrid>
      </section>
    );
  }

  // Empty case: just the new-tile, with a short prompt alongside. The tile
  // alone in a 3-col grid would feel orphaned, so we add a single-line
  // explanation in the second slot.
  if (recent.length === 0) {
    return (
      <section style={{ marginBottom: 48 }}>
        {sectionHeader}
        <HubRecipeCardGrid>
          <NewRecipeTile tilt={HUB_CARD_TILTS[0]} />
          <div
            style={{
              gridColumn: "span 2",
              display: "flex",
              alignItems: "center",
              padding: "28px 28px",
              background: hsTokens.cream2,
              border: `2px solid color-mix(in oklch, ${hsTokens.ink} 14%, transparent)`,
              borderRadius: 14,
              fontFamily: hsTokens.body,
              fontSize: 15,
              color: hsTokens.muted,
              lineHeight: 1.55,
            }}
          >
            No recipes yet. Start your first build and it&apos;ll show up here.
          </div>
        </HubRecipeCardGrid>
      </section>
    );
  }

  return (
    <section style={{ marginBottom: 48 }}>
      {sectionHeader}
      <HubRecipeCardGrid>
        <NewRecipeTile tilt={HUB_CARD_TILTS[0]} />
        {recent.map(({ r, calc }, idx) => {
          const openHref = `/recipes/${r.id}`;
          return (
            <HubRecipeCard
              key={r.id}
              href={openHref}
              name={r.name ?? ""}
              subtitle={r.subtitle}
              style={r.style ?? ""}
              // Shift the tilt index by 1 so the new-tile sits in slot 0's tilt
              // and the recipes get the rest of the rotation pattern.
              tilt={HUB_CARD_TILTS[(idx + 1) % HUB_CARD_TILTS.length]}
              tags={r.tags ?? []}
              stats={{
                abv: calc.abv ?? undefined,
                ibu: calc.ibu ?? undefined,
                og: calc.og ?? undefined,
                fg: calc.fg ?? undefined,
                srm: calc.srm ?? undefined,
              }}
              trailingMeta={
                formatDate(r.updatedAt)
                  ? `edited ${formatDate(r.updatedAt)}`
                  : undefined
              }
              previewMode={previewMode}
              isPreviewSelected={previewSelectedId === r.id}
              anyPreviewSelected={anyPreviewSelected}
              onPreviewSelect={
                onPreviewSelect
                  ? () =>
                      void onPreviewSelect({
                        id: r.id,
                        openHref,
                        // Already loaded in Zustand — no fetch needed.
                        loadFull: async () => r,
                      })
                  : undefined
              }
            />
          );
        })}
      </HubRecipeCardGrid>
    </section>
  );
}
