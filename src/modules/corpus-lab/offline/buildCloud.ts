/**
 * Phase 1.5 — recipe → feature vector.
 *
 * Pure logic (no corpus I/O here — see buildCloud.test.ts for the runner):
 *   - composition()     — fermentable mix by category (grain/extract/sugar/adjunct/…)
 *   - passesFilter()    — the agreed clean-corpus filter (reconstructable all-grain)
 *   - recipeToVector()  — the cloud coordinate: malt 9-axis (lab lexicon) + hop 9-axis
 *                         (the app's real HopFlavorCalculationService) + body + scalars.
 *
 * Reuses app code one-way (lab → app). Grist is handled as % (already in the data);
 * non-malt fermentables auto-drop from the malt FLAVOUR (not lexicon slugs) but feed
 * BODY (sugar thins, lactose adds).
 */
import { aggregateMaltFlavor, aggregateMaltBody, type MaltFlavorProfile } from "../maltFlavor";
import { hopFlavorCalculationService as hopSvc } from "../../recipe/services/HopFlavorCalculationService";
import type { Hop } from "../../recipe/models/Recipe";
import type { HopFlavorProfile } from "../../recipe/models/Presets";
import HOPS from "../../../utils/presets.generated.hops.json";
import MAP from "./out/archetype-map.json";

const ARCH = MAP as Record<string, { archetype: string }>;

/** hop preset flavour keyed by lower-cased name (corpus names vary in case). */
export const HOP_FLAVOR_BY_LOWER = new Map<string, HopFlavorProfile>(
  (HOPS as Array<{ name: string; flavor?: HopFlavorProfile }>)
    .filter((h) => h.flavor)
    .map((h) => [h.name.toLowerCase(), h.flavor as HopFlavorProfile])
);

const num = (x: unknown): number =>
  typeof x === "number" && isFinite(x) ? x : typeof x === "string" ? parseFloat(x) || 0 : 0;

export type CorpusRecipe = {
  method?: string;
  style?: string;
  batch?: number;
  og?: number;
  fg?: number;
  abv?: number;
  ibu?: number;
  color?: number;
  fermentables?: Array<Array<string | number>>;
  hops?: Array<Array<string | number>>;
};

type GristCat = "grain" | "extract" | "sugar" | "adjunct" | "inert" | "unknown";
const CATS: GristCat[] = ["grain", "extract", "sugar", "adjunct", "inert", "unknown"];

export function gristCategory(name: string): GristCat {
  const a = ARCH[name]?.archetype;
  if (!a) return "unknown";
  if (a === "extract") return "extract";
  if (a === "sugar" || a === "honey-sugar" || a === "lactose") return "sugar";
  if (a === "adjunct") return "adjunct";
  if (a === "lauter") return "inert";
  if (a === "unknown") return "unknown";
  return "grain";
}

/** Fermentable mix as % of grist by category (renormalised to 100). */
export function composition(rec: CorpusRecipe): Record<GristCat, number> {
  const c: Record<GristCat, number> = { grain: 0, extract: 0, sugar: 0, adjunct: 0, inert: 0, unknown: 0 };
  let tot = 0;
  for (const f of rec.fermentables ?? []) {
    const name = String(f[1] ?? "");
    if (!name) continue;
    const pct = num(f[4]);
    c[gristCategory(name)] += pct;
    tot += pct;
  }
  if (tot > 0) for (const k of CATS) c[k] *= 100 / tot;
  return c;
}

/** The agreed clean-corpus filter: all-grain/BIAB, reconstructable as a grain bill. */
export function passesFilter(rec: CorpusRecipe): boolean {
  const m = rec.method ?? "";
  if (m !== "All Grain" && m !== "BIAB") return false;
  if (!rec.fermentables?.length) return false;
  const c = composition(rec);
  return c.extract <= 5 && c.adjunct <= 20 && c.unknown <= 15;
}

