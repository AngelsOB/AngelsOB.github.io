import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // regenerate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'
  const { adminDb } = await import('@/config/firebase-admin')

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL },
    { url: `${BASE_URL}/browse` },
    { url: `${BASE_URL}/calculators` },
    { url: `${BASE_URL}/learn` },
  ]

  const learnSlugs = [
    'getting-started', 'ibu', 'gravity', 'water-chemistry', 'mash-ph',
    'mash-temperature', 'yeast-starters', 'hop-flavor',
    'abv-calculator', 'dilution-calculator', 'boil-off-calculator',
    'carbonation-calculator', 'hydrometer-calculator', 'strike-temp-calculator',
  ]
  const learnRoutes: MetadataRoute.Sitemap = learnSlugs.map((slug) => ({
    url: `${BASE_URL}/learn/${slug}`,
  }))

  // Published recipes (includes seed recipes now that they're in Firestore)
  let recipeRoutes: MetadataRoute.Sitemap = []
  try {
    const snapshot = await adminDb.collection('publicRecipeIndex').get()
    recipeRoutes = snapshot.docs.map((doc) => ({
      url: `${BASE_URL}/r/${doc.data().shareSlug}`,
    }))
  } catch {
    // Admin SDK unavailable during build — skip dynamic recipes
  }

  return [...staticRoutes, ...learnRoutes, ...recipeRoutes]
}
