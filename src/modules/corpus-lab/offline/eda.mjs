#!/usr/bin/env node
/**
 * Phase 0 EDA — ground-truth the Brewer's Friend raw corpus.
 *
 * Streams src/data/raw/recipes_full.txt (a line-delimited JSON dict — each line
 * is `"<n>": { ...recipe... },`) and reports shape + messiness, with emphasis on
 * the name-matching workload (distinct fermentable / hop / yeast strings, and how
 * much of total VOLUME the top names cover). Read-only; prints a summary, writes
 * nothing. Run: `node scripts/recipe-corpus/eda.mjs`
 */
import fs from "node:fs";
import readline from "node:readline";

const FILE = "src/modules/corpus-lab/raw/recipes_full.txt";

/** Pull the recipe object out of one `"<n>": { ... },` line. */
function parseLine(line) {
  let s = line.trim();
  if (!s) return null;
  if (s.startsWith("{")) s = s.slice(1); // first line's leading dict brace
  s = s.replace(/[,}]\s*$/, ""); // trailing comma, or the final dict brace
  s = s.replace(/^"\d+":\s*/, ""); // the `"<n>": ` key prefix
  if (!s.startsWith("{")) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

const counts = { total: 0, parsed: 0, parseErr: 0, withFerm: 0, withHops: 0, withYeast: 0, phMissing: 0 };
const method = new Map();
const style = new Map();
const fermName = new Map(); // name -> times used (across all recipes)
const hopName = new Map();
const yeastName = new Map();
const nums = { og: [], fg: [], abv: [], ibu: [], color: [], batch: [] };
const fermColor = [];

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const pushNum = (arr, v) => {
  if (typeof v === "number" && isFinite(v) && v > 0) arr.push(v);
};

const rl = readline.createInterface({ input: fs.createReadStream(FILE), crlfDelay: Infinity });
for await (const line of rl) {
  counts.total++;
  const r = parseLine(line);
  if (!r) {
    counts.parseErr++;
    continue;
  }
  counts.parsed++;
  bump(method, r.method || "(none)");
  bump(style, r.style || "(none)");

  if (Array.isArray(r.fermentables) && r.fermentables.length) {
    counts.withFerm++;
    for (const f of r.fermentables) {
      if (f && f[1]) bump(fermName, String(f[1]));
      if (typeof f?.[3] === "number") fermColor.push(f[3]);
    }
  }
  if (Array.isArray(r.hops) && r.hops.length) {
    counts.withHops++;
    for (const h of r.hops) if (h && h[1]) bump(hopName, String(h[1]));
  }
  if (Array.isArray(r.yeast) && r.yeast.length && r.yeast[0]) {
    counts.withYeast++;
    bump(yeastName, String(r.yeast[0]));
  }
  if (r["ph mash"] === -1 || r["ph mash"] == null) counts.phMissing++;

  pushNum(nums.og, r.og);
  pushNum(nums.fg, r.fg);
  pushNum(nums.abv, r.abv);
  pushNum(nums.ibu, r.ibu);
  pushNum(nums.color, r.color);
  pushNum(nums.batch, r.batch);
}

const pct = (n) => ((100 * n) / counts.parsed).toFixed(1) + "%";
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const totalUses = (map) => [...map.values()].reduce((a, b) => a + b, 0);
/** What fraction of total ingredient USES the top-K names cover (the long-tail shape). */
const coverage = (map, k) => {
  const sorted = [...map.values()].sort((a, b) => b - a);
  const total = sorted.reduce((a, b) => a + b, 0);
  const head = sorted.slice(0, k).reduce((a, b) => a + b, 0);
  return total ? ((100 * head) / total).toFixed(1) + "%" : "n/a";
};
const stats = (arr) => {
  if (!arr.length) return "n/a";
  const s = [...arr].sort((a, b) => a - b);
  const q = (p) => s[Math.floor(p * (s.length - 1))];
  return `min ${s[0].toFixed(2)} | p10 ${q(0.1).toFixed(2)} | median ${q(0.5).toFixed(2)} | p90 ${q(0.9).toFixed(2)} | max ${s[s.length - 1].toFixed(2)} (n=${s.length})`;
};

console.log("=== records ===");
console.log("total lines:", counts.total, "| parsed:", counts.parsed, "| parse errors:", counts.parseErr);
console.log("with fermentables:", pct(counts.withFerm), "| with hops:", pct(counts.withHops), "| with yeast:", pct(counts.withYeast));
console.log("ph mash missing (-1/null):", pct(counts.phMissing));

console.log("\n=== method ===");
for (const [k, v] of top(method, 8)) console.log(`  ${v}\t${k}`);

console.log("\n=== styles ===");
console.log("distinct styles:", style.size);
for (const [k, v] of top(style, 25)) console.log(`  ${v}\t${k}`);

console.log("\n=== FERMENTABLE NAMES (the name-matching workload) ===");
console.log("distinct names:", fermName.size, "| total uses:", totalUses(fermName));
console.log("top-100 names cover", coverage(fermName, 100), "of uses | top-300 cover", coverage(fermName, 300));
console.log("top 40:");
for (const [k, v] of top(fermName, 40)) console.log(`  ${v}\t${k}`);

console.log("\n=== HOP NAMES ===");
console.log("distinct names:", hopName.size, "| top-100 cover", coverage(hopName, 100), "of uses");
console.log("top 30:");
for (const [k, v] of top(hopName, 30)) console.log(`  ${v}\t${k}`);

console.log("\n=== YEAST STRINGS ===");
console.log("distinct strings:", yeastName.size, "| top-100 cover", coverage(yeastName, 100), "of uses");
console.log("top 20:");
for (const [k, v] of top(yeastName, 20)) console.log(`  ${v}\t${k}`);

console.log("\n=== numeric ranges (unit sanity) ===");
console.log("og:          ", stats(nums.og));
console.log("fg:          ", stats(nums.fg));
console.log("abv:         ", stats(nums.abv));
console.log("ibu:         ", stats(nums.ibu));
console.log("color:       ", stats(nums.color));
console.log("batch (L):   ", stats(nums.batch));
console.log("ferm color °L:", stats(fermColor));
