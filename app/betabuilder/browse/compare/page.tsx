import { Suspense } from 'react';
import type { Metadata } from 'next';
// Quarantined classic route — see HOPSKIP_MIGRATION_PRD.md §1.3 + Phase 5 deletion.
// eslint-disable-next-line no-restricted-imports
import CompareRecipesPage from '@/modules/compare/CompareRecipesPage';

export const metadata: Metadata = {
  title: 'Compare Recipes | Brewing.It',
  alternates: { canonical: '/browse/compare' },
  description:
    'Compare multiple homebrew recipes side-by-side. Analyze grain bills, hop usage, water chemistry, mash schedules, and more to find your mean brew.',
  openGraph: {
    title: 'Compare Recipes | Brewing.It',
    description:
      'Compare multiple homebrew recipes side-by-side. Analyze grain bills, hop usage, water chemistry, mash schedules, and more to find your mean brew.',
  },
  twitter: {
    card: 'summary',
    title: 'Compare Recipes | Brewing.It',
    description:
      'Compare multiple homebrew recipes side-by-side. Analyze grain bills, hop usage, water chemistry, mash schedules, and more to find your mean brew.',
  },
};

export default function ComparePage() {
  return (
    <Suspense>
      <CompareRecipesPage />
    </Suspense>
  );
}
