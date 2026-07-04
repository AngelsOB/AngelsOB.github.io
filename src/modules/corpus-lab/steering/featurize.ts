/**
 * Phase 0 of PRD-009 — place an arbitrary app `Recipe` in the Corpus Lab's
 * flavour space (9 malt axes, 9 hop axes, core stats → the same 23-dim row the
 * cloud uses).
 *
 * Pure: no cloud, no I/O. The malt side uses the runtime classifier
 * (`maltArchetypeForFermentable`, the port of offline `classify()`); the hop
 * side reuses `hopFlavorCalculationService` + the preset flavour map, with any
 * per-hop `flavor` already on the recipe winning (BeerXML / builder enrichment).
 *
 * Do **not** use `archetypeForPresetName` here — that only covers the ~34
 * canonical presets the generator emits. This path has to handle user-typed
 * and imported names.
 */
import type { Recipe, RecipeCalculations, Fermentable, Hop } from "../../recipe/models/Recipe";
import type { HopFlavorProfile } from "../../recipe/models/Presets";
import { HOP_FLAVOR_KEYS } from "../../recipe/models/Presets";
import {
  MALT_FLAVOR_KEYS,
  maltArchetypeForFermentable,
  aggregateMaltFlavor,
  aggregateMaltBody,
  type MaltFlavorProfile,
  type MaltArchetypeMatch,
  type MaltMatchConfidence,
} from "../maltFlavor";
import { hopFlavorCalculationService } from "../../recipe/services/HopFlavorCalculationService";
import { recipeCalculationService } from "../../recipe/services/RecipeCalculationService";
import { HOP_FLAVOR_BY_LOWER } from "../offline/buildCloud";
import { continuousRow } from "./featureSpace";

export type FermentableClassification = {
  name: string;
  weightKg: number;
  colorLovibond: number;
  archetype: string;
  confidence: MaltMatchConfidence;
};

export type FeaturizedRecipe = {
  /** 23-dim continuous feature row (malt 9 + hop 9 + grav/ibu/srm/buGu/mb). */
  row: number[];
  malt: MaltFlavorProfile;
  hop: HopFlavorProfile;
  maltBody: number;
  og: number;
  ibu: number;
  srm: number;
  abv: number;
  calculations: RecipeCalculations;
  /** Per-fermentable classification (for unmatched-rate tracking / review). */
  classifications: FermentableClassification[];
  /**
   * Share of grist weight whose archetype is `"unknown"` (no rule matched).
   * Unmatched malts contribute zero flavour — acceptable, but track the rate.
   */
  unmatchedRate: number;
  notes: string[];
};

function profileToArray(p: MaltFlavorProfile | HopFlavorProfile, keys: readonly string[]): number[] {
  return keys.map((k) => (p as Record<string, number>)[k] ?? 0);
}

/** Classify every fermentable; amounts stay in kg (aggregation normalises). */
export function classifyGrist(fermentables: Fermentable[]): {
  items: Array<{ archetype: string; amount: number }>;
  classifications: FermentableClassification[];
} {
  const classifications: FermentableClassification[] = [];
  const items: Array<{ archetype: string; amount: number }> = [];
  for (const f of fermentables) {
    const match: MaltArchetypeMatch = maltArchetypeForFermentable(f.name, f.colorLovibond);
    classifications.push({
      name: f.name,
      weightKg: f.weightKg,
      colorLovibond: f.colorLovibond,
      archetype: match.archetype,
      confidence: match.confidence,
    });
    if (f.weightKg > 0) items.push({ archetype: match.archetype, amount: f.weightKg });
  }
  return { items, classifications };
}

/**
 * Hop flavour lookup: preset map as baseline, any inline `hop.flavor` on the
 * recipe overrides (builder enrichment / user-authored profiles).
 * Keys are lower-cased to match `HOP_FLAVOR_BY_LOWER`.
 */
export function hopFlavorMapFor(hops: Hop[]): Map<string, HopFlavorProfile> {
  const map = new Map(HOP_FLAVOR_BY_LOWER);
  for (const h of hops) {
    if (h.flavor) map.set(h.name.toLowerCase(), h.flavor);
  }
  return map;
}

/**
 * Place a recipe in the lab's flavour space. Stats (OG/IBU/SRM/ABV) come from
 * the app's real calculators so the point sits on the same axes the cloud uses.
 */
export function featurize(recipe: Recipe): FeaturizedRecipe {
  const notes: string[] = [];
  const { items, classifications } = classifyGrist(recipe.fermentables ?? []);

  const totalWeight = items.reduce((s, it) => s + it.amount, 0);
  const unknownWeight = items
    .filter((it) => it.archetype === "unknown")
    .reduce((s, it) => s + it.amount, 0);
  const unmatchedRate = totalWeight > 0 ? unknownWeight / totalWeight : 0;
  if (unmatchedRate > 0) {
    const n = classifications.filter((c) => c.archetype === "unknown").length;
    notes.push(
      `${n} fermentable${n === 1 ? "" : "s"} unmatched (${(unmatchedRate * 100).toFixed(0)}% of grist by weight) — scoring zero malt flavour`,
    );
  }

  const malt = aggregateMaltFlavor(items);
  const maltBody = aggregateMaltBody(items);

  const batchVolumeL = recipe.batchVolumeL > 0 ? recipe.batchVolumeL : 20;
  const lowerCasedHops = (recipe.hops ?? []).map((h) => ({ ...h, name: h.name.toLowerCase() }));
  const hop = hopFlavorCalculationService.calculateCombinedFlavor(
    lowerCasedHops,
    hopFlavorMapFor(recipe.hops ?? []),
    batchVolumeL,
  );

  const calculations = recipeCalculationService.calculate(recipe);
  const { og, ibu, srm, abv } = calculations;

  const row = continuousRow({
    m: profileToArray(malt, MALT_FLAVOR_KEYS),
    h: profileToArray(hop, HOP_FLAVOR_KEYS),
    og,
    ibu,
    srm,
    mb: maltBody,
  });

  return {
    row,
    malt,
    hop,
    maltBody,
    og,
    ibu,
    srm,
    abv,
    calculations,
    classifications,
    unmatchedRate,
    notes,
  };
}
