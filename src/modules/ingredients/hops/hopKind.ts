// Hop instantiation of the ingredient reference module. PURE DATA + helpers —
// no React — so it's safe to import from the index route, the detail route, the
// metadata builder, and (Phase 3) the sitemap. The components that render this
// (HopDetailBody, the generic index/sidebar) live alongside but import from here.

import type { HopFlavorProfile, HopPreset } from "@/modules/recipe/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/recipe/models/Presets";
import { HOP_PRESETS, groupHops } from "@/modules/recipe/data/hopPresets";
import {
  findSimilarHops,
  hasHopDetails,
  formatAlphaRange,
  formatBetaRange,
} from "@/modules/builder/components/builder/hopDetails";
import { getCountryFlag, BREWING_ORIGINS } from "@/utils/flags";
import { hsTokens } from "@/modules/builder/tokens";

import { createCatalog } from "../catalog";
import { slugify } from "../slugify";
import type {
  IngredientFaqItem,
  IngredientGroup,
  IngredientMeta,
  IngredientRow,
  IngredientSection,
  IngredientSubFilter,
} from "../types";

const HOPS = HOP_PRESETS;

// ─── Catalog (the slug source of truth) ────────────────────────────────────
// Duplicate names disambiguate by origin (e.g. cascade / cascade-nz); the
// current dataset has none, but the rule is here so new data can't break URLs.
export const hopCatalog = createCatalog(HOPS, {
  baseName: (h) => h.name,
  disambiguator: (h) => h.originCode,
});

export const hopSlugs = hopCatalog.slugs;
export const getHop = (slug: string): HopPreset | undefined =>
  hopCatalog.bySlug(slug);
export const hopSlug = (h: HopPreset): string => hopCatalog.slugOf(h);
export const allHops = (): HopPreset[] => HOPS;

/** Whether a hop is rich enough to index: a real alpha range + a flavor vector
 *  we're not low-confidence about (a derived guess shouldn't present as fact).
 *  The ~handful that fail get `noindex` + stay out of the sitemap — keeping the
 *  indexed set uniformly strong protects the domain's quality signal. They're
 *  still crawlable (follow) and browsable. */
export const isHopIndexable = (h: HopPreset): boolean =>
  hasHopDetails(h) &&
  formatAlphaRange(h) != null &&
  h.flavorConfidence !== "low";

/** Indexable hops as {name, path} — feeds the index ItemList + the sitemap. */
export function indexableHopItems(): { name: string; path: string }[] {
  return HOPS.filter(isHopIndexable).map((h) => ({
    name: h.name,
    path: `/hops/${hopSlug(h)}`,
  }));
}

// ─── Flavour vocabulary ─────────────────────────────────────────────────────

const FLAVOR_LABEL: Record<keyof HopFlavorProfile, string> = {
  citrus: "citrus",
  tropicalFruit: "tropical fruit",
  stoneFruit: "stone fruit",
  berry: "berry",
  floral: "floral",
  grassy: "grassy",
  herbal: "herbal",
  spice: "spice",
  resinPine: "pine and resin",
};

// Per-axis hue, mirroring the builder's hop hover preview so the same hop reads
// the same colour everywhere.
const FLAVOR_COLOR: Record<keyof HopFlavorProfile, string> = {
  citrus: "#facc15",
  tropicalFruit: "#fb923c",
  stoneFruit: "#f97316",
  berry: "#a855f7",
  floral: "#f472b6",
  grassy: "#84cc16",
  herbal: "#22c55e",
  spice: "#ef4444",
  resinPine: "#16a34a",
};

function rankedAxes(flavor: HopFlavorProfile) {
  return HOP_FLAVOR_KEYS.map((k) => ({ key: k, value: flavor[k] ?? 0 }))
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value);
}

// Flavor-match thresholds on the 0–5 axis scale, used by the graded flavor
// filter on the index: when a flavor is selected it must be "present" (≥1) for a
// hop to qualify, and at least one selected flavor must be "prominent" (≥3) — so
// a multi-flavor query never returns a hop that's missing one of the picks.
const FLAVOR_PRESENT = 1;
const FLAVOR_PROMINENT = 3;

export function dominantAxis(
  flavor: HopFlavorProfile
): keyof HopFlavorProfile | null {
  return rankedAxes(flavor)[0]?.key ?? null;
}

/** Dominant-flavour hue for a hop's card dot / radar, or hop green if blank. */
export function hopAccent(h: HopPreset): string {
  const dom = h.flavor ? dominantAxis(h.flavor) : null;
  return dom ? FLAVOR_COLOR[dom] : hsTokens.hops;
}

