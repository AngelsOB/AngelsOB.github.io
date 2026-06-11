import type { MetadataRoute } from 'next'

// ISR — regenerate at most hourly. (force-dynamic would override revalidate.)
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'
  const { adminDb } = await import('@/config/firebase-admin')

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL },
    { url: `${BASE_URL}/browse` },
    { url: `${BASE_URL}/calculators` },
    { url: `${BASE_URL}/learn` },
    { url: `${BASE_URL}/privacy` },
    { url: `${BASE_URL}/terms` },
    { url: `${BASE_URL}/credits` },
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

  // Published recipes (includes seed recipes now that they're in Firestore),
  // plus a profile page per brewer with at least one public recipe.
  let recipeRoutes: MetadataRoute.Sitemap = []
  let profileRoutes: MetadataRoute.Sitemap = []
  try {
    const snapshot = await adminDb.collection('publicRecipeIndex').get()

    recipeRoutes = snapshot.docs.map((doc) => {
      const d = doc.data()
      const publishedAt = typeof d.publishedAt === 'string' ? d.publishedAt : undefined
      return {
        url: `${BASE_URL}/r/${d.shareSlug}`,
        ...(publishedAt ? { lastModified: publishedAt } : {}),
      }
    })

    const ownerIds = new Set<string>()
    for (const doc of snapshot.docs) {
      const ownerId = doc.data().ownerId
      if (typeof ownerId === 'string' && ownerId) ownerIds.add(ownerId)
    }
    profileRoutes = [...ownerIds].map((ownerId) => ({
      url: `${BASE_URL}/u/${ownerId}`,
    }))
  } catch {
    // Admin SDK unavailable during build — skip dynamic routes
  }

  return [...staticRoutes, ...learnRoutes, ...recipeRoutes, ...profileRoutes]
}
