// Yeast instantiation of the ingredient reference module. PURE DATA + helpers —
// no React — so it's safe to import from the index route, the detail route, the
// metadata builder, and the sitemap. The components that render this
// (YeastDetailBody, the generic index/sidebar) live alongside but import here.
//
// Mirrors hops/hopKind.ts. The deliberate differences: yeast has NO flavor
// radar (so rows carry no `chart`), buckets by LAB rather than category, and
// leads its SEO surface with the cross-lab "{strain} equivalent" query — the
// unowned-SERP wedge (the web has no modern per-strain equivalence reference).

import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { YEAST_PRESETS, groupYeasts } from "@/modules/recipe/data/yeastPresets";
import {
  findStrainPeers,
  resolveSubstitutes,
  formatAttenuationRange,
  formatTempRange,
  formatStrainType,
  formatForm,
  type ResolvedYeastRef,
} from "@/modules/builder/components/builder/yeastDetails";
import { hsTokens } from "@/modules/builder/tokens";
import { getYeastLabFavicon } from "@/modules/recipe/utils/yeastLabIcons";

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

const YEASTS = YEAST_PRESETS;

// ─── Catalog (the slug source of truth) ────────────────────────────────────
// The current dataset has no exact duplicate names, but two strains could
// still slug-collide; the lab (category) disambiguates the first collision
// (e.g. a duplicate "Cali Ale" → `cali-ale` / `cali-ale-wyeast`) before any
// numeric fallback, so new data can't silently break URLs.
export const yeastCatalog = createCatalog(YEASTS, {
  baseName: (y) => y.name,
  disambiguator: (y) => y.category,
});

export const yeastSlugs = yeastCatalog.slugs;
export const getYeast = (slug: string): YeastPreset | undefined =>
  yeastCatalog.bySlug(slug);
export const yeastSlug = (y: YeastPreset): string => yeastCatalog.slugOf(y);
export const allYeasts = (): YeastPreset[] => YEASTS;

/** Whether a strain is rich enough to index: the core spec block a brewer
 *  actually looks up (attenuation + temperature + flocculation). The ~handful
 *  that fail get `noindex` + stay out of the sitemap — keeping the indexed set
 *  uniformly strong protects the domain's quality signal. They're still
 *  crawlable (follow) and browsable. Suited styles / substitutes are bonus
 *  sections, NOT part of the bar (only ~half the library carries them). */
export const isYeastIndexable = (y: YeastPreset): boolean =>
  hasAttenuation(y) &&
  (y.tempMinC != null || y.tempMaxC != null) &&
  y.flocculation != null;

/** Indexable strains as {name, path} — feeds the index ItemList + the sitemap. */
export function indexableYeastItems(): { name: string; path: string }[] {
  return YEASTS.filter(isYeastIndexable).map((y) => ({
    name: y.name,
    path: `/yeast/${yeastSlug(y)}`,
  }));
}

// ─── Lab palette ────────────────────────────────────────────────────────────
// A stable, distinct hue per laboratory so a strain's dot reads the same on its
// card, its filter chip, and its sidebar row. Loosely echoes each lab's brand
// colour; unknown labs cycle the shared accent palette so nothing is colourless.
const LAB_ACCENT: Record<string, string> = {
  "White Labs": "#2b6fb8", // blue
  Wyeast: "#d4452c", // red
  "Omega Yeast": "#e8852a", // orange
  "Escarpment Labs": "#4a8a3d", // green
  "Imperial Yeast": "#8a5cd1", // purple
  Fermentis: "#ee7755", // coral
  Lallemand: "#1f9e89", // teal
  "Mangrove Jack's": "#c4406f", // magenta
};

const FALLBACK_PALETTE = [
  hsTokens.yeast,
  hsTokens.malt,
  hsTokens.water,
  hsTokens.hops,
  hsTokens.roast,
  hsTokens.honey,
];

/** Accent hue for a strain (its lab's colour), or a cycled fallback. */
export function yeastAccent(y: YeastPreset): string {
  return labAccent(y.category);
}

