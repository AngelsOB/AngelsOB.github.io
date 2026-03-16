"use client";

/**
 * Recipe List Page Component
 *
 * Displays all saved recipes with:
 * - Search by name, style, tags
 * - Filter by style, tags
 * - Sort by date, name, ABV, IBU, SRM
 * - Quick actions: view, duplicate, delete
 * - Create new recipe button
 */

import type React from "react";
import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecipeStore } from "../stores/recipeStore";
import { useBrewSessionStore } from "../stores/brewSessionStore";
import { useAuthStore } from "../../../auth/authStore";
import { useUserTier } from "../../../auth/useUserTier";
import RecipeLimitModal from "../../../auth/components/RecipeLimitModal";
import { useRecipeCalculations } from "../hooks/useRecipeCalculations";
import {
  downloadTextFile,
  generateBeerXml,
  generateRecipeMarkdown,
  sanitizeFileName,
} from "../utils/recipeExport";
import type { Recipe } from "../../domain/models/Recipe";
import { srmToRgb } from "../../utils/srmColorUtils";
import VersionHistoryModal from "./VersionHistoryModal";
import RecipeSessionsBar from "./RecipeSessionsBar";
import { toast } from "../../../../stores/toastStore";
import ScalableText from "@/components/ScalableText";

type SortOption =
  | "date-desc"
  | "date-asc"
  | "name-asc"
  | "name-desc"
  | "abv-desc"
  | "abv-asc"
  | "ibu-desc"
  | "ibu-asc";

