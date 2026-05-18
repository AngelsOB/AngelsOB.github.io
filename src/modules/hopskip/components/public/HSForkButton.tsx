'use client';

import { hsTokens } from '../../tokens';
import HSButton from '../HSButton';
import { useForkRecipe } from './useForkRecipe';

interface Props {
  recipeId: string;
  recipeName: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function HSForkButton({ recipeId, recipeName, size = 'md' }: Props) {
  const { fork, isForking, isSignedIn, needsSignIn } = useForkRecipe({ recipeId, recipeName });

  if (!isSignedIn) {
    return (
      <HSButton variant="ghost" size={size} onClick={needsSignIn}>
        Sign in to save
      </HSButton>
    );
  }

  return (
    <HSButton
      variant="solid"
      color={hsTokens.hops}
      size={size}
      onClick={fork}
      disabled={isForking}
    >
      {isForking ? 'Forking…' : 'Fork to my recipes'}
    </HSButton>
  );
}