function labAccent(lab: string | undefined, index = 0): string {
  if (lab && LAB_ACCENT[lab]) return LAB_ACCENT[lab];
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

// ─── Spec formatting + derived data ─────────────────────────────────────────

function hasAttenuation(y: YeastPreset): boolean {
  return (
    y.attenuationMin != null ||
    y.attenuationMax != null ||
    y.attenuationPercent != null
  );
}

/** Published attenuation as a display string ("73–80%"), or null. */
export function yeastAttenuation(y: YeastPreset): string | null {
  return formatAttenuationRange(
    y.attenuationMin,
    y.attenuationMax,
    y.attenuationPercent
  );
}

/** Recommended fermentation temperature as a display string ("16–22°C"), or null. */
export function yeastTemp(y: YeastPreset): string | null {
  return formatTempRange(y.tempMinC, y.tempMaxC);
}

/** Alcohol tolerance as a display string ("≈12% ABV"), or null. */
export function yeastTolerance(y: YeastPreset): string | null {
  return y.alcoholTolerance != null
    ? `≈${Math.round(y.alcoholTolerance)}% ABV`
    : null;
}

/** Type + form as one label ("Ale · Liquid"), or null. */
export function yeastTypeForm(y: YeastPreset): string | null {
  const parts = [formatStrainType(y.type), formatForm(y.form)].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// ─── Meter geometry (the compact spec sliders) ──────────────────────────────
// Each returns track positions for a small right-column meter on the detail
// page. Pure + tested so the visual and the numbers can't drift apart.

/**
 * Attenuation band as whole-percent track positions on a 0–100 rule (a
 * percentage domain reads honestly at a glance). `point` is the headline
 * number; `low`/`high` bound the published range (collapsed to the point when
 * no range exists). Null when the strain publishes no attenuation.
 */
export function yeastGauge(
  y: YeastPreset
): { low: number; high: number; point: number } | null {
  if (!hasAttenuation(y)) return null;
  const toPct = (v?: number | null) => (v != null ? v * 100 : null);
  const lo = toPct(y.attenuationMin);
  const hi = toPct(y.attenuationMax);
  const pt = toPct(y.attenuationPercent);
  const low = lo ?? pt ?? hi!;
  const high = hi ?? pt ?? lo!;
  const point = pt ?? (low + high) / 2;
  return {
    low: clampPct(Math.round(Math.min(low, high))),
    high: clampPct(Math.round(Math.max(low, high))),
    point: clampPct(Math.round(point)),
  };
}

/** Recommended fermentation temperature band in °C, low ≤ high, or null. The
 *  meter maps it onto a fixed 0–{@link TEMP_DOMAIN_C}°C rule (covers kveik). */
export const TEMP_DOMAIN_C = 45;
export function yeastTempBar(
  y: YeastPreset
): { minC: number; maxC: number } | null {
  if (y.tempMinC == null && y.tempMaxC == null) return null;
  const a = y.tempMinC ?? y.tempMaxC!;
  const b = y.tempMaxC ?? y.tempMinC!;
  return { minC: Math.min(a, b), maxC: Math.max(a, b) };
}

// Flocculation is ordinal, not numeric — map each grade to a marker position
// on a low→high rule (kept off the exact 0/1 edges so the marker never clips).
const FLOC_POSITION: Record<string, number> = {
  "very-low": 6,
  low: 22,
  "medium-low": 36,
  medium: 50,
  "medium-high": 64,
  high: 78,
  "very-high": 94,
};

/** Flocculation marker position (0–100 on a low→high rule), or null. */
export function flocPosition(y: YeastPreset): number | null {
  return y.flocculation != null ? (FLOC_POSITION[y.flocculation] ?? null) : null;
}

/** Alcohol-tolerance marker position on a 0–{@link ABV_DOMAIN}% ABV rule, or null. */
export const ABV_DOMAIN = 20;
export function tolerancePosition(y: YeastPreset): number | null {
  if (y.alcoholTolerance == null) return null;
  return clampPct((y.alcoholTolerance / ABV_DOMAIN) * 100);
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, v));
}

// ─── Cross-lab equivalence (the wedge) ──────────────────────────────────────

/** Other labs' versions of this same strain (shared `strainGroup`). */
export function yeastEquivalents(y: YeastPreset): YeastPreset[] {
  return findStrainPeers(y, YEASTS);
}

/** Short token used in the "WLP001 = 1056 = US-05" line — the lab catalog id
 *  if there is one, else the full strain name. */
export function equivToken(y: YeastPreset): string {
  return y.labProductId || y.name;
}

/**
 * The "A = B = C" equivalence string for the headline + meta, self first, or
 * null for a singleton. Deduped so two labs sharing a catalog id don't repeat.
 */
