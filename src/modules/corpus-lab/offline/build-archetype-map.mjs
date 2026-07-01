#!/usr/bin/env node
/**
 * Phase 1.2 — name → malt archetype mapper.
 *
 * Streams the corpus, tallies every distinct fermentable name (+ usage count and
 * mean colour °L), classifies each to a lexicon archetype via structural/keyword
 * rules, and emits a full map + a human review file. We map EVERYTHING; the review
 * focuses on the top names by usage (where ~94% of volume lives) plus every
 * low/medium-confidence call worth a human eyeball.
 *
 * Pseudo-archetypes (NOT lexicon slugs — aggregateMaltFlavor skips them, 0 flavour):
 *   "extract" (DME/LME — base wort), "sugar"/"honey-sugar" (fermentable, thin body),
 *   "lactose" (unfermentable, +body), "adjunct" (fruit/veg/spice), "lauter" (rice
 *   hulls — inert), "unknown" (needs a rule).
 *
 * Read-only on the corpus; writes to src/modules/corpus-lab/offline/out/.
 * Run: `node src/modules/corpus-lab/offline/build-archetype-map.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { streamRecords } from "./corpus.mjs";

const OUT_DIR = "src/modules/corpus-lab/offline/out";

// ── classify ────────────────────────────────────────────────────────────────
function extractLovibond(n) {
  let m = n.match(/(\d+(?:\.\d+)?)\s*°?\s*l\b/);
  if (m) return parseFloat(m[1]);
  m = n.match(/\bc(\d+)\b/); // C60 style
  if (m) return parseFloat(m[1]);
  return null;
}

function crystalByColor(L) {
  if (L == null) return ["crystal-medium", "low"]; // most common; flag for review
  if (L >= 80) return ["crystal-dark", "high"];
  if (L >= 35) return ["crystal-medium", "high"];
  return ["crystal-light", "high"];
}

/** returns [archetypeSlug | "extract" | "sugar" | "honey-sugar" | "lactose" | "adjunct" | "lauter" | "unknown", confidence] */
function classify(rawName, dataColor) {
  const n = rawName.toLowerCase();
  const L = extractLovibond(n) ?? dataColor ?? null;

  // non-malt: lauter aid
  if (/rice hull|rice husk|oat hull/.test(n)) return ["lauter", "high"];

  // non-malt: lactose (unfermentable milk sugar — body & sweetness) & maltodextrin (body)
  if (/lactose|milk sugar/.test(n)) return ["lactose", "high"];
  if (/maltodextrin|malto-dextrin/.test(n)) return ["dextrine", "high"];

  // non-malt: sugars (honey before generic sugar so it gets its own tag)
  if (/candi|candy/.test(n)) return L != null && L >= 40 ? ["dark-candi-syrup", "medium"] : ["sugar", "medium"];
  if (/\bhoney\b/.test(n) && !/honey\s*malt/.test(n)) return ["honey-sugar", "high"];
  if (/\b(sugar|dextrose|sucrose|glucose|fructose|invert|turbinado|demerara|muscovado|maple|molasses|treacle|agave|jaggery|piloncillo|syrup)\b/.test(n)) return ["sugar", "high"];

  // extract (DME/LME) → own tag (base-wort flavour, but NOT a base GRAIN — keeps grist % honest)
  if (/\b(extract|dme|lme|dry malt|liquid malt|malt extract)\b/.test(n)) return ["extract", "high"];

  // smoked
  if (/smoke|rauch|peat|beech|cherry wood|mesquite/.test(n)) return ["smoked-malt", "high"];

  // non-grain flavour/gravity adjuncts (fruit / veg / spice / nibs) — bucketed, excluded from malt flavour
  if (/mango|blueberr|raspberr|strawberr|blackberr|\bcherr|peach|apricot|\bplum\b|\bapple\b|\bpear\b|banana|pineapple|passion|guava|coconut|pumpkin|sweet potato|squash|vanilla|cacao|cocoa nib|coffee bean|chili|chile|jalape|ginger|orange|lemon|\blime\b|\bzest|hibiscus|elderberr|currant|\bfig\b|\bdate\b|tamarind|watermelon|mandarin|tangerine|lavender|beet/.test(n)) return ["adjunct", "high"];

  // roasted / dark — specific first
  if (/roast(ed)?\s*barley/.test(n)) return ["roasted-barley", "high"];
  if (/carafa/.test(n)) return ["carafa-dehusked", "high"];
  if (/pale\s*chocolate/.test(n)) return ["pale-chocolate", "high"];
  if (/chocolate/.test(n)) return ["chocolate-malt", "high"];
  if (/black|patent|blackprinz|black prinz|midnight wheat/.test(n)) return ["black-malt", "high"];

  // crystal / caramel family (colour-split)
  if (/special\s*b\b/.test(n)) return ["special-b", "high"];
  if (/carapils|cara[- ]?foam|carafoam|dextrin|cara\s*pils|caramel\s*pils/.test(n)) return ["dextrine", "high"];
  if (/crystal|caramel|caramunich|caravienne|carared|caramalt|caraamber|\bcara/.test(n)) return crystalByColor(L);

  // toasted / specialty
  if (/biscuit/.test(n)) return ["biscuit-malt", "high"];
  if (/victory/.test(n)) return ["victory-amber", "high"];
  if (/melano|brumalt/.test(n)) return ["melanoidin", "high"];
  if (/honey\s*malt/.test(n)) return ["honey-malt", "high"];
  if (/aromatic|caraaroma|cara\s*aroma/.test(n)) return ["aromatic", "high"];
  if (/brown\s*malt|\bbrown\b/.test(n)) return ["brown-malt", "medium"];
  if (/amber\s*malt|\bamber\b/.test(n)) return ["amber-malt", "medium"];
  if (/acidulated|acid\s*malt|sauer/.test(n)) return ["acidulated", "high"];

  // regional / specialty bases & dark malts (top former "unknown" names)
  if (/red\s*x|redx|\bred\s*malt\b|red\s*active/.test(n)) return ["munich-light", "medium"];
  if (/abbey|abbaye/.test(n)) return ["melanoidin", "medium"];
  if (/cookie/.test(n)) return ["biscuit-malt", "medium"];
  if (/aurora|red\s*back|dark\s*ale/.test(n)) return ["munich-dark", "medium"];
  if (/millet|gluten[- ]?free|buckwheat|quinoa|amaranth/.test(n)) return ["base-pale", "low"];

  // flaked / adjuncts
  if (/flaked\s*oat|rolled\s*oat|naked\s*oat|\boats?\b|oatmeal/.test(n)) return ["flaked-oats", "high"];
  if (/torrified\s*wheat|torrefied\s*wheat/.test(n)) return ["torrified-wheat", "high"];
  if (/flaked\s*wheat|wheat\s*flake/.test(n)) return ["flaked-wheat", "high"];
  if (/flaked\s*barley|barley\s*flake/.test(n)) return ["flaked-barley", "high"];
  if (/flaked\s*(corn|maize)|corn\s*flake|\bmaize\b/.test(n)) return ["flaked-corn", "high"];
  if (/flaked\s*rice|rice\s*flake|\brice\b/.test(n)) return ["flaked-rice", "high"];

  // base malts
  if (/maris\s*otter|golden\s*promise|\bpearl\b|\boptic\b|\bhalcyon\b/.test(n)) return ["maris-otter", "high"];
  if (/pilsner|pilsen|\bpils\b|bohemian|lager\s*malt/.test(n)) return ["pilsner", "high"];
  if (/vienna/.test(n)) return ["vienna", "high"];
  if (/munich/.test(n)) return /dark|\bii\b|dunkel|\b2[05]\b/.test(n) ? ["munich-dark", "high"] : ["munich-light", "high"];
  if (/\brye\b/.test(n)) return ["rye-malt", "high"];
  if (/wheat/.test(n)) return ["wheat-malt", "high"];
  if (/2[\s-]*row|6[\s-]*row|pale\s*ale|pale\s*malt|\bpale\b|ale\s*malt|2row|base\s*malt|mild\s*malt/.test(n)) return ["base-pale", "high"];

  // colour-based fallback for anything dark/unlabelled
  if (L != null) {
    if (L >= 300) return ["black-malt", "low"];
    if (L >= 150) return ["chocolate-malt", "low"];
    if (L >= 35) return crystalByColor(L);
    if (L <= 6) return ["base-pale", "low"];
  }
  return ["unknown", "low"];
}