export default function RecipeListPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const {
    recipes,
    loadRecipes,
    deleteRecipe,
    setCurrentRecipe,
    isLoading,
    importFromBeerXml,
    importFromJson,
  } = useRecipeStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const importMenuRef = useRef<HTMLDivElement | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date-desc");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const { canCreate, userState } = useUserTier();
  const atLimit = userState === "free" && !canCreate;
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);

  // Close import menu on outside click
  useEffect(() => {
    if (!showImportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target as Node)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showImportMenu]);

  // Load recipes on mount
  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // Filter and sort recipes
  const filteredAndSortedRecipes = useMemo(() => {
    // Filter by search query
    const filtered = recipes.filter((recipe) => {
      const query = searchQuery.toLowerCase();
      const matchesName = recipe.name.toLowerCase().includes(query);
      const matchesStyle = recipe.style?.toLowerCase().includes(query) ?? false;
      const matchesTags = recipe.tags?.some((tag) => tag.toLowerCase().includes(query)) ?? false;
      return matchesName || matchesStyle || matchesTags;
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "date-asc":
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        // For ABV/IBU sorting, we need to calculate on-the-fly (not ideal but works)
        case "abv-desc":
        case "abv-asc":
        case "ibu-desc":
        case "ibu-asc":
          // We'll handle this in the render to avoid recalculating every time
          return 0;
        default:
          return 0;
      }
    });

    return sorted;
  }, [recipes, searchQuery, sortBy]);

  // Handle creating a new recipe
  const handleCreateNew = () => {
    setCurrentRecipe(null);
    router.push("/recipes/new");
  };

  // Pre-set recipe in store before navigation so BetaBuilderPage renders instantly
  const handlePreloadRecipe = (recipe: Recipe) => {
    setCurrentRecipe(recipe);
  };

  // Handle delete confirmation
  const handleDeleteClick = (recipeId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowDeleteConfirm(recipeId);
  };

  const handleDeleteConfirm = () => {
    if (showDeleteConfirm) {
      deleteRecipe(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
  };

  if (isLoading && recipes.length === 0) {
    return (
      <div className="brew-theme mx-auto max-w-6xl px-2 py-6">
        {/* Header skeleton */}
        <div className="mb-8 animate-pulse">
          <div className="h-8 w-48 rounded bg-[var(--brew-accent-200)]" />
          <div className="mt-2 h-5 w-20 rounded bg-[var(--brew-accent-100)]" />
        </div>
        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-[var(--brew-card)]">
              <div className="h-2 w-full rounded-t-xl bg-[var(--brew-accent-200)]" />
              <div className="space-y-2 border-b border-[rgb(var(--brew-border))] p-4">
                <div className="h-6 w-3/4 rounded bg-[var(--brew-accent-100)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--brew-accent-100)]" />
              </div>
              <div className="grid grid-cols-5 gap-0 px-4 py-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="space-y-1 px-1">
                    <div className="h-2 w-8 rounded bg-[var(--brew-accent-100)]" />
                    <div className="h-4 w-10 rounded bg-[var(--brew-accent-100)]" />
                  </div>
                ))}
              </div>
              <div className="rounded-b-xl border-t border-[rgb(var(--brew-border))] bg-[var(--brew-card-inset)] p-3">
                <div className="h-3 w-24 rounded bg-[var(--brew-accent-100)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="brew-theme mx-auto max-w-6xl px-2 py-6">
      {/* Header */}
      <div className="mb-8 flex items-baseline gap-3">
        <h1 className="brew-section-title text-3xl">My Recipes</h1>
        <span className="group relative">
          <button
            type="button"
            className={`brew-tag${atLimit ? " cursor-pointer !border-[var(--brew-warning)] !text-[var(--brew-warning)]" : " cursor-default"}`}
            onClick={atLimit ? () => setIsLimitModalOpen(true) : undefined}
          >
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </button>
          {atLimit && (
            <>
              <span
                className="absolute -top-1.5 -right-1.5 inline-block cursor-pointer text-lg leading-none"
                style={{ animation: "wiggle 4s ease-in-out infinite" }}
                onClick={() => setIsLimitModalOpen(true)}
              >
                ⚠️
              </span>
              <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-[var(--brew-warning)] bg-[var(--brew-surface)] px-3 py-2 text-center text-xs text-[var(--brew-text-secondary)] opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                Free tier limit reached. Upgrade to Premium to save unlimited recipes.
              </span>
            </>
          )}
        </span>
      </div>

      {/* Local-only banner for unauthenticated users */}
      {!isAuthLoading && !user && (
        <div className="brew-alert-warning mb-6 flex items-center gap-4 px-4 py-3">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            style={{ color: "var(--brew-warning)" }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
          <p className="flex-1 text-sm">
            Your recipes are saved locally on this device. Sign in to sync across devices and share
            with others.
          </p>
          <button
            onClick={signInWithGoogle}
            className="brew-btn-ghost px-3 py-1 text-sm whitespace-nowrap"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Search and Controls */}
      <div className="brew-section mb-6">
        {/* Row 1: Search + Sort */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes by name, style, or tags..."
              className="brew-input w-full"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="recipe-sort-select" className="text-sm font-medium whitespace-nowrap">
              Sort by:
            </label>
            <select
              id="recipe-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="brew-input"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>
        </div>

        {/* Row 2: New Recipe + Import dropdown */}
        <div className="mt-3 flex items-center gap-3 border-t border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] pt-3">
          <button onClick={handleCreateNew} className="brew-btn-primary whitespace-nowrap">
            + New Recipe
          </button>

          {/* Import dropdown */}
          <div className="relative ml-auto" ref={importMenuRef}>
            <button
              onClick={() => setShowImportMenu((prev) => !prev)}
              className="brew-btn-ghost flex items-center gap-1.5 text-sm whitespace-nowrap"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Import
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${showImportMenu ? "rotate-180" : ""}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showImportMenu && (
              <div className="absolute right-0 z-30 mt-1.5 w-44 overflow-hidden rounded-lg border border-[rgb(var(--brew-border))] bg-[var(--brew-card)] shadow-lg">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowImportMenu(false);
                  }}
                  className="brew-menu-item w-full text-left"
                >
                  Import BeerXML
                </button>
                <button
                  onClick={() => {
                    jsonFileInputRef.current?.click();
                    setShowImportMenu(false);
                  }}
                  className="brew-menu-item w-full text-left"
                >
                  Import JSON
                </button>
              </div>
            )}
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,text/xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = typeof reader.result === "string" ? reader.result : "";
                const imported = importFromBeerXml(text);
                if (imported) {
                  loadRecipes();
                  toast.success(`Imported "${imported.name}"`);
                } else {
                  toast.error("Failed to import BeerXML file");
                }
              };
              reader.readAsText(file);
              e.target.value = "";
            }}
          />
          <input
            ref={jsonFileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const text = typeof reader.result === "string" ? reader.result : "";
                const imported = importFromJson(text);
                if (imported) {
                  loadRecipes();
                  toast.success(`Imported "${imported.name}"`);
                } else {
                  toast.error("Failed to import JSON file");
                }
              };
              reader.readAsText(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Recipe Grid */}
      {filteredAndSortedRecipes.length === 0 ? (
        searchQuery ? (
          <div className="brew-section brew-animate-in py-10 text-center" data-accent="grain">
            {/* Search icon */}
            <svg
              className="mx-auto mb-4 opacity-30"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
              <path d="m8 11h6" />
            </svg>
            <p className="mb-1 text-lg font-semibold" style={{ color: "var(--fg-strong)" }}>
              No matches for &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="text-muted mb-5 text-sm">Try a different name, style, or tag</p>
            <button onClick={() => setSearchQuery("")} className="brew-btn-ghost">
              Clear search
            </button>
          </div>
        ) : (
          <div className="brew-section brew-animate-in py-12 text-center" data-accent="grain">
            {/* Beer mug illustration */}
            <div className="brew-animate-in brew-stagger-1">
              <svg
                className="mx-auto mb-6"
                width="72"
                height="72"
                viewBox="0 0 24 24"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Mug body */}
                <path
                  d="M4 7h10v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z"
                  stroke="var(--brew-accent-400)"
                  strokeWidth="1.2"
                  fill="color-mix(in oklch, var(--brew-accent-200) 30%, transparent)"
                />
                {/* Handle */}
                <path
                  d="M14 9h2a3 3 0 0 1 0 6h-2"
                  stroke="var(--brew-accent-400)"
                  strokeWidth="1.2"
                />
                {/* Liquid line */}
                <path
                  d="M5.5 10.5h7"
                  stroke="var(--brew-accent-300)"
                  strokeWidth="1"
                  opacity="0.6"
                />
                {/* Foam bubbles */}
                <circle
                  cx="6.5"
                  cy="6"
                  r="1.2"
                  fill="var(--brew-accent-200)"
                  stroke="var(--brew-accent-300)"
                  strokeWidth="0.6"
                />
                <circle
                  cx="9"
                  cy="5.5"
                  r="1.4"
                  fill="var(--brew-accent-100)"
                  stroke="var(--brew-accent-300)"
                  strokeWidth="0.6"
                />
                <circle
                  cx="11.5"
                  cy="6.2"
                  r="1"
                  fill="var(--brew-accent-200)"
                  stroke="var(--brew-accent-300)"
                  strokeWidth="0.6"
                />
                {/* Rim */}
                <path d="M4.5 7h9" stroke="var(--brew-accent-500)" strokeWidth="0.8" />
              </svg>
            </div>
            <div className="brew-animate-in brew-stagger-2">
              <h2 className="mb-2 text-xl font-bold" style={{ color: "var(--fg-strong)" }}>
                Your brew log is empty
              </h2>
              <p className="text-muted mx-auto mb-8 max-w-xs text-sm leading-relaxed">
                Start by building your first recipe — add grains, hops, yeast, and dial in your
                numbers.
              </p>
            </div>
            <div className="brew-animate-in brew-stagger-3">
              <button onClick={handleCreateNew} className="brew-btn-primary px-8 py-3 text-base">
                Create Your First Recipe
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedRecipes.map((recipe) => (
            <div key={recipe.id} className="flex flex-col overflow-visible">
              <Link
                href={`/recipes/${recipe.id}`}
                onClick={() => {
                  handlePreloadRecipe(recipe);
                  setNavigatingId(recipe.id);
                }}
                className="contents"
              >
                <RecipeCard
                  recipe={recipe}
                  onDelete={(e) => handleDeleteClick(recipe.id, e)}
                  isNavigating={navigatingId === recipe.id}
                />
              </Link>
              <RecipeSessionsBar recipeId={recipe.id} />
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="brew-modal mx-4 max-w-md p-6">
            <h3 className="mb-4 text-lg font-semibold">Delete Recipe?</h3>
            <p className="text-muted mb-6">
              Are you sure you want to delete this recipe? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={handleDeleteCancel} className="brew-btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="rounded-lg px-4 py-2 transition-colors"
                style={{ background: "var(--brew-danger)", color: "white" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Limit Modal */}
      <RecipeLimitModal isOpen={isLimitModalOpen} onClose={() => setIsLimitModalOpen(false)} />
    </div>
  );
}

// Recipe Card Component
function RecipeCard({
  recipe,
  onDelete,
  isNavigating,
}: {
  recipe: Recipe;
  onDelete: (e: React.MouseEvent) => void;
  isNavigating?: boolean;
}) {
  const router = useRouter();
  // Calculate stats for the recipe
  const calculations = useRecipeCalculations(recipe);
  const [isVersionMenuOpen, setIsVersionMenuOpen] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [showVariationDialog, setShowVariationDialog] = useState(false);
  const variationNameRef = useRef<HTMLInputElement>(null);
  const { createNewVersion, createVariation } = useRecipeStore();
  const { createSession, saveCurrentSession } = useBrewSessionStore();

  const handleExportMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const md = generateRecipeMarkdown(recipe, calculations);
    downloadTextFile(`${sanitizeFileName(recipe.name)}.md`, md);
  };

  const handleCopyMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    const md = generateRecipeMarkdown(recipe, calculations);
    navigator.clipboard.writeText(md);
  };

  const handleExportJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    const json = JSON.stringify(recipe, null, 2);
    downloadTextFile(`${sanitizeFileName(recipe.name)}.json`, json, "application/json");
  };

  const handleExportBeerXml = (e: React.MouseEvent) => {
    e.stopPropagation();
    const xml = generateBeerXml(recipe);
    downloadTextFile(`${sanitizeFileName(recipe.name)}.xml`, xml, "text/xml");
  };

  const handleCopyShareLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (recipe.shareSlug) {
      navigator.clipboard.writeText(`${window.location.origin}/r/${recipe.shareSlug}`);
      toast.success("Share link copied to clipboard");
    } else {
      toast.error("Recipe is private — open it and make it public to share");
    }
  };

  const handleNewVersion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNewVersionDialog(true);
  };

  const handleCreateVariation = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowVariationDialog(true);
  };

  const handleViewHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowVersionModal(true);
  };

  const handleStartSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    const session = createSession(recipe);
    saveCurrentSession();
    router.push(`/recipes/sessions/${session.id}`);
  };

  return (
    <div
      className={`group brew-recipe-card relative cursor-pointer overflow-visible ${isVersionMenuOpen ? "z-30" : "z-10"}`}
      style={
        {
          "--card-srm": calculations ? srmToRgb(calculations.srm) : "rgb(220, 190, 140)",
        } as React.CSSProperties
      }
    >
      {isNavigating && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[var(--brew-card)]/40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brew-accent-300)] border-t-[var(--brew-accent-700)]" />
        </div>
      )}
      <div className="rounded-xl bg-[var(--brew-card)]" style={{ containerType: "inline-size" }}>
        {/* SRM Color Strip */}
        {calculations && (
          <div
            className="h-2 w-full rounded-t-xl"
            style={{ backgroundColor: srmToRgb(calculations.srm) }}
          />
        )}

        {/* Header */}
        <div className="border-b border-[rgb(var(--brew-border))] p-4">
          <div className="flex items-start gap-3">
            <ScalableText
              className="min-w-0 flex-1 font-extrabold tracking-tight"
              minScale={0.75}
              maxLines={2}
              style={{ fontSize: "clamp(1rem, calc(8px + 3cqw), 1.5rem)" }}
            >
              {recipe.name}
            </ScalableText>
            <div
              className="relative flex shrink-0 items-center gap-2"
              onClickCapture={(e) => {
                e.preventDefault();
              }}
            >
              <button
                onClick={handleStartSession}
                className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-transform hover:-rotate-12"
                style={{
                  background: "color-mix(in oklch, var(--brew-accent-200) 40%, transparent)",
                  color: "var(--brew-accent-700)",
                  border: "1px solid var(--brew-accent-300)",
                }}
                title="Brew this beer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 8h10v9a3 3 0 01-3 3H7a3 3 0 01-3-3V8z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 9h2a3 3 0 010 6h-2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h7" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsVersionMenuOpen((prev) => !prev);
                }}
                className="brew-tag shadow-sm"
                title="Version actions"
              >
                v{recipe.currentVersion}
              </button>
              {isVersionMenuOpen && (
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div
                  className="absolute top-full right-0 z-20 -m-4 mt-2 p-4"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onMouseLeave={() => setIsVersionMenuOpen(false)}
                >
                  <div className="w-40 overflow-hidden rounded-lg border border-[rgb(var(--brew-border))] bg-[var(--brew-card)] shadow-lg">
                    <button
                      onClick={(e) => {
                        handleNewVersion(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      New version
                    </button>
                    <button
                      onClick={(e) => {
                        handleCreateVariation(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      New variation
                    </button>
                    <button
                      onClick={(e) => {
                        handleViewHistory(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      View history
                    </button>
                    <div className="my-1 border-t border-[rgb(var(--brew-border))]" />
                    <button
                      onClick={(e) => {
                        handleExportMarkdown(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      Export Markdown
                    </button>
                    <button
                      onClick={(e) => {
                        handleCopyMarkdown(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      Copy Markdown
                    </button>
                    <button
                      onClick={(e) => {
                        handleExportJson(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={(e) => {
                        handleExportBeerXml(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      Export BeerXML
                    </button>
                    <div className="my-1 border-t border-[rgb(var(--brew-border))]" />
                    <button
                      onClick={(e) => {
                        handleCopyShareLink(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item w-full text-left"
                    >
                      Copy Share Link
                    </button>
                    <div className="my-1 border-t border-[rgb(var(--brew-border))]" />
                    <button
                      onClick={(e) => {
                        onDelete(e);
                        setIsVersionMenuOpen(false);
                      }}
                      className="brew-menu-item brew-danger-text w-full text-left"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {recipe.style && <p className="text-muted truncate text-xs italic">{recipe.style}</p>}
        </div>

        {/* Stats */}
        {calculations && (
          <div className="grid grid-cols-5 gap-0 px-4 py-3">
            <div className="pr-2">
              <div className="brew-gauge-label text-[10px]">ABV</div>
              <div
                className="font-handwritten-alt text-sm tabular-nums"
                style={{ color: "var(--brew-accent-700)" }}
              >
                {calculations.abv.toFixed(1)}%
              </div>
            </div>
            <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
              <div className="brew-gauge-label text-[10px]">IBU</div>
              <div className="font-handwritten-alt text-sm tabular-nums">
                {calculations.ibu.toFixed(0)}
              </div>
            </div>
            <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
              <div className="brew-gauge-label text-[10px]">SRM</div>
              <div className="flex items-center gap-1">
                <div
                  className="h-3 w-3 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: srmToRgb(calculations.srm) }}
                />
                <span className="font-handwritten-alt text-sm tabular-nums">
                  {calculations.srm.toFixed(0)}
                </span>
              </div>
            </div>
            <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
              <div className="brew-gauge-label text-[10px]">OG</div>
              <div className="font-handwritten-alt text-sm tabular-nums">
                {calculations.og.toFixed(3)}
              </div>
            </div>
            <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] pl-2">
              <div className="brew-gauge-label text-[10px]">FG</div>
              <div className="font-handwritten-alt text-sm tabular-nums">
                {calculations.fg.toFixed(3)}
              </div>
            </div>
          </div>
        )}

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag, index) => (
                <span key={index} className="brew-tag">
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="brew-tag">+{recipe.tags.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="rounded-b-xl border-t border-[rgb(var(--brew-border))] bg-[var(--brew-card-inset)] p-3">
          <div className="text-muted text-xs">
            {new Date(recipe.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* New Version Dialog */}
      {showNewVersionDialog && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-version-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowNewVersionDialog(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setShowNewVersionDialog(false);
            }
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="brew-modal mx-4 max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="new-version-dialog-title" className="mb-4 text-lg font-semibold">
              Create New Version
            </h3>
            <p className="text-muted mb-4 text-sm">
              This will save the current state of "{recipe.name}" as version {recipe.currentVersion}{" "}
              and increment to version {recipe.currentVersion + 1}.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNewVersionDialog(false);
                }}
                className="brew-btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  createNewVersion(recipe.id);
                  setShowNewVersionDialog(false);
                }}
                className="brew-btn-primary"
              >
                Create Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Variation Dialog */}
      {showVariationDialog && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-variation-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setShowVariationDialog(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setShowVariationDialog(false);
            }
          }}
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="brew-modal mx-4 max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 id="create-variation-dialog-title" className="mb-4 text-lg font-semibold">
              Create Variation
            </h3>
            <p className="text-muted mb-4 text-sm">
              This will create a new recipe based on "{recipe.name}" (v
              {recipe.currentVersion}).
            </p>
            <input
              type="text"
              defaultValue={`${recipe.name} - Variation`}
              ref={variationNameRef}
              className="brew-input mb-4 w-full"
              placeholder="New recipe name"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVariationDialog(false);
                }}
                className="brew-btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const newName = variationNameRef.current?.value || `${recipe.name} - Variation`;
                  createVariation(recipe.id, newName);
                  setShowVariationDialog(false);
                }}
                className="brew-btn-primary"
              >
                Create Variation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      <VersionHistoryModal
        recipe={recipe}
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
      />
    </div>
  );
}
