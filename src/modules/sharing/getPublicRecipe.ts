import { cache } from 'react'
import type { Recipe, RecipeCalculations } from '@/modules/beta-builder/domain/models/Recipe'

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
    '@/modules/beta-builder/domain/services/RecipeCalculationService'
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
export function buildRecipeJsonLd(
  recipe: Recipe,
  calc: RecipeCalculations,
  ownerName: string,
  slug: string,
  ratingAvg?: number,
  ratingCount?: number,
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'

  return {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.notes || `${recipe.style || 'Homebrew'} recipe`,
    author: { '@type': 'Person', name: ownerName },
    datePublished: recipe.publishedAt,
    recipeCategory: 'Beverage',
    recipeCuisine: 'Beer',
    recipeYield: `${recipe.batchVolumeL} liters`,
    url: `${baseUrl}/r/${slug}`,

    recipeIngredient: [
      ...(recipe.fermentables || []).map(
        (f) => `${f.weightKg} kg ${f.name}`,
      ),
      ...(recipe.hops || []).map(
        (h) => `${h.grams} g ${h.name} (${h.type}, ${h.timeMinutes ?? 0} min)`,
      ),
      ...(recipe.yeasts || []).map((y) => `${y.name} yeast`),
    ],

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

    keywords: [
      recipe.style,
      'homebrew',
      'beer recipe',
      ...(recipe.tags || []),
    ]
      .filter(Boolean)
      .join(', '),
  }
}
