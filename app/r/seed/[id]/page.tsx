'use client';

import { use } from 'react';
import { notFound } from 'next/navigation';
import { findSeedRecipe } from '@/data/seed-recipes';
import BetaBuilderPage from '@/modules/beta-builder/presentation/components/BetaBuilderPage';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SeedRecipePage({ params }: PageProps) {
  const { id } = use(params);
  const recipe = findSeedRecipe(id);

  if (!recipe) return notFound();

  return <BetaBuilderPage sharedRecipe={recipe} sharedOwnerName="The Brewing.It Team" />;
}
