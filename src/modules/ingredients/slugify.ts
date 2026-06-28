// Deterministic slug helpers for ingredient reference URLs.
//
// NOTE: this is intentionally NOT `generateShareSlug` (src/modules/sharing/
// slugUtils.ts) — that appends a random 4-char suffix for unguessable recipe
// share links. Reference pages need STABLE, deterministic URLs that survive
// rebuilds, so we slug the name alone and disambiguate collisions explicitly.

// Combining diacritical marks (U+0300–U+036F): the tail left behind after
// NFKD decomposition splits "ü" into "u" + a combining mark.
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * URL-safe slug from a free-text name. Lowercases, strips diacritics
 * ("Hüll Melon" → "hull-melon"), drops anything that isn't a-z/0-9, and
 * collapses whitespace to single hyphens. Pure + deterministic: the same
 * name always yields the same slug.
 */
export function slugify(value: string): string {
  return (value || "")
    .normalize("NFKD") // split accented letters into base + combining mark
    .replace(COMBINING_MARKS, "") // …then drop the combining marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface SlugIndexOptions<T> {
  /** The text the slug is derived from (e.g. the ingredient name). */
  baseName: (item: T) => string;
  /**
   * Optional disambiguator appended on the FIRST collision, before any
   * numeric fallback. For hops this is the origin code, so a duplicate
   * "Cascade" grown in NZ becomes `cascade-nz` rather than `cascade-2`.
   */
  disambiguator?: (item: T) => string | undefined;
}

export interface SlugIndex<T> {
  /** item → its unique slug (keyed by object identity). */
  slugOf: Map<T, string>;
  /** slug → the item that owns it. */
  bySlug: Map<string, T>;
}

/**
 * Assigns every item a unique, stable slug. Items are processed in array
 * order, so the FIRST item to claim a base slug keeps it; later collisions
 * fall back to `{base}-{disambiguator}` and then `{base}-{n}`. Deterministic
 * for a fixed input order — the same dataset always produces the same slugs.
 */
export function buildSlugIndex<T>(
  items: T[],
  options: SlugIndexOptions<T>
): SlugIndex<T> {
  const slugOf = new Map<T, string>();
  const bySlug = new Map<string, T>();

  for (const item of items) {
    const base = slugify(options.baseName(item)) || "item";
    let slug = base;

    if (bySlug.has(slug)) {
      // First collision — try the disambiguator (e.g. origin → "cascade-nz").
      const dis = options.disambiguator?.(item);
      const disSlug = dis ? slugify(dis) : "";
      const prefix = disSlug ? `${base}-${disSlug}` : base;
      slug = prefix;
      // Still taken (or no disambiguator) — append an incrementing index.
      let n = 2;
      while (bySlug.has(slug)) {
        slug = `${prefix}-${n}`;
        n += 1;
      }
    }

    slugOf.set(item, slug);
    bySlug.set(slug, item);
  }

  return { slugOf, bySlug };
}
