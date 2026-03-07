'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const [justRated, setJustRated] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const handleRate = useCallback(
    async (value: number) => {
      if (!user) {
        try {
          await signInWithGoogle();
        } catch {
          return;
        }
        return;
      }

      if (isSubmitting) return;
      setIsSubmitting(true);

      setJustRated(value);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setJustRated(null), 400);

      try {
        const wasNew = userRating === null;
        const oldValue = userRating ?? 0;

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
        className="flex items-end"
        style={{ gap: '2px' }}
        onMouseLeave={() => setHoveredStar(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeValue;
          const isBouncing = justRated !== null && star <= justRated;

          // Progressive scale: stars build up to the hovered one
          // e.g. hovering star 5: star1=0.7, star2=0.8, star3=0.95, star4=1.1, star5=1.3
          let hoverScale = 1;
          if (hoveredStar !== null && star <= hoveredStar) {
            const distance = hoveredStar - star; // 0 = hovered, 1 = one before, etc
            hoverScale = 1.3 - distance * 0.15;
            hoverScale = Math.max(0.7, hoverScale);
          }

          return (
            <button
              key={star}
              type="button"
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoveredStar(star)}
              disabled={isSubmitting}
              className="rating-star-btn p-[3px] disabled:opacity-50"
              style={{ outline: 'none', background: 'none', border: 'none' }}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill={isFilled ? 'var(--brew-accent-500)' : 'none'}
                stroke={isFilled ? 'var(--brew-accent-600)' : 'var(--brew-accent-300)'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transition: isBouncing
                    ? 'none'
                    : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), fill 0.15s ease, stroke 0.15s ease',
                  transform: isBouncing
                    ? undefined
                    : hoveredStar !== null && star <= hoveredStar
                    ? `scale(${hoverScale})`
                    : 'scale(1)',
                  animation: isBouncing
                    ? `rating-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${(star - 1) * 40}ms both`
                    : 'none',
                }}
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          );
        })}
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
      <style>{`
        @keyframes rating-pop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.4); }
          65%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        .rating-star-btn:active svg {
          transform: scale(0.8) !important;
          transition: transform 0.06s ease !important;
        }
      `}</style>
    </div>
  );
}
