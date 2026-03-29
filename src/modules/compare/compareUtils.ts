/**
 * Pure utility functions for recipe comparison and aggregation.
 * No React/browser dependencies — safe for both client and server.
 */

import type { Recipe, Fermentable, Hop, RecipeCalculations } from '../beta-builder/domain/models/Recipe';
import type { HopFlavorProfile } from '../beta-builder/domain/models/Presets';
import {
  categorizeFermentable,
  inferType,
  type FermentableGroup,
} from '../beta-builder/data/fermentablePresets';

export type { FermentableGroup };

// ── Types ────────────────────────────────────────────────────────────────

export type RecipeWithCalcs = {
  recipe: Recipe;
  calcs: RecipeCalculations;
};

export type GrainCategoryEntry = {
  weightKg: number;
  pct: number;
  grains: { name: string; weightKg: number; pct: number }[];
};

export type GrainBreakdown = Partial<Record<FermentableGroup, GrainCategoryEntry>>;

export type HopSummary = {
  name: string;
  totalGrams: number;
  avgAlphaAcid: number;
  additions: { type: Hop['type']; grams: number; timeMinutes?: number }[];
};

export type RecipeHopSummary = {
  hops: HopSummary[];
  totalGrams: number;
  gramsPerLiter: number;
};

export type WaterProfile = {
  Ca: number;
  Mg: number;
  Na: number;
  Cl: number;
  SO4: number;
  HCO3: number;
};

export type MeanRecipeData = {
  avgAbv: number;
  avgOg: number;
  avgFg: number;
  avgIbu: number;
  avgSrm: number;
  avgCalories: number;
  grainBreakdown: GrainBreakdown;
  /** Normalized grain names with avg percentage across all recipes, grouped by category */
  grainDetail: { category: FermentableGroup; name: string; avgPct: number; count: number }[];
  commonHops: string[];
  avgHopRate: number;
  avgMashTempC: number | null;
  avgWater: WaterProfile | null;
};

// ── Grain name normalization ──────────────────────────────────────────────

/**
 * Strips maltster/brand prefixes and normalizes to the common grain name.
 * e.g., "Crisp Malting - Finest Maris Otter" → "Maris Otter"
 *       "Thomas Fawcett - Maris Otter Pale Ale Malt" → "Maris Otter"
 *       "Weyermann - Roasted Barley" → "Roasted Barley"
 *       "Briess - Pale Ale Malt 2-Row" → "Pale Ale Malt 2-Row"
 */
