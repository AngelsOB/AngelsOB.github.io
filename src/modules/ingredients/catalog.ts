import { buildSlugIndex, type SlugIndexOptions } from "./slugify";

/**
 * A resolved ingredient dataset: the items plus the stable slug index that
 * maps each one to a unique URL segment. Built once per kind at module load
 * and shared by the index page, the detail route, and (Phase 3) the sitemap,
 * so slugs never drift between where they're generated and where they're read.
 */
export interface IngredientCatalog<T> {
  items: T[];
  /** Every slug, in dataset order — feeds `generateStaticParams`. */
  slugs: string[];
  /** The unique slug for an item (by object identity). */
  slugOf(item: T): string;
  /** The item that owns a slug, or undefined for an unknown slug. */
  bySlug(slug: string): T | undefined;
}

export function createCatalog<T>(
  items: T[],
  options: SlugIndexOptions<T>
): IngredientCatalog<T> {
  const { slugOf, bySlug } = buildSlugIndex(items, options);
  return {
    items,
    slugs: items.map((item) => slugOf.get(item)!),
    slugOf: (item) => slugOf.get(item)!,
    bySlug: (slug) => bySlug.get(slug),
  };
}
