/**
 * Ingredient fuzzy matching for imports (BeerXML, JSON, etc.).
 *
 * Generic distance is unsafe for ingredients: "Citra" and "Citra Cryo" are
 * one token apart but completely different products. The rules below treat
 * product-form modifiers (Cryo, Lupomax, T-90, Flaked, Extract, …) and lab
 * catalog codes (WLP001, US-05, 1056, …) as atomic — both sides must agree
 * before any candidate is eligible. Fuzzy similarity only decides between
 * remaining variants (typos, producer prefixes, hyphenation).
 */

import {
  HOP_PRESETS,
  YEAST_PRESETS,
  getGrainPresets,
  type HopPreset,
  type YeastPreset,
  type GrainPreset,
} from "./presets";

// ============================================================
// String primitives
// ============================================================

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(s: string): string[] {
  return normalize(s).split(/[\s-]+/).filter(Boolean);
}

/**
 * Forgiving substring match for ingredient pickers.
 *
 * Brewers type lab codes loosely — "us05", "us 05", "us-05" should all
 * find "SafAle US-05". The query matches if any of these hold:
 *   1) plain lowercase substring (fast path)
 *   2) alphanumeric-stripped substring — separators on either side stop mattering
 *   3) every whitespace-split word in the query appears in the haystack
 *
 * Pass any number of candidate fields (name, lab code, category, …); they're
 * joined into one haystack so a hit in any field counts. Empty query → true.
 */
export function fuzzyIncludes(
  query: string,
  ...candidates: Array<string | undefined | null>
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = candidates
    .filter((c): c is string => typeof c === "string" && c.length > 0)
    .join(" ")
    .toLowerCase();
  if (!haystack) return false;

  if (haystack.includes(q)) return true;

  const alphaQ = q.replace(/[^a-z0-9]/g, "");
  if (alphaQ) {
    const alphaH = haystack.replace(/[^a-z0-9]/g, "");
    if (alphaH.includes(alphaQ)) return true;
  }

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => haystack.includes(t))) return true;

  return false;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** 0-1 similarity combining token-set overlap (Jaccard) with normalized edit distance. */
export function nameSimilarity(query: string, candidate: string): number {
  const qNorm = normalize(query);
  const cNorm = normalize(candidate);
  if (!qNorm || !cNorm) return 0;
  if (qNorm === cNorm) return 1;

  const qTokens = new Set(tokenize(query));
  const cTokens = new Set(tokenize(candidate));
  let inter = 0;
  for (const t of qTokens) if (cTokens.has(t)) inter++;
  const union = new Set([...qTokens, ...cTokens]).size;
  const jaccard = union > 0 ? inter / union : 0;

  const maxLen = Math.max(qNorm.length, cNorm.length);
  const editSim = maxLen > 0 ? 1 - editDistance(qNorm, cNorm) / maxLen : 0;

  return 0.6 * jaccard + 0.4 * editSim;
}

// ============================================================
// Result contract
// ============================================================

export type MatchCandidate<T> = {
  preset: T;
  presetName: string;
  score: number;
};

export type MatchResult<T> = {
  imported: string;
  /** True when we'll silently apply `best` without prompting the user. */
  autoAccept: boolean;
  best: MatchCandidate<T> | null;
  /** Top N ranked candidates (best first), for the review UI. */
  candidates: MatchCandidate<T>[];
  /** Optional one-line context (e.g., "Variant: cryo" or "Lab code: WLP001"). */
  reason?: string;
};

const AUTO_ACCEPT_THRESHOLD = 0.92;
const REVIEW_FLOOR = 0.45;

// ============================================================
// Form-token discriminators (hops + grains)
// ============================================================

// Lupulin product forms — must match on both sides (or both absent).
const HOP_FORM_TOKENS = new Set([
  "cryo",
  "lupomax",
  "incognito",
  "spectrum",
  "hash",
  "t90",
  "t45",
  "powder",
  "extract",
  "co2",
  "bbc",
]);

// Fermentable forms that change the product category.
const GRAIN_FORM_TOKENS = new Set([
  "flaked",
  "torrified",
  "torrefied",
  "roasted",
  "smoked",
  "extract",
  "syrup",
  "dme",
  "lme",
]);

