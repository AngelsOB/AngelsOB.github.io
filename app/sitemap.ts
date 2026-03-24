import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // regenerate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'
  const { adminDb } = await import('@/config/firebase-admin')

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/browse`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/calculators`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/learn`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
  ]

  // Learn / docs pages
  const learnArticles = ['getting-started', 'ibu', 'gravity', 'water-chemistry', 'mash-ph', 'mash-temperature', 'yeast-starters', 'hop-flavor']
  const learnCalculators = ['abv-calculator', 'dilution-calculator', 'boil-off-calculator', 'carbonation-calculator', 'hydrometer-calculator']
  const learnRoutes: MetadataRoute.Sitemap = [
    ...learnArticles.map((slug) => ({
      url: `${BASE_URL}/learn/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    })),
    ...learnCalculators.map((slug) => ({
      url: `${BASE_URL}/learn/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]

  // Seed recipes (static, known IDs)
  const seedRecipeIds = ['seed-american-ipa', 'seed-saison', 'seed-irish-stout']
  const seedRoutes: MetadataRoute.Sitemap = seedRecipeIds.map((id) => ({
    url: `${BASE_URL}/r/seed/${id}`,
    lastModified: new Date('2025-01-01'),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Published community recipes
  let recipeRoutes: MetadataRoute.Sitemap = []
  try {
    const snapshot = await adminDb.collection('publicRecipeIndex').get()
    recipeRoutes = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        url: `${BASE_URL}/r/${data.shareSlug}`,
        lastModified: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }
    })
  } catch {
    // If admin SDK is unavailable (e.g. during build), skip dynamic recipes
  }

  return [...staticRoutes, ...learnRoutes, ...seedRoutes, ...recipeRoutes]
}
