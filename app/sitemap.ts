import type { MetadataRoute } from 'next'

import { allLearnRoutes } from '@/modules/learn/docsConfig'
import { calculatorSlugs } from '@/modules/calculators/calculatorsMeta'
import { indexableHopItems } from '@/modules/ingredients/hops/hopKind'
import { indexableYeastItems } from '@/modules/ingredients/yeast/yeastKind'

// ISR — regenerate at most hourly. (force-dynamic would override revalidate.)
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://brewing.it.com'
  const { adminDb } = await import('@/config/firebase-admin')

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL },
    { url: `${BASE_URL}/browse` },
    { url: `${BASE_URL}/calculators` },
    { url: `${BASE_URL}/hops` },
    { url: `${BASE_URL}/yeast` },
    { url: `${BASE_URL}/yeast/substitution-chart` },
    { url: `${BASE_URL}/learn` },
    { url: `${BASE_URL}/privacy` },
    { url: `${BASE_URL}/terms` },
    { url: `${BASE_URL}/credits` },
  ]

  // Each calculator's own tool-first page (registry-driven).
  const calculatorRoutes: MetadataRoute.Sitemap = calculatorSlugs.map((slug) => ({
    url: `${BASE_URL}/calculators/${slug}`,
  }))

  // Hop reference pages — only the index-worthy ones (thin hops + the compare
  // tool are noindexed and stay out).
  const hopRoutes: MetadataRoute.Sitemap = indexableHopItems().map((it) => ({
    url: `${BASE_URL}${it.path}`,
  }))

  // Yeast reference pages — only the index-worthy ones (strains missing the
  // core attenuation/temp/floc block are noindexed and stay out).
  const yeastRoutes: MetadataRoute.Sitemap = indexableYeastItems().map((it) => ({
    url: `${BASE_URL}${it.path}`,
  }))

  // Learn articles, sourced from docsConfig so the list never drifts.
  const learnRoutes: MetadataRoute.Sitemap = allLearnRoutes.map((href) => ({
    url: `${BASE_URL}${href}`,
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

  return [
    ...staticRoutes,
    ...calculatorRoutes,
    ...hopRoutes,
    ...yeastRoutes,
    ...learnRoutes,
    ...recipeRoutes,
    ...profileRoutes,
  ]
}