function gristItems(rec: CorpusRecipe): Array<{ archetype: string; amount: number }> {
  const out: Array<{ archetype: string; amount: number }> = [];
  for (const f of rec.fermentables ?? []) {
    const name = String(f[1] ?? "");
    if (!name) continue;
    const archetype = ARCH[name]?.archetype ?? "unknown";
    const amount = num(f[4]) || num(f[0]); // prefer % of grist, fallback to weight
    if (amount > 0) out.push({ archetype, amount });
  }
  return out;
}

function parseTimeMin(s: string): number {
  const m = s.match(/([\d.]+)/);
  const v = m ? parseFloat(m[1]) : 0;
  return /day/i.test(s) ? v * 1440 : v;
}

/** Map a corpus hop row [grams, name, form, alpha, use, time, ibu, pct] → app Hop. */
export function parseHopAddition(row: Array<string | number>): Hop | null {
  const grams = num(row[0]);
  const name = String(row[1] ?? "").toLowerCase().trim();
  if (!name || grams <= 0) return null;
  const use = String(row[4] ?? "").toLowerCase();
  const time = String(row[5] ?? "");
  let type: Hop["type"] = "boil";
  let temperatureC: number | undefined;
  let whirlpoolTimeMinutes: number | undefined;
  if (/whirlpool|aroma|hop\s*stand|hopstand|flame|steep/.test(use)) {
    type = "whirlpool";
    const tf = use.match(/(\d+)\s*°?\s*f/);
    const tc = use.match(/(\d+)\s*°?\s*c/);
    if (tf) temperatureC = ((parseFloat(tf[1]) - 32) * 5) / 9;
    else if (tc) temperatureC = parseFloat(tc[1]);
    whirlpoolTimeMinutes = parseTimeMin(time);
  } else if (/dry\s*hop/.test(use)) type = "dry hop";
  else if (/first\s*wort|fwh/.test(use)) type = "first wort";
  else if (/mash/.test(use)) type = "mash";
  return { id: "", name, alphaAcid: num(row[3]), grams, type, timeMinutes: parseTimeMin(time), temperatureC, whirlpoolTimeMinutes };
}

export type RecipeVector = {
  style: string;
  og: number;
  fg: number;
  abv: number;
  ibu: number;
  srm: number;
  buGu: number;
  malt: MaltFlavorProfile;
  maltBody: number;
  hop: HopFlavorProfile;
};

export function recipeToVector(rec: CorpusRecipe): RecipeVector {
  const grist = gristItems(rec);
  const hops = (rec.hops ?? []).map(parseHopAddition).filter((h): h is Hop => h !== null);
  const og = num(rec.og);
  const ibu = num(rec.ibu);
  return {
    style: rec.style ?? "(none)",
    og,
    fg: num(rec.fg),
    abv: num(rec.abv),
    ibu,
    srm: num(rec.color),
    buGu: og > 1 ? ibu / ((og - 1) * 1000) : 0,
    malt: aggregateMaltFlavor(grist),
    maltBody: aggregateMaltBody(grist),
    hop: hopSvc.calculateCombinedFlavor(hops, HOP_FLAVOR_BY_LOWER, num(rec.batch) || 20),
  };
}

/** Grist collapsed to archetype → % of grist (renormalised). For cloud synthesis. */
export function gristArchetypePct(rec: CorpusRecipe): Record<string, number> {
  const out: Record<string, number> = {};
  let tot = 0;
  for (const f of rec.fermentables ?? []) {
    const name = String(f[1] ?? "");
    if (!name) continue;
    const a = ARCH[name]?.archetype ?? "unknown";
    const pct = num(f[4]) || num(f[0]);
    out[a] = (out[a] ?? 0) + pct;
    tot += pct;
  }
  if (tot > 0) for (const k of Object.keys(out)) out[k] = +((out[k] * 100) / tot).toFixed(1);
  return out;
}
