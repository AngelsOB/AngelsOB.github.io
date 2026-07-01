#!/usr/bin/env node
/**
 * Phase 1.2 — hop name → canonical HOP_PRESETS name resolver.
 *
 * The missing sibling of build-archetype-map (grain) and build-yeast-map (yeast).
 * Grain and yeast are resolved ONCE here and baked into the cloud; hops were the
 * exception — stored as dirty free text and re-cleaned per query. Worse, ~14.6%
 * of hop additions never resolved to a preset at all (real hops under variant
 * spellings: "fuggles", "hallertau mittelfruh", "northern brewer", "ekg", "ctz"),
 * so they contributed ZERO to the hop flavour vector the k-NN searches on.
 *
 * Resolves each distinct corpus hop name to a real preset via, in order:
 * diacritic/punctuation fold → exact → de-spaced → vendor-prefix strip → token
 * subset → small alias table → tight single-edit fuzzy. Conservative on purpose:
 * an unresolved name (null) is safer than a wrong match, and the review file +
 * confidence levels exist to catch the medium/low calls.
 *
 * Read-only on the corpus; writes to src/modules/corpus-lab/offline/out/.
 * Run: `node src/modules/corpus-lab/offline/build-hop-map.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { streamRecords } from "./corpus.mjs";

const OUT_DIR = "src/modules/corpus-lab/offline/out";
const HOPS = JSON.parse(fs.readFileSync("src/utils/presets.generated.hops.json", "utf8"));

// ── cleaning ──────────────────────────────────────────────────────────────────
function foldClean(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip diacritics: ü→u, é→e
    .replace(/\([^)]*\)/g, " ") // parentheticals: "(german)", "(7% aa)"
    .replace(/\b\d+(\.\d+)?\s*%?\s*a\.?a\.?\b/gi, " ") // stray AA annotations
    .replace(/[^a-z0-9]+/g, " ") // punctuation → space (apostrophes, periods, slashes)
    .replace(/\s+/g, " ")
    .trim();
}
const despace = (s) => s.replace(/\s+/g, "");
const singular = (t) => (t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t);
const tokenSet = (s) => new Set(foldClean(s).split(" ").filter(Boolean).map(singular));

/**
 * Strip a leading "Vendor - " marketing prefix from the RAW name (before
 * foldClean turns the dash into a space and the boundary is lost). Applied only
 * when the prefix is a known/structural vendor, so a real hop that just happens
 * to share a vendor's name ("Northern Brewer" the hop, no dash) is untouched —
 * while "Northern Brewer - Hallertau" correctly reduces to "Hallertau".
 */
