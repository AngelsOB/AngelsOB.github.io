"use client";

/**
 * Beta Builder Page
 *
 * This is your SwiftUI "View" - pure UI, no business logic.
 * It uses the store (like @ObservedObject) and hooks (for calculations).
 */

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRecipeStore } from "../stores/recipeStore";
import { useRecipeCalculations } from "../hooks/useRecipeCalculations";
import FermentableSection from "./FermentableSection";
import MashScheduleSection from "./MashScheduleSection";
import HopSection from "./HopSection";
import YeastSection from "./YeastSection";
import WaterSection from "./WaterSection";
import FermentationSection from "./FermentationSection";
import { EquipmentSection } from "./EquipmentSection";
import StyleSelectorModal from "./StyleSelectorModal";
import StyleRangeComparison from "./StyleRangeComparison";
import { srmToRgb } from "../../utils/srmColorUtils";
import { recipeVersionRepository } from "../../domain/repositories/RecipeVersionRepository";
import BrewDayChecklistSection from "./BrewDayChecklistSection";
import StickyStatsBar from "./StickyStatsBar";
import SectionSidebar from "./SectionSidebar";
import { SECTIONS, getScribbleLines } from "./sidebarData";
import AnimatedValue from "./AnimatedValue";
import ShareModal from "../../../sharing/ShareModal";
import ForkButton from "../../../sharing/ForkButton";
import RatingStars from "../../../sharing/RatingStars";
import { useAuthStore } from "../../../auth/authStore";
import { useUserTier } from "../../../auth/useUserTier";
import RecipeLimitModal from "../../../auth/components/RecipeLimitModal";
import type { Recipe, RecipeCalculations } from "../../domain/models/Recipe";

interface BetaBuilderPageProps {
  sharedRecipe?: Recipe;
  sharedOwnerName?: string;
  sharedOwnerId?: string;
  sharedRatingAvg?: number;
  sharedRatingCount?: number;
}

/**
 * Mobile accordion tile header.
 * Hidden on desktop via CSS. On mobile, acts as an expandable section toggle.
 * Styled to match the sidebar's skeuomorphic colored tiles.
 */