/** Short flavour label for a hop ("Tropical fruit"), or null if blank. */
export function hopDominantLabel(h: HopPreset): string | null {
  const dom = h.flavor ? dominantAxis(h.flavor) : null;
  return dom ? capitalize(FLAVOR_LABEL[dom]) : null;
}

/** One-line derived description ("Citrus-forward, with pine and resin and floral."). */
export function hopFlavorSummary(h: HopPreset): string {
  if (!h.flavor) return "";
  const top = rankedAxes(h.flavor)
    .slice(0, 3)
    .map((a) => FLAVOR_LABEL[a.key]);
  if (top.length === 0) return "A restrained, low-intensity aroma profile.";
  if (top.length === 1) return `${capitalize(top[0])}-forward.`;
  const [first, ...rest] = top;
  return `${capitalize(first)}-forward, with ${joinAnd(rest)}.`;
}

/** Ordered axis breakdown for the crawlable flavour list on the detail page. */
export function hopFlavorBreakdown(
  h: HopPreset
): { key: keyof HopFlavorProfile; label: string; value: number; color: string }[] {
  if (!h.flavor) return [];
  return rankedAxes(h.flavor).map((a) => ({
    key: a.key,
    label: capitalize(FLAVOR_LABEL[a.key]),
    value: a.value,
    color: FLAVOR_COLOR[a.key],
  }));
}

export const originName = (code: string | undefined): string | null =>
  code ? (BREWING_ORIGINS[code] ?? code) : null;

/**
 * One-line derived verdict comparing two hops — the axis each one leads on plus
 * a bittering-punch note. Pure + data-derived (no authored prose), so it's safe
 * for the compare tool. Returns "" if either lacks a flavor vector.
 */
export function hopCompareSummary(a: HopPreset, b: HopPreset): string {
  if (!a.flavor || !b.flavor) return "";

  let aAxis: keyof HopFlavorProfile | null = null;
  let bAxis: keyof HopFlavorProfile | null = null;
  let aLead = 0.5;
  let bLead = 0.5;
  for (const k of HOP_FLAVOR_KEYS) {
    const diff = (a.flavor[k] ?? 0) - (b.flavor[k] ?? 0);
    if (diff > aLead) {
      aLead = diff;
      aAxis = k;
    }
    if (-diff > bLead) {
      bLead = -diff;
      bAxis = k;
    }
  }

  const parts: string[] = [];
  if (aAxis && bAxis) {
    parts.push(
      `${a.name} leans more ${FLAVOR_LABEL[aAxis]}, while ${b.name} brings more ${FLAVOR_LABEL[bAxis]}.`
    );
  } else if (aAxis) {
    parts.push(`${a.name} is the more ${FLAVOR_LABEL[aAxis]}-forward of the two.`);
  } else if (bAxis) {
    parts.push(`${b.name} is the more ${FLAVOR_LABEL[bAxis]}-forward of the two.`);
  } else {
    parts.push(`${a.name} and ${b.name} share a similar flavor footprint.`);
  }

  const aa = a.alphaAcidPercent;
  const ba = b.alphaAcidPercent;
  if (aa != null && ba != null && Math.abs(aa - ba) >= 2) {
    const hi = aa > ba ? a : b;
    const lo = aa > ba ? b : a;
    parts.push(
      `${hi.name} packs more bittering punch (${hi.alphaAcidPercent?.toFixed(
        1
      )}% vs ${lo.alphaAcidPercent?.toFixed(1)}% alpha).`
    );
  }

  return parts.join(" ");
}

// ─── Index rows + groups ────────────────────────────────────────────────────

export function hopRows(): IngredientRow[] {
  return HOPS.map((h) => {
    const group = h.category || "Other";
    const alpha = formatAlphaRange(h);
    const beta = formatBetaRange(h);
    const summary = hopFlavorSummary(h);
    // The card shows the key numbers (alpha / beta); the dwell panel adds the rest.
    const stats = [];
    if (alpha) stats.push({ label: "Alpha", value: alpha });
    if (beta) stats.push({ label: "Beta", value: beta });
    return {
      slug: hopSlug(h),
      name: h.name,
      group,
      groupSlug: slugify(group),
      accent: hopAccent(h),
      badge: h.originCode ? getCountryFlag(h.originCode) : undefined,
      badgeLabel: h.originCode,
      stats,
      chart: h.flavor
        ? HOP_FLAVOR_KEYS.map((k) => h.flavor![k] ?? 0)
        : undefined,
      // Per-axis flavor intensities (0–5) — feeds the graded flavor filter.
      subWeights: h.flavor ? { ...h.flavor } : undefined,
      keywords:
        `${h.name} ${group} ${h.originCode ?? ""} ${originName(h.originCode) ?? ""} ${summary}`
          .toLowerCase()
          .trim(),
    };
  });
}

