/**
 * Bundled "style guide" seed recipes.
 *
 * These ship with the app so the browse page is never empty.
 * Each recipe uses a deterministic `seed-*` ID and `source: "official"`.
 * Users can fork them into their own collection.
 */

import type { Recipe } from '../modules/beta-builder/domain/models/Recipe';

export const SEED_RECIPES: Recipe[] = [
  // ── 21A  American IPA ────────────────────────────────────────────────
  {
    id: 'seed-american-ipa',
    name: 'West Coast IPA',
    style: 'American IPA',
    notes:
      'A classic West Coast IPA with bold citrus and pine hop character, ' +
      'clean fermentation, and a dry finish. Built around the C-hop trio ' +
      '(Centennial, Citra, Cascade) with Simcoe for piney depth.',
    tags: ['ipa', 'hoppy', 'west-coast', 'american'],
    source: 'official',
    currentVersion: 1,
    batchVolumeL: 20,
    equipment: {
      boilTimeMin: 60,
      boilOffRateLPerHour: 4,
      mashEfficiencyPercent: 75,
      mashThicknessLPerKg: 2.7,
      grainAbsorptionLPerKg: 0.8,
      mashTunDeadspaceLiters: 2.0,
      mashTunLossLiters: 0,
      kettleLossLiters: 1.0,
      hopsAbsorptionLPerKg: 0.7,
      chillerLossLiters: 0,
      fermenterLossLiters: 0.5,
      coolingShrinkagePercent: 4.0,
    },

    fermentables: [
      {
        id: 'seed-ipa-grain-1',
        name: 'Briess - Pale Ale Malt 2-Row',
        weightKg: 5.0,
        colorLovibond: 4,
        ppg: 36.8,
        efficiencyPercent: 75,
        originCode: 'US',
      },
      {
        id: 'seed-ipa-grain-2',
        name: 'Briess - Caramel Malt - 40L',
        weightKg: 0.25,
        colorLovibond: 40,
        ppg: 35.4,
        efficiencyPercent: 75,
        originCode: 'US',
      },
      {
        id: 'seed-ipa-grain-3',
        name: 'Briess - Victory Malt',
        weightKg: 0.15,
        colorLovibond: 28,
        ppg: 34.5,
        efficiencyPercent: 75,
        originCode: 'US',
      },
    ],

    hops: [
      // Bittering
      {
        id: 'seed-ipa-hop-1',
        name: 'Centennial',
        alphaAcid: 10,
        grams: 18,
        type: 'boil',
        timeMinutes: 60,
        flavor: {
          citrus: 4, tropicalFruit: 1, stoneFruit: 1, berry: 1,
          floral: 3, grassy: 1, herbal: 1, spice: 1, resinPine: 2,
        },
      },
      // Flavor
      {
        id: 'seed-ipa-hop-2',
        name: 'Simcoe',
        alphaAcid: 13,
        grams: 14,
        type: 'boil',
        timeMinutes: 15,
        flavor: {
          citrus: 2, tropicalFruit: 1, stoneFruit: 2, berry: 2,
          floral: 0, grassy: 0, herbal: 1, spice: 1, resinPine: 4,
        },
      },
      {
        id: 'seed-ipa-hop-3',
        name: 'Citra',
        alphaAcid: 12.5,
        grams: 14,
        type: 'boil',
        timeMinutes: 15,
        flavor: {
          citrus: 5, tropicalFruit: 4, stoneFruit: 2, berry: 1,
          floral: 1, grassy: 0, herbal: 0, spice: 0, resinPine: 1,
        },
      },
      // Aroma (flameout)
      {
        id: 'seed-ipa-hop-4',
        name: 'Cascade',
        alphaAcid: 5.5,
        grams: 28,
        type: 'whirlpool',
        whirlpoolTimeMinutes: 15,
        temperatureC: 80,
        flavor: {
          citrus: 3, tropicalFruit: 1, stoneFruit: 1, berry: 1,
          floral: 3, grassy: 1, herbal: 1, spice: 1, resinPine: 2,
        },
      },
      // Dry hop
      {
        id: 'seed-ipa-hop-5',
        name: 'Simcoe',
        alphaAcid: 13,
        grams: 28,
        type: 'dry hop',
        dryHopStartDay: 5,
        dryHopDays: 5,
        flavor: {
          citrus: 2, tropicalFruit: 1, stoneFruit: 2, berry: 2,
          floral: 0, grassy: 0, herbal: 1, spice: 1, resinPine: 4,
        },
      },
      {
        id: 'seed-ipa-hop-6',
        name: 'Citra',
        alphaAcid: 12.5,
        grams: 28,
        type: 'dry hop',
        dryHopStartDay: 5,
        dryHopDays: 5,
        flavor: {
          citrus: 5, tropicalFruit: 4, stoneFruit: 2, berry: 1,
          floral: 1, grassy: 0, herbal: 0, spice: 0, resinPine: 1,
        },
      },
    ],

    yeasts: [
      {
        id: 'seed-ipa-yeast-1',
        name: 'SafAle US-05',
        attenuation: 0.78,
        laboratory: 'Fermentis',
      },
    ],

    otherIngredients: [],

    mashSteps: [
      {
        id: 'seed-ipa-mash-1',
        name: 'Saccharification',
        type: 'infusion',
        temperatureC: 65,
        durationMinutes: 60,
      },
      {
        id: 'seed-ipa-mash-2',
        name: 'Mash Out',
        type: 'temperature',
        temperatureC: 76,
        durationMinutes: 10,
      },
    ],

    fermentationSteps: [
      {
        id: 'seed-ipa-ferm-1',
        name: 'Primary Fermentation',
        type: 'primary',
        durationDays: 10,
        temperatureC: 18,
      },
      {
        id: 'seed-ipa-ferm-2',
        name: 'Cold Crash',
        type: 'cold-crash',
        durationDays: 2,
        temperatureC: 2,
      },
    ],

    waterChemistry: {
      sourceProfile: { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 },
      saltAdditions: {
        gypsum_g: 9.5,
        cacl2_g: 2.0,
        epsom_g: 3.0,
      },
      sourceProfileName: 'RO / Distilled',
      targetStyleName: 'Hoppy / IPA',
    },

    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

/** Look up a seed recipe by its deterministic ID. */
export function findSeedRecipe(id: string): Recipe | undefined {
  return SEED_RECIPES.find((r) => r.id === id);
}
