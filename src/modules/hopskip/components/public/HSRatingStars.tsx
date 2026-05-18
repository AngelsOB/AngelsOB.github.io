'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuthStore } from '@/modules/auth/authStore';
import { getUserRating, submitRating } from '@/modules/sharing/ratingService';
import { toast } from '@/stores/toastStore';

import { hsTokens } from '../../tokens';
import HSScriptNote from '../HSScriptNote';

interface Props {
  recipeId: string;
  ratingAvg?: number;
  ratingCount?: number;
}

const STAR_POLYGONS = [
  '16 3.6 19.8 12.4 29.4 13.2 21.7 19.4 24.6 28.6 16 23.1 7.6 28.9 10.5 19.5 2.7 13.4 12.4 12.6',
  '15.8 4.1 19.4 12.7 29 13.5 21.4 19.7 24.5 28.7 16 22.8 7.4 28.6 10.6 19.4 3.1 13.1 12.6 12.5',
  '16.2 3.8 19.6 12.6 29.2 13 21.5 19.6 24.4 28.5 15.9 23 7.5 28.7 10.4 19.6 2.9 13.3 12.5 12.7',
];
const STAR_ROTATIONS = [-4, 2, -1, 3, -2];

export default function HSRatingStars({ recipeId, ratingAvg = 0, ratingCount = 0 }: Props) {
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayCount, setDisplayCount] = useState(ratingCount);
  const [displayAvg, setDisplayAvg] = useState(ratingAvg);
  const [justRated, setJustRated] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!user) {
      setUserRating(null);
      return;
    }
    getUserRating(recipeId, user.uid)
      .then(setUserRating)
      .catch(() => {});
  }, [recipeId, user]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

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
    [
      user,
      signInWithGoogle,
      isSubmitting,
      userRating,
      recipeId,
      displayCount,
      displayAvg,
      ratingCount,
      ratingAvg,
    ],
  );

  const activeValue = hoveredStar ?? userRating ?? 0;

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{ display: 'inline-flex', gap: 3 }}
        onMouseLeave={() => setHoveredStar(null)}
      >
        {[1, 2, 3, 4, 5].map((star, idx) => {
          const points = STAR_POLYGONS[idx % STAR_POLYGONS.length];
          const rotation = STAR_ROTATIONS[idx % STAR_ROTATIONS.length];
          const isFilled = star <= activeValue;
          const isBouncing = justRated !== null && star <= justRated;

          let hoverScale = 1;
          if (hoveredStar !== null && star <= hoveredStar) {
            const distance = hoveredStar - star;
            hoverScale = Math.max(0.7, 1.3 - distance * 0.15);
          }

          return (
            <button
              key={star}
              type="button"
              onClick={() => handleRate(star)}
              onMouseEnter={() => setHoveredStar(star)}
              disabled={isSubmitting}
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
              className="hs-rating-star"
              style={{
                background: 'none',
                border: 'none',
                outline: 'none',
                padding: 2,
                cursor: isSubmitting ? 'wait' : 'pointer',
                opacity: isSubmitting ? 0.6 : 1,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 32 32"
                aria-hidden="true"
                style={{
                  overflow: 'visible',
                  transformOrigin: 'center',
                  transition: isBouncing
                    ? 'none'
                    : 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  transform: isBouncing
                    ? undefined
                    : `rotate(${rotation}deg) scale(${
                        hoveredStar !== null && star <= hoveredStar ? hoverScale : 1
                      })`,
                  animation: isBouncing
                    ? `hs-rating-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) ${
                        (star - 1) * 40
                      }ms both`
                    : 'none',
                }}
              >
                <polygon
                  points={points}
                  fill={isFilled ? hsTokens.honey : 'none'}
                  stroke={hsTokens.ink}
                  strokeWidth={1.7}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
        {displayCount > 0 ? (
          <>
            <span
              style={{
                fontFamily: hsTokens.script,
                fontSize: 16,
                fontWeight: 500,
                color: hsTokens.ink,
                lineHeight: 1,
              }}
            >
              {displayAvg.toFixed(1)}
            </span>
            <span
              style={{
                fontFamily: hsTokens.body,
                fontSize: 12,
                color: hsTokens.muted,
              }}
            >
              ({displayCount})
            </span>
          </>
        ) : (
          <HSScriptNote color={hsTokens.water} size={14} rotate={-2}>
            {user ? 'be the first ✦' : 'sign in to rate ✦'}
          </HSScriptNote>
        )}
      </div>
      <style>{`
        @keyframes hs-rating-pop {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.4); }
          65%  { transform: scale(0.92); }
          100% { transform: scale(1); }
        }
        .hs-rating-star:active svg {
          transform: scale(0.85) !important;
          transition: transform 0.06s ease !important;
        }
      `}</style>
    </div>
  );
}
