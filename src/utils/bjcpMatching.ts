/**
 * BJCP style matcher for imports.
 *
 * Output: a canonical "21A. American IPA"-form string (and the bare code),
 * which is what HopSkipBuilder / BJCPStyleRail / StyleRangeComparison parse
 * via `style.split('.')[0]` to feed `getBjcpStyleSpec(code)`. If we don't
 * land on a canonical code, target ranges silently fail to render — that's
 * the bug this matcher exists to prevent.
 *
 * Resolution order:
 *   1. Explicit code hint (BeerXML CATEGORY_NUMBER + STYLE_LETTER)
 *   2. Leading code embedded in the name ("21A American IPA", "21A. …", "21A")
 *   3. Exact-name match (case/punctuation-insensitive)
 *   4. Alias table (NEIPA → 21C, Imperial Stout → 20C, …)
 *   5. Tail-after-colon alias ("Specialty IPA: Black IPA" → 21B-Black IPA)
 *   6. Fuzzy fallback over canonical names
 */

import { flatBjcpStyles } from "./bjcp";
import {
  nameSimilarity,
  normalize,
  type MatchCandidate,
  type MatchResult,
} from "./ingredientMatching";

export type BjcpStyleHit = {
  code: string;
  name: string;
  canonical: string; // "21A. American IPA"
};

const STYLE_INDEX: Array<BjcpStyleHit & { normalizedName: string }> = flatBjcpStyles().map(
  (s) => ({
    code: s.code,
    name: s.name,
    canonical: `${s.code}. ${s.name}`,
    normalizedName: normalize(s.name),
  })
);

const CANONICAL_BY_CODE = new Map(STYLE_INDEX.map((s) => [s.code, s.canonical]));
const ENTRY_BY_CODE = new Map(STYLE_INDEX.map((s) => [s.code, s]));
const ENTRY_BY_NORM_NAME = new Map(STYLE_INDEX.map((s) => [s.normalizedName, s]));

