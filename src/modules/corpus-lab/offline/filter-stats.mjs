#!/usr/bin/env node
/**
 * Phase 1.5a — recipe filter analysis ("iso the offending recipes").
 *
 * Using the archetype map, computes each recipe's fermentable composition by
 * category (grain / extract / sugar / adjunct / unknown, as % of grist) and reports
 * how many recipes survive candidate "reconstructable as an all-grain recipe"
 * filters. Lets us choose thresholds before baking the filter into the pipeline.
 *
 * Read-only. Run: `node src/modules/corpus-lab/offline/filter-stats.mjs`
 */
import fs from "node:fs";
import { streamRecords } from "./corpus.mjs";

const MAP = JSON.parse(fs.readFileSync("src/modules/corpus-lab/offline/out/archetype-map.json", "utf8"));

function category(name) {
  const e = MAP[name];
  if (!e) return "unknown";
  const a = e.archetype;
  if (a === "extract") return "extract";
  if (a === "sugar" || a === "honey-sugar" || a === "lactose") return "sugar"; // builder handles these
  if (a === "adjunct") return "adjunct";
  if (a === "lauter") return "inert";
  if (a === "unknown") return "unknown";
  return "grain";
}

const recipes = [];
const { parsed } = await streamRecords((r) => {
  if (!Array.isArray(r.fermentables) || !r.fermentables.length) return;
  const c = { grain: 0, extract: 0, sugar: 0, adjunct: 0, unknown: 0, inert: 0 };
  let totalPct = 0;
  for (const f of r.fermentables) {
    if (!f || !f[1]) continue;
    const pct = typeof f[4] === "number" && isFinite(f[4]) ? f[4] : 0;
    c[category(String(f[1]))] += pct;
    totalPct += pct;
  }
  const norm = totalPct > 0 ? 100 / totalPct : 0; // renormalise to 100%
  for (const k in c) c[k] *= norm;
  recipes.push({ method: r.method || "(none)", ...c });
});

const N = recipes.length;
const pct = (x) => ((100 * x) / N).toFixed(1) + "%";
const count = (pred) => recipes.filter(pred).length;

console.log("recipes with fermentables:", N, "/ parsed", parsed);

console.log("\n=== method ===");
const methods = {};
for (const r of recipes) methods[r.method] = (methods[r.method] || 0) + 1;
for (const [k, v] of Object.entries(methods).sort((a, b) => b[1] - a[1])) console.log(`  ${pct(v).padStart(6)}  ${v}\t${k}`);

console.log("\n=== extract (DME/LME) presence ===");
console.log("  any extract >0% :", pct(count((r) => r.extract > 0)));
console.log("  extract >5%     :", pct(count((r) => r.extract > 5)));
console.log("  extract >20%    :", pct(count((r) => r.extract > 20)));
console.log("  extract >50%    :", pct(count((r) => r.extract > 50)));

console.log("\n=== adjunct (fruit/veg/spice) presence ===");
console.log("  any adjunct >0% :", pct(count((r) => r.adjunct > 0)));
console.log("  adjunct >10%    :", pct(count((r) => r.adjunct > 10)));
console.log("  adjunct >20%    :", pct(count((r) => r.adjunct > 20)));

console.log("\n=== unknown presence ===");
console.log("  any unknown >0% :", pct(count((r) => r.unknown > 0)));
console.log("  unknown >10%    :", pct(count((r) => r.unknown > 10)));

console.log("\n=== retention under candidate filters ===");
const allgrain = (r) => r.method === "All Grain" || r.method === "BIAB";
const policies = [
  ["method ∈ {All Grain, BIAB}", allgrain],
  ["  + extract ≤5%", (r) => allgrain(r) && r.extract <= 5],
  ["  + extract ≤5% & adjunct ≤20%", (r) => allgrain(r) && r.extract <= 5 && r.adjunct <= 20],
  ["  + extract ≤5% & adjunct ≤20% & unknown ≤15%", (r) => allgrain(r) && r.extract <= 5 && r.adjunct <= 20 && r.unknown <= 15],
  ["strict: drop ANY extract", (r) => r.extract === 0],
  ["strict: drop ANY extract OR adjunct", (r) => r.extract === 0 && r.adjunct === 0],
];
for (const [label, pred] of policies) {
  const k = count(pred);
  console.log(`  ${pct(k).padStart(6)}  (${k})  ${label}`);
}