export function yeastEquivalenceLine(y: YeastPreset): string | null {
  const peers = yeastEquivalents(y);
  if (peers.length === 0) return null;
  const tokens: string[] = [];
  for (const s of [y, ...peers]) {
    const t = equivToken(s);
    if (!tokens.includes(t)) tokens.push(t);
  }
  return tokens.length >= 2 ? tokens.join(" = ") : null;
}

/** Resolved substitutes for this strain (best-first), empty when none. */
export function yeastSubstitutes(y: YeastPreset): ResolvedYeastRef[] {
  return resolveSubstitutes(y, YEASTS);
}

// ─── Index rows + groups ────────────────────────────────────────────────────

export function yeastRows(): IngredientRow[] {
  return YEASTS.map((y) => {
    const group = y.category || "Other";
    const atten = yeastAttenuation(y);
    const temp = yeastTemp(y);
    // The card shows the two numbers a brewer scans for (attenuation + temp);
    // the lab is the grouping/accent, and the dwell preview adds the rest.
    const stats = [];
    if (atten) stats.push({ label: "Atten", value: atten });
    if (temp) stats.push({ label: "Temp", value: temp });
    return {
      slug: yeastSlug(y),
      name: y.name,
      group,
      groupSlug: slugify(group),
      // Strain type (ale/lager/kveik/…) — the secondary filter dimension.
      subGroups: y.type ? [y.type] : undefined,
      accent: yeastAccent(y),
      // No origin flag for yeast; the lab is the grouping, surfaced in keywords.
      stats,
      // No radar vector — yeast has no flavor profile; the generic card
      // handles the absent `chart` by rendering name + stats only.
      keywords: [
        y.name,
        group,
        formatStrainType(y.type) ?? "",
        y.labProductId ?? "",
        y.strainGroupLabel ?? "",
        ...(y.styles ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .trim(),
    };
  });
}

// Strain-type secondary filter — ordered common → specialty, only types the
// library actually carries, each with its own chip colour.
const TYPE_ORDER = [
  "ale",
  "lager",
  "wheat",
  "kveik",
  "brett",
  "wild",
  "blend",
  "bacteria",
  "wine",
  "other",
] as const;
const TYPE_ACCENT: Record<string, string> = {
  ale: hsTokens.hops,
  lager: hsTokens.water,
  wheat: hsTokens.malt,
  kveik: hsTokens.roast,
  brett: "#8a5cd1",
  wild: "#1f9e89",
  blend: hsTokens.muted,
};

/** The strain-type filter (Ale / Lager / Kveik / …) for the index's second chip
 *  row — counted off the live library so empty types never show a dead chip. */
export function yeastTypeFilter(): IngredientSubFilter {
  const counts = new Map<string, number>();
  for (const y of YEASTS) {
    if (y.type) counts.set(y.type, (counts.get(y.type) ?? 0) + 1);
  }
  const options = TYPE_ORDER.filter((t) => counts.has(t)).map((t) => ({
    value: t,
    label: formatStrainType(t) ?? t,
    count: counts.get(t)!,
    accent: TYPE_ACCENT[t],
  }));
  return { label: "Type", options };
}

export function yeastGroups(): IngredientGroup[] {
  return groupYeasts(YEASTS).map((g, i) => ({
    label: g.label,
    slug: slugify(g.label),
    accent: labAccent(g.label, i),
    count: g.items.length,
  }));
}

/** Labs with their strains, for the accordion sidebar (nav-only — yeast has no
 *  compare tool). Each strain carries its lab colour for the row swatch. */
export function yeastSidebarCategories(): {
  label: string;
  accent: string;
  icon?: string;
  hops: { slug: string; name: string; accent: string }[];
}[] {
  return groupYeasts(YEASTS).map((g, i) => ({
    label: g.label,
    accent: labAccent(g.label, i),
    // The lab favicon shows on the category header (the colour dot is the
    // fallback for any lab without an icon asset, e.g. Mangrove Jack's).
    icon: getYeastLabFavicon(g.label) ?? undefined,
    // The generic SidebarCategory names this row list `hops` (kind-agnostic
    // shape, hop-flavoured field name) — yeast fills it with its strains.
    hops: g.items.map((y) => ({
      slug: yeastSlug(y),
      name: y.name,
      accent: yeastAccent(y),
    })),
  }));
}

// ─── Templated metadata + FAQ ───────────────────────────────────────────────

/** One short, data-derived lede ("Liquid Ale yeast from White Labs."). Curated
 *  `description` (only ever hand-written for a handful of marquee strains) wins
 *  when present — we never machine-generate prose across the long tail. */
export function yeastLede(y: YeastPreset): string {
  if (y.description && y.description.trim()) return y.description.trim();
  const kind = [formatForm(y.form), formatStrainType(y.type)]
    .filter(Boolean)
    .join(" ");
  const base = kind ? `${kind} yeast` : "Yeast strain";
  return y.category ? `${base} from ${y.category}.` : `${base}.`;
}

export function yeastMeta(y: YeastPreset): IngredientMeta {
  const atten = yeastAttenuation(y);
  const temp = yeastTemp(y);
  const equiv = yeastEquivalenceLine(y);
  const subs = yeastSubstitutes(y).map((s) => s.name);

  const description = [
    // Lead with the cross-lab equivalence — the highest-intent, lowest-
    // competition query — then the core spec, then substitutes.
    equiv ? `${y.name} is the same strain as ${equiv}.` : null,
    [
      atten ? `${atten} attenuation` : null,
      temp ? `${temp} fermentation` : null,
    ]
      .filter(Boolean)
      .join(", ")
      .replace(/^./, (c) => c.toUpperCase()) || null,
    subs.length ? `Substitutes: ${subs.slice(0, 3).join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join(". ")
    .replace(/\.\./g, ".")
    .replace(/,\s*$/, "");

  const keywords = [
    `${y.name}`,
    `${y.name} yeast`,
    `${y.name} substitute`,
    `${y.name} attenuation`,
    `${y.name} temperature`,
    `${y.name} equivalent`,
  ];
  // The lab id is the term people actually search the equivalence by.
  if (y.labProductId && !y.name.includes(y.labProductId)) {
    keywords.push(`${y.labProductId} equivalent`, `${y.labProductId} substitute`);
  }

  return {
    slug: yeastSlug(y),
    title: `${y.name} — Attenuation, Temperature & Equivalents`,
    description: description || yeastLede(y),
    keywords,
  };
}

/**
 * A short, high-intent FAQ. Each question maps to a real search and each answer
 * is one factual clause — no padding. The equivalence question is the headline:
 * "{strain} equivalent" is the highest-volume, least-owned long-tail and is
 * answerable straight from the curated strainGroup lineage.
 */
export function yeastFaq(y: YeastPreset): IngredientFaqItem[] {
  const out: IngredientFaqItem[] = [];

  const peers = yeastEquivalents(y);
  if (peers.length) {
    const names = peers.map((p) => p.name);
    out.push({
      q: `What is the ${y.name} equivalent?`,
      a: `${joinAnd(names)} — the same strain from ${
        peers.length === 1 ? "another lab" : "other labs"
      }${y.strainGroupLabel ? ` (${y.strainGroupLabel})` : ""}.`,
    });
  }

  const atten = yeastAttenuation(y);
  if (atten) {
    out.push({
      q: `What is ${y.name}'s attenuation?`,
      a: `${atten} apparent attenuation.`,
    });
  }

  const temp = yeastTemp(y);
  if (temp) {
    out.push({
      q: `What temperature should I ferment ${y.name} at?`,
      a: `${temp} is the recommended range.`,
    });
  }

  if (y.styles && y.styles.length) {
    out.push({
      q: `What beer styles is ${y.name} good for?`,
      a: `${joinAnd(y.styles)}.`,
    });
  }

  const subs = yeastSubstitutes(y).map((s) => s.name);
  if (subs.length) {
    out.push({
      q: `What can I substitute for ${y.name}?`,
      a: `${joinAnd(subs.slice(0, 4))}.`,
    });
  }

  return out;
}

// ─── Section branding ───────────────────────────────────────────────────────

export const YEAST_SECTION: IngredientSection = {
  basePath: "yeast",
  label: "Yeast",
  // Kicker + blurb intentionally empty — the index masthead is just the title;
  // the descriptive/SEO copy lives at the bottom of the page instead.
  kicker: "",
  titleWord: "Yeast",
  titleRest: "Database",
  blurb: "",
  accent: hsTokens.yeast,
};

// ─── Small string helpers ───────────────────────────────────────────────────

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