// ── tally ───────────────────────────────────────────────────────────────────
const names = new Map(); // name -> { count, colorSum, colorN }
const { total, parsed } = await streamRecords((r) => {
  if (!Array.isArray(r.fermentables)) return;
  for (const f of r.fermentables) {
    if (!f || !f[1]) continue;
    const name = String(f[1]);
    const rec = names.get(name) || { count: 0, colorSum: 0, colorN: 0 };
    rec.count++;
    if (typeof f[3] === "number" && isFinite(f[3])) {
      rec.colorSum += f[3];
      rec.colorN++;
    }
    names.set(name, rec);
  }
});

// ── classify + aggregate ──────────────────────────────────────────────────────
const rows = [];
for (const [name, rec] of names) {
  const meanColor = rec.colorN ? rec.colorSum / rec.colorN : null;
  const [archetype, confidence] = classify(name, meanColor);
  rows.push({ name, count: rec.count, meanColorL: meanColor != null ? +meanColor.toFixed(1) : null, archetype, confidence });
}
rows.sort((a, b) => b.count - a.count);

const totalUses = rows.reduce((s, r) => s + r.count, 0);
const byConf = { high: 0, medium: 0, low: 0 };
let unknownUses = 0;
for (const r of rows) {
  byConf[r.confidence] += r.count;
  if (r.archetype === "unknown") unknownUses += r.count;
}
const pctUses = (n) => ((100 * n) / totalUses).toFixed(1) + "%";

