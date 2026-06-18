"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";
import HSButton from "@/modules/builder/components/HSButton";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { useImportStore } from "@/modules/recipe/stores/importStore";
import { recipeCalculationService } from "@/modules/recipe/services/RecipeCalculationService";
import type { Recipe } from "@/modules/recipe/models/Recipe";
import HSPreviewColumn from "@/modules/builder/components/public/HSPreviewColumn";
import { usePreviewState } from "@/modules/builder/components/public/usePreviewState";
import {
  useCanPreview,
  usePreviewWidth,
} from "@/modules/builder/components/public/usePreviewLayout";
import { useAuthStore } from "@/modules/auth/authStore";

import MyRecipeCard from "@/modules/builder/components/MyRecipeCard";

type SortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "abv-desc" | "ibu-desc";

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "date-desc", label: "Most recent" },
  { key: "date-asc", label: "Oldest first" },
  { key: "name-asc", label: "Name A→Z" },
  { key: "name-desc", label: "Name Z→A" },
  { key: "abv-desc", label: "ABV high → low" },
  { key: "ibu-desc", label: "IBU high → low" },
];

export default function HopSkipRecipes() {
  const recipes = useRecipeStore((s) => s.recipes);
  const recipesLoaded = useRecipeStore((s) => s.recipesLoaded);
  const localRecipeIds = useRecipeStore((s) => s.localRecipeIds);
  const user = useAuthStore((s) => s.user);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);
  const deleteRecipe = useRecipeStore((s) => s.deleteRecipe);
  const openImport = useImportStore((s) => s.open);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [pendingDelete, setPendingDelete] = useState<Recipe | null>(null);

  const canPreview = useCanPreview();
  const prefersReducedMotion = useReducedMotion();
  const previewWidth = usePreviewWidth();
  const preview = usePreviewState({ canPreview });
  const previewSelectedId = preview.selection?.id;

  const handlePreviewSelect = useCallback(
    (recipe: Recipe) => {
      void preview.handleSelect({
        id: recipe.id,
        openHref: `/recipes/${recipe.id}`,
        // Owned recipes are already in the Zustand store — no fetch needed.
        loadFull: async () => recipe,
      });
    },
    [preview],
  );

  useEffect(() => {
    if (!recipesLoaded) loadRecipes();
  }, [recipesLoaded, loadRecipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = recipes.filter((r) => {
      if (!q) return true;
      return (
        r.name?.toLowerCase().includes(q) ||
        r.style?.toLowerCase().includes(q) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
    const withCalc = list.map((r) => ({ r, calc: recipeCalculationService.calculate(r) }));
    withCalc.sort((a, b) => {
      switch (sort) {
        case "date-desc":
          return (b.r.updatedAt ?? "").localeCompare(a.r.updatedAt ?? "");
        case "date-asc":
          return (a.r.updatedAt ?? "").localeCompare(b.r.updatedAt ?? "");
        case "name-asc":
          return (a.r.name ?? "").localeCompare(b.r.name ?? "");
        case "name-desc":
          return (b.r.name ?? "").localeCompare(a.r.name ?? "");
        case "abv-desc":
          return (b.calc.abv ?? 0) - (a.calc.abv ?? 0);
        case "ibu-desc":
          return (b.calc.ibu ?? 0) - (a.calc.ibu ?? 0);
      }
    });
    return withCalc;
  }, [recipes, query, sort]);

  const tilts = [-0.4, 0.3, -0.2, 0.5, -0.6, 0.2];

  return (
    <main>
      {/* Title bar */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) 20px",
        }}
      >
        <h1
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(40px, 6vw, 88px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.92,
            margin: "10px 0 0",
            color: hsTokens.ink,
          }}
        >
          <span
            style={{
              background: hsTokens.malt,
              padding: "0 0.18em",
              display: "inline-block",
              transform: "rotate(-1.5deg)",
              border: `2px solid ${hsTokens.ink}`,
              boxShadow: hsTokens.sh1,
            }}
          >
            Recipes
          </span>
        </h1>

        <div
          className="hs-recipes-actions"
          style={{
            marginTop: 28,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <HSButton href="/recipes/new" variant="ink" color={hsTokens.hops} arrow>
            + New recipe
          </HSButton>
          <HSButton variant="ghost" onClick={openImport}>
            Import
          </HSButton>
          <div
            style={{
              flex: 1,
              minWidth: 200,
              position: "relative",
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, style, or tag…"
              style={{
                width: "100%",
                padding: "10px 16px",
                background: hsTokens.paper,
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 999,
                fontFamily: hsTokens.body,
                fontSize: 14,
                color: hsTokens.ink,
                outline: "none",
              }}
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              padding: "10px 14px",
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 999,
              fontFamily: hsTokens.body,
              fontSize: 13,
              color: hsTokens.ink,
              cursor: "pointer",
            }}
          >
            {SORT_LABELS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <HSScriptNote color={hsTokens.muted} size={18} rotate={-3}>
            {recipes.length} saved
          </HSScriptNote>
        </div>
      </section>

      {/* Grid */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "20px clamp(20px, 4vw, 56px) clamp(48px, 8vw, 96px)",
        }}
      >
        {recipes.length === 0 ? (
          <HSCard shadow={3} padding="32px 28px" style={{ maxWidth: 560, margin: "32px auto", textAlign: "center" }}>
            <HSScriptNote color={hsTokens.yeast} size={22}>
              no recipes yet —
            </HSScriptNote>
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 30,
                letterSpacing: "-0.035em",
                margin: "10px 0 8px",
              }}
            >
              Start with a blank one.
            </div>
            <p style={{ fontSize: 14, color: hsTokens.muted, lineHeight: 1.5, margin: "0 0 18px" }}>
              Or bring in an existing BeerXML, or paste one straight from a book or forum.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <HSButton href="/recipes/new" variant="ink" color={hsTokens.hops} arrow>
                Start a recipe
              </HSButton>
              <HSButton variant="ghost" onClick={openImport}>
                Import
              </HSButton>
            </div>
          </HSCard>
        ) : filtered.length === 0 ? (
          <HSCard shadow={2} padding="24px 24px" style={{ maxWidth: 460, margin: "32px auto", textAlign: "center" }}>
            <HSEyebrow>no matches</HSEyebrow>
            <div style={{ fontFamily: hsTokens.display, fontSize: 22, marginTop: 6 }}>
              Nothing matched &ldquo;{query}&rdquo;.
            </div>
            <p style={{ fontSize: 13, color: hsTokens.muted, marginTop: 8 }}>
              Try a shorter term, or clear the search.
            </p>
          </HSCard>
        ) : (
          <div
            className="hs-preview-shell hs-my-recipes-shell"
            data-preview-open={previewSelectedId && canPreview ? "true" : "false"}
          >
            <div
              className="hs-my-recipes-grid"
              data-preview-open={previewSelectedId && canPreview ? "true" : "false"}
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 22,
                minWidth: 0,
                flex: 1,
              }}
            >
              {filtered.map((entry, idx) => {
                const { r, calc } = entry;
                const tilt = tilts[idx % tilts.length];
                return (
                  <motion.div
                    key={r.id}
                    layout
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 260,
                            damping: 30,
                            mass: 0.8,
                          }
                    }
                    style={{ minWidth: 0 }}
                  >
                    <MyRecipeCard
                      recipe={r}
                      calc={calc}
                      tilt={tilt}
                      onDelete={setPendingDelete}
                      // Badge only matters when signed in — signed out,
                      // everything is local.
                      isLocal={!!user && localRecipeIds.has(r.id)}
                      previewMode={canPreview}
                      isPreviewSelected={previewSelectedId === r.id}
                      anyPreviewSelected={!!previewSelectedId}
                      onPreviewSelect={handlePreviewSelect}
                    />
                  </motion.div>
                );
              })}
            </div>
            <HSPreviewColumn
              open={!!previewSelectedId && canPreview}
              full={preview.full}
              loading={preview.loading}
              error={preview.error}
              cardPath={preview.selection?.openHref ?? ""}
              previewWidth={previewWidth}
              onClose={preview.handleClose}
              onRetry={preview.handleRetry}
            />
            <style>{`
              /* When preview is open, snap to a fixed 2-col grid (matches
                 /browse). auto-fill at narrow widths combined with the
                 layout-tracking motion.div leaves weird row gaps. */
              .hs-my-recipes-grid[data-preview-open="true"] {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                align-content: start;
              }
              .hs-my-recipes-shell[data-preview-open="true"] .hs-browse-card-title {
                font-size: 18px !important;
              }
              /* Closed state: keep auto-fill but pin to top so a short list
                 doesn't space-evenly through the stretched shell height. */
              .hs-my-recipes-grid {
                align-content: start;
              }
            `}</style>
          </div>
        )}
      </section>

      {/* Import (combined paste + BeerXML) is mounted globally in ClientShell
          via <ImportRecipeFlow />; the "Import" button above opens it. */}

      {/* Delete confirmation */}
      {pendingDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(26, 22, 18, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPendingDelete(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440 }}>
            <HSCard shadow={4} padding="22px 24px 24px" style={{ borderTop: `7px solid ${hsTokens.roast}` }}>
              <HSEyebrow color={hsTokens.roast}>Delete recipe</HSEyebrow>
              <div
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 24,
                  letterSpacing: "-0.035em",
                  margin: "6px 0 8px",
                }}
              >
                Delete &ldquo;{pendingDelete.name || "Untitled"}&rdquo;?
              </div>
              <p style={{ fontSize: 13, color: hsTokens.muted, lineHeight: 1.5, margin: "0 0 18px" }}>
                This removes the recipe and its version history. Saved sessions are kept.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <HSButton variant="ghost" onClick={() => setPendingDelete(null)}>
                  Cancel
                </HSButton>
                <HSButton
                  variant="solid"
                  color={hsTokens.roast}
                  onClick={() => {
                    deleteRecipe(pendingDelete.id);
                    setPendingDelete(null);
                  }}
                >
                  Delete
                </HSButton>
              </div>
            </HSCard>
          </div>
        </div>
      ) : null}
    </main>
  );
}
