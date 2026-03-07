'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../auth/authStore';
import { getUserRating, submitRating } from './ratingService';
import { toast } from '../../stores/toastStore';

interface RatingStarsProps {
  recipeId: string;
  /** Pre-loaded aggregate from publicRecipeIndex */
  ratingAvg?: number;
  ratingCount?: number;
}

export default function RatingStars({
  recipeId,
  ratingAvg = 0,
  ratingCount = 0,
}: RatingStarsProps) {
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayCount, setDisplayCount] = useState(ratingCount);
  const [displayAvg, setDisplayAvg] = useState(ratingAvg);

  // Load user's existing rating
  useEffect(() => {
    if (!user) {
      setUserRating(null);
      return;
    }
    getUserRating(recipeId, user.uid)
      .then(setUserRating)
      .catch(() => {});
  }, [recipeId, user]);

  const handleRate = useCallback(
    async (value: number) => {
      if (!user) {
        try {
          await signInWithGoogle();
        } catch {
          return;
        }
        return; // After sign-in, useEffect will load state; user can click again
      }

      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        const wasNew = userRating === null;
        const oldValue = userRating ?? 0;

        // Optimistic update
        setUserRating(value);
        if (wasNew) {
          const newCount = displayCount + 1;
          setDisplayCount(newCount);
          setDisplayAvg((displayAvg * displayCount + value) / newCount);
        } else {
          const newSum = displayAvg * displayCount - oldValue + value;
          setDisplayAvg(newSum / displayCount);
        }

        await submitRating(recipeId, user.uid, value);
      } catch {
        // Revert optimistic update
        setUserRating(userRating);
        setDisplayCount(ratingCount);
        setDisplayAvg(ratingAvg);
        toast.error('Failed to save rating');
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, signInWithGoogle, isSubmitting, userRating, recipeId, displayCount, displayAvg, ratingCount, ratingAvg],
  );

  const activeValue = hoveredStar ?? userRating ?? 0;

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHoveredStar(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleRate(star)}
            onMouseEnter={() => setHoveredStar(star)}
            disabled={isSubmitting}
            className="p-0.5 transition-transform hover:scale-110 disabled:opacity-50"
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={star <= activeValue ? 'var(--brew-accent-500)' : 'none'}
              stroke={star <= activeValue ? 'var(--brew-accent-500)' : 'var(--brew-accent-300)'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
      <div className="text-sm text-[var(--fg-muted)]">
        {displayCount > 0 ? (
          <>
            <span className="font-medium" style={{ color: 'var(--brew-accent-700)' }}>
              {displayAvg.toFixed(1)}
            </span>
            <span className="ml-1">
              ({displayCount} {displayCount === 1 ? 'rating' : 'ratings'})
            </span>
          </>
        ) : (
          <span>{user ? 'Be the first to rate' : 'Sign in to rate'}</span>
        )}
      </div>
    </div>
  );
}
