'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  getDocsFromCache,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Fetches label URLs from the top-rated public recipes.
 * Returns up to `count` unique label URLs sorted by rating average (desc).
 */
export function useTopRatedLabels(count = 5): string[] {
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      const q = query(
        collection(db, 'publicRecipeIndex'),
        orderBy('publishedAt', 'desc'),
      );

      const extract = (docs: { data: () => Record<string, unknown> }[]) => {
        const withLabels = docs
          .map((doc) => {
            const d = doc.data();
            return {
              labelUrl: (d.labelUrl as string) || '',
              ratingSum: (d.ratingSum as number) || 0,
              ratingCount: (d.ratingCount as number) || 0,
            };
          })
          .filter((r) => r.labelUrl)
          .map((r) => ({
            ...r,
            ratingAvg: r.ratingCount > 0 ? r.ratingSum / r.ratingCount : 0,
          }))
          .sort((a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount);

        return withLabels.slice(0, count).map((r) => r.labelUrl);
      };

      // Try cache first
      try {
        const cached = await getDocsFromCache(q);
        if (!cached.empty && !cancelled) {
          setLabels(extract(cached.docs));
        }
      } catch {
        /* cache miss */
      }

      // Always fetch fresh
      try {
        const snapshot = await getDocs(q);
        if (!cancelled) {
          setLabels(extract(snapshot.docs));
        }
      } catch (err) {
        console.warn('[useTopRatedLabels] Failed to fetch:', err);
      }
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [count]);

  return labels;
}