function extractFormTokens(tokens: string[], set: Set<string>): Set<string> {
  const found = new Set<string>();
  for (const t of tokens) {
    const flat = t.replace(/-/g, "");
    if (set.has(flat)) found.add(flat);
  }
  return found;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ============================================================
// Yeast lab codes
// ============================================================

// Catalog ids — atomic, never edit-distance these. WLP001 ≠ WLP002.
// White Labs WLPnnn, Omega OYL-nnn, Fermentis US-/S-/W-/F-, Brewing
// Yeast Project BRY-nnn, Lallemand short codes (e.g., A24, M27, etc.).
const LAB_CODE_RES: RegExp[] = [
  /\bWLP\d{2,4}\b/i,
  /\bOYL[- ]?\d{2,4}\b/i,
  /\bUS[- ]?\d{2,3}\b/i,
  /\bS[- ]?\d{2,3}\b/i,
  /\bW[- ]?\d{4}\b/i,
  /\bF[- ]?\d{2,3}\b/i,
  /\bBRY[- ]?\d{2,4}\b/i,
];
// Wyeast / Imperial 4-digit numeric ids — match standalone numbers
const WYEAST_NUM_RE = /(?:^|[^\w])(\d{4})(?=[^\w]|$)/;

function canonicalLabCode(s: string): string | null {
  for (const re of LAB_CODE_RES) {
    const m = s.match(re);
    if (m) return m[0].replace(/[- ]/g, "").toUpperCase();
  }
  const m2 = s.match(WYEAST_NUM_RE);
  if (m2) return m2[1];
  return null;
}

// ============================================================
// Fermentable color numbers (Crystal 60 vs Crystal 80)
// ============================================================

function extractColorNumber(s: string): number | null {
  const m = s.match(/(?:^|[^\d])(\d{2,3})\s?°?[Ll](?:\b|$)/);
  if (m) return parseInt(m[1], 10);
  const m2 = s.match(/\b(?:crystal|caramel|cara|c)[\s-]?(\d{2,3})\b/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

// ============================================================
// Hops
// ============================================================

export function matchHop(name: string): MatchResult<HopPreset> {
  const qTokens = tokenize(name);
  const qForms = extractFormTokens(qTokens, HOP_FORM_TOKENS);
  const reason = qForms.size > 0 ? `Variant: ${[...qForms].join(", ")}` : undefined;

  const scored: MatchCandidate<HopPreset>[] = [];
  for (const preset of HOP_PRESETS) {
    const cTokens = tokenize(preset.name);
    const cForms = extractFormTokens(cTokens, HOP_FORM_TOKENS);
    if (!setsEqual(qForms, cForms)) continue;
    const score = nameSimilarity(name, preset.name);
    if (score >= REVIEW_FLOOR) {
      scored.push({ preset, presetName: preset.name, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0] ?? null;
  const normalizedExact = !!top && normalize(top.presetName) === normalize(name);
  const autoAccept = !!top && (normalizedExact || top.score >= AUTO_ACCEPT_THRESHOLD);

  return {
    imported: name,
    autoAccept,
    best: top,
    candidates: scored.slice(0, 8),
    reason,
  };
}

// ============================================================
// Yeasts
// ============================================================

export function matchYeast(
  name: string,
  laboratory?: string
): MatchResult<YeastPreset> {
  const queryStr = laboratory ? `${laboratory} ${name}` : name;
  const qCode = canonicalLabCode(queryStr);

  const scored: MatchCandidate<YeastPreset>[] = [];
  for (const preset of YEAST_PRESETS) {
    const presetCodeStr = [
      preset.labProductId ?? "",
      preset.category ?? "",
      preset.producer ?? "",
      preset.name,
    ].join(" ");
    const cCode = preset.labProductId
      ? preset.labProductId.replace(/[- ]/g, "").toUpperCase()
      : canonicalLabCode(presetCodeStr);

    // Lab code gate: if the import has a code, only match presets with the same code.
    // (A query that names a specific catalog id should never be matched to a different one.)
    if (qCode) {
      if (!cCode) continue;
      if (cCode !== qCode) continue;
    }

    let score = nameSimilarity(name, preset.name);
    // Code agreement is a strong positive signal.
    if (qCode && cCode === qCode) score = Math.min(1, score + 0.35);

    if (score >= REVIEW_FLOOR) {
      scored.push({ preset, presetName: preset.name, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0] ?? null;
  const normalizedExact = !!top && normalize(top.presetName) === normalize(name);
  const autoAccept = !!top && (normalizedExact || top.score >= AUTO_ACCEPT_THRESHOLD);

  return {
    imported: name,
    autoAccept,
    best: top,
    candidates: scored.slice(0, 8),
    reason: qCode ? `Lab code: ${qCode}` : undefined,
  };
}

// ============================================================
// Fermentables
// ============================================================

export function matchGrain(name: string): MatchResult<GrainPreset> {
  const qTokens = tokenize(name);
  const qForms = extractFormTokens(qTokens, GRAIN_FORM_TOKENS);
  const qColor = extractColorNumber(name);
  const reasonParts: string[] = [];
  if (qForms.size > 0) reasonParts.push(`Form: ${[...qForms].join(", ")}`);
  if (qColor !== null) reasonParts.push(`~${qColor}°L`);

  const scored: MatchCandidate<GrainPreset>[] = [];
  for (const preset of getGrainPresets()) {
    const cTokens = tokenize(preset.name);
    const cForms = extractFormTokens(cTokens, GRAIN_FORM_TOKENS);
    if (!setsEqual(qForms, cForms)) continue;

    // Color is a strong discriminator on crystal/caramel malts.
    const cColor = extractColorNumber(preset.name);
    if (qColor !== null && cColor !== null && Math.abs(qColor - cColor) > 10) continue;

    let score = nameSimilarity(name, preset.name);
    // Color agreement is a strong positive signal: "Crystal 160L" should
    // prefer "Extra Dark Crystal 160L" over a color-less "Dark Crystal Malt"
    // that happens to share more name tokens.
    if (qColor !== null && cColor !== null && Math.abs(qColor - cColor) <= 5) {
      score = Math.min(1, score + 0.2);
    }
    if (score >= REVIEW_FLOOR) {
      scored.push({ preset, presetName: preset.name, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0] ?? null;
  const normalizedExact = !!top && normalize(top.presetName) === normalize(name);
  const autoAccept = !!top && (normalizedExact || top.score >= AUTO_ACCEPT_THRESHOLD);

  return {
    imported: name,
    autoAccept,
    best: top,
    candidates: scored.slice(0, 8),
    reason: reasonParts.length > 0 ? reasonParts.join(" · ") : undefined,
  };
}
