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
  /** Bucket this row is grouped + filtered by (hops: category; yeast: lab). */
  group: string;
  groupSlug: string;
  /** Optional membership tags for a plain (OR) sub-filter — yeast: its strain
   *  type. A row matches when its tags include the selected option's value. */
  subGroups?: string[];
  /** Optional graded intensities per sub-filter value (hops: each flavor axis,
   *  0–5). A `graded` sub-filter requires every selected value to be present and
   *  at least one to be prominent, then ranks survivors prominence-first. */
  subWeights?: Record<string, number>;
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

/**
 * The index's optional second filter dimension (yeast: strain type; hops:
 * flavor).
 *
 * Without `graded` it's plain cumulative OR over `row.subGroups`: selections
 * union, you never hit an empty grid, dataset order is preserved (right for
 * one-value-per-row dimensions like strain type).
 *
 * With `graded` it reads `row.subWeights`: a row passes only when EVERY selected
 * value is at least `presentMin` (no selected flavor missing) AND at least one
 * is `prominentMin`+ (a real, not trace, match) — so selecting Floral + Spice +
 * Stone fruit never surfaces a hop with zero stone fruit. Survivors rank
 * prominence-first (most selected flavors at full strength lead).
 */
export interface IngredientSubFilter {
  label: string;
  options: { value: string; label: string; count: number; accent?: string }[];
  graded?: { presentMin: number; prominentMin: number };
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
  /** Marker-box + kicker hue for the masthead. Defaults to the hop green. */
  accent?: string;
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
