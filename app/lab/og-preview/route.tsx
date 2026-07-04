import type { Recipe } from '@/modules/recipe/models/Recipe'
import type { RecipeCalculations } from '@/modules/recipe/models/Recipe'
import { renderRecipeOgImage } from '../../r/[slug]/ogCard'

/**
 * Dev-only preview harness for the recipe share card. Renders the exact
 * production card (`renderRecipeOgImage`) against a hand-built sample recipe, so
 * the OG image can be iterated on without Firebase or a real public slug — an
 * OG image is only ever "right" once you render it and look.
 *
 * Visit /lab/og-preview to see the PNG.
 */

// Sample: a hazy-ish West Coast IPA — citrus/tropical hops, caramel/biscuit malt.
const SAMPLE_RECIPE = {
  name: 'Midnight Harvest IPA',
  style: 'American IPA',
  batchVolumeL: 20,
  fermentables: [
    { name: 'Pale Ale Malt (2-row)', weightKg: 4.8, colorLovibond: 2 },
    { name: 'Munich Malt', weightKg: 0.5, colorLovibond: 9 },
    { name: 'Crystal 60', weightKg: 0.4, colorLovibond: 60 },
    { name: 'Chocolate Malt', weightKg: 0.08, colorLovibond: 350 },
    { name: 'Flaked Wheat', weightKg: 0.3, colorLovibond: 2 },
  ],
  hops: [
    {
      name: 'Citra', type: 'dry hop', grams: 60, timeMinutes: 0,
      flavor: { citrus: 4.6, tropicalFruit: 4.1, stoneFruit: 3.0, berry: 1.6, floral: 1.4, grassy: 0.8, herbal: 0.6, spice: 0.5, resinPine: 1.2 },
    },
    {
      name: 'Mosaic', type: 'whirlpool', grams: 40, timeMinutes: 20, temperatureC: 80,
      flavor: { citrus: 3.4, tropicalFruit: 4.4, stoneFruit: 3.6, berry: 3.0, floral: 2.0, grassy: 0.7, herbal: 0.9, spice: 0.6, resinPine: 2.1 },
    },
    {
      name: 'Simcoe', type: 'boil', grams: 20, timeMinutes: 10,
      flavor: { citrus: 2.6, tropicalFruit: 2.4, stoneFruit: 2.2, berry: 1.4, floral: 1.0, grassy: 1.2, herbal: 1.4, spice: 0.8, resinPine: 4.0 },
    },
  ],
} as unknown as Recipe

const SAMPLE_CALC = {
  og: 1.062, fg: 1.012, abv: 6.6, ibu: 55, srm: 7.4, calories: 205,
} as unknown as RecipeCalculations

export async function GET() {
  return renderRecipeOgImage(SAMPLE_RECIPE, SAMPLE_CALC, 'Sam Brewer')
}
