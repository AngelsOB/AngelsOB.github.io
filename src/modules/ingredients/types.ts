// Shared, kind-agnostic shapes for the ingredient reference module. Hops fill
// these in for Phase 1; yeast slots into the same shapes in Phase 2 without the
// generic index / shell / sidebar needing to change.

/** One labelled stat shown on a card or in a detail grid. */
export interface IngredientStat {
  label: string;
  value: string;
  /** Optional native-title explainer ("what does cohumulone mean?"). */
  hint?: string;
}

/**
 * A flat, serializable row the generic index grid renders. The route (server)
 * builds these from each kind's records; the client only searches + filters
 * over plain data, so no kind-specific component crosses the boundary.
 */
export interface IngredientRow {
  slug: string;
  name: string;
  /** Bucket this row is grouped + filtered by (hops: category). */
  group: string;
  groupSlug: string;
  /** Dot/accent colour for the card (hops: dominant-flavour hue). */
  accent: string;
  /** Small trailing badge — hops use the origin flag emoji. */
  badge?: string;
  badgeLabel?: string;
  /** Key stat chips shown on the card (hops: alpha/beta ranges). */
  stats: IngredientStat[];
  /**
   * Optional radar vector (values on a 0–max scale, axis order fixed by the
   * kind) for a mini chart preview on the card. Hops pass their 9-axis flavor
   * profile; omit for kinds without a radar-able vector.
   */
  chart?: number[];
  /** Lowercased blob the search box matches against. */
  keywords: string;
}

/** A category/filter bucket, for the index chips and the detail-page sidebar. */
export interface IngredientGroup {
  label: string;
  slug: string;
  accent: string;
  count: number;
}

/** Section-level branding + copy for the persistent masthead. */
export interface IngredientSection {
  /** Route base, no slashes — "hops" / "yeast". */
  basePath: string;
  /** Plural display label — "Hops" / "Yeast". */
  label: string;
  /** Script kicker above the masthead title. */
  kicker: string;
  /** The highlighted word in the masthead title (sits in the marker box). */
  titleWord: string;
  /** Plain text following the highlighted word. */
  titleRest: string;
  /** One-line masthead blurb. */
  blurb: string;
}

/** Generated metadata for a detail page (templated, never hand-authored). */
export interface IngredientMeta {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
}

/**
 * One generated Q/A. Kept to a small, high-intent set (substitutes, taste,
 * alpha) with terse factual answers — the questions match real searches and
 * the answers are always true. Plain-text so Phase 3 can wrap the same array
 * in FAQPage JSON-LD unchanged.
 */
export interface IngredientFaqItem {
  q: string;
  a: string;
}
