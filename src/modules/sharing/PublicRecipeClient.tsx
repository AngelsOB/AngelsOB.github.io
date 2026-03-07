'use client'

import type { Recipe } from '@/modules/beta-builder/domain/models/Recipe'
import BetaBuilderPage from '@/modules/beta-builder/presentation/components/BetaBuilderPage'

interface PublicRecipeClientProps {
  recipe?: Recipe
  ownerName?: string
  ownerId?: string
  slug: string
  ratingAvg?: number
  ratingCount?: number
}

/**
 * Client component for public recipe pages.
 *
 * When recipe data is provided by the server component, renders immediately.
 * The `slug` prop is kept for URL context (e.g. share links).
 */
export default function PublicRecipeClient({
  recipe,
  ownerName = 'Anonymous Brewer',
  ownerId,
  slug: _slug,
  ratingAvg,
  ratingCount,
}: PublicRecipeClientProps) {
  if (!recipe) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg-strong)' }}>
          Recipe Not Found
        </h1>
        <p className="text-[var(--fg-muted)]">
          This recipe may have been unpublished or the link is incorrect.
        </p>
      </div>
    )
  }

  return (
    <BetaBuilderPage
      sharedRecipe={recipe}
      sharedOwnerName={ownerName}
      sharedOwnerId={ownerId}
      sharedRatingAvg={ratingAvg}
      sharedRatingCount={ratingCount}
    />
  )
}