// ── write outputs ─────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const mapObj = {};
for (const r of rows) mapObj[r.name] = { archetype: r.archetype, confidence: r.confidence, count: r.count, meanColorL: r.meanColorL };
fs.writeFileSync(path.join(OUT_DIR, "archetype-map.json"), JSON.stringify(mapObj, null, 0));

const REVIEW_N = 400;
const fmt = (r) => `${r.count}\t${r.confidence}\t${r.archetype}\t${r.meanColorL ?? ""}\t${r.name}`;
const lines = ["# count\tconf\tarchetype\tcolorL\tname", ...rows.slice(0, REVIEW_N).map(fmt)];
lines.push(`\n# --- LOW/MEDIUM confidence within top ${REVIEW_N} (eyeball these) ---`);
lines.push(...rows.slice(0, REVIEW_N).filter((r) => r.confidence !== "high").map(fmt));
fs.writeFileSync(path.join(OUT_DIR, "archetype-map.review.tsv"), lines.join("\n"));

// ── console summary ───────────────────────────────────────────────────────────
console.log("recipes parsed:", parsed, "/", total);
console.log("distinct fermentable names:", rows.length, "| total uses:", totalUses);
console.log("mapped by confidence (share of USES): high", pctUses(byConf.high), "| medium", pctUses(byConf.medium), "| low", pctUses(byConf.low));
console.log("unmapped 'unknown':", pctUses(unknownUses), "across", rows.filter((r) => r.archetype === "unknown").length, "names");
console.log("\ntop 15 UNKNOWN names by usage (need a rule):");
for (const r of rows.filter((r) => r.archetype === "unknown").slice(0, 15)) console.log(`  ${r.count}\t${r.meanColorL ?? "?"}\t${r.name}`);
console.log("\ntop 15 LOW-confidence (non-unknown) by usage:");
for (const r of rows.filter((r) => r.confidence === "low" && r.archetype !== "unknown").slice(0, 15)) console.log(`  ${r.count}\t${r.archetype}\t${r.meanColorL ?? "?"}\t${r.name}`);
console.log("\noutputs →", OUT_DIR + "/archetype-map.json , archetype-map.review.tsv");
