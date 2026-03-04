export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { adminDb, adminAuth } from '@/config/firebase-admin';
import { RecipeCalculationService } from '@/modules/beta-builder/domain/services/RecipeCalculationService';
import type { Recipe } from '@/modules/beta-builder/domain/models/Recipe';
import PublicRecipeView from '@/modules/sharing/PublicRecipeView';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getRecipeBySlug(slug: string) {
  try {
    // Query only by shareSlug (single-field index, auto-created).
    // Avoids needing a composite index on shareSlug + isPublic.
    const snapshot = await adminDb
      .collection('recipes')
      .where('shareSlug', '==', slug)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Check isPublic in application code instead of the query
    if (data.isPublic === false) return null;

    return { id: doc.id, ...data } as Recipe & { ownerId: string };
  } catch (err) {
    console.error('[r/slug] Failed to fetch recipe:', err);
    return null;
  }
}

async function getOwnerName(ownerId: string): Promise<string> {
  try {
    const userRecord = await adminAuth.getUser(ownerId);
    return userRecord.displayName || 'Anonymous Brewer';
  } catch {
    return 'Anonymous Brewer';
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let recipe: (Recipe & { ownerId: string }) | null = null;
  try {
    recipe = await getRecipeBySlug(slug);
  } catch {
    // Fallback if Firebase Admin is unavailable
  }

  if (!recipe) {
    return { title: 'Recipe Not Found' };
  }

  const calcService = new RecipeCalculationService();
  const calc = calcService.calculate(recipe);

  const description = [
    recipe.style,
    `${calc.abv.toFixed(1)}% ABV`,
    `${Math.round(calc.ibu)} IBU`,
    `OG ${calc.og.toFixed(3)}`,
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    title: recipe.name,
    description,
    openGraph: {
      title: `${recipe.name} — BeerApp`,
      description,
      type: 'article',
      siteName: 'BeerApp',
    },
    twitter: {
      card: 'summary',
      title: `${recipe.name} — BeerApp`,
      description,
    },
  };
}

export default async function PublicRecipePage({ params }: PageProps) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);

  if (!recipe) {
    notFound();
  }

  const calcService = new RecipeCalculationService();
  const calculations = calcService.calculate(recipe);
  const ownerName = await getOwnerName(recipe.ownerId);

  return (
    <div className="px-4 py-8">
      <PublicRecipeView
        recipe={recipe}
        calculations={calculations}
        ownerName={ownerName}
      />
    </div>
  );
}
