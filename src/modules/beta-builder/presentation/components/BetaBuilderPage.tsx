/**
 * Beta Builder Page
 *
 * This is your SwiftUI "View" - pure UI, no business logic.
 * It uses the store (like @ObservedObject) and hooks (for calculations).
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecipeStore } from '../stores/recipeStore';
import { useRecipeCalculations } from '../hooks/useRecipeCalculations';
import FermentableSection from './FermentableSection';
import MashScheduleSection from './MashScheduleSection';
import HopSection from './HopSection';
import YeastSection from './YeastSection';
import WaterSection from './WaterSection';
import FermentationSection from './FermentationSection';
import { EquipmentSection } from './EquipmentSection';
import StyleSelectorModal from './StyleSelectorModal';
import StyleRangeComparison from './StyleRangeComparison';
import { srmToRgb } from '../../utils/srmColorUtils';
import { recipeVersionRepository } from '../../domain/repositories/RecipeVersionRepository';
import BrewDayChecklistSection from './BrewDayChecklistSection';
import StickyStatsBar from './StickyStatsBar';
import SectionSidebar from './SectionSidebar';

export default function BetaBuilderPage() {
  const { id, versionNumber } = useParams<{ id?: string; versionNumber?: string }>();
  const navigate = useNavigate();
  const {
    currentRecipe,
    createNewRecipe,
    loadRecipe,
    setCurrentRecipe,
    updateRecipe,
    saveCurrentRecipe,
  } = useRecipeStore();

  const calculations = useRecipeCalculations(currentRecipe);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [showStickyTop, setShowStickyTop] = useState(false);
  const [showStickyBottom, setShowStickyBottom] = useState(false);
  const calculatedValuesRef = React.useRef<HTMLDivElement>(null);
  const isReadOnly = Boolean(versionNumber);

  // Load recipe based on URL param or create new
  useEffect(() => {
    if (id && versionNumber) {
      const version = recipeVersionRepository.loadByRecipeIdAndVersion(
        id,
        Number(versionNumber)
      );
      if (version) {
        setCurrentRecipe({ ...version.recipeSnapshot, id });
      } else {
        setCurrentRecipe(null);
      }
      return;
    }

    if (id) {
      // Editing existing recipe
      loadRecipe(id);
    } else {
      // Creating new recipe
      createNewRecipe();
    }
  }, [id, versionNumber, loadRecipe, createNewRecipe, setCurrentRecipe]);

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

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Removed hard-coded fermentable handler - now using FermentableSection with presets

  if (!currentRecipe) {
    return (
      <div className="max-w-4xl mx-auto py-4">
        {isReadOnly ? (
          <div className="text-center">
            <p className="mb-4">Version not found.</p>
            <button
              onClick={() => navigate('/recipes')}
              className="px-4 py-2 border border-[rgb(var(--border))] rounded-md hover:bg-[rgb(var(--bg))]"
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
    saveCurrentRecipe();
    navigate('/recipes');
  };

  return (
    <div className="brew-theme has-section-sidebar max-w-4xl mx-auto py-6 px-4">
      <SectionSidebar />
      {/* Sticky Stats Bars */}
      {calculations && (
        <>
          <StickyStatsBar
            calculations={calculations}
            position="top"
            isVisible={showStickyTop}
          />
          <StickyStatsBar
            calculations={calculations}
            position="bottom"
            isVisible={showStickyBottom}
          />
        </>
      )}
        {/* Header */}
        <div className="mb-8 brew-animate-in">
          <div className="flex items-center justify-between bg-[rgb(var(--surface))]/80 backdrop-blur">
            <div>
              <button
                onClick={() => navigate('/recipes')}
                className="text-sm font-medium mb-3 flex items-center gap-1.5 transition-colors"
                style={{ color: 'var(--brew-accent-600)' }}
              >
                <span className="text-xs">&#8592;</span> Back to Recipes
              </button>
              <h1 className="brew-section-title text-3xl">
                {isReadOnly ? `Version ${versionNumber} (Read-only)` : 'Recipe Builder'}
              </h1>
            </div>
            {isReadOnly && id && (
              <button
                onClick={() => navigate(`/recipes/${id}`)}
                className="brew-btn-ghost"
              >
                Open Current Recipe
              </button>
            )}
          </div>
        </div>

        <div className={isReadOnly ? 'pointer-events-none opacity-90' : ''}>
        {/* Recipe Name & Metadata */}
        <div className="brew-section brew-animate-in brew-stagger-1 space-y-5">
          <div>
            <label htmlFor="recipe-name" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted">
              Recipe Name
            </label>
            <input
              id="recipe-name"
              type="text"
              value={currentRecipe.name}
              onChange={(e) => updateRecipe({ name: e.target.value })}
              className="brew-input w-full text-lg font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span id="bjcp-style-label" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted">
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
              <label htmlFor="recipe-tags" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted">
                Tags
              </label>
              <input
                id="recipe-tags"
                type="text"
                value={currentRecipe.tags?.join(', ') || ''}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(',')
                    .map(t => t.trim())
                    .filter(t => t.length > 0);
                  updateRecipe({ tags: tags.length > 0 ? tags : [] });
                }}
                placeholder="e.g., hoppy, sessionable"
                className="brew-input w-full"
              />
            </div>
          </div>

          {/* Calculated Values - Gauge Style */}
          {calculations && (
            <div ref={calculatedValuesRef} className="overflow-x-auto scrollbar-hide -mx-1 px-1">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 sm:min-w-max">
              {/* ABV */}
              <div className="brew-gauge">
                <div className="brew-gauge-label">ABV</div>
                <div className="brew-gauge-value">{calculations.abv.toFixed(1)}%</div>
              </div>

              {/* OG */}
              <div className="brew-gauge">
                <div className="brew-gauge-label">OG</div>
                <div className="brew-gauge-value">{calculations.og.toFixed(3)}</div>
              </div>

              {/* FG */}
              <div className="brew-gauge">
                <div className="brew-gauge-label">FG</div>
                <div className="brew-gauge-value">{calculations.fg.toFixed(3)}</div>
              </div>

              {/* IBU */}
              <div className="brew-gauge">
                <div className="brew-gauge-label">IBU</div>
                <div className="brew-gauge-value">{calculations.ibu.toFixed(0)}</div>
              </div>

              {/* SRM with Color Background - the showpiece */}
              <div
                className="brew-srm-swatch"
                style={{ backgroundColor: srmToRgb(calculations.srm) }}
              >
                <div className="relative z-10 text-[10px] font-semibold uppercase tracking-widest text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mb-1">
                  SRM
                </div>
                <div className="relative z-10 text-3xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
                  {calculations.srm.toFixed(1)}
                </div>
              </div>

              {/* Calories */}
              <div className="brew-gauge">
                <div className="brew-gauge-label">Cal</div>
                <div className="brew-gauge-value text-lg">{calculations.calories}</div>
                <div className="text-[9px] text-muted">per 12 oz</div>
              </div>

              {/* Carbs */}
              <div className="brew-gauge">
                <div className="brew-gauge-label">Carbs</div>
                <div className="brew-gauge-value text-lg">{calculations.carbsG.toFixed(1)}g</div>
                <div className="text-[9px] text-muted">per 12 oz</div>
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
            <label htmlFor="recipe-notes" className="block text-xs font-semibold uppercase tracking-wider mb-2 text-muted">
              Notes
            </label>
            <textarea
              id="recipe-notes"
              value={currentRecipe.notes || ''}
              onChange={(e) => updateRecipe({ notes: e.target.value || undefined })}
              placeholder="Brew notes, tasting notes, recipe inspiration..."
              rows={3}
              className="brew-journal"
            />
          </div>
        </div>

        {/* Equipment Profile */}
        <EquipmentSection />

        {/* Fermentables - Now using dedicated component with preset picker */}
        <FermentableSection />

        {/* Mash Schedule */}
        <MashScheduleSection />

        {/* Hops - Phase 3 addition */}
        <HopSection />

        {/* Yeast - Phase 5 addition */}
        <YeastSection />

        {/* Water - Volumes + Chemistry */}
        <WaterSection calculations={calculations} recipe={currentRecipe} />

        {/* Fermentation - Phase 5 addition */}
        <FermentationSection />

        {/* Brew Day Checklist */}
        <BrewDayChecklistSection />

        {/* Save Button */}
          {!isReadOnly && (
        <div className="brew-section brew-animate-in brew-stagger-9 flex gap-3">
          <button
            onClick={() => navigate('/recipes')}
            className="brew-btn-ghost flex-1 py-3"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="brew-btn-primary flex-1 py-3 text-base"
          >
            Save & Close
          </button>
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

    </div>
  );
}