// A small ordered palette so the category chips/sidebar read as distinct
// buckets. Cycles if there are ever more categories than colours.
const GROUP_PALETTE = [
  hsTokens.hops,
  hsTokens.malt,
  hsTokens.water,
  hsTokens.yeast,
  hsTokens.roast,
  hsTokens.honey,
];

export function hopGroups(): IngredientGroup[] {
  return groupHops(HOPS).map((g, i) => ({
    label: g.label,
    slug: slugify(g.label),
    accent: GROUP_PALETTE[i % GROUP_PALETTE.length],
    count: g.items.length,
  }));
}

/** The flavor filter (Citrus / Tropical fruit / …) for the index's second chip
 *  row — in radar-axis order, each chip counting the hops that carry that axis
 *  prominently (≥3), so its count matches what a single-flavor pick returns. */
export function hopFlavorFilter(): IngredientSubFilter {
  const counts = new Map<string, number>();
  for (const h of HOPS) {
    if (!h.flavor) continue;
    for (const k of HOP_FLAVOR_KEYS) {
      if ((h.flavor[k] ?? 0) >= FLAVOR_PROMINENT) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  const options = HOP_FLAVOR_KEYS.filter((k) => counts.has(k)).map((k) => ({
    value: k,
    label: capitalize(FLAVOR_LABEL[k]),
    count: counts.get(k)!,
    accent: FLAVOR_COLOR[k],
  }));
  // Graded: every selected flavor must be present and at least one prominent, so
  // (e.g.) Floral + Spice + Stone fruit never surfaces a hop with no stone fruit.
  return {
    label: "Flavor",
    options,
    graded: { presentMin: FLAVOR_PRESENT, prominentMin: FLAVOR_PROMINENT },
  };
}

/** Categories with their hops, for the accordion sidebar (nav + compare-add).
 *  Each hop carries its dominant-flavor color for the row swatch. */
export function hopSidebarCategories(): {
  label: string;
  accent: string;
  hops: { slug: string; name: string; accent: string }[];
}[] {
  return groupHops(HOPS).map((g, i) => ({
    label: g.label,
    accent: GROUP_PALETTE[i % GROUP_PALETTE.length],
    hops: g.items.map((h) => ({
      slug: hopSlug(h),
      name: h.name,
      accent: hopAccent(h),
    })),
  }));
}

// ─── Templated metadata + FAQ ───────────────────────────────────────────────

export function hopMeta(h: HopPreset): IngredientMeta {
  const alpha = formatAlphaRange(h);
  const origin = originName(h.originCode);
  const summary = hopFlavorSummary(h);
  const similar = findSimilarHops(h, HOPS, 3).map((s) => s.hop.name);

  const description = [
    `${h.name} is ${origin ? `a ${origin} ` : "a "}hop` +
      (alpha ? ` averaging ${alpha} alpha acid.` : "."),
    summary,
    similar.length ? `Similar hops: ${similar.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    slug: hopSlug(h),
    title: `${h.name} Hops — Flavor, Alpha Acid & Substitutes`,
    description,
    keywords: [
      `${h.name} hops`,
      `${h.name} hop`,
      `${h.name} alpha acid`,
      `${h.name} substitute`,
      `${h.name} hop flavor`,
      `${h.name} aroma`,
    ],
  };
}

/**
 * A short, high-intent FAQ. Each question maps to a real search and each answer
 * is one factual clause — no padding. The substitute question is the headline:
 * it's the highest-volume long-tail and is always answerable from the data.
 */
export function hopFaq(h: HopPreset): IngredientFaqItem[] {
  const out: IngredientFaqItem[] = [];

  const similar = findSimilarHops(h, HOPS, 3).map((s) => s.hop.name);
  if (similar.length) {
    out.push({
      q: `What can I substitute for ${h.name}?`,
      a: `${joinAnd(similar)} — the closest by flavor and alpha acid.`,
    });
  }

  const summary = hopFlavorSummary(h);
  if (summary && h.flavor) {
    out.push({ q: `What does ${h.name} taste like?`, a: summary });
  }

  const alpha = formatAlphaRange(h);
  if (alpha) {
    out.push({ q: `What is ${h.name}'s alpha acid?`, a: alpha });
  }

  return out;
}

// ─── Section branding ───────────────────────────────────────────────────────

export const HOP_SECTION: IngredientSection = {
  basePath: "hops",
  label: "Hops",
  // Kicker + blurb intentionally empty — the index masthead is just the title;
  // the descriptive/SEO copy lives at the bottom of the page instead.
  kicker: "",
  titleWord: "Hop",
  titleRest: "Database",
  blurb: "",
};

// ─── Small string helpers ───────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