function stripVendorPrefix(raw) {
  return String(raw)
    .replace(/^\s*(?:yakima chief hops|yakima valley hops|crosby hop farm|brewmaster|artisan|northern brewer|hollingbery\s*&?\s*son|[\w. ]+?\s(?:hops?|hop farm|hop co\.?|hop company))\s*[-:]\s*/i, "")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

// ── preset indexes ────────────────────────────────────────────────────────────
const presetClean = new Map(); // cleaned name → canonical
const presetDespace = new Map(); // de-spaced cleaned → canonical
const presetList = HOPS.map((h) => ({ canonical: h.name, clean: foldClean(h.name), tokens: tokenSet(h.name) }));
for (const p of presetList) {
  if (!presetClean.has(p.clean)) presetClean.set(p.clean, p.canonical);
  const d = despace(p.clean);
  if (!presetDespace.has(d)) presetDespace.set(d, p.canonical);
}

// Hand-verified aliases for names no structural rule catches (cleaned form → canonical).
const ALIAS = {
  ekg: "East Kent Goldings",
  "kent goldings": "East Kent Goldings",
  "kent golding": "East Kent Goldings",
  "goldings east kent": "East Kent Goldings",
  ctz: "CTZ (Columbus/Tomahawk/Zeus)",
  "columbus tomahawk zeus": "CTZ (Columbus/Tomahawk/Zeus)",
  "mount rainier": "Mt. Rainier",
  "mount hood": "Mt. Hood",
  "us fuggle": "Fuggle",
  "east kent golding": "East Kent Goldings",
  equinox: "Ekuanot", // breeder renamed Equinox → Ekuanot; same hop
  // renamed / synonym varieties (corpus name → the entry we already have)
  "super alpha": "Dr. Rudi", // renamed 2012
  taiheke: "Cascade", // NZ-grown Cascade
  idaho: "Idaho 7", // bare "Idaho" → the dominant Idaho variety
  "german select": "Spalter Select",
  "super styrian": "Aurora", // "Super Styrian" = Aurora
  "super styrians": "Aurora",
  "hbc 438": "Sabro", // HBC 438 released as Sabro
  zpc: "Saaz", // ŽPČ (Žatecký Poloraný Červeňák) = Saaz
  // generic region names → the classic noble default
  hallertau: "Hallertau Mittelfrüh",
  hallertauer: "Hallertau Mittelfrüh",
  "domestic hallertau": "Hallertau Mittelfrüh",
  "german hallertau": "Hallertau Mittelfrüh",
  // common misspellings too short/far for the fuzzy guard
  simco: "Simcoe",
  mosiac: "Mosaic",
};

// ── resolve one raw name ──────────────────────────────────────────────────────
function resolve(raw) {
  const clean = foldClean(stripVendorPrefix(raw));
  if (!clean) return [null, "none"];

  if (presetClean.has(clean)) return [presetClean.get(clean), "high"];
  if (presetDespace.has(despace(clean))) return [presetDespace.get(despace(clean)), "high"];
  if (ALIAS[clean]) return [ALIAS[clean], "high"];

  const qTokens = [...tokenSet(clean)];

  // forward token subset: every query token appears in a longer preset name —
  // a shortened form ("kent goldings"→East Kent Goldings). Requires ≥2 query
  // tokens so a lone generic token ("hallertauer") can't grab a specific preset.
  if (qTokens.length >= 2) {
    let best = null, bestExtra = Infinity;
    for (const p of presetList) {
      if (!qTokens.every((t) => p.tokens.has(t))) continue;
      const extra = p.tokens.size - qTokens.length;
      if (extra < bestExtra) { best = p.canonical; bestExtra = extra; }
    }
    if (best) return [best, "medium"];
  }

  // reverse token subset: the whole (strictly shorter) preset name sits inside a
  // more-specific, qualifier-prefixed query — pick the LONGEST preset that fits.
  // Handles "hallertau hersbrucker"→Hersbrucker, "czech saaz"→Saaz,
  // "citra lupuln2 (cryo)"→Citra.
  if (qTokens.length) {
    const qset = new Set(qTokens);
    let best = null, bestSize = 0;
    for (const p of presetList) {
      if (p.tokens.size === 0 || p.tokens.size >= qset.size) continue; // strictly more specific
      if (![...p.tokens].every((t) => qset.has(t))) continue;
      if (p.tokens.size > bestSize) { best = p.canonical; bestSize = p.tokens.size; }
    }
    if (best) return [best, "medium"];
  }

  // tight fuzzy: a single edit on a reasonably long single-token name
  // ("millenium"→"millennium", "centenial"→"centennial"). Only if unambiguous.
  if (clean.length >= 6 && !clean.includes(" ")) {
    const within = presetList.filter((p) => !p.clean.includes(" ") && levenshtein(clean, p.clean) <= 1);
    if (within.length === 1) return [within[0].canonical, "low"];
  }
  return [null, "none"];
}

// ── tally corpus hop names ────────────────────────────────────────────────────
const names = new Map(); // raw name → count
const { total, parsed } = await streamRecords((r) => {
  if (!Array.isArray(r.hops)) return;
  for (const h of r.hops) {
    if (!h || h[1] == null) continue;
    const name = String(h[1]).trim();
    if (!name) continue;
    names.set(name, (names.get(name) || 0) + 1);
  }
});

// ── resolve + aggregate ───────────────────────────────────────────────────────
const rows = [];
for (const [name, count] of names) {
  const [canonical, confidence] = resolve(name);
  rows.push({ name, count, canonical, confidence });
}
rows.sort((a, b) => b.count - a.count);

const totalUses = rows.reduce((s, r) => s + r.count, 0);
const byConf = { high: 0, medium: 0, low: 0, none: 0 };
for (const r of rows) byConf[r.confidence] += r.count;
const pct = (n) => ((100 * n) / totalUses).toFixed(1) + "%";

// ── write outputs ─────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const mapObj = {};
for (const r of rows) mapObj[r.name] = { canonical: r.canonical, confidence: r.confidence, count: r.count };
fs.writeFileSync(path.join(OUT_DIR, "hop-map.json"), JSON.stringify(mapObj, null, 0));

const REVIEW_N = 400;
const fmt = (r) => `${r.count}\t${r.confidence}\t${r.canonical ?? "(UNRESOLVED)"}\t${r.name}`;
const lines = ["# count\tconf\tcanonical\traw", ...rows.slice(0, REVIEW_N).map(fmt)];
lines.push(`\n# --- medium/low confidence within top ${REVIEW_N} (eyeball these) ---`);
lines.push(...rows.slice(0, REVIEW_N).filter((r) => r.confidence === "medium" || r.confidence === "low").map(fmt));
lines.push(`\n# --- top UNRESOLVED by usage (need an alias or a new preset) ---`);
lines.push(...rows.filter((r) => !r.canonical).slice(0, 80).map(fmt));
fs.writeFileSync(path.join(OUT_DIR, "hop-map.review.tsv"), lines.join("\n"));

// ── console summary ───────────────────────────────────────────────────────────
console.log("recipes parsed:", parsed, "/", total);
console.log("distinct hop names:", rows.length, "| total hop uses:", totalUses);
console.log("resolved (share of USES): high", pct(byConf.high), "| medium", pct(byConf.medium), "| low", pct(byConf.low));
console.log("resolved TOTAL:", pct(byConf.high + byConf.medium + byConf.low), "| still unresolved:", pct(byConf.none), `across ${rows.filter((r) => !r.canonical).length} names`);
console.log("\ntop 20 UNRESOLVED by usage (candidates for an alias or a new preset):");
for (const r of rows.filter((r) => !r.canonical).slice(0, 20)) console.log(`  ${String(r.count).padStart(6)}  ${JSON.stringify(r.name)}`);
console.log("\noutputs →", OUT_DIR + "/hop-map.json , hop-map.review.tsv");