// Common names brewers use that don't appear literally in BJCP.
const STYLE_ALIASES: Record<string, string> = {
  // Hazy / NEIPA family → 21C
  neipa: "21C",
  "new england ipa": "21C",
  "new england style ipa": "21C",
  "hazy ipa": "21C",
  "east coast ipa": "21C",
  "juicy ipa": "21C",
  "milkshake ipa": "21C",

  // West Coast IPA → 21A
  "west coast ipa": "21A",
  "wcipa": "21A",

  // Specialty IPA subs → 21B-…
  "black ipa": "21B-Black IPA",
  "cascadian dark ale": "21B-Black IPA",
  "belgian ipa": "21B-Belgian IPA",
  "red ipa": "21B-Red IPA",
  "white ipa": "21B-White IPA",
  "rye ipa": "21B-Rye IPA",
  "brown ipa": "21B-Brown IPA",
  "brut ipa": "21B-Brut IPA",

  // DIPA / Imperial families
  "imperial ipa": "22A",
  "double ipa": "22A",
  dipa: "22A",
  "triple ipa": "22A",
  tipa: "22A",

  "imperial stout": "20C",
  "russian imperial stout": "20C",
  ris: "20C",
  "rispa": "20C",

  // Stouts / Porters
  "milk stout": "16A",
  "sweet stout": "16A",
  "oatmeal stout": "16B",
  "irish stout": "15B",
  "dry stout": "15B",
  "foreign extra stout": "16D",
  "export stout": "16D",
  "american stout": "20B",
  porter: "20A",
  "american porter": "20A",
  "robust porter": "20A",
  "english porter": "13C",
  "brown porter": "13C",
  "baltic porter": "9C",

  // Wheat & related
  "american wheat": "1D",
  "american wheat beer": "1D",
  weissbier: "10A",
  hefeweizen: "10A",
  hefe: "10A",
  hefeweisse: "10A",
  dunkelweizen: "10B",
  "dunkles weissbier": "10B",
  weizenbock: "10C",

  // German/European lagers
  helles: "4A",
  "munich helles": "4A",
  oktoberfest: "6A",
  maerzen: "6A",
  "märzen": "6A",
  "vienna lager": "7A",
  altbier: "7B",
  kolsch: "5B",
  "kölsch": "5B",
  koelsch: "5B",
  schwarzbier: "8B",
  "munich dunkel": "8A",
  dunkel: "8A",
  rauchbier: "6B",
  bock: "6C",
  "dunkles bock": "6C",
  doppelbock: "9A",
  eisbock: "9B",
  maibock: "4C",
  "helles bock": "4C",

  // Pilsners
  pilsner: "5D",
  pils: "5D",
  pilsener: "5D",
  "german pils": "5D",
  "german pilsner": "5D",
  "italian pilsner": "5D",
  "czech pilsner": "3B",
  "czech pils": "3B",
  "bohemian pilsner": "3B",
  "new zealand pilsner": "X5",
  "nz pilsner": "X5",
  "nz pils": "X5",

  // American lagers
  "american lager": "1B",
  "mexican lager": "1B",
  "light lager": "1A",
  "american light lager": "1A",
  "cream ale": "1C",

  // Belgians
  witbier: "24A",
  wit: "24A",
  "belgian witbier": "24A",
  "belgian white": "24A",
  "belgian wit": "24A",
  saison: "25B",
  tripel: "26C",
  "belgian tripel": "26C",
  dubbel: "26B",
  "belgian dubbel": "26B",
  quad: "26D",
  quadrupel: "26D",
  "belgian quad": "26D",
  "belgian dark strong": "26D",
  "belgian dark strong ale": "26D",
  "belgian single": "26A",
  "belgian blonde": "25A",
  "belgian blond": "25A",
  "belgian golden strong": "25C",
  "biere de garde": "24C",
  "bière de garde": "24C",

  // American ales
  "amber ale": "19A",
  "american amber": "19A",
  "american amber ale": "19A",
  "red ale": "19A",
  "irish red": "15A",
  "irish red ale": "15A",
  "pale ale": "18B",
  "american pale ale": "18B",
  apa: "18B",
  "blonde ale": "18A",
  "american brown ale": "19C",
  "american brown": "19C",
  "california common": "19B",
  "steam beer": "19B",

  // British
  "english pale ale": "11B",
  "best bitter": "11B",
  bitter: "11A",
  "ordinary bitter": "11A",
  esb: "11C",
  "extra special bitter": "11C",
  "strong bitter": "11C",
  "british brown": "13B",
  "british brown ale": "13B",
  "english brown": "13B",
  "dark mild": "13A",
  mild: "13A",
  "wee heavy": "17C",
  "scotch ale": "17C",
  "scottish ale": "14B",
  "old ale": "17B",
  "english barleywine": "17D",
  barleywine: "22C",
  "american barleywine": "22C",
  wheatwine: "22D",
  "american strong ale": "22B",

  // Sour / mixed
  gose: "23G",
  "berliner weisse": "23A",
  "berliner": "23A",
  lambic: "23D",
  gueuze: "23E",
  "fruit lambic": "23F",
  "flanders red": "23B",
  "flanders red ale": "23B",
  "oud bruin": "23C",
  "flanders brown": "23C",
  "catharina sour": "28-Catharina Sour",
  "kettle sour": "28D",
  "brett beer": "28A",
  "wild ale": "28C",
  "mixed fermentation sour": "28B",
  "mixed-fermentation sour": "28B",

  // Misc
  "fruit beer": "29A",
  "fruit and spice beer": "29B",
  "smoked beer": "32A",
  "wood aged beer": "33A",
  "wood-aged beer": "33A",
};

const STYLE_AUTO_ACCEPT_THRESHOLD = 0.88;
const STYLE_REVIEW_FLOOR = 0.5;

export type BjcpMatchResult = MatchResult<BjcpStyleHit> & {
  /** When set, the matcher resolved to a definitive canonical code. */
  canonical?: string;
};

function decisive(entry: BjcpStyleHit, reason: string): BjcpMatchResult {
  return {
    imported: entry.canonical,
    autoAccept: true,
    best: { preset: entry, presetName: entry.name, score: 1 },
    candidates: [{ preset: entry, presetName: entry.name, score: 1 }],
    canonical: entry.canonical,
    reason,
  };
}

