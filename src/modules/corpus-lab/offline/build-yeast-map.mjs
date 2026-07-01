#!/usr/bin/env node
/**
 * Phase 1.6 — yeast → base-class mapper.
 *
 * Matches each corpus yeast string to your canonical yeast preset (by lab code,
 * then name), collapses it to a base CLASS (strainGroup if present, else a singleton
 * keyed by lab code / name), and resolves the preset's substitutes to their classes.
 * The cloud will multi-hot [own class + substitute classes]; reconstruction uses the
 * actual (normalized) yeast. Emits a full map + review + class-usage summary.
 *
 * Read-only on the corpus; writes to src/modules/corpus-lab/offline/out/.
 * Run: `node src/modules/corpus-lab/offline/build-yeast-map.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import { streamRecords } from "./corpus.mjs";

const OUT_DIR = "src/modules/corpus-lab/offline/out";
const YEASTS = JSON.parse(fs.readFileSync("src/utils/presets.generated.yeasts.json", "utf8"));

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// base class for a preset: strainGroup, else a singleton keyed by lab code / name
function classOf(p) {
  if (p.strainGroup) return p.strainGroup;
  return "solo:" + (p.labProductId ? slug(p.labProductId) : slug(p.name));
}

// ── indexes ───────────────────────────────────────────────────────────────────
const byCode = new Map(); // normalized lab code -> preset
const byName = new Map(); // exact normalized name -> preset (for substitute resolution)
const STOP = new Set("ale yeast lager dry wheat beer ipa the and of co brewing brewery labs lab safale saflager safbrew danstar lallemand lalbrew fermentis wyeast whitelabs white imperial omega mangrove jack gigayeast escarpment bootleg biology yeastbay giga craft house home".split(" "));
const tokenIndex = new Map(); // distinctive name/alias token -> Set<preset>
const addToken = (t, p) => { if (t.length >= 4 && !STOP.has(t)) { if (!tokenIndex.has(t)) tokenIndex.set(t, new Set()); tokenIndex.get(t).add(p); } };
for (const p of YEASTS) {
  if (p.labProductId) {
    const up = p.labProductId.toUpperCase();
    byCode.set(up, p);
    byCode.set(up.replace(/[-\s]/g, ""), p);
  }
  if (p.name) {
    byName.set(norm(p.name), p);
    for (const t of norm(p.name).split(" ")) addToken(t, p);
    for (const al of p.strainGroupAliases || []) for (const t of norm(al).split(" ")) addToken(t, p);
  }
}
// resolve a substitute / alias reference (a full name OR a lab code) to a preset
function resolveRef(str) {
  const n = norm(str);
  if (byName.has(n)) return byName.get(n);
  const up = String(str).toUpperCase();
  return byCode.get(up) || byCode.get(up.replace(/[-\s]/g, "")) || null;
}

const CODE_RES = [
  /\bWLP\s?0?\d{2,3}\b/i,
  /\bOYL-?\s?\d+\b/i,
  /\bBRY-?\s?\d+\b/i,
  /\b(?:US|S|W|T|WB|BE|K|F|CBC|SO|LA)-\s?\d+(?:\/\d+)?\b/i,
  /\bA\s?\d{2}\b/,
  /\bM\s?\d{2}\b/,
  /\b\d{4}\b/, // Wyeast 4-digit — last (could be a year)
];

/** returns { preset, confidence } | { preset:null } */
function matchPreset(raw) {
  const s = String(raw || "").trim();
  if (!s || s === "- -" || /^-\s*-?$/.test(s)) return { preset: null, confidence: "none" };

  for (const re of CODE_RES) {
    const m = s.match(re);
    if (m) {
      const code = m[0].toUpperCase().replace(/\s/g, "");
      const hit = byCode.get(code) || byCode.get(code.replace(/[-]/g, ""));
      if (hit) return { preset: hit, confidence: "high" };
    }
  }
  // exact name
  const cn = norm(s);
  const exact = byName.get(cn);
  if (exact) return { preset: exact, confidence: "high" };
  // token-overlap fuzzy: shared distinctive name tokens (catches Nottingham, Belle Saison, …)
  const toks = cn.split(" ").filter((t) => t.length >= 4 && !STOP.has(t));
  const score = new Map();
  for (const t of toks) { const ps = tokenIndex.get(t); if (!ps) continue; for (const p of ps) score.set(p, (score.get(p) || 0) + 1); }
  let best = null, bestS = 0;
  for (const [p, sc] of score) if (sc > bestS) { bestS = sc; best = p; }
  if (best && bestS >= 1) return { preset: best, confidence: bestS >= 2 ? "high" : "medium" };
  return { preset: null, confidence: "low" };
}

