import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { findSeedRecipe } from '@/data/seed-recipes'
import { RecipeCalculationService } from '@/modules/beta-builder/domain/services/RecipeCalculationService'
import BetaBuilderPage from '@/modules/beta-builder/presentation/components/BetaBuilderPage'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const recipe = findSeedRecipe(id)
  if (!recipe) return { title: 'Recipe Not Found' }

  const calc = new RecipeCalculationService().calculate(recipe)
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
    alternates: { canonical: `/r/seed/${id}` },
    openGraph: {
      title: `${recipe.name} — BeerApp`,
      description,
      type: 'article',
      siteName: 'BeerApp',
    },
  }
}

export default async function SeedRecipePage({ params }: PageProps) {
  const { id } = await params
  const recipe = findSeedRecipe(id)
  if (!recipe) return notFound()

  return <BetaBuilderPage sharedRecipe={recipe} sharedOwnerName="The Brewing.It Team" />
}
