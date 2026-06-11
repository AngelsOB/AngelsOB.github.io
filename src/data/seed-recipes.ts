/**
 * Bundled "style guide" seed recipes.
 *
 * These ship with the app so the browse page is never empty.
 * Each recipe uses a deterministic `seed-*` ID and `source: "official"`.
 * Users can fork them into their own collection.
 */

import type { Recipe } from '@/modules/recipe/models/Recipe';

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
        temperatureC: 65,
        durationMinutes: 60,
      },
      {
        id: 'seed-ipa-mash-2',
        name: 'Mash Out',
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
  // ── 25B  Saison ──────────────────────────────────────────────────────
  {
    id: 'seed-saison',
    name: 'Farmhouse Saison',
    style: 'Saison',
    notes:
      'A classic Belgian farmhouse ale — bone-dry, peppery, and refreshing. ' +
      'Simple Pilsner-forward grist with wheat for body and dextrose for a ' +
      'crisp finish. Noble hops stay in the background and let the yeast shine.',
    tags: ['saison', 'farmhouse', 'belgian', 'dry'],
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
        id: 'seed-saison-grain-1',
        name: 'Dingemans - Belgian Pilsner Malt',
        weightKg: 3.8,
        colorLovibond: 2,
        ppg: 37,
        efficiencyPercent: 75,
        originCode: 'BE',
      },
      {
        id: 'seed-saison-grain-2',
        name: 'Castle Malting - Château Vienna',
        weightKg: 0.4,
        colorLovibond: 3,
        ppg: 38,
        efficiencyPercent: 75,
        originCode: 'BE',
      },
      {
        id: 'seed-saison-grain-3',
        name: 'Briess - White Wheat Malt',
        weightKg: 0.4,
        colorLovibond: 3,
        ppg: 39.1,
        efficiencyPercent: 75,
        originCode: 'US',
      },
      {
        id: 'seed-saison-grain-4',
        name: 'Briess - Dextrose',
        weightKg: 0.25,
        colorLovibond: 1,
        ppg: 42,
        efficiencyPercent: 100,
        originCode: 'US',
        fermentability: 1.0,
      },
    ],

    hops: [
      // Bittering
      {
        id: 'seed-saison-hop-1',
        name: 'Styrian Goldings',
        alphaAcid: 4.5,
        grams: 30,
        type: 'boil',
        timeMinutes: 60,
        flavor: {
          citrus: 1, tropicalFruit: 0, stoneFruit: 0, berry: 0,
          floral: 3, grassy: 1, herbal: 2, spice: 2, resinPine: 0,
        },
      },
      // Flavor
      {
        id: 'seed-saison-hop-2',
        name: 'East Kent Goldings',
        alphaAcid: 5,
        grams: 20,
        type: 'boil',
        timeMinutes: 10,
        flavor: {
          citrus: 1, tropicalFruit: 0, stoneFruit: 1, berry: 0,
          floral: 3, grassy: 2, herbal: 2, spice: 2, resinPine: 0,
        },
      },
      // Aroma
      {
        id: 'seed-saison-hop-3',
        name: 'Saaz',
        alphaAcid: 3.5,
        grams: 15,
        type: 'whirlpool',
        whirlpoolTimeMinutes: 10,
        temperatureC: 80,
        flavor: {
          citrus: 1, tropicalFruit: 0, stoneFruit: 0, berry: 0,
          floral: 4, grassy: 2, herbal: 3, spice: 3, resinPine: 0,
        },
      },
    ],

    yeasts: [
      {
        id: 'seed-saison-yeast-1',
        name: 'LalBrew Belle Saison',
        attenuation: 0.85,
        laboratory: 'Lallemand',
      },
    ],

    otherIngredients: [],

    mashSteps: [
      {
        id: 'seed-saison-mash-1',
        name: 'Saccharification',
        temperatureC: 65,
        durationMinutes: 60,
      },
      {
        id: 'seed-saison-mash-2',
        name: 'Mash Out',
        temperatureC: 76,
        durationMinutes: 10,
      },
    ],

    fermentationSteps: [
      {
        id: 'seed-saison-ferm-1',
        name: 'Primary Fermentation',
        type: 'primary',
        durationDays: 7,
        temperatureC: 26,
        notes: 'Pitch at 20°C and allow free rise to 26°C over first 48 hours.',
      },
      {
        id: 'seed-saison-ferm-2',
        name: 'Conditioning',
        type: 'conditioning',
        durationDays: 5,
        temperatureC: 22,
      },
    ],

    waterChemistry: {
      sourceProfile: { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 },
      saltAdditions: {
        gypsum_g: 4.0,
        cacl2_g: 3.0,
        epsom_g: 1.5,
      },
      sourceProfileName: 'RO / Distilled',
      targetStyleName: 'Balanced / Belgian',
    },

    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  // ── 15B  Irish Stout ──────────────────────────────────────────────────
  {
    id: 'seed-irish-stout',
    name: 'Irish Stout',
    style: 'Irish Stout',
    notes:
      'A classic dry Irish stout in the Guinness tradition — jet black with a ' +
      'creamy tan head, roasty coffee and dark chocolate flavors, and a dry, ' +
      'quenching finish. Flaked barley provides the silky body and head retention. ' +
      'Restrained hopping lets the roasted barley take center stage.',
    tags: ['stout', 'irish', 'dry', 'roasty', 'session'],
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
        id: 'seed-stout-grain-1',
        name: 'Crisp Malting - Finest Maris Otter',
        weightKg: 2.9,
        colorLovibond: 2,
        ppg: 36.8,
        efficiencyPercent: 75,
        originCode: 'GB',
      },
      {
        id: 'seed-stout-grain-2',
        name: 'Flaked Barley',
        weightKg: 0.85,
        colorLovibond: 2,
        ppg: 32,
        efficiencyPercent: 75,
        originCode: 'GB',
      },
      {
        id: 'seed-stout-grain-3',
        name: 'Roasted Barley',
        weightKg: 0.45,
        colorLovibond: 550,
        ppg: 29,
        efficiencyPercent: 75,
        originCode: 'GB',
      },
    ],

    hops: [
      // Bittering
      {
        id: 'seed-stout-hop-1',
        name: 'East Kent Goldings',
        alphaAcid: 5,
        grams: 45,
        type: 'boil',
        timeMinutes: 60,
        flavor: {
          citrus: 1, tropicalFruit: 0, stoneFruit: 1, berry: 0,
          floral: 3, grassy: 2, herbal: 2, spice: 2, resinPine: 0,
        },
      },
      // Flavor
      {
        id: 'seed-stout-hop-2',
        name: 'East Kent Goldings',
        alphaAcid: 5,
        grams: 14,
        type: 'boil',
        timeMinutes: 15,
        flavor: {
          citrus: 1, tropicalFruit: 0, stoneFruit: 1, berry: 0,
          floral: 3, grassy: 2, herbal: 2, spice: 2, resinPine: 0,
        },
      },
    ],

    yeasts: [
      {
        id: 'seed-stout-yeast-1',
        name: '1084 Irish Ale',
        attenuation: 0.75,
        laboratory: 'Wyeast',
      },
    ],

    otherIngredients: [],

    mashSteps: [
      {
        id: 'seed-stout-mash-1',
        name: 'Saccharification',
        temperatureC: 67,
        durationMinutes: 60,
      },
      {
        id: 'seed-stout-mash-2',
        name: 'Mash Out',
        temperatureC: 76,
        durationMinutes: 10,
      },
    ],

    fermentationSteps: [
      {
        id: 'seed-stout-ferm-1',
        name: 'Primary Fermentation',
        type: 'primary',
        durationDays: 10,
        temperatureC: 18,
      },
      {
        id: 'seed-stout-ferm-2',
        name: 'Conditioning',
        type: 'conditioning',
        durationDays: 5,
        temperatureC: 16,
      },
    ],

    waterChemistry: {
      sourceProfile: { Ca: 0, Mg: 0, Na: 0, Cl: 0, SO4: 0, HCO3: 0 },
      saltAdditions: {
        gypsum_g: 3.0,
        cacl2_g: 4.5,
        epsom_g: 1.0,
      },
      sourceProfileName: 'RO / Distilled',
      targetStyleName: 'Balanced / Malty',
    },

    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

/** Seed recipe ID → public share slug */
export const SEED_SLUG_MAP: Record<string, string> = {
  'seed-american-ipa': 'west-coast-ipa',
  'seed-saison': 'farmhouse-saison',
  'seed-irish-stout': 'irish-stout',
};

/** Look up a seed recipe by its deterministic ID. */
export function findSeedRecipe(id: string): Recipe | undefined {
  return SEED_RECIPES.find((r) => r.id === id);
}
