import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicRecipe, buildRecipeJsonLd } from '@/modules/sharing/getPublicRecipe'
import PublicRecipeClient from '@/modules/sharing/PublicRecipeClient'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params

  try {
    const result = await getPublicRecipe(slug)

    if (!result) return { title: 'Recipe Not Found' }

    const { recipe, calc, ownerName } = result
    const stats = [
      recipe.style,
      `${calc.abv.toFixed(1)}% ABV`,
      `${Math.round(calc.ibu)} IBU`,
      `OG ${calc.og.toFixed(3)}`,
    ]
      .filter(Boolean)
      .join(' | ')
    const description = recipe.notes
      ? `${recipe.notes.slice(0, 120).trim()}${recipe.notes.length > 120 ? '...' : ''} — ${stats}`
      : `${recipe.name} homebrew recipe by ${ownerName}. ${stats}. Full ingredients, mash schedule & brew-day instructions.`

    const images = recipe.labelUrl ? [{ url: recipe.labelUrl }] : []

    return {
      title: recipe.name,
      description,
      alternates: { canonical: `/r/${slug}` },
      openGraph: {
        title: `${recipe.name} | Brewing.It`,
        description,
        url: `/r/${slug}`,
        type: 'article',
        siteName: 'Brewing.It',
        ...(images.length > 0 ? { images } : {}),
      },
      twitter: {
        card: images.length > 0 ? 'summary_large_image' : 'summary',
        title: `${recipe.name} | Brewing.It`,
        description,
        ...(images.length > 0 ? { images: [recipe.labelUrl!] } : {}),
      },
    }
  } catch {
    // Admin SDK unavailable — fall through to generic metadata
    return { title: 'Shared Recipe' }
  }
}

export default async function PublicRecipePage({ params }: PageProps) {
  const { slug } = await params

  let result
  try {
    result = await getPublicRecipe(slug)
  } catch {
    // Admin SDK unavailable at build time — render client-only fallback
    return <PublicRecipeClient slug={slug} />
  }

  if (!result) return notFound()

  const { recipe, calc, ownerName, ownerId, ratingAvg, ratingCount } = result
  const jsonLd = buildRecipeJsonLd(recipe, calc, ownerName, slug, ratingAvg, ratingCount)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <PublicRecipeClient
        recipe={recipe}
        ownerName={ownerName}
        ownerId={ownerId}
        slug={slug}
        ratingAvg={ratingAvg}
        ratingCount={ratingCount}
      />
    </>
  )
}
