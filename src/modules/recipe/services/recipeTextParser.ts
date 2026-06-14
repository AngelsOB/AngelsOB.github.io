/**
 * Deterministic free-form recipe text parser.
 *
 * Turns pasted text (book recipes, forum posts, written notes) into a
 * ParsedRecipeDraft — raw ingredient rows plus vitals. Pure module: no
 * browser deps, no presets, no network. Name→preset matching happens later
 * in textRecipeImportService; this file only classifies lines and extracts
 * amounts/units/timings.
 *
 * The same ParsedRecipeDraft shape is produced by the AI cleanup endpoint
 * (app/api/parse-recipe), so everything downstream is parser-agnostic.
 */

import type { Hop } from '../models/Recipe';

export type ParsedFermentable = {
  rawName: string;
  weightKg?: number;
  /** Percentage-of-grist bills ("80% 2-Row") — weight derived later. */
  relativePct?: number;
};

export type ParsedHop = {
  rawName: string;
  grams?: number;
  type: Hop['type'];
  /** Boil/first-wort minutes, or whirlpool stand minutes. */
  timeMinutes?: number;
  dryHopDays?: number;
  alphaAcid?: number;
  /** Hot-side temperature for whirlpool/flameout additions (°C). Explicit if the
   *  text gives one, else defaulted by sub-usage (flameout hotter than whirlpool). */
  temperatureC?: number;
};

export type ParsedYeast = {
  rawName: string;
  laboratory?: string;
};

export type ParsedMashStep = {
  temperatureC: number;
  durationMinutes?: number;
};

export type ParsedRecipeDraft = {
  name?: string;
  style?: string;
  batchVolumeL?: number;
  boilTimeMin?: number;
  targetOg?: number;
  targetFg?: number;
  /** Stated brewhouse/mash efficiency ("72% efficiency"). */
  efficiencyPercent?: number;
  /** Mash rests from directions prose — supports step mashes. */
  mashSteps?: ParsedMashStep[];
  /** Primary fermentation temperature ("Ferment at 64°F"). */
  fermentTempC?: number;
  /** Primary duration ("2 weeks", "10 days"). */
  fermentDays?: number;
  fermentables: ParsedFermentable[];
  hops: ParsedHop[];
  yeasts: ParsedYeast[];
  /** Lines we couldn't classify — drives the AI-cleanup offer + manual fix. */
  unparsedLines: string[];
};

// ── Unit converters (inverse of the display converters elsewhere) ──────────

export const lbToKg = (lb: number): number => lb * 0.45359237;
export const ozToG = (oz: number): number => oz * 28.349523125;
export const galToL = (gal: number): number => gal * 3.785411784;
export const fToC = (f: number): number => ((f - 32) * 5) / 9;

const round = (n: number, decimals: number): number => {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
};

// ── Tokenizing helpers ─────────────────────────────────────────────────────

const VULGAR_FRACTIONS: Record<string, string> = {
  '½': '.5', '¼': '.25', '¾': '.75', '⅓': '.333', '⅔': '.667', '⅛': '.125',
};

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/**
 * "an hour" → "1 hour", "two weeks" → "2 weeks", "a pound of crystal" →
 * "1 pound of crystal". Scoped to number-word + unit-word pairs so names
 * like "Two Hearted" survive.
 */
function normalizeWordNumbers(line: string): string {
  let out = line.replace(/\bhalf\s+an?\s+hour\b/gi, '30 minutes');
  out = out.replace(/\ban?\s+(hour|minute|week|day|pound|gallon|liter|litre)\b/gi, '1 $1');
  out = out.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(hours?|hrs?|minutes?|mins?|days?|weeks?|pounds?|lbs?|ounces?|oz|gallons?|gal|liters?|litres?|grams?|kilograms?|kgs?)\b/gi,
    (_, w: string, unit: string) => `${WORD_NUMBERS[w.toLowerCase()]} ${unit}`,
  );
  return out;
}

/** "1½ lb" → "1.5 lb", "½ oz" → "0.5 oz" */
function normalizeVulgarFractions(line: string): string {
  return line.replace(/(\d)?\s*([½¼¾⅓⅔⅛])/g, (_, whole, frac) =>
    whole ? `${whole}${VULGAR_FRACTIONS[frac]}` : `0${VULGAR_FRACTIONS[frac]}`,
  );
}

