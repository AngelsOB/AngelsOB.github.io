'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Recipe } from '../beta-builder/domain/models/Recipe';
import { RecipeCalculationService } from '../beta-builder/domain/services/RecipeCalculationService';
import { srmToRgb } from '../beta-builder/utils/srmColorUtils';
import { type RecipeWithCalcs, computeMeanRecipe } from './compareUtils';
import VitalsComparison from './sections/VitalsComparison';
import GrainComparison from './sections/GrainComparison';
import HopComparison from './sections/HopComparison';
import MashComparison from './sections/MashComparison';
import WaterComparison from './sections/WaterComparison';
import MeanRecipeSummary from './sections/MeanRecipeSummary';

const calc = new RecipeCalculationService();

/** @deprecated Classic UI. Migrating to HS — see HOPSKIP_MIGRATION_PRD.md §1.3. */
export default function CompareRecipesPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get('ids') || '';

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idsParam) {
      setError('No recipe IDs provided');
      setIsLoading(false);
      return;
    }

    async function fetchRecipes() {
      try {
        const res = await fetch(`/api/compare?ids=${encodeURIComponent(idsParam)}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to load recipes (${res.status})`);
        }
        const data = await res.json();
        setRecipes(data.recipes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recipes');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecipes();
  }, [idsParam]);

  const items: RecipeWithCalcs[] = useMemo(
    () => recipes.map((r) => ({ recipe: r, calcs: calc.calculate(r) })),
    [recipes],
  );

  const meanRecipe = useMemo(
    () => (items.length >= 2 ? computeMeanRecipe(items) : null),
    [items],
  );

  if (isLoading) {
    return (
      <div className="brew-theme mx-auto max-w-6xl px-2 py-6">
        <div className="mb-8">
          <h1 className="brew-section-title text-3xl">Compare Recipes</h1>
        </div>
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="section-soft animate-pulse rounded-xl p-6">
              <div className="h-5 w-48 rounded bg-[var(--brew-accent-100)]" />
              <div className="mt-4 h-32 rounded bg-[var(--brew-accent-100)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || items.length < 2) {
    return (
      <div className="brew-theme mx-auto max-w-6xl px-2 py-6">
        <div className="section-soft py-12 text-center">
          <p className="text-lg font-semibold" style={{ color: 'var(--fg-strong)' }}>
            {error || 'Not enough recipes to compare'}
          </p>
          <p className="text-muted mt-2 text-sm">Select at least 2 recipes from the browse page.</p>
          <Link href="/browse" className="btn-neon mt-4 inline-block">
            Back to Browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="brew-theme mx-auto max-w-6xl px-2 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link href="/browse" className="text-muted text-sm hover:underline mb-2 inline-block">
          &larr; Back to Browse
        </Link>
        <h1 className="brew-section-title text-3xl">Compare Recipes</h1>
        <p className="text-muted text-sm mt-1">
          Comparing {items.length} recipes side-by-side
        </p>
      </div>

      {/* Recipe name chips */}
      <div className="mb-8 flex flex-wrap gap-2">
        {items.map(({ recipe: r, calcs: c }) => {
          const color = srmToRgb(c.srm);
          return (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: `color-mix(in oklch, ${color} 15%, var(--brew-card))`,
                border: `2px solid ${color}`,
              }}
            >
              <div
                className="h-3 w-3 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: color }}
              />
              <span className="max-w-[200px] truncate">{r.name}</span>
            </div>
          );
        })}
      </div>

      {/* Comparison sections */}
      <div className="space-y-8">
        <VitalsComparison items={items} />
        <GrainComparison items={items} />
        <HopComparison items={items} />
        <MashComparison items={items} />
        <WaterComparison items={items} />
        {meanRecipe && <MeanRecipeSummary mean={meanRecipe} recipeCount={items.length} />}
      </div>
    </div>
  );
}