// ── tally corpus yeast strings ─────────────────────────────────────────────────
const strings = new Map(); // raw -> count
await streamRecords((r) => {
  const y = Array.isArray(r.yeast) ? r.yeast[0] : null;
  const key = y ? String(y) : "(none)";
  strings.set(key, (strings.get(key) || 0) + 1);
});

// ── classify ───────────────────────────────────────────────────────────────────
const rows = [];
for (const [raw, count] of strings) {
  const { preset, confidence } = matchPreset(raw);
  if (!preset) {
    rows.push({ raw, count, cls: null, label: null, subs: [], confidence });
    continue;
  }
  const cls = classOf(preset);
  // soft-bridge classes: substitutes + strainGroupAliases that resolve to a real preset
  // (generic descriptor aliases like "California Ale" don't resolve → no false merges).
  const links = [...(preset.substitutes || []), ...(preset.strainGroupAliases || [])]
    .map(resolveRef)
    .filter(Boolean)
    .map(classOf)
    .filter((c) => c !== cls);
  rows.push({ raw, count, preset: preset.name, cls, label: preset.strainGroup || preset.name, subs: [...new Set(links)], confidence });
}
rows.sort((a, b) => b.count - a.count);

// ── class usage (multi-hot dimension budget) ──────────────────────────────────
const classUse = new Map();
for (const r of rows) if (r.cls) classUse.set(r.cls, (classUse.get(r.cls) || 0) + r.count);
const classesByUse = [...classUse.entries()].sort((a, b) => b[1] - a[1]);
const totalUses = rows.reduce((s, r) => s + r.count, 0);
const byConf = { high: 0, medium: 0, low: 0, none: 0 };
for (const r of rows) byConf[r.confidence] += r.count;
const pct = (n) => ((100 * n) / totalUses).toFixed(1) + "%";
const cover = (k) => { const t = classesByUse.reduce((s, c) => s + c[1], 0); const h = classesByUse.slice(0, k).reduce((s, c) => s + c[1], 0); return t ? ((100 * h) / t).toFixed(1) + "%" : "n/a"; };

// ── write ──────────────────────────────────────────────────────────────────────
fs.mkdirSync(OUT_DIR, { recursive: true });
const mapObj = {};
for (const r of rows) mapObj[r.raw] = { preset: r.preset || null, cls: r.cls, label: r.label, subs: r.subs, confidence: r.confidence, count: r.count };
fs.writeFileSync(path.join(OUT_DIR, "yeast-map.json"), JSON.stringify(mapObj, null, 0));

const review = ["# count\tconf\tclass\tsubs\traw\tpreset"];
for (const r of rows.slice(0, 200)) review.push(`${r.count}\t${r.confidence}\t${r.cls ?? ""}\t${(r.subs || []).length}\t${r.raw}\t${r.preset ?? ""}`);
fs.writeFileSync(path.join(OUT_DIR, "yeast-map.review.tsv"), review.join("\n"));

// ── summary ──────────────────────────────────────────────────────────────────
console.log("distinct yeast strings:", rows.length, "| total uses:", totalUses);
console.log("matched by confidence (share of USES): high", pct(byConf.high), "| medium", pct(byConf.medium), "| low(unmatched)", pct(byConf.low), "| none('- -')", pct(byConf.none));
console.log("distinct base classes used:", classUse.size, "| top-30 classes cover", cover(30), "of matched uses");
console.log("\ntop 20 classes by usage (multi-hot budget):");
for (const [c, n] of classesByUse.slice(0, 20)) console.log(`  ${n}\t${c}`);
console.log("\ntop 12 UNMATCHED strings (need a rule):");
for (const r of rows.filter((r) => r.confidence === "low").slice(0, 12)) console.log(`  ${r.count}\t${r.raw}`);
console.log("\noutputs →", OUT_DIR + "/yeast-map.json , yeast-map.review.tsv");