export function normalizeGrainName(name: string): string {
  // Strip maltster prefix (e.g., "Briess - ", "Crisp Malting - ", "Weyermann - ")
  let normalized = name.replace(/^[A-Za-z\s&'.]+\s*[-–—]\s*/, '');

  // Remove qualifiers like "Finest", "Premium", "Best", "Extra"
  normalized = normalized.replace(/\b(Finest|Premium|Best|Extra|Superior)\s+/gi, '');

  // Normalize Maris Otter variants — anything containing "maris otter" is "Maris Otter"
  if (/maris\s*otter/i.test(normalized)) return 'Maris Otter';

  // Normalize "Pale Ale Malt" variants
  if (/^pale\s+ale\s+malt/i.test(normalized)) return 'Pale Ale Malt';

  // Normalize 2-Row / Two-Row variants
  if (/\b(2-row|two[- ]row)\b/i.test(normalized) && !/pilsner|vienna|munich/i.test(normalized)) {
    return '2-Row Pale Malt';
  }

  // Normalize Pilsner variants
  if (/^pilsner/i.test(normalized) || /^pils\b/i.test(normalized)) return 'Pilsner Malt';

  // Normalize Munich variants
  if (/^munich/i.test(normalized)) {
    const colorMatch = normalized.match(/(\d+)\s*°?L/i);
    return colorMatch ? `Munich Malt ${colorMatch[1]}L` : 'Munich Malt';
  }

  // Normalize Vienna
  if (/^vienna/i.test(normalized)) return 'Vienna Malt';

  // Normalize Crystal/Caramel with color
  const crystalMatch = normalized.match(/^(?:crystal|caramel)\s*(?:malt\s*)?(\d+)\s*°?L?/i);
  if (crystalMatch) return `Crystal ${crystalMatch[1]}L`;

  // Normalize Roasted Barley variants
  if (/roasted\s*barley/i.test(normalized)) return 'Roasted Barley';

  // Normalize Chocolate Malt variants
  if (/^(?:pale\s+)?chocolate(?:\s+malt)?$/i.test(normalized)) return 'Chocolate Malt';

  // Normalize Black Malt / Black Barley / Black Patent
  if (/^black\s*(malt|patent)/i.test(normalized)) return 'Black Malt';
  if (/^black\s*barley/i.test(normalized)) return 'Black Barley';

  // Normalize Flaked variants
  const flakedMatch = normalized.match(/^flaked\s+(\w+)/i);
  if (flakedMatch) return `Flaked ${flakedMatch[1].charAt(0).toUpperCase() + flakedMatch[1].slice(1).toLowerCase()}`;

  // Normalize Victory Malt
  if (/^victory/i.test(normalized)) return 'Victory Malt';

  // Normalize Biscuit Malt
  if (/^biscuit/i.test(normalized)) return 'Biscuit Malt';

  // Normalize Melanoidin Malt
  if (/^melanoidin/i.test(normalized)) return 'Melanoidin Malt';

  // Normalize Aromatic Malt
  if (/^aromatic/i.test(normalized)) return 'Aromatic Malt';

  // Normalize Wheat Malt
  if (/^wheat\s*(malt)?$/i.test(normalized)) return 'Wheat Malt';

  // Normalize Carapils / Dextrine
  if (/^cara\s*pils/i.test(normalized) || /^dextrin/i.test(normalized)) return 'CaraPils / Dextrine';

  return normalized.trim();
}

// ── Grain categorization ─────────────────────────────────────────────────

export function categorizeRecipeFermentable(f: Fermentable): FermentableGroup {
  const pseudoPreset = {
    name: f.name,
    colorLovibond: f.colorLovibond,
    potentialGu: f.ppg,
    type: inferType(f.name),
  };
  return categorizeFermentable(pseudoPreset);
}

export function getGrainBreakdown(recipe: Recipe): GrainBreakdown {
  const totalKg = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
  if (totalKg === 0) return {};

  const groups: Record<string, { weightKg: number; grains: { name: string; weightKg: number }[] }> = {};

  for (const f of recipe.fermentables) {
    const cat = categorizeRecipeFermentable(f);
    if (!groups[cat]) groups[cat] = { weightKg: 0, grains: [] };
    groups[cat].weightKg += f.weightKg;
    groups[cat].grains.push({ name: f.name, weightKg: f.weightKg });
  }

  const result: GrainBreakdown = {};
  for (const [cat, data] of Object.entries(groups)) {
    result[cat as FermentableGroup] = {
      weightKg: data.weightKg,
      pct: (data.weightKg / totalKg) * 100,
      grains: data.grains.map((g) => ({
        ...g,
        pct: (g.weightKg / totalKg) * 100,
      })),
    };
  }
  return result;
}

// ── Hop analysis ─────────────────────────────────────────────────────────

export function getHopSummary(recipe: Recipe): RecipeHopSummary {
  const byName: Record<string, { grams: number; alphaSum: number; count: number; additions: HopSummary['additions'] }> = {};

  for (const h of recipe.hops) {
    if (!byName[h.name]) byName[h.name] = { grams: 0, alphaSum: 0, count: 0, additions: [] };
    byName[h.name].grams += h.grams;
    byName[h.name].alphaSum += h.alphaAcid;
    byName[h.name].count += 1;
    byName[h.name].additions.push({ type: h.type, grams: h.grams, timeMinutes: h.timeMinutes });
  }

  const hops: HopSummary[] = Object.entries(byName).map(([name, data]) => ({
    name,
    totalGrams: data.grams,
    avgAlphaAcid: data.alphaSum / data.count,
    additions: data.additions,
  }));

  const totalGrams = recipe.hops.reduce((s, h) => s + h.grams, 0);
  const batchL = recipe.batchVolumeL || 1;

  return {
    hops,
    totalGrams,
    gramsPerLiter: totalGrams / batchL,
  };
}

// ── Mash analysis ────────────────────────────────────────────────────────

export function getWeightedMashTemp(recipe: Recipe): number | null {
  const steps = recipe.mashSteps.filter((s) => s.durationMinutes > 0 && s.temperatureC > 0);
  if (steps.length === 0) return null;

  const totalMin = steps.reduce((s, step) => s + step.durationMinutes, 0);
  if (totalMin === 0) return null;

  return steps.reduce((s, step) => s + step.temperatureC * step.durationMinutes, 0) / totalMin;
}

// ── Water analysis ───────────────────────────────────────────────────────

export function getEffectiveWaterProfile(recipe: Recipe): WaterProfile | null {
  const wc = recipe.waterChemistry;
  if (!wc?.sourceProfile) return null;
  const p = wc.sourceProfile;
  if (p.Ca === 0 && p.Mg === 0 && p.Na === 0 && p.Cl === 0 && p.SO4 === 0 && p.HCO3 === 0) return null;
  return { ...p };
}

export function averageWaterProfiles(recipes: Recipe[]): WaterProfile | null {
  const profiles = recipes.map(getEffectiveWaterProfile).filter((p): p is WaterProfile => p !== null);
  if (profiles.length === 0) return null;

  const ions: (keyof WaterProfile)[] = ['Ca', 'Mg', 'Na', 'Cl', 'SO4', 'HCO3'];
  const avg: Partial<WaterProfile> = {};
  for (const ion of ions) {
    avg[ion] = profiles.reduce((s, p) => s + p[ion], 0) / profiles.length;
  }
  return avg as WaterProfile;
}

// ── Hop flavor aggregation ───────────────────────────────────────────────

const FLAVOR_KEYS: (keyof HopFlavorProfile)[] = [
  'citrus', 'tropicalFruit', 'stoneFruit', 'berry',
  'floral', 'spice', 'herbal', 'grassy', 'resinPine',
];

export function getRecipeFlavorProfile(recipe: Recipe): HopFlavorProfile | null {
  const hopsWithFlavor = recipe.hops.filter((h) => h.flavor);
  if (hopsWithFlavor.length === 0) return null;

  const totalGrams = hopsWithFlavor.reduce((s, h) => s + h.grams, 0);
  if (totalGrams === 0) return null;

  const result: Partial<HopFlavorProfile> = {};
  for (const key of FLAVOR_KEYS) {
    result[key] = hopsWithFlavor.reduce((s, h) => s + (h.flavor![key] || 0) * h.grams, 0) / totalGrams;
  }
  return result as HopFlavorProfile;
}

// ── Averaging helpers ────────────────────────────────────────────────────

export function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

// ── Mean recipe ──────────────────────────────────────────────────────────

export function computeMeanRecipe(items: RecipeWithCalcs[]): MeanRecipeData {
  const calcs = items.map((i) => i.calcs);
  const recipes = items.map((i) => i.recipe);

  // Average vitals
  const avgAbv = avg(calcs.map((c) => c.abv));
  const avgOg = avg(calcs.map((c) => c.og));
  const avgFg = avg(calcs.map((c) => c.fg));
  const avgIbu = avg(calcs.map((c) => c.ibu));
  const avgSrm = avg(calcs.map((c) => c.srm));
  const avgCalories = avg(calcs.map((c) => c.calories));

  // Average grain breakdown
  const breakdowns = recipes.map(getGrainBreakdown);
  const allCategories = new Set(breakdowns.flatMap((b) => Object.keys(b))) as Set<FermentableGroup>;
  const grainBreakdown: GrainBreakdown = {};
  for (const cat of allCategories) {
    const pcts = breakdowns.map((b) => b[cat]?.pct ?? 0);
    const avgPct = avg(pcts);
    if (avgPct > 0) {
      grainBreakdown[cat] = { weightKg: 0, pct: avgPct, grains: [] };
    }
  }

  // Normalized grain detail per category
  const grainDetail: MeanRecipeData['grainDetail'] = [];
  for (const cat of GRAIN_CATEGORY_ORDER) {
    if (!allCategories.has(cat)) continue;
    const grainCounts: Record<string, { count: number; pctSum: number }> = {};
    for (const b of breakdowns) {
      const entry = b[cat];
      if (!entry) continue;
      // Merge by normalized name
      const merged: Record<string, number> = {};
      for (const g of entry.grains) {
        const norm = normalizeGrainName(g.name);
        merged[norm] = (merged[norm] || 0) + g.pct;
      }
      for (const [norm, pct] of Object.entries(merged)) {
        if (!grainCounts[norm]) grainCounts[norm] = { count: 0, pctSum: 0 };
        grainCounts[norm].count += 1;
        grainCounts[norm].pctSum += pct;
      }
    }
    for (const [name, data] of Object.entries(grainCounts)) {
      const avgPct = data.pctSum / recipes.length;
      if (avgPct >= 0.5) {
        grainDetail.push({ category: cat, name, avgPct, count: data.count });
      }
    }
  }
  grainDetail.sort((a, b) => b.avgPct - a.avgPct);

  // Common hops (appear in >= 50% of recipes)
  const hopCounts: Record<string, number> = {};
  for (const r of recipes) {
    const seen = new Set<string>();
    for (const h of r.hops) {
      if (!seen.has(h.name)) {
        hopCounts[h.name] = (hopCounts[h.name] || 0) + 1;
        seen.add(h.name);
      }
    }
  }
  const threshold = recipes.length / 2;
  const commonHops = Object.entries(hopCounts)
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  // Average hop rate
  const hopRates = recipes.map((r) => getHopSummary(r).gramsPerLiter);
  const avgHopRate = avg(hopRates);

  // Average mash temp
  const mashTemps = recipes.map(getWeightedMashTemp).filter((t): t is number => t !== null);
  const avgMashTempC = mashTemps.length > 0 ? avg(mashTemps) : null;

  // Average water
  const avgWater = averageWaterProfiles(recipes);

  return {
    avgAbv, avgOg, avgFg, avgIbu, avgSrm, avgCalories,
    grainBreakdown, grainDetail, commonHops, avgHopRate, avgMashTempC, avgWater,
  };
}

// ── Grain category colors ────────────────────────────────────────────────

export const GRAIN_CATEGORY_COLORS: Record<FermentableGroup, string> = {
  'Base malts': 'oklch(75% 0.12 80)',
  'Crystal/Caramel': 'oklch(65% 0.14 55)',
  'Roasted': 'oklch(35% 0.08 40)',
  'Toasted & specialty': 'oklch(60% 0.12 65)',
  'Adjuncts (mashable/flaked)': 'oklch(80% 0.08 90)',
  'Extracts': 'oklch(70% 0.06 70)',
  'Sugars': 'oklch(85% 0.10 95)',
  'Lauter aids & other': 'oklch(65% 0.03 80)',
};

export const GRAIN_CATEGORY_ORDER: FermentableGroup[] = [
  'Base malts',
  'Crystal/Caramel',
  'Toasted & specialty',
  'Roasted',
  'Adjuncts (mashable/flaked)',
  'Sugars',
  'Extracts',
  'Lauter aids & other',
];
