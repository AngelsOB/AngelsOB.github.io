'use client';

import type { Recipe } from '@/modules/beta-builder/domain/models/Recipe';

import HopSkipBuilder from '../HopSkipBuilder';

interface Props {
  recipe: Recipe;
  ownerName: string;
  ownerId: string;
  ratingAvg: number;
  ratingCount: number;
}

export default function HSPublicRecipeShell({
  recipe,
  ownerName,
  ownerId,
  ratingAvg,
  ratingCount,
}: Props) {
  return (
    <HopSkipBuilder
      sharedRecipe={recipe}
      sharedOwnerName={ownerName}
      sharedOwnerId={ownerId}
      sharedRatingAvg={ratingAvg}
      sharedRatingCount={ratingCount}
    />
  );
}
