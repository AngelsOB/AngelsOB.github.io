import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPublicRecipe, buildRecipeJsonLd } from '@/modules/sharing/getPublicRecipe'
import HSPublicRecipeShell from '@/modules/builder/components/public/HSPublicRecipeShell'
import HSCard from '@/modules/builder/components/HSCard'
import HSScriptNote from '@/modules/builder/components/HSScriptNote'
import { hsTokens } from '@/modules/builder/tokens'
import { breadcrumbJsonLd } from '@/utils/seo'

// ISR: cache rendered recipe pages for an hour. Recipes change on republish;
// displayed ratings may lag up to an hour, which is fine for a share page.
export const revalidate = 3600

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
    return { title: 'Shared Recipe' }
  }
}

export default async function PublicRecipePage({ params }: PageProps) {
  const { slug } = await params

  let result
  try {
    result = await getPublicRecipe(slug)
  } catch {
    return (
      <section
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '72px 24px',
          textAlign: 'center',
        }}
      >
        <HSScriptNote color={hsTokens.water} size={22}>
          blank page —
        </HSScriptNote>
        <HSCard shadow={2} padding={32} style={{ marginTop: 12 }}>
          <p
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.ink,
              margin: 0,
            }}
          >
            Recipe data is temporarily unavailable. Please try again.
          </p>
        </HSCard>
      </section>
    )
  }

  if (!result) return notFound()

  const { recipe, calc, ownerName, ownerId, ratingAvg, ratingCount } = result
  const jsonLd = [
    buildRecipeJsonLd(recipe, calc, ownerName, slug, ratingAvg, ratingCount),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Browse Recipes', path: '/browse' },
      { name: recipe.name, path: `/r/${slug}` },
    ]),
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <HSPublicRecipeShell
        recipe={recipe}
        ownerName={ownerName}
        ownerId={ownerId}
        ratingAvg={ratingAvg}
        ratingCount={ratingCount}
      />
    </>
  )
}