function MobileAccordionTile({
  section,
  isOpen,
  onToggle,
  scribbleLines,
}: {
  section: (typeof SECTIONS)[number];
  isOpen: boolean;
  onToggle: () => void;
  scribbleLines: React.ReactNode[];
}) {
  return (
    <button
      className={"mobile-accordion-tile" + (isOpen ? " is-open" : "")}
      style={{ backgroundColor: section.bg, "--sidebar-accent": section.bg } as React.CSSProperties}
      onClick={onToggle}
      aria-expanded={isOpen}
    >
      <span className="mobile-accordion-number" style={{ color: section.text }}>
        {section.number}
      </span>
      <span className="mobile-accordion-label" style={{ color: section.text }}>
        {section.label}
      </span>
      {!isOpen && scribbleLines.length > 0 && (
        <span className="mobile-accordion-preview" style={{ color: section.text }}>
          {scribbleLines.map((line, i) => (
            <span key={i} className="mobile-accordion-preview-line">
              {line}
            </span>
          ))}
        </span>
      )}
      <span className="mobile-accordion-chevron" style={{ color: section.text }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d={isOpen ? "M3 9L7 5L11 9" : "M3 5L7 9L11 5"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}

/**
 * Helper: wraps a section with the mobile accordion tile + collapsible body.
 * On desktop, the tile is hidden and body flows normally (CSS handles this).
 */
function AccordionSection({
  sectionKey,
  recipe,
  calculations,
  mobileOpen,
  onToggle,
  children,
}: {
  sectionKey: string;
  recipe: Recipe | null;
  calculations: RecipeCalculations | null;
  mobileOpen: Set<string>;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}) {
  const section = SECTIONS.find((s) => s.accent === sectionKey);
  if (!section) return <>{children}</>;

  const isOpen = mobileOpen.has(sectionKey);
  const scribbleLines = getScribbleLines(sectionKey, recipe, calculations);

  return (
    <>
      <MobileAccordionTile
        section={section}
        isOpen={isOpen}
        onToggle={() => onToggle(sectionKey)}
        scribbleLines={scribbleLines}
      />
      <div className={"mobile-accordion-body" + (isOpen ? " is-open" : "")}>
        <div className="mobile-accordion-body-inner">{children}</div>
      </div>
    </>
  );
}

export default function BetaBuilderPage({
  sharedRecipe,
  sharedOwnerName,
  sharedOwnerId,
  sharedRatingAvg,
  sharedRatingCount,
}: BetaBuilderPageProps = {}) {
  const { id, versionNumber } = useParams<{ id?: string; versionNumber?: string }>();
  const router = useRouter();
  const {
    currentRecipe,
    createNewRecipe,
    loadRecipe,
    setCurrentRecipe,
    updateRecipe,
    saveCurrentRecipe,
  } = useRecipeStore();

  const calculations = useRecipeCalculations(currentRecipe);
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const { canCreate: canCreateMore } = useUserTier();
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [showStickyTop, setShowStickyTop] = useState(false);
  const [showStickyBottom, setShowStickyBottom] = useState(false);
  const [titleUnderline, setTitleUnderline] = useState(false);
  const [mobileOpenSection, setMobileOpenSection] = useState<Set<string>>(() => new Set(["recipe"]));
  const calculatedValuesRef = React.useRef<HTMLDivElement>(null);
  const recipes = useRecipeStore((s) => s.recipes);
  const isShared = Boolean(sharedRecipe);
  const isReadOnly = Boolean(versionNumber) || isShared;
  // A recipe is "new" if it hasn't been saved yet (not in the recipes list)
  const isNewRecipe = currentRecipe ? !recipes.some((r) => r.id === currentRecipe.id) : false;
  // Disable save for new recipes when at the free tier limit
  const saveDisabled = isNewRecipe && !canCreateMore;

  const toggleMobileSection = useCallback((key: string) => {
    setMobileOpenSection((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Delayed underline animation for recipe name
  useEffect(() => {
    const timer = setTimeout(() => setTitleUnderline(true), 750);
    return () => clearTimeout(timer);
  }, []);

  // Load recipe based on URL param, shared prop, or create new.
  // For recipes with an ID, we load immediately (from IndexedDB cache) without
  // waiting for auth. When auth resolves, AuthProvider calls loadRecipes(true)
  // which refreshes the data from the network.
  useEffect(() => {
    if (sharedRecipe) {
      setCurrentRecipe(sharedRecipe);
      return;
    }

    if (id && versionNumber) {
      if (isAuthLoading) return; // version history needs auth
      const version = recipeVersionRepository.loadByRecipeIdAndVersion(id, Number(versionNumber));
      if (version) {
        setCurrentRecipe({ ...version.recipeSnapshot, id });
      } else {
        setCurrentRecipe(null);
      }
      return;
    }

    if (id) {
      // Load immediately — store will use IndexedDB cache if auth isn't ready yet
      loadRecipe(id);
    } else if (!isAuthLoading) {
      // Only create new recipe after auth resolves (needs user context)
      createNewRecipe();
    }
  }, [
    id,
    versionNumber,
    sharedRecipe,
    isAuthLoading,
    loadRecipe,
    createNewRecipe,
    setCurrentRecipe,
  ]);

  // Update document title with recipe name
  useEffect(() => {
    if (currentRecipe?.name) {
      document.title = `${currentRecipe.name} | Brewing.It`;
    } else {
      document.title = "Recipe Builder | Brewing.It";
    }
    return () => {
      document.title = "Brewing.It - Homebrewing Recipe Builder & Calculator";
    };
  }, [currentRecipe?.name]);

  // Sticky header scroll detection
  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const calculatedValuesEl = calculatedValuesRef.current;

      if (calculatedValuesEl) {
        const rect = calculatedValuesEl.getBoundingClientRect();
        const isPastCalculatedValues = rect.bottom < 0;

        if (isPastCalculatedValues) {
          const scrollDiff = currentScrollY - lastScrollY;

          if (scrollDiff > 0) {
            // Scrolling down - show top header
            setShowStickyTop(true);
            setShowStickyBottom(false);
          } else if (scrollDiff < 0) {
            // Scrolling up - show bottom header
            setShowStickyTop(false);
            setShowStickyBottom(true);
          }
        } else {
          // Not past calculated values - hide both
          setShowStickyTop(false);
          setShowStickyBottom(false);
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Removed hard-coded fermentable handler - now using FermentableSection with presets

  if (!currentRecipe) {
    return (
      <div className="mx-auto max-w-4xl py-4">
        {isReadOnly ? (
          <div className="text-center">
            <p className="mb-4">Version not found.</p>
            <button
              onClick={() => router.push("/recipes")}
              className="rounded-md border border-[rgb(var(--border))] px-4 py-2 hover:bg-[var(--bg)]"
            >
              Back to Recipes
            </button>
          </div>
        ) : (
          <p>Loading...</p>
        )}
      </div>
    );
  }

  const handleSave = () => {
    if (saveDisabled) {
      setIsLimitModalOpen(true);
      return;
    }
    saveCurrentRecipe();
    router.push("/recipes");
  };

  return (
    <div className="brew-theme has-section-sidebar mx-auto max-w-4xl px-1 sm:px-4 py-6">
      <SectionSidebar
        recipe={currentRecipe}
        calculations={calculations}
        hideSidebarNav={showStickyTop || showStickyBottom}
        navButton={{
          backPath: isShared ? "/browse" : "/recipes",
          backLabel: isShared ? "Back to Browse" : "Back to Recipes",
          showShareControl: !isReadOnly && !isShared && !!user && !!id,
          isPublic: currentRecipe?.isPublic ?? false,
          shareSlug: currentRecipe?.shareSlug,
          recipeName: currentRecipe?.name,
          recipeId: currentRecipe?.id,
          onPublished: (slug) => {
            updateRecipe({
              isPublic: true,
              shareSlug: slug,
              publishedAt: new Date().toISOString(),
            });
            saveCurrentRecipe();
          },
          onUnpublished: () => {
            updateRecipe({ isPublic: false, shareSlug: undefined, publishedAt: undefined });
            saveCurrentRecipe();
          },
        }}
      />
      {/* Sticky Stats Bars */}
      {calculations && (
        <>
          <StickyStatsBar
            calculations={calculations}
            position="top"
            isVisible={showStickyTop}
            leftAction={
              <button
                onClick={() => router.push(isShared ? "/browse" : "/recipes")}
                className="sticky-bar-btn"
              >
                <span className="sticky-bar-btn-arrow">&#8592;</span>
                {isShared ? "Back to Browse" : "Back to Recipes"}
              </button>
            }
            rightAction={
              <>
                {isShared && currentRecipe && (
                  <ForkButton recipeId={currentRecipe.id} recipeName={currentRecipe.name} />
                )}
                {!isShared && isReadOnly && id && (
                  <button onClick={() => router.push(`/recipes/${id}`)} className="sticky-bar-btn">
                    Current
                  </button>
                )}
                {!isReadOnly && user && id && currentRecipe && (
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="sticky-bar-btn"
                  >
                    {currentRecipe.isPublic && (
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    )}
                    {currentRecipe.isPublic ? "Shared" : "Share"}
                  </button>
                )}
              </>
            }
          />
          <StickyStatsBar
            calculations={calculations}
            position="bottom"
            isVisible={showStickyBottom}
            leftAction={
              <button
                onClick={() => router.push(isShared ? "/browse" : "/recipes")}
                className="sticky-bar-btn"
              >
                <span className="sticky-bar-btn-arrow">&#8592;</span>
                {isShared ? "Back to Browse" : "Back to Recipes"}
              </button>
            }
            rightAction={
              <>
                {isShared && currentRecipe && (
                  <ForkButton recipeId={currentRecipe.id} recipeName={currentRecipe.name} />
                )}
                {!isShared && isReadOnly && id && (
                  <button onClick={() => router.push(`/recipes/${id}`)} className="sticky-bar-btn">
                    Current
                  </button>
                )}
                {!isReadOnly && user && id && currentRecipe && (
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="sticky-bar-btn"
                  >
                    {currentRecipe.isPublic && (
                      <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    )}
                    {currentRecipe.isPublic ? "Shared" : "Share"}
                  </button>
                )}
              </>
            }
          />
        </>
      )}
      {/* Shared/read-only info banner */}
      {(isShared || isReadOnly || (currentRecipe?.parentRecipeId && currentRecipe.parentRecipeName)) && (
        <div className="mb-4 text-center">
          {(isShared || isReadOnly) && (
            <h1 className="brew-section-title text-xl">
              {isShared
                ? "Shared Recipe (Read-only)"
                : `Version ${versionNumber} (Read-only)`}
            </h1>
          )}
          {isShared && sharedOwnerName && (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              by{" "}
              {sharedOwnerId ? (
                <Link href={`/u/${sharedOwnerId}`} className="font-medium hover:underline">
                  {sharedOwnerName}
                </Link>
              ) : (
                <span className="font-medium">{sharedOwnerName}</span>
              )}
            </p>
          )}
          {isShared && currentRecipe && (
            <div className="mt-2">
              <RatingStars
                recipeId={currentRecipe.id}
                ratingAvg={sharedRatingAvg}
                ratingCount={sharedRatingCount}
              />
            </div>
          )}
          {!isShared && currentRecipe?.parentRecipeId && currentRecipe.parentRecipeName && (
            <p className="mt-1 text-xs text-[var(--fg-muted)]">
              Forked from{" "}
              {currentRecipe.parentRecipeShareSlug ? (
                <Link
                  href={`/r/${currentRecipe.parentRecipeShareSlug}`}
                  className="font-medium underline transition-colors hover:text-[var(--brew-accent-600)]"
                  style={{ pointerEvents: "auto" }}
                >
                  {currentRecipe.parentRecipeName}
                </Link>
              ) : (
                <span className="font-medium">{currentRecipe.parentRecipeName}</span>
              )}
              {currentRecipe.parentRecipeOwnerName && (
                <> by {currentRecipe.parentRecipeOwnerName}</>
              )}
            </p>
          )}
        </div>
      )}

      <div className={`brew-main-fade-in ${isReadOnly ? "brew-read-only" : ""}`}>
        {/* Recipe Name & Metadata */}
        <div>
          <AccordionSection
            sectionKey="recipe"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <div className="brew-section space-y-5">
              {/* Handwritten recipe name — desktop only */}
              <div className="hidden md:block text-center">
                {!currentRecipe.name && (
                  <span className="recipe-name-label">Title:</span>
                )}
                <div className={"recipe-name-wrapper" + (titleUnderline && currentRecipe.name ? " is-drawn" : "")}>
                  <input
                    id="recipe-name"
                    type="text"
                    autoComplete="off"
                    placeholder="Untitled Recipe"
                    value={currentRecipe.name}
                    onChange={(e) => updateRecipe({ name: e.target.value })}
                    size={currentRecipe.name.length || 16}
                    className="recipe-name-input text-center"
                  />
                </div>
              </div>

              {/* Mobile recipe name — plain input */}
              <div className="md:hidden">
                <label
                  htmlFor="recipe-name-mobile"
                  className="text-muted mb-2 block text-xs font-semibold tracking-wider uppercase"
                >
                  Recipe Name
                </label>
                <input
                  id="recipe-name-mobile"
                  type="text"
                  autoComplete="off"
                  value={currentRecipe.name}
                  onChange={(e) => updateRecipe({ name: e.target.value })}
                  className="brew-input w-full text-lg font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span
                    id="bjcp-style-label"
                    className="text-muted mb-2 block text-xs font-semibold tracking-wider uppercase"
                  >
                    BJCP Style
                  </span>
                  <button
                    aria-labelledby="bjcp-style-label"
                    onClick={() => setIsStyleModalOpen(true)}
                    className="brew-btn-ghost w-full text-left"
                  >
                    {currentRecipe.style || <span className="text-muted">Select a style...</span>}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="recipe-tags"
                    className="text-muted mb-2 block text-xs font-semibold tracking-wider uppercase"
                  >
                    Tags
                  </label>
                  <input
                    id="recipe-tags"
                    type="text"
                    value={currentRecipe.tags?.join(", ") || ""}
                    onChange={(e) => {
                      const tags = e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => t.length > 0);
                      updateRecipe({ tags: tags.length > 0 ? tags : [] });
                    }}
                    placeholder="e.g., hoppy, sessionable"
                    className="brew-input w-full"
                  />
                </div>
              </div>

              {/* Calculated Values - Gauge Style */}
              {calculations && (
                <div
                  ref={calculatedValuesRef}
                  className="scrollbar-hide -mx-1 overflow-x-auto px-1"
                >
                  <div className="brew-gauge-grid">
                    {/* ABV */}
                    <div className="brew-gauge">
                      <div className="brew-gauge-label">ABV</div>
                      <div className="brew-gauge-value">
                        <AnimatedValue value={calculations.abv} decimals={1} suffix="%" />
                      </div>
                    </div>

                    {/* OG */}
                    <div className="brew-gauge">
                      <div className="brew-gauge-label">OG</div>
                      <div className="brew-gauge-value">
                        <AnimatedValue value={calculations.og} decimals={3} />
                      </div>
                    </div>

                    {/* FG */}
                    <div className="brew-gauge">
                      <div className="brew-gauge-label">FG</div>
                      <div className="brew-gauge-value">
                        <AnimatedValue value={calculations.fg} decimals={3} />
                      </div>
                    </div>

                    {/* IBU */}
                    <div className="brew-gauge">
                      <div className="brew-gauge-label">IBU</div>
                      <div className="brew-gauge-value">
                        <AnimatedValue value={calculations.ibu} decimals={0} />
                      </div>
                    </div>

                    {/* SRM with Color Background - the showpiece */}
                    <div
                      className="brew-srm-swatch"
                      style={{ backgroundColor: srmToRgb(calculations.srm) }}
                    >
                      <div className="relative z-10 mb-1 text-[10px] font-semibold tracking-widest text-white uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                        SRM
                      </div>
                      <div
                        className="relative z-10 text-3xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                        style={{ fontVariantNumeric: "tabular-nums lining-nums" }}
                      >
                        <AnimatedValue value={calculations.srm} decimals={1} />
                      </div>
                    </div>

                    {/* Calories */}
                    <div className="brew-gauge">
                      <div className="brew-gauge-label">Cal</div>
                      <div className="brew-gauge-value text-lg">
                        <AnimatedValue value={calculations.calories} decimals={0} />
                      </div>
                      <div className="text-muted text-[9px]">per 12 oz</div>
                    </div>

                    {/* Carbs */}
                    <div className="brew-gauge">
                      <div className="brew-gauge-label">Carbs</div>
                      <div className="brew-gauge-value text-lg">
                        <AnimatedValue value={calculations.carbsG} decimals={1} suffix="g" />
                      </div>
                      <div className="text-muted text-[9px]">per 12 oz</div>
                    </div>
                  </div>
                </div>
              )}

              {/* BJCP Style Range Comparison */}
              {calculations && currentRecipe.style && (
                <div className="pt-2">
                  <StyleRangeComparison
                    styleCode={currentRecipe.style}
                    abv={calculations.abv}
                    og={calculations.og}
                    fg={calculations.fg}
                    ibu={calculations.ibu}
                    srm={calculations.srm}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="recipe-notes"
                  className="text-muted mb-2 block text-xs font-semibold tracking-wider uppercase"
                >
                  Notes
                </label>
                <textarea
                  id="recipe-notes"
                  value={currentRecipe.notes || ""}
                  onChange={(e) => updateRecipe({ notes: e.target.value || undefined })}
                  placeholder="Brew notes, tasting notes, recipe inspiration..."
                  rows={3}
                  className="brew-journal"
                />
              </div>
            </div>
          </AccordionSection>
        </div>

        {/* Equipment Profile */}
        <div>
          <AccordionSection
            sectionKey="equipment"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <EquipmentSection />
          </AccordionSection>
        </div>

        {/* Fermentables */}
        <div>
          <AccordionSection
            sectionKey="grain"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <FermentableSection />
          </AccordionSection>
        </div>

        {/* Mash Schedule */}
        <div>
          <AccordionSection
            sectionKey="mash"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <MashScheduleSection />
          </AccordionSection>
        </div>

        {/* Hops */}
        <div>
          <AccordionSection
            sectionKey="hops"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <HopSection />
          </AccordionSection>
        </div>

        {/* Yeast */}
        <div>
          <AccordionSection
            sectionKey="yeast"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <YeastSection />
          </AccordionSection>
        </div>

        {/* Water */}
        <div>
          <AccordionSection
            sectionKey="water"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <WaterSection calculations={calculations} recipe={currentRecipe} />
          </AccordionSection>
        </div>

        {/* Fermentation */}
        <div>
          <AccordionSection
            sectionKey="fermentation"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            <FermentationSection />
          </AccordionSection>
        </div>

        {/* Brew Day Numbers */}
        <div>
          <AccordionSection
            sectionKey="targets"
            recipe={currentRecipe}
            calculations={calculations}
            mobileOpen={mobileOpenSection}
            onToggle={toggleMobileSection}
          >
            {currentRecipe && (
              <BrewDayChecklistSection recipe={currentRecipe} calculations={calculations} />
            )}
          </AccordionSection>
        </div>

        {/* Save Button */}
        {!isReadOnly && (
          <div>
            <div className="brew-section flex gap-3">
              <button
                onClick={() => router.push("/recipes")}
                className="brew-btn-ghost flex-1 py-3"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`brew-btn-primary flex-1 py-3 text-base${saveDisabled ? ' opacity-50' : ''}`}
              >
                Save &amp; Close
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Style Selector Modal */}
      <StyleSelectorModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        onSelect={(style) => updateRecipe({ style: style || undefined })}
        currentStyle={currentRecipe.style}
      />

      {/* Share Modal */}
      {user && id && (
        <ShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          recipeId={currentRecipe.id}
          recipeName={currentRecipe.name}
          isPublic={currentRecipe.isPublic ?? false}
          shareSlug={currentRecipe.shareSlug}
          onPublished={(slug) => {
            updateRecipe({
              isPublic: true,
              shareSlug: slug,
              publishedAt: new Date().toISOString(),
            });
            saveCurrentRecipe();
          }}
          onUnpublished={() => {
            updateRecipe({ isPublic: false, shareSlug: undefined, publishedAt: undefined });
            saveCurrentRecipe();
          }}
        />
      )}

      {/* Recipe Limit Modal */}
      <RecipeLimitModal
        isOpen={isLimitModalOpen}
        onClose={() => setIsLimitModalOpen(false)}
      />
    </div>
  );
}