/** Try to parse a leading BJCP code like "21A", "21A.", "21A American IPA". */
function tryLeadingCode(input: string): string | null {
  const trimmed = input.trim();
  // 21A, 22B, 27A, …
  const m = trimmed.match(/^(\d{1,2}[A-Z])(?:[\s.\-:]|$)/);
  if (m && CANONICAL_BY_CODE.has(m[1])) return m[1];
  // Provisional: X5, X12, …
  const x = trimmed.match(/^(X\d+)(?:[\s.\-:]|$)/);
  if (x && CANONICAL_BY_CODE.has(x[1])) return x[1];
  // Bare numeric category number alone is too ambiguous (e.g. "21") — don't match.
  return null;
}

/** Build a BJCP code from BeerXML's separate CATEGORY_NUMBER + STYLE_LETTER fields. */
export function bjcpCodeFromParts(
  categoryNumber?: string,
  styleLetter?: string
): string | null {
  if (!categoryNumber) return null;
  const cat = categoryNumber.trim();
  const letter = (styleLetter ?? "").trim().toUpperCase();
  const code = `${cat}${letter}`;
  if (CANONICAL_BY_CODE.has(code)) return code;
  // Some exporters put "21" + "" and rely on NAME — let the name pass handle it.
  return null;
}

/**
 * Match an imported style name to a canonical BJCP entry.
 * `codeHint` is BeerXML's CATEGORY_NUMBER + STYLE_LETTER joined (e.g. "21A").
 */
export function matchBjcpStyle(
  rawName: string,
  codeHint?: string
): BjcpMatchResult {
  const input = (rawName ?? "").trim();

  // 1) Explicit code hint
  if (codeHint && CANONICAL_BY_CODE.has(codeHint)) {
    return decisive(ENTRY_BY_CODE.get(codeHint)!, "Matched by BeerXML category/letter");
  }

  if (!input) {
    return { imported: input, autoAccept: false, best: null, candidates: [] };
  }

  // 2) Leading code in the imported name
  const leadCode = tryLeadingCode(input);
  if (leadCode) {
    return decisive(ENTRY_BY_CODE.get(leadCode)!, "Matched by leading BJCP code");
  }

  // 3) Exact normalized name
  const norm = normalize(input);
  const exact = ENTRY_BY_NORM_NAME.get(norm);
  if (exact) return decisive(exact, "Matched by name");

  // 4) Alias table
  const aliasCode = STYLE_ALIASES[norm];
  if (aliasCode && ENTRY_BY_CODE.has(aliasCode)) {
    return decisive(ENTRY_BY_CODE.get(aliasCode)!, "Matched by alias");
  }

  // 5) Tail-after-colon alias ("Specialty IPA: Black IPA")
  const colonIdx = input.indexOf(":");
  if (colonIdx >= 0) {
    const tail = normalize(input.slice(colonIdx + 1));
    if (ENTRY_BY_NORM_NAME.has(tail)) {
      return decisive(ENTRY_BY_NORM_NAME.get(tail)!, "Matched by name (after colon)");
    }
    const tailAlias = STYLE_ALIASES[tail];
    if (tailAlias && ENTRY_BY_CODE.has(tailAlias)) {
      return decisive(ENTRY_BY_CODE.get(tailAlias)!, "Matched by alias (after colon)");
    }
  }

  // 6) Fuzzy fallback on canonical names
  const scored: MatchCandidate<BjcpStyleHit>[] = [];
  for (const entry of STYLE_INDEX) {
    const score = nameSimilarity(input, entry.name);
    if (score >= STYLE_REVIEW_FLOOR) {
      scored.push({
        preset: { code: entry.code, name: entry.name, canonical: entry.canonical },
        presetName: entry.name,
        score,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0] ?? null;
  const autoAccept = !!top && top.score >= STYLE_AUTO_ACCEPT_THRESHOLD;

  return {
    imported: input,
    autoAccept,
    best: top,
    candidates: scored.slice(0, 8),
    canonical: autoAccept && top ? top.preset.canonical : undefined,
  };
}