/** ".6 oz" → "0.6 oz" — blogs love leading-dot decimals. */
function normalizeLeadingDotDecimals(line: string): string {
  return line.replace(/(^|[\s(\-–—:,])\.(\d)/g, '$10.$2');
}

// Cooking-style denominators only — keeps "Crystal 40 / 1 lb Munich" intact.
const FRACTION_DENOMS = new Set([2, 3, 4, 5, 8, 16]);

/** "1 1/2 lb" → "1.5 lb", "3/4 oz" → "0.75 oz" */
function normalizeAsciiFractions(line: string): string {
  return line.replace(/(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/g, (m, whole, num, den) => {
    const n = parseInt(num, 10);
    const d = parseInt(den, 10);
    if (!FRACTION_DENOMS.has(d) || n >= d) return m;
    const value = (whole ? parseInt(whole, 10) : 0) + n / d;
    return String(round(value, 3));
  });
}

/**
 * Forum one-liners separate ingredients with " / ". Split only when at least
 * two segments carry amounts, so names like "CaraPils / Dextrine" survive.
 */
function splitCompoundLine(line: string): string[] {
  const parts = line.split(/\s+\/\s+/);
  if (parts.length < 2) return [line];
  const withAmounts = parts.filter((p) => extractAmount(normalizeAsciiFractions(p)) !== null);
  return withAmounts.length >= 2 ? parts : [line];
}

type ParsedAmount =
  | { kind: 'mass'; grams: number; raw: string }
  | { kind: 'percent'; pct: number; raw: string };

const LB_RE = /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|#)\b\.?/i;
const OZ_RE = /(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b\.?/i;
const KG_RE = /(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kilograms?)\b\.?/i;
const G_RE = /(\d+(?:\.\d+)?)\s*(?:g|grams?)\b\.?/i;
const PCT_RE = /(\d+(?:\.\d+)?)\s*%/;

/**
 * Extracts the first mass (or percentage) amount from a line.
 * Handles compound imperial ("1 lb 8 oz"). Returns the matched raw substrings
 * so the caller can strip them out of the ingredient name.
 */
function extractAmount(line: string): ParsedAmount | null {
  const lb = line.match(LB_RE);
  if (lb) {
    let grams = lbToKg(parseFloat(lb[1])) * 1000;
    let raw = lb[0];
    // Compound "1 lb 8 oz" — only when the oz follows the lb token.
    const after = line.slice(line.indexOf(lb[0]) + lb[0].length);
    const oz = after.match(OZ_RE);
    if (oz && after.slice(0, after.indexOf(oz[0])).trim().length <= 1) {
      grams += ozToG(parseFloat(oz[1]));
      raw = `${raw}${after.slice(0, after.indexOf(oz[0]))}${oz[0]}`;
    }
    return { kind: 'mass', grams, raw };
  }
  const kg = line.match(KG_RE);
  if (kg) return { kind: 'mass', grams: parseFloat(kg[1]) * 1000, raw: kg[0] };
  const oz = line.match(OZ_RE);
  if (oz) return { kind: 'mass', grams: ozToG(parseFloat(oz[1])), raw: oz[0] };
  const g = line.match(G_RE);
  if (g) return { kind: 'mass', grams: parseFloat(g[1]), raw: g[0] };
  const pct = line.match(PCT_RE);
  if (pct) return { kind: 'percent', pct: parseFloat(pct[1]), raw: pct[0] };
  return null;
}

/**
 * Strips parenthetical unit duplicates — "0.75 oz. (21 g)" → "0.75 oz.",
 * "8lbs, 8.2oz. (3kg 861.2g)" → "8lbs, 8.2oz.". One or more number+unit
 * pairs per paren group. Bare "L" stays (°Lovibond in grain names).
 */
function stripParenUnitDupes(line: string): string {
  return line.replace(
    /\(\s*(?:\d+(?:\.\d+)?\s*(?:g|grams?|kgs?|kilograms?|oz|ounces?|ml|lbs?|pounds?)\.?[\s,]*)+\)/gi,
    ' ',
  );
}

/** Strips leading/trailing list punctuation and collapsed whitespace. */
function cleanName(s: string): string {
  return s
    .replace(/^[\s\-–—•*:,.()]+/, '')
    .replace(/[\s\-–—•*:,.()]+$/, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Section + line classification ──────────────────────────────────────────

type Section = 'grain' | 'hops' | 'yeast' | 'ignored' | null;

/** Header lines like "Fermentables:", "Grain Bill", "HOP SCHEDULE", "Yeast". */
function detectSectionHeader(line: string): Section | undefined {
  // Headers carry no amounts.
  if (extractAmount(line)) return undefined;
  const l = line.replace(/[:\-–—]+$/, '').trim();
  if (l.length > 32) return undefined;
  // "Ingredients:" introduces the ingredient sections — reset, don't classify.
  if (/^ingredients?$/i.test(l)) return null;
  if (/^(fermentables?|grains?|(?:grain|malt)\s*bill|malts?|grist|fermentable\s*bill)$/i.test(l)) return 'grain';
  if (/^(hops?|hop\s*(schedule|bill|additions?))$/i.test(l)) return 'hops';
  if (/^(yeasts?|yeast\s*(?:&|and|\+)?\s*fermentation)$/i.test(l)) return 'yeast';
  if (/^(mash(\s*schedule)?|water(\s*(profile|chemistry))?|misc(ellaneous)?|others?|notes?|instructions?|directions?|process|fermentation(\s+(?:and|&)\s+conditioning)?|packag(?:e|ing)|carbonation|specifications?|specs|stats|vitals|targets?)$/i.test(l)) {
    return 'ignored';
  }
  return undefined;
}

const YEAST_CUE_RE =
  /\b(wyeast|white\s*labs|wlp\s*\d{2,4}|us[- ]?05|s[- ]?0?4\b|s[- ]?23\b|s[- ]?189|w[- ]?34\/?70|k[- ]?97\b|safale|saflager|safbrew|fermentis|lallemand|lalbrew|imperial\s+(yeast|organic)|omega(\s*yeast)?|oyl[- ]?\d{2,4}|escarpment|verdant|nottingham|windsor|kveik|voss|hornindal|yeast)\b/i;

// Lab names/codes are unambiguous — these lines yield a yeast no matter what
// section they're in or what else the sentence carries ("Ferment with Wyeast
// 1469 … at 65°F" is both a temperature line AND the yeast).
const STRONG_YEAST_CUE_RE =
  /\b(?:wyeast|white\s*labs|wlp\s*-?\d{2,4}|fermentis|safale|saflager|safbrew|lallemand|lalbrew|omega\s*yeast|oyl[- ]?\d{2,4}|imperial\s+(?:yeast|organic)|escarpment)\b/i;

/**
 * All lab-code mentions on a line, with their parenthesized or trailing
 * capitalized names: "Wyeast 1469 (West Yorkshire Ale), White Labs WLP022
 * (Essex Ale)" → two rows. Falls back to whole-line parsing when the line
 * has a lab cue but no catalog codes.
 */
function extractYeastMentions(line: string): ParsedYeast[] {
  const out: ParsedYeast[] = [];
  // Lab words are case-tolerant via classes; the trailing-name group stays
  // case-SENSITIVE so it only grabs Capitalized strain words, not prose.
  for (const m of line.matchAll(
    /\b[Ww][Yy][Ee][Aa][Ss][Tt]\s*#?\s*(\d{4})\s*(?:\(([^)]{2,40})\)|((?:[A-Z][A-Za-z'’-]*\s*){1,4}))?/g,
  )) {
    out.push({ rawName: cleanName(`${m[1]} ${m[2] ?? m[3] ?? ''}`), laboratory: 'Wyeast' });
  }
  for (const m of line.matchAll(
    /\b[Ww][Ll][Pp]\s*-?\s*0*(\d{1,4})\s*(?:\(([^)]{2,40})\)|((?:[A-Z][A-Za-z'’-]*\s*){1,4}))?/g,
  )) {
    out.push({
      rawName: cleanName(`WLP${m[1].padStart(3, '0')} ${m[2] ?? m[3] ?? ''}`),
      laboratory: 'White Labs',
    });
  }
  if (out.length > 0) return out;
  return [parseYeastLine(line)];
}

const DRY_HOP_RE = /dry[\s-]*hop(?:ped|s)?/i;
const WHIRLPOOL_RE = /\b(whirlpool|flame\s*out|flameout|hop\s*stand|hopstand|steep)\b/i;
// Flameout is the boiling-hot subset of the whirlpool family; it gets a hotter
// default temperature than a cooled whirlpool/hopstand.
const FLAMEOUT_RE = /\b(flame\s*out|flameout)\b/i;
const FIRST_WORT_RE = /\b(fwh|first\s*wort)\b/i;
const MASH_HOP_RE = /\bmash\s*hop\b/i;
// "@60", "@ 60 min", "at 25 minutes" — but never "at 80C" (a temperature).
const AT_TIME_RE =
  /(?:@|\bat\b)\s*(\d+(?:\.\d+)?)(?!\s*(?:°|º|deg|[cf]\b))\s*(?:min(?:s|utes?)?)?\b/i;
const MIN_TIME_RE = /\b(\d+(?:\.\d+)?)[-\s]*min(?:s|utes?)?\b/i;
const DRY_HOP_DAYS_RE = /(\d+(?:\.\d+)?)\s*days?\b/i;
const ALPHA_RE = /(\d+(?:\.\d+)?)\s*%\s*(?:aa|alpha(?:\s*acids?)?)?/i;

function hasHopCue(line: string): boolean {
  return (
    DRY_HOP_RE.test(line) ||
    WHIRLPOOL_RE.test(line) ||
    FIRST_WORT_RE.test(line) ||
    MASH_HOP_RE.test(line) ||
    AT_TIME_RE.test(line) ||
    MIN_TIME_RE.test(line) ||
    /\d\s*%\s*(aa|alpha)/i.test(line)
  );
}

// ── Vitals ─────────────────────────────────────────────────────────────────

// Gravity extraction is keyword-then-first-gravity so Plato-first forms
// ("Expected OG: 9.3° P/1.037") still land on the 1.0xx number.
const OG_KEY_RE = /\b(?:OG|original\s+gravity)\b/i;
const FG_KEY_RE = /\b(?:FG|TG|final\s+gravity|terminal\s+gravity)\b/i;
const GRAVITY_NUM_RE = /\b[01]\.\d{2,3}\b/;

function gravityAfterKeyword(line: string, keyRe: RegExp): number | undefined {
  const key = line.match(keyRe);
  if (key?.index === undefined) return undefined;
  const g = line.slice(key.index + key[0].length).match(GRAVITY_NUM_RE);
  return g ? parseFloat(g[0]) : undefined;
}
const ABV_IBU_SRM_RE = /\b(abv|ibu|srm|ebc)\b/i;
const BARE_VOLUME_RE = /^(\d+(?:\.\d+)?)\s*(?:U\.?S\.?\s+|imperial\s+)?(gal(?:lons?)?|l|liters?|litres?)(\s+batch)?$/i;
const STYLE_RE = /^style[:=\s]+(.+)$/i;

// ── Process extraction: typed entities + keyword slots ─────────────────────
//
// Instead of one regex per phrasing ("Mash at X for Y", "X°C mash", "Sacch
// rest: X/Y"…), we find typed values (temperatures, durations, volumes)
// anywhere near a slot keyword and validate them against physical
// plausibility ranges. The ranges also resolve missing units: "mash at 152"
// can only be °F, "mash at 67" can only be °C.

const MASH_RANGE_C: [number, number] = [40, 80]; // protein rest → mash-out
const FERMENT_RANGE_C: [number, number] = [5, 40]; // lager pitch → kveik

const TAGGED_TEMP_RE =
  /(\d+(?:\.\d+)?)\s*(?:°|º|deg(?:rees?)?\.?)?\s*(c|f|celsius|fahrenheit)\b/gi;
const DUR_MIN_RE = /(\d+(?:\.\d+)?)[-\s]*(?:min(?:s|utes?)?|m)\b/i;
const DUR_HOUR_RE = /(\d+(?:\.\d+)?)[-\s]*(?:hours?|hrs?|h)\b/i;
const DUR_DAY_RE = /(\d+(?:\.\d+)?)[-\s]*days?\b/i;
const DUR_WEEK_RE = /(\d+(?:\.\d+)?)[-\s]*weeks?\b/i;
const VOLUME_RE = /(\d+(?:\.\d+)?)\s*(?:U\.?S\.?\s+|imperial\s+)?(gal(?:lons?)?|liters?|litres?|l)\b/i;

const MASH_KEY_RE =
  /\b(?:mash(?:\s*-?\s*(?:in|out))?|mashout|sacch(?:arification)?(?:\s+rest)?|conversion\s+rest|protein\s+rest|beta\s+rest|alpha\s+rest|(?:single\s+)?infusion)\b/gi;
const FERMENT_KEY_RE = /\b(?:ferment(?:ed|ing|ation)?|pitch(?:ed|ing)?|primary)\b/gi;
const BOIL_KEY_RE = /\bboil(?:ed|ing)?\b/gi;
const BATCH_KEY_RE =
  /\b(?:batch(?:\s+size)?|yields?|makes|volume|into\s+(?:the\s+)?fermenter)\b/gi;
// Stated water volumes are recognized but deliberately NOT imported — the
// calc service derives mash/sparge water from the user's own equipment.
const WATER_LINE_RE =
  /\b(?:strike|sparge|liquor|mash\s+water|total\s+water|water\s+(?:needed|required|volume))\b/i;
const EFFICIENCY_RE =
  /(?:(\d{2}(?:\.\d+)?)\s*%\s*(?:brewhouse\s+|mash\s+)?efficiency|efficiency\b[^0-9%]{0,8}(\d{2}(?:\.\d+)?)\s*%)/i;

const inRangeC = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;

function resolveTempC(
  value: number,
  unit: 'C' | 'F' | null,
  rangeC: [number, number],
): number | undefined {
  if (unit === 'C') return inRangeC(value, rangeC) ? value : undefined;
  if (unit === 'F') {
    const c = round(fToC(value), 1);
    return inRangeC(c, rangeC) ? c : undefined;
  }
  if (inRangeC(value, rangeC)) return value;
  const c = round(fToC(value), 1);
  return inRangeC(c, rangeC) ? c : undefined;
}

/**
 * First plausible temperature in a segment. °C-tagged values win (books
 * write "152°F (67°C)" — the metric parenthetical is authoritative), then
 * any tagged value, then bare numbers resolved by range.
 */
function pickTempC(segment: string, rangeC: [number, number]): number | undefined {
  const tagged = [...segment.matchAll(TAGGED_TEMP_RE)];
  for (const t of tagged) {
    if (t[2].toLowerCase() === 'c') {
      const v = resolveTempC(parseFloat(t[1]), 'C', rangeC);
      if (v !== undefined) return v;
    }
  }
  for (const t of tagged) {
    const v = resolveTempC(parseFloat(t[1]), t[2].toLowerCase() === 'c' ? 'C' : 'F', rangeC);
    if (v !== undefined) return v;
  }
  for (const m of segment.matchAll(/(\d+(?:\.\d+)?)/g)) {
    // Digits glued to letters are catalog codes (WLP022), not temperatures.
    const before = segment[(m.index ?? 0) - 1];
    if (before !== undefined && /[\w#-]/.test(before)) continue;
    const after = segment.slice((m.index ?? 0) + m[0].length);
    // Numbers glued to other units are not temperatures.
    if (
      /^\s*(?:°\s*[pl]|min|m\b|hour|hr|h\b|day|week|gal|l\b|liter|litre|ml|kg|g\b|lbs?\b|oz|%|vol|ibu|srm|°?\s*[cf]\b)/i.test(
        after,
      )
    ) {
      continue;
    }
    const v = resolveTempC(parseFloat(m[0]), null, rangeC);
    if (v !== undefined) return v;
  }
  return undefined;
}

function pickDurationMin(segment: string): number | undefined {
  const min = segment.match(DUR_MIN_RE);
  if (min) return round(parseFloat(min[1]), 0);
  const hr = segment.match(DUR_HOUR_RE);
  if (hr) return round(parseFloat(hr[1]) * 60, 0);
  return undefined;
}

function pickDurationDays(segment: string): number | undefined {
  const d = segment.match(DUR_DAY_RE);
  if (d) return round(parseFloat(d[1]), 1);
  const w = segment.match(DUR_WEEK_RE);
  if (w) return round(parseFloat(w[1]) * 7, 1);
  return undefined;
}

/** Sentence-ish bounds around an index (decimal points don't terminate). */
function sentenceBounds(line: string, keyIdx: number): [number, number] {
  let start = 0;
  for (let i = keyIdx - 1; i > 0; i--) {
    if ((line[i] === '.' || line[i] === ';') && /\s/.test(line[i + 1] ?? ' ')) {
      start = i + 1;
      break;
    }
  }
  let end = line.length;
  for (let i = keyIdx; i < line.length; i++) {
    if ((line[i] === '.' || line[i] === ';') && /\s/.test(line[i + 1] ?? ' ')) {
      end = i;
      break;
    }
  }
  return [start, end];
}

type KeywordSegment = { forward: string; backward: string };

/**
 * For each keyword occurrence: the sentence text from the keyword up to the
 * next keyword (so step mashes don't double-read), plus the pre-keyword part
 * of the sentence as a fallback ("67°C mash for an hour").
 */
function keywordSegments(line: string, keyRe: RegExp): KeywordSegment[] {
  const matches = [...line.matchAll(keyRe)];
  return matches.map((m, i) => {
    const idx = m.index ?? 0;
    const [sentStart, sentEnd] = sentenceBounds(line, idx);
    const nextIdx = matches[i + 1]?.index;
    const fwdEnd = nextIdx !== undefined && nextIdx > idx && nextIdx < sentEnd ? nextIdx : sentEnd;
    const prev = matches[i - 1];
    const backStart =
      prev && (prev.index ?? 0) >= sentStart ? (prev.index ?? 0) + prev[0].length : sentStart;
    return {
      forward: line.slice(idx, fwdEnd),
      backward: line.slice(Math.max(sentStart, backStart), idx),
    };
  });
}

function extractMashSteps(line: string): ParsedMashStep[] {
  const steps: ParsedMashStep[] = [];
  for (const seg of keywordSegments(line, MASH_KEY_RE)) {
    const forwardTemp = pickTempC(seg.forward, MASH_RANGE_C);
    const temperatureC =
      forwardTemp !== undefined ? forwardTemp : pickTempC(seg.backward, MASH_RANGE_C);
    if (temperatureC === undefined) continue;
    const durationMinutes = pickDurationMin(seg.forward) ?? pickDurationMin(seg.backward);
    const dup = steps.find((s) => Math.abs(s.temperatureC - temperatureC) < 0.6);
    if (dup) {
      dup.durationMinutes ??= durationMinutes;
      continue;
    }
    steps.push({ temperatureC, durationMinutes });
  }
  return steps.slice(0, 4);
}

function extractFerment(line: string): { tempC?: number; days?: number } {
  for (const seg of keywordSegments(line, FERMENT_KEY_RE)) {
    const tempC =
      pickTempC(seg.forward, FERMENT_RANGE_C) ?? pickTempC(seg.backward, FERMENT_RANGE_C);
    const days = pickDurationDays(seg.forward) ?? pickDurationDays(seg.backward);
    if (tempC !== undefined || days !== undefined) return { tempC, days };
  }
  return {};
}

function extractBoilMin(line: string): number | undefined {
  for (const seg of keywordSegments(line, BOIL_KEY_RE)) {
    const dur = pickDurationMin(seg.forward) ?? pickDurationMin(seg.backward);
    if (dur !== undefined && dur > 0 && dur <= 240) return dur;
  }
  return undefined;
}

function extractBatchL(line: string): number | undefined {
  for (const seg of keywordSegments(line, BATCH_KEY_RE)) {
    const scope = `${seg.backward} ${seg.forward}`;
    // "Sparge to collect 6.5 gal" / "total water 7.5 gal" are NOT the batch.
    if (/\b(?:sparge|strike|pre-?boil|water|collect)\b/i.test(scope)) continue;
    const vol = scope.match(VOLUME_RE);
    if (vol) {
      const value = parseFloat(vol[1]);
      const liters = /gal/i.test(vol[2]) ? galToL(value) : value;
      if (liters >= 1 && liters <= 120) return round(liters, 1);
    }
  }
  const bare = line.match(BARE_VOLUME_RE);
  if (bare) {
    const value = parseFloat(bare[1]);
    const liters = /gal/i.test(bare[2]) ? galToL(value) : value;
    if (liters >= 1 && liters <= 120) return round(liters, 1);
  }
  return undefined;
}

type VitalsHit = Partial<
  Pick<
    ParsedRecipeDraft,
    | 'batchVolumeL'
    | 'boilTimeMin'
    | 'targetOg'
    | 'targetFg'
    | 'style'
    | 'efficiencyPercent'
    | 'mashSteps'
    | 'fermentTempC'
    | 'fermentDays'
  >
> & {
  /** True when the line carried vitals info and shouldn't be unparsed. */
  consumed: boolean;
};

function parseVitals(line: string, hasMassAmount: boolean): VitalsHit {
  const hit: VitalsHit = { consumed: false };

  const og = gravityAfterKeyword(line, OG_KEY_RE);
  if (og !== undefined) {
    hit.targetOg = og;
    hit.consumed = true;
  }
  const fg = gravityAfterKeyword(line, FG_KEY_RE);
  if (fg !== undefined) {
    hit.targetFg = fg;
    hit.consumed = true;
  }
  // ABV / IBU / SRM stat lines: recognized so they don't pollute
  // unparsedLines, but the values are recomputed by the calc service.
  if (ABV_IBU_SRM_RE.test(line) && /\d/.test(line) && !hasMassAmount) {
    hit.consumed = true;
  }

  const style = line.match(STYLE_RE);
  if (style) {
    hit.style = style[1].trim();
    hit.consumed = true;
  }

  // A mass amount marks an ingredient row ("1 oz Magnum @ 60 min boil") —
  // ingredient rows never feed the process slots.
  if (hasMassAmount) return hit;

  const eff = line.match(EFFICIENCY_RE);
  if (eff) {
    const value = parseFloat(eff[1] ?? eff[2]);
    if (value >= 40 && value <= 98) {
      hit.efficiencyPercent = value;
      hit.consumed = true;
    }
  }

  const mashSteps = extractMashSteps(line);
  if (mashSteps.length > 0) {
    hit.mashSteps = mashSteps;
    hit.consumed = true;
  }

  const ferment = extractFerment(line);
  if (ferment.tempC !== undefined || ferment.days !== undefined) {
    hit.fermentTempC = ferment.tempC;
    hit.fermentDays = ferment.days;
    hit.consumed = true;
  }

  const boilMin = extractBoilMin(line);
  if (boilMin !== undefined) {
    hit.boilTimeMin = boilMin;
    hit.consumed = true;
  }

  const batchL = extractBatchL(line);
  if (batchL !== undefined) {
    hit.batchVolumeL = batchL;
    hit.consumed = true;
  }

  // Stated water volumes/temps (strike, sparge, total water) are recognized
  // and deliberately discarded — the app derives water from the user's own
  // equipment profile, not the book's.
  if (
    !hit.consumed &&
    WATER_LINE_RE.test(line) &&
    (VOLUME_RE.test(line) || pickTempC(line, [35, 85]) !== undefined)
  ) {
    hit.consumed = true;
  }

  return hit;
}

// ── Yeast laboratory detection ─────────────────────────────────────────────

const LAB_PATTERNS: Array<{ lab: string; re: RegExp }> = [
  { lab: 'Wyeast', re: /\bwyeast\b/i },
  { lab: 'White Labs', re: /\b(white\s*labs|wlp\s*\d{2,4})\b/i },
  { lab: 'Fermentis', re: /\b(fermentis|safale|saflager|safbrew)\b/i },
  { lab: 'Lallemand', re: /\b(lallemand|lalbrew|nottingham|windsor)\b/i },
  { lab: 'Omega Yeast', re: /\b(omega|oyl[- ]?\d{2,4})\b/i },
  { lab: 'Imperial Yeast', re: /\bimperial\b/i },
  { lab: 'Escarpment Labs', re: /\bescarpment\b/i },
  { lab: 'Verdant', re: /\bverdant\b/i },
];

function detectLaboratory(line: string): string | undefined {
  for (const { lab, re } of LAB_PATTERNS) {
    if (re.test(line)) return lab;
  }
  return undefined;
}

// ── Ingredient line parsers ────────────────────────────────────────────────

function parseHopLine(line: string, amount: ParsedAmount | null): ParsedHop {
  let type: Hop['type'] = 'boil';
  let timeMinutes: number | undefined;
  let dryHopDays: number | undefined;
  let temperatureC: number | undefined;

  if (DRY_HOP_RE.test(line)) {
    type = 'dry hop';
    const days = line.match(DRY_HOP_DAYS_RE);
    if (days) dryHopDays = parseFloat(days[1]);
  } else if (WHIRLPOOL_RE.test(line)) {
    type = 'whirlpool';
    // Capture an explicit hot-side temperature if the line gives one, else
    // default by sub-usage: flameout is at the boil (~99°C), a cooled
    // whirlpool/hopstand is gentler (~85°C).
    temperatureC = pickTempC(line, [62, 100]) ?? (FLAMEOUT_RE.test(line) ? 99 : 85);
  } else if (FIRST_WORT_RE.test(line)) {
    type = 'first wort';
  } else if (MASH_HOP_RE.test(line)) {
    type = 'mash';
  }

  if (type !== 'dry hop') {
    const at = line.match(AT_TIME_RE) ?? line.match(MIN_TIME_RE);
    if (at) timeMinutes = parseFloat(at[1]);
  }

  // Alpha: a small % is alpha acid; require AA/alpha wording OR a plausible
  // alpha range so "80%" grist lines never read as alpha.
  let alphaAcid: number | undefined;
  const alpha = line.match(ALPHA_RE);
  if (alpha) {
    const value = parseFloat(alpha[1]);
    const explicit = /aa|alpha/i.test(alpha[0]);
    if (explicit || value <= 25) alphaAcid = value;
  }

  let name = line;
  if (amount?.kind === 'mass') name = name.replace(amount.raw, ' ');
  name = name
    .replace(DRY_HOP_RE, ' ')
    .replace(WHIRLPOOL_RE, ' ')
    .replace(FIRST_WORT_RE, ' ')
    .replace(MASH_HOP_RE, ' ')
    .replace(AT_TIME_RE, ' ')
    .replace(MIN_TIME_RE, ' ')
    // Strip a whirlpool/hopstand temperature ("at 80C", "80°C", "180F") plus any
    // leading connective so it doesn't end up glued onto the hop name.
    .replace(/\b(?:@|at)?\s*\d+(?:\.\d+)?\s*(?:°|º|deg(?:rees?)?\.?)?\s*[cf]\b/gi, ' ')
    .replace(DRY_HOP_DAYS_RE, ' ')
    .replace(/for\s*$/i, ' ')
    .replace(ALPHA_RE, ' ')
    // "(5.0% AA, contribution of 19 IBU)" style metadata parens, whole.
    .replace(/\([^)]*(?:aa|alpha|ibu)[^)]*\)/gi, ' ')
    .replace(/\ba\.?a\.?(?=[\s,.)]|$)/gi, ' ')
    .replace(/\balpha\s*acids?\b/gi, ' ')
    .replace(/\b(?:boil|addition)\b/gi, ' ');

  return {
    rawName: cleanName(name),
    grams: amount?.kind === 'mass' ? round(amount.grams, 1) : undefined,
    type,
    timeMinutes,
    dryHopDays,
    alphaAcid,
    temperatureC,
  };
}

function parseGrainLine(line: string, amount: ParsedAmount | null): ParsedFermentable {
  let name = line;
  if (amount) name = name.replace(amount.raw, ' ');
  // Weighted bills often carry the grist share too: "6 lb Maris Otter (89%)".
  let relativePct = amount?.kind === 'percent' ? amount.pct : undefined;
  if (amount?.kind === 'mass') {
    const pct = name.match(/\(\s*(\d+(?:\.\d+)?)\s*%\s*\)/);
    if (pct && parseFloat(pct[1]) <= 100) relativePct = parseFloat(pct[1]);
  }
  name = name.replace(/\(\s*\d+(?:\.\d+)?\s*%\s*\)/g, ' ');
  return {
    rawName: cleanName(name),
    weightKg: amount?.kind === 'mass' ? round(amount.grams / 1000, 4) : undefined,
    relativePct,
  };
}

/**
 * Prose like "…the help of San Diego Super Yeast by White Labs" — pull the
 * capitalized strain phrase that precedes "[Yeast] by/from <lab>".
 */
function extractStrainBeforeLab(line: string): string | undefined {
  const byMatch = line.match(/\s+(?:[Yy]east\s+)?(?:by|from)\s+/);
  if (byMatch?.index === undefined) return undefined;
  const before = line.slice(0, byMatch.index);
  // Trailing run of Capitalized/numeric/code words ("San Diego Super",
  // "Safale US-05") — lowercase prose ("the help of") breaks the run.
  const run = before.match(/(?:[A-Z][A-Za-z0-9'’-]*|\d[\w'’-]*)(?:\s+(?:[A-Z][A-Za-z0-9'’-]*|\d[\w'’-]*))*$/);
  const strain = run?.[0]?.replace(/\s*\b[Yy]east\b\s*$/, '').trim();
  return strain && strain.length >= 3 ? strain : undefined;
}

function parseYeastLine(line: string): ParsedYeast {
  const laboratory = detectLaboratory(line);

  const strainFromProse = laboratory ? extractStrainBeforeLab(line) : undefined;
  if (strainFromProse) return { rawName: strainFromProse, laboratory };

  const name = line
    .replace(/^yeasts?\b[:=\s]*/i, ' ')
    .replace(/\b(\d+\s*(pack|pkg|packet|vial|sachet)s?\s*(of)?)\b/gi, ' ')
    // Brand words drown the strain name in fuzzy matching ("Lallemand
    // Nottingham Yeast" vs "LalBrew Nottingham"). The lab is captured
    // separately above; strains that double as names (Verdant, Nottingham)
    // are NOT stripped.
    .replace(
      /\b(wyeast|white\s*labs|fermentis|lallemand|lalbrew|escarpment(\s+labs)?|omega(\s+yeast)?(\s+labs)?|imperial\s+yeast)\b/gi,
      ' ',
    )
    .replace(/\byeast\b/gi, ' ');
  return { rawName: cleanName(name), laboratory };
}

// ── Main entry point ───────────────────────────────────────────────────────

export function parseRecipeText(text: string): ParsedRecipeDraft {
  const draft: ParsedRecipeDraft = {
    fermentables: [],
    hops: [],
    yeasts: [],
    unparsedLines: [],
  };

  const splitLines = text
    .split(/\r?\n/)
    .flatMap((l) =>
      splitCompoundLine(
        normalizeWordNumbers(normalizeLeadingDotDecimals(normalizeVulgarFractions(l.trim()))),
      ),
    )
    .map((l) => l.trim())
    .filter(Boolean);

  // Book layouts sometimes put the amount on its own line:
  //   "6" / "pounds Maris Otter pale malt (89%)" — rejoin those.
  const rawLines: string[] = [];
  for (let i = 0; i < splitLines.length; i++) {
    const cur = splitLines[i];
    const next = splitLines[i + 1];
    if (
      /^\d+(?:\.\d+)?$/.test(cur) &&
      next &&
      /^(?:lbs?|pounds?|ounces?|oz|grams?|g|kgs?|kilograms?)\b/i.test(next)
    ) {
      rawLines.push(`${cur} ${next}`);
      i++;
    } else {
      rawLines.push(cur);
    }
  }

  let section: Section = null;
  let firstContentLineSeen = false;
  // "Single-Infusion Mash" / "Mash" header with the temps on the NEXT line.
  let pendingMashHeader = false;

  const mergeMashSteps = (steps: ParsedMashStep[]) => {
    const merged = [...(draft.mashSteps ?? [])];
    for (const step of steps) {
      const dup = merged.find((s) => Math.abs(s.temperatureC - step.temperatureC) < 0.6);
      if (dup) dup.durationMinutes ??= step.durationMinutes;
      else merged.push(step);
    }
    draft.mashSteps = merged.slice(0, 4);
  };

  for (const rawLine of rawLines) {
    const line = normalizeAsciiFractions(rawLine);

    // Section headers steer classification until the next header.
    const header = detectSectionHeader(line);
    if (header !== undefined) {
      section = header;
      firstContentLineSeen = true;
      pendingMashHeader = /\bmash\b/i.test(line);
      continue;
    }

    // Vitals can appear anywhere (header block or inline).
    // "(21 g)" style metric duplicates pollute names and amount extraction.
    // Computed before vitals: a mass amount marks an ingredient row, which
    // never feeds the process slots. Only lines SHAPED like ingredient rows
    // count — short, or amount up front. A directions paragraph mentioning
    // "2.2 g/L of CO2" deep in prose must still yield mash/boil/ferment.
    const ingredientLine = stripParenUnitDupes(line);
    const amount = extractAmount(ingredientLine);
    const isIngredientShaped =
      amount?.kind === 'mass' &&
      (line.length < 60 || ingredientLine.indexOf(amount.raw) < 24);

    // A mash header on the previous line — this line may carry just the
    // temps: "153°F (67°C) for 75 minutes".
    if (pendingMashHeader) {
      pendingMashHeader = false;
      if (!isIngredientShaped) {
        const temperatureC = pickTempC(line, MASH_RANGE_C);
        if (temperatureC !== undefined) {
          mergeMashSteps([{ temperatureC, durationMinutes: pickDurationMin(line) }]);
          section = null;
          firstContentLineSeen = true;
          continue;
        }
      }
    }

    const vitals = parseVitals(line, isIngredientShaped);
    if (vitals.targetOg !== undefined) draft.targetOg ??= vitals.targetOg;
    if (vitals.targetFg !== undefined) draft.targetFg ??= vitals.targetFg;
    if (vitals.boilTimeMin !== undefined) draft.boilTimeMin ??= vitals.boilTimeMin;
    if (vitals.batchVolumeL !== undefined) draft.batchVolumeL ??= vitals.batchVolumeL;
    if (vitals.style !== undefined) draft.style ??= vitals.style;
    if (vitals.efficiencyPercent !== undefined) draft.efficiencyPercent ??= vitals.efficiencyPercent;
    if (vitals.fermentTempC !== undefined) draft.fermentTempC ??= vitals.fermentTempC;
    if (vitals.fermentDays !== undefined) draft.fermentDays ??= vitals.fermentDays;
    if (vitals.mashSteps !== undefined) {
      // Step mashes can span lines ("Protein rest…" / "Sacch rest…").
      mergeMashSteps(vitals.mashSteps);
    }
    if (vitals.consumed) {
      // A process line ends an ingredient block — "90-Minute Boil" after a
      // header-less grain bill means the hops that follow aren't grains.
      if (
        vitals.mashSteps !== undefined ||
        vitals.boilTimeMin !== undefined ||
        vitals.fermentTempC !== undefined
      ) {
        section = null;
      }
      // Prose packs strain + temps into one sentence ("Ferment with Wyeast
      // 1469 … at 65°F") — the yeast still gets captured.
      if (STRONG_YEAST_CUE_RE.test(line)) {
        draft.yeasts.push(...extractYeastMentions(ingredientLine));
      }
      firstContentLineSeen = true;
      continue;
    }

    // Lab-name/code lines are yeast regardless of section.
    if (STRONG_YEAST_CUE_RE.test(line)) {
      draft.yeasts.push(...extractYeastMentions(ingredientLine));
      firstContentLineSeen = true;
      continue;
    }

    if (section === 'ignored') continue;

    // Recipe name: first contentful line with no amount, before anything else parsed.
    if (!firstContentLineSeen && !amount && !YEAST_CUE_RE.test(line) && line.length <= 80) {
      draft.name = cleanName(line);
      firstContentLineSeen = true;
      continue;
    }
    firstContentLineSeen = true;

    // Mash/process prose without amounts (outside an explicit section).
    if (!amount && /^mash\b|\bmash\s+at\b|\bsparge\b|\bferment\s+at\b/i.test(line)) continue;

    // Per-line type inference. Yeast first (lab codes are unambiguous), then
    // hop timing cues, then grain (the catch-all for amount-bearing lines).
    if ((section === 'yeast' || section === null) && YEAST_CUE_RE.test(ingredientLine)) {
      draft.yeasts.push(parseYeastLine(ingredientLine));
      continue;
    }
    if (section === 'hops' && amount) {
      draft.hops.push(parseHopLine(ingredientLine, amount));
      continue;
    }
    if (section === null && amount && hasHopCue(ingredientLine)) {
      draft.hops.push(parseHopLine(ingredientLine, amount));
      continue;
    }
    if ((section === 'grain' || section === null) && amount) {
      draft.fermentables.push(parseGrainLine(ingredientLine, amount));
      continue;
    }
    // Yeast-section catch-all for bare strain names ("Conan", "US-05") —
    // word-capped so caption prose ("putting beer into fermentation
    // chamber") doesn't become a yeast.
    if (section === 'yeast' && line.split(/\s+/).length <= 4) {
      draft.yeasts.push(parseYeastLine(ingredientLine));
      continue;
    }

    // Short mash-ish line with no values ("Single-Infusion Mash") — the
    // temps are probably on the next line.
    if (!amount && line.length <= 40 && /\b(?:mash|infusion)\b/i.test(line)) {
      pendingMashHeader = true;
      continue;
    }

    draft.unparsedLines.push(rawLine);
  }

  return draft;
}

// ── Draft sanitation (shared with the AI-cleanup response path) ────────────

const HOP_TYPES: ReadonlySet<string> = new Set([
  'boil',
  'whirlpool',
  'dry hop',
  'first wort',
  'mash',
]);

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

/**
 * Coerces an untrusted ParsedRecipeDraft-shaped value (e.g. the AI cleanup
 * response, where unknowns come back as null) into a safe draft: nulls →
 * undefined, non-finite numbers dropped, rows without names dropped.
 */
export function sanitizeDraft(raw: unknown): ParsedRecipeDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

  const fermentables: ParsedFermentable[] = [];
  for (const item of arr(r.fermentables)) {
    const f = (item ?? {}) as Record<string, unknown>;
    const rawName = str(f.rawName);
    if (!rawName) continue;
    fermentables.push({
      rawName,
      weightKg: num(f.weightKg),
      relativePct: num(f.relativePct),
    });
  }

  const hops: ParsedHop[] = [];
  for (const item of arr(r.hops)) {
    const h = (item ?? {}) as Record<string, unknown>;
    const rawName = str(h.rawName);
    if (!rawName) continue;
    const type = typeof h.type === 'string' && HOP_TYPES.has(h.type) ? (h.type as Hop['type']) : 'boil';
    hops.push({
      rawName,
      grams: num(h.grams),
      type,
      timeMinutes: num(h.timeMinutes),
      dryHopDays: num(h.dryHopDays),
      alphaAcid: num(h.alphaAcid),
    });
  }

  const yeasts: ParsedYeast[] = [];
  for (const item of arr(r.yeasts)) {
    const y = (item ?? {}) as Record<string, unknown>;
    const rawName = str(y.rawName);
    if (!rawName) continue;
    yeasts.push({ rawName, laboratory: str(y.laboratory) });
  }

  const targetOg = num(r.targetOg);
  const targetFg = num(r.targetFg);
  const efficiencyPercent = num(r.efficiencyPercent);
  const fermentTempC = num(r.fermentTempC);
  const fermentDays = num(r.fermentDays);

  const mashSteps: ParsedMashStep[] = [];
  for (const item of arr(r.mashSteps)) {
    const s = (item ?? {}) as Record<string, unknown>;
    const temperatureC = num(s.temperatureC);
    if (temperatureC === undefined || temperatureC < 35 || temperatureC > 85) continue;
    const durationMinutes = num(s.durationMinutes);
    mashSteps.push({
      temperatureC,
      durationMinutes:
        durationMinutes !== undefined && durationMinutes > 0 && durationMinutes <= 300
          ? durationMinutes
          : undefined,
    });
  }

  return {
    name: str(r.name),
    style: str(r.style),
    batchVolumeL: num(r.batchVolumeL),
    boilTimeMin: num(r.boilTimeMin),
    // Gravity sanity: anything outside 1.0–1.2 is junk.
    targetOg: targetOg !== undefined && targetOg > 1 && targetOg < 1.2 ? targetOg : undefined,
    targetFg: targetFg !== undefined && targetFg > 0.98 && targetFg < 1.2 ? targetFg : undefined,
    efficiencyPercent:
      efficiencyPercent !== undefined && efficiencyPercent >= 40 && efficiencyPercent <= 98
        ? efficiencyPercent
        : undefined,
    mashSteps: mashSteps.length > 0 ? mashSteps.slice(0, 4) : undefined,
    fermentTempC:
      fermentTempC !== undefined && fermentTempC > 2 && fermentTempC < 45 ? fermentTempC : undefined,
    fermentDays:
      fermentDays !== undefined && fermentDays >= 0.5 && fermentDays <= 60 ? fermentDays : undefined,
    fermentables,
    hops,
    yeasts,
    unparsedLines: arr(r.unparsedLines).flatMap((l) => (typeof l === 'string' ? [l] : [])),
  };
}
