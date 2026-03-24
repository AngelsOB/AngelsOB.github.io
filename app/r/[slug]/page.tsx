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

    const { recipe, calc } = result
    const description = [
      recipe.style,
      `${calc.abv.toFixed(1)}% ABV`,
      `${Math.round(calc.ibu)} IBU`,
      `OG ${calc.og.toFixed(3)}`,
    ]
      .filter(Boolean)
      .join(' | ')

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
      },
      twitter: {
        card: 'summary_large_image',
        title: `${recipe.name} | Brewing.It`,
        description,
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
