import type { Metadata } from 'next';
import PublicRecipeClient from '@/modules/sharing/PublicRecipeClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Metadata is best-effort — works when Admin SDK is available,
  // falls back to generic title otherwise.
  try {
    const { adminDb } = await import('@/config/firebase-admin');
    const { RecipeCalculationService } = await import(
      '@/modules/beta-builder/domain/services/RecipeCalculationService'
    );
    const snapshot = await adminDb
      .collection('recipes')
      .where('shareSlug', '==', slug)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      if (data.isPublic !== false) {
        const calc = new RecipeCalculationService().calculate({
          id: snapshot.docs[0].id,
          ...data,
        } as Parameters<InstanceType<typeof RecipeCalculationService>['calculate']>[0]);

        const description = [
          data.style,
          `${calc.abv.toFixed(1)}% ABV`,
          `${Math.round(calc.ibu)} IBU`,
          `OG ${calc.og.toFixed(3)}`,
        ]
          .filter(Boolean)
          .join(' | ');

        return {
          title: data.name,
          description,
          openGraph: {
            title: `${data.name} — BeerApp`,
            description,
            type: 'article',
            siteName: 'BeerApp',
          },
          twitter: {
            card: 'summary',
            title: `${data.name} — BeerApp`,
            description,
          },
        };
      }
    }
  } catch {
    // Admin SDK unavailable — fall through to generic metadata
  }

  return { title: 'Shared Recipe' };
}

export default async function PublicRecipePage({ params }: PageProps) {
  const { slug } = await params;
  return <PublicRecipeClient slug={slug} />;
}
