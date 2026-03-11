import type { ReactNode } from 'react';

export type IngredientTone = 'fermentables' | 'hops' | 'yeast' | 'water';

interface IngredientCardProps {
  tone: IngredientTone;
  className?: string;
  children: ReactNode;
}

const TONE_BORDERS: Record<IngredientTone, string> = {
  fermentables: 'border-blue-500',
  hops: 'border-green-500',
  yeast: 'border-amber-500',
  water: 'border-cyan-500',
};

export function IngredientCard({
  tone,
  className = '',
  children,
}: IngredientCardProps) {
  return (
    <div
      className={`rounded-lg border border-[rgb(var(--border))] border-t-4 bg-[var(--card)] p-4 shadow-sm ${TONE_BORDERS[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
