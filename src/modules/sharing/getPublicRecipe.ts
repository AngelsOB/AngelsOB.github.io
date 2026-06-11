import { cache } from 'react'
import type { Recipe, RecipeCalculations } from '@/modules/recipe/models/Recipe'

export type PublicRecipeResult = {
  recipe: Recipe
  calc: RecipeCalculations
  ownerName: string
  ownerId: string
  ratingAvg: number
  ratingCount: number
}

export const getPublicRecipe = cache(async (slug: string): Promise<PublicRecipeResult | null> => {
  const { adminDb } = await import('@/config/firebase-admin')
  const { RecipeCalculationService } = await import(
    '@/modules/recipe/services/RecipeCalculationService'
  )

  const snapshot = await adminDb
    .collection('recipes')
    .where('shareSlug', '==', slug)
    .limit(1)
    .get()

  if (snapshot.empty) return null

  const doc = snapshot.docs[0]
  const data = doc.data()
  if (data.isPublic === false) return null

  // Get owner name from publicRecipeIndex
  const indexSnap = await adminDb
    .collection('publicRecipeIndex')
    .doc(doc.id)
    .get()
  const indexData = indexSnap.data()
  const ownerName = indexData?.ownerName || 'Anonymous Brewer'
  const ownerId = indexData?.ownerId || data.ownerId || ''
  const ratingSum = indexData?.ratingSum || 0
  const ratingCount = indexData?.ratingCount || 0
  const ratingAvg = ratingCount > 0 ? ratingSum / ratingCount : 0

  const recipe = { id: doc.id, ...data } as Recipe
  const calc = new RecipeCalculationService().calculate(recipe)

  return { recipe, calc, ownerName, ownerId, ratingAvg, ratingCount }
})

/**
 * Build schema.org/Recipe JSON-LD structured data for a public recipe.
 */
/**
 * Convert minutes to ISO 8601 duration (e.g. 90 → "PT1H30M").
 */
function toIsoDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0 && m > 0) return `PT${h}H${m}M`
  if (h > 0) return `PT${h}H`
  return `PT${m}M`
}

/**
 * Build schema.org/Recipe JSON-LD structured data for a public recipe.
 */
export function buildRecipeJsonLd(
  recipe: Recipe,
  calc: RecipeCalculations,
  ownerName: string,
  slug: string,
  ratingAvg?: number,
  ratingCount?: number,
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'

  // Build recipeInstructions from mash + fermentation steps
  const instructions: { '@type': string; name: string; text: string }[] = []

  if (recipe.mashSteps?.length) {
    for (const step of recipe.mashSteps) {
      instructions.push({
        '@type': 'HowToStep',
        name: `Mash: ${step.name}`,
        text: `${step.name} at ${step.temperatureC}°C for ${step.durationMinutes} minutes.`,
      })
    }
  }

  const boilTime = recipe.equipment?.boilTimeMin ?? 60
  const boilHops = (recipe.hops || []).filter((h) => h.type === 'boil')
  if (boilHops.length > 0) {
    const hopList = boilHops.map((h) => `${h.grams}g ${h.name} at ${h.timeMinutes} min`).join(', ')
    instructions.push({
      '@type': 'HowToStep',
      name: 'Boil',
      text: `Boil for ${boilTime} minutes. Hop additions: ${hopList}.`,
    })
  } else {
    instructions.push({
      '@type': 'HowToStep',
      name: 'Boil',
      text: `Boil for ${boilTime} minutes.`,
    })
  }

  if (recipe.fermentationSteps?.length) {
    for (const step of recipe.fermentationSteps) {
      const parts = [step.name || step.type]
      if (step.temperatureC) parts.push(`at ${step.temperatureC}°C`)
      if (step.durationDays) parts.push(`for ${step.durationDays} days`)
      instructions.push({
        '@type': 'HowToStep',
        name: `Fermentation: ${step.name || step.type}`,
        text: `${parts.join(' ')}.`,
      })
    }
  }

  // Calculate total times
  const mashMinutes = (recipe.mashSteps || []).reduce((sum, s) => sum + (s.durationMinutes || 0), 0)
  const fermentDays = (recipe.fermentationSteps || []).reduce((sum, s) => sum + (s.durationDays || 0), 0)
  const prepMinutes = mashMinutes // mash = prep
  const cookMinutes = boilTime // boil = cook
  const totalMinutes = prepMinutes + cookMinutes + fermentDays * 24 * 60

  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description:
      recipe.notes ||
      `${recipe.style || 'Homebrew'} beer recipe — ${calc.abv.toFixed(1)}% ABV, ${Math.round(calc.ibu)} IBU. Batch size: ${recipe.batchVolumeL}L.`,
    author: { '@type': 'Person', name: ownerName },
    datePublished: recipe.publishedAt,
    recipeCategory: 'Beverage',
    recipeCuisine: 'Beer',
    recipeYield: `${recipe.batchVolumeL} liters`,
    url: `${baseUrl}/r/${slug}`,

    ...(prepMinutes > 0 ? { prepTime: toIsoDuration(prepMinutes) } : {}),
    ...(cookMinutes > 0 ? { cookTime: toIsoDuration(cookMinutes) } : {}),
    ...(totalMinutes > 0 ? { totalTime: toIsoDuration(totalMinutes) } : {}),

    ...(recipe.labelUrl ? { image: recipe.labelUrl } : {}),

    recipeIngredient: [
      ...(recipe.fermentables || []).map((f) => `${f.weightKg} kg ${f.name}`),
      ...(recipe.hops || []).map(
        (h) => `${h.grams} g ${h.name} (${h.type}, ${h.timeMinutes ?? 0} min)`,
      ),
      ...(recipe.yeasts || []).map((y) => `${y.name} yeast`),
      ...(recipe.otherIngredients || []).map(
        (o) => `${o.amount} ${o.unit} ${o.name}`,
      ),
    ],

    ...(instructions.length > 0 ? { recipeInstructions: instructions } : {}),

    nutrition: {
      '@type': 'NutritionInformation',
      calories: `${Math.round(calc.calories)} cal per 355mL`,
    },

    ...(ratingCount && ratingCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: ratingAvg!.toFixed(1),
            ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),

    keywords: [recipe.style, 'homebrew', 'beer recipe', 'homebrewing', ...(recipe.tags || [])]
      .filter(Boolean)
      .join(', '),
  }
}
