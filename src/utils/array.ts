/**
 * Return a new array with duplicates removed, keeping the FIRST occurrence of
 * each key. Insertion order is preserved. Mirrors the Map-based de-dupe the
 * equipment repositories used inline.
 */
export function deduplicateBy<T, K>(items: T[], keyFn: (item: T) => K): T[] {
  const seen = new Map<K, T>();
  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}
