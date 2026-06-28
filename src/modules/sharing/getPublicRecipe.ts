import { cache } from 'react'
import type { Recipe, RecipeCalculations } from '@/modules/recipe/models/Recipe'
import { normalizeRecipe } from '@/modules/recipe/models/normalizeRecipe'

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

  const recipe = normalizeRecipe({ id: doc.id, ...data } as Recipe)
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

    // Recipe rich results REQUIRE an image. Fall back to the per-recipe OG
    // card (generated for every recipe at /r/[slug]/opengraph-image) when the
    // brewer hasn't uploaded a label, so the field is never missing.
    image: recipe.labelUrl || `${baseUrl}/r/${slug}/opengraph-image`,

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

/**
 * Render a public recipe as a portable Markdown document — the payload behind
 * the "Copy as Markdown" action on the share page. Pure + deterministic so the
 * same string can be both displayed and copied.
 */
export function buildRecipeMarkdown(
  recipe: Recipe,
  calc: RecipeCalculations,
  ownerName: string,
  slug: string,
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'
  const stats = [
    recipe.style,
    `${calc.abv.toFixed(1)}% ABV`,
    `${Math.round(calc.ibu)} IBU`,
    `OG ${calc.og.toFixed(3)}`,
    `FG ${calc.fg.toFixed(3)}`,
    `${Math.round(calc.srm)} SRM`,
    recipe.batchVolumeL ? `${recipe.batchVolumeL} L batch` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const lines: string[] = [`# ${recipe.name}`]
  if (recipe.subtitle) lines.push(`*${recipe.subtitle}*`)
  lines.push('', `_${stats}_`)
  if (ownerName) lines.push(`By ${ownerName}`)

  const section = (title: string, rows: (string | null)[], ordered = false) => {
    const clean = rows.filter(Boolean) as string[]
    if (!clean.length) return
    lines.push('', `## ${title}`, '')
    clean.forEach((r, i) => lines.push(ordered ? `${i + 1}. ${r}` : `- ${r}`))
  }

  section('Vitals', [
    `OG ${calc.og.toFixed(3)}`,
    `FG ${calc.fg.toFixed(3)}`,
    `ABV ${calc.abv.toFixed(1)}%`,
    `IBU ${Math.round(calc.ibu)}`,
    `Color ${Math.round(calc.srm)} SRM`,
    calc.estimatedMashPh != null ? `Est. mash pH ${calc.estimatedMashPh.toFixed(2)}` : null,
    `${Math.round(calc.calories)} cal / 355 mL`,
    `${calc.carbsG.toFixed(1)} g carbs / 355 mL`,
  ])
  section(
    'Fermentables',
    (recipe.fermentables || []).map(
      (f) => `${f.weightKg} kg — ${f.name}${typeof f.colorLovibond === 'number' ? ` (${f.colorLovibond} °L)` : ''}`,
    ),
  )
  section(
    'Hops',
    (recipe.hops || []).map((h) => {
      const bits = [
        typeof h.alphaAcid === 'number' ? `${h.alphaAcid}% AA` : null,
        h.type,
        typeof h.timeMinutes === 'number' ? `${h.timeMinutes} min` : null,
      ].filter(Boolean)
      return `${h.grams} g — ${h.name}${bits.length ? ` (${bits.join(', ')})` : ''}`
    }),
  )
  section('Yeast', (recipe.yeasts || []).map((y) => y.name))
  section(
    'Other ingredients',
    (recipe.otherIngredients || []).map((o) => `${o.amount} ${o.unit} — ${o.name}`),
  )

  const wc = recipe.waterChemistry
  if (wc) {
    const sp = wc.sourceProfile
    const sa = wc.saltAdditions || {}
    const salts = [
      sa.gypsum_g ? `Gypsum ${sa.gypsum_g} g` : null,
      sa.cacl2_g ? `CaCl₂ ${sa.cacl2_g} g` : null,
      sa.epsom_g ? `Epsom ${sa.epsom_g} g` : null,
      sa.nacl_g ? `Table salt ${sa.nacl_g} g` : null,
      sa.nahco3_g ? `Baking soda ${sa.nahco3_g} g` : null,
    ].filter(Boolean)
    section('Water', [
      sp
        ? `Source${wc.sourceProfileName ? ` (${wc.sourceProfileName})` : ''}: Ca ${sp.Ca}, Mg ${sp.Mg}, Na ${sp.Na}, Cl ${sp.Cl}, SO₄ ${sp.SO4}, HCO₃ ${sp.HCO3} ppm`
        : null,
      salts.length ? `Salts: ${salts.join(', ')}` : null,
      wc.targetStyleName ? `Target: ${wc.targetStyleName}` : null,
    ])
  }

  section(
    'Mash schedule',
    (recipe.mashSteps || []).map((s) => `${s.name} — ${s.temperatureC}°C for ${s.durationMinutes} min`),
    true,
  )
  section(
    'Fermentation',
    (recipe.fermentationSteps || []).map(
      (s) =>
        `${s.name || s.type}${typeof s.temperatureC === 'number' ? ` — ${s.temperatureC}°C` : ''}${typeof s.durationDays === 'number' ? ` for ${s.durationDays} days` : ''}`,
    ),
    true,
  )

  const eq = recipe.equipment
  if (eq) {
    section('Process', [
      `Efficiency: ${eq.brewhouseEfficiencyPercent}%`,
      `Boil: ${eq.boilTimeMin} min`,
      `Boil-off: ${eq.boilOffRateLPerHour} L/hr`,
      `Mash thickness: ${eq.mashThicknessLPerKg} L/kg`,
      `Batch volume: ${recipe.batchVolumeL} L`,
    ])
  }

  const pk = recipe.packaging
  if (pk) {
    section('Packaging', [
      pk.methods?.length ? `Method: ${pk.methods.join(' + ')}` : null,
      typeof pk.targetCo2Volumes === 'number' ? `Target CO₂: ${pk.targetCo2Volumes} volumes` : null,
      pk.primingSugarType ? `Priming sugar: ${pk.primingSugarType}` : null,
      typeof pk.conditioningDays === 'number'
        ? `Conditioning: ${pk.conditioningDays} days${typeof pk.conditioningTempC === 'number' ? ` at ${pk.conditioningTempC}°C` : ''}`
        : null,
      typeof pk.servingTempC === 'number' ? `Serving temp: ${pk.servingTempC}°C` : null,
    ])
  }

  if (recipe.tags?.length) section('Tags', [recipe.tags.join(', ')])
  if (recipe.notes) lines.push('', '## Notes', '', recipe.notes)

  lines.push('', `Built with Brewing.It — ${baseUrl}/r/${slug}`)
  return lines.join('\n')
}
