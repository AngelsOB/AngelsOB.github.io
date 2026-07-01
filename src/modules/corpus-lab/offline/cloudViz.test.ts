/* eslint-disable no-console -- offline cloud-build/PCA runner reports to stdout */
import { describe, it, expect } from "vitest";
import { existsSync, writeFileSync, createWriteStream, readFileSync } from "node:fs";
import {
  passesFilter,
  recipeToVector,
  gristArchetypePct,
  parseHopAddition,
  type CorpusRecipe,
} from "./buildCloud";
import { MALT_FLAVOR_KEYS } from "../maltFlavor";
import { HOP_FLAVOR_KEYS } from "../../recipe/models/Presets";
import { streamRecords } from "./corpus.mjs";

const MALT = [...MALT_FLAVOR_KEYS];
const HOP = [...HOP_FLAVOR_KEYS];
const num = (x: unknown) => (typeof x === "number" && isFinite(x) ? x : 0);
const YMAP: Record<string, { cls: string | null; subs: string[]; preset: string | null }> =
  JSON.parse(readFileSync("src/modules/corpus-lab/offline/out/yeast-map.json", "utf8"));

// coarse style family for colouring the map
function family(style: string): string {
  const n = style.toLowerCase();
  if (/sour|gose|lambic|berliner|brett|\bwild\b|kettle/.test(n)) return "Sour/Wild";
  if (/stout|porter/.test(n)) return "Stout/Porter";
  if (/ipa|india pale/.test(n)) return "IPA";
  if (/wheat|weiss|weizen|witbier|\bwit\b|hefe/.test(n)) return "Wheat";
  if (/saison|farmhouse|belgian|tripel|dubbel|\bquad|abbey|biere de|grisette/.test(n)) return "Belgian";
  if (/barley\s?wine|wee heavy|old ale|imperial|strong/.test(n)) return "Strong";
  if (/lager|pilsner|\bpils\b|helles|märzen|marzen|bock|schwarz|dunkel|festbier|common|steam/.test(n)) return "Lager";
  if (/brown|amber|\bred\b|altbier|\balt\b|bitter|\besb\b|\bmild\b|scottish/.test(n)) return "Amber/Brown";
  if (/pale ale|blonde|golden|kölsch|kolsch|cream ale|\bapa\b/.test(n)) return "Pale/Blonde";
  return "Other";
}

// ── tiny PCA (no deps): standardise → covariance → power-iteration top-2 ────────
function standardise(rows: number[][], D: number) {
  const mean = new Array(D).fill(0);
  const std = new Array(D).fill(0);
  for (const r of rows) for (let j = 0; j < D; j++) mean[j] += r[j];
  for (let j = 0; j < D; j++) mean[j] /= rows.length;
  for (const r of rows) for (let j = 0; j < D; j++) { const d = r[j] - mean[j]; std[j] += d * d; }
  for (let j = 0; j < D; j++) std[j] = Math.sqrt(std[j] / rows.length) || 1;
  return { mean, std };
}
function covariance(rows: number[][], D: number, mean: number[], std: number[]) {
  const C = Array.from({ length: D }, () => new Array(D).fill(0));
  const z = new Array(D);
  for (const r of rows) {
    for (let j = 0; j < D; j++) z[j] = (r[j] - mean[j]) / std[j];
    for (let a = 0; a < D; a++) for (let b = a; b < D; b++) C[a][b] += z[a] * z[b];
  }
  for (let a = 0; a < D; a++) for (let b = a; b < D; b++) { C[a][b] /= rows.length; C[b][a] = C[a][b]; }
  return C;
}
function topEigen(C: number[][], D: number, iters = 150) {
  let v = Array.from({ length: D }, (_, i) => Math.sin(i + 1)); // deterministic init
  const normalise = (x: number[]) => { const n = Math.hypot(...x) || 1; return x.map((e) => e / n); };
  v = normalise(v);
  let val = 0;
  for (let it = 0; it < iters; it++) {
    const Cv = new Array(D).fill(0);
    for (let a = 0; a < D; a++) { let s = 0; for (let b = 0; b < D; b++) s += C[a][b] * v[b]; Cv[a] = s; }
    val = Math.hypot(...Cv);
    v = normalise(Cv);
  }
  return { vec: v, val };
}
function deflate(C: number[][], D: number, vec: number[], val: number) {
  for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) C[a][b] -= val * vec[a] * vec[b];
}

const RAW = "src/modules/corpus-lab/raw/recipes_full.txt";
const HEAVY = !!process.env.BUILD_CLOUD && existsSync(RAW);

describe.runIf(HEAVY)("cloudViz — persist cloud + PCA map (gated)", () => {
  it("writes cloud.ndjson and a 2D cloud-viz.json", async () => {
    const feats: number[][] = [];
    const styles: string[] = [];
    const out = createWriteStream("src/modules/corpus-lab/offline/out/cloud.ndjson");
    let id = 0;

    await streamRecords((r: CorpusRecipe) => {
      if (!passesFilter(r)) return;
      const v = recipeToVector(r);
      const grav = (v.og - 1) * 1000;
      const row = [
        ...MALT.map((k) => v.malt[k]),
        ...HOP.map((k) => v.hop[k]),
        grav, v.ibu, v.srm, v.buGu, v.maltBody,
      ];
      feats.push(row);
      styles.push(v.style);
      // full cloud record (gitignored) — enough to synthesise from neighbours later
      const hops = (r.hops ?? []).map(parseHopAddition).filter((h) => h !== null)
        .map((h) => [h!.name, +(h!.grams / (num(r.batch) || 20)).toFixed(2), h!.type, h!.timeMinutes]);
      const ym = YMAP[(r.yeast && r.yeast[0]) || ""] || null;
      // souring organisms are usually co-pitched (in `other`) or a blend — detect from
      // ingredient text only, NOT the style label (keeps the purity metric honest).
      const yos = (JSON.stringify(r.yeast ?? "") + " " + JSON.stringify(r.other ?? "")).toLowerCase();
      const srb = /brett|roeselare|melange|mixed cult|wild ale|dregs|\bfunk/.test(yos);
      const srl = /lacto|pedio|kettle sour|sour blend|sour culture|souring/.test(yos);
      out.write(JSON.stringify({
        id: id++, s: v.style, og: v.og, fg: v.fg, abv: v.abv, ibu: v.ibu, srm: v.srm,
        mb: +v.maltBody.toFixed(3),
        m: MALT.map((k) => +v.malt[k].toFixed(2)), h: HOP.map((k) => +v.hop[k].toFixed(2)),
        g: gristArchetypePct(r), hp: hops,
        yc: ym?.cls ?? null, ys: ym?.subs ?? [], yn: ym?.preset ?? null,
        srb: srb || undefined, srl: srl || undefined,
      }) + "\n");
    });
    out.end();

    const N = feats.length;
    const D = feats[0].length;
    console.log(`\nkept ${N} recipes, ${D}-dim vectors → cloud.ndjson`);

    // PCA → top 2 components
    const { mean, std } = standardise(feats, D);
    const C = covariance(feats, D, mean, std);
    const totalVar = C.reduce((s, row, i) => s + row[i], 0);
    const pc1 = topEigen(C, D);
    deflate(C, D, pc1.vec, pc1.val);
    const pc2 = topEigen(C, D);
    console.log(`PC1 ${((100 * pc1.val) / totalVar).toFixed(1)}% var, PC2 ${((100 * pc2.val) / totalVar).toFixed(1)}% var`);

    const project = (r: number[]) => {
      let x = 0, y = 0;
      for (let j = 0; j < D; j++) { const z = (r[j] - mean[j]) / std[j]; x += z * pc1.vec[j]; y += z * pc2.vec[j]; }
      return [x, y];
    };

    // sample ~6000 points for a renderable scatter (deterministic stride)
    const TARGET = 6000;
    const stride = Math.max(1, Math.floor(N / TARGET));
    const famNames = ["IPA", "Pale/Blonde", "Amber/Brown", "Stout/Porter", "Lager", "Wheat", "Belgian", "Sour/Wild", "Strong", "Other"];
    const famIdx = (f: string) => Math.max(0, famNames.indexOf(f));
    const points: Array<{ x: number; y: number; f: number }> = [];
    const famCount: Record<string, number> = {};
    for (let i = 0; i < N; i += stride) {
      const fam = family(styles[i]);
      famCount[fam] = (famCount[fam] || 0) + 1;
      const [x, y] = project(feats[i]);
      points.push({ x: +x.toFixed(2), y: +y.toFixed(2), f: famIdx(fam) });
    }
    // family centroids over the sample
    const cent: Record<number, { x: number; y: number; n: number }> = {};
    for (const p of points) { (cent[p.f] ??= { x: 0, y: 0, n: 0 }); cent[p.f].x += p.x; cent[p.f].y += p.y; cent[p.f].n++; }
    const centroids = Object.entries(cent).map(([f, c]) => ({ f: +f, x: +(c.x / c.n).toFixed(2), y: +(c.y / c.n).toFixed(2), n: c.n }));

    // what each axis "means": dominant feature loadings
    const FNAMES = [...MALT, ...HOP, "gravity", "ibu", "srm", "buGu", "maltBody"];
    const loadings = (vec: number[]) =>
      vec.map((w, j) => [FNAMES[j], +w.toFixed(2)] as [string, number])
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
    const pc1Load = loadings(pc1.vec);
    const pc2Load = loadings(pc2.vec);
    console.log("PC1 driven by:", pc1Load.map((l) => `${l[0]} ${l[1]}`).join(", "));
    console.log("PC2 driven by:", pc2Load.map((l) => `${l[0]} ${l[1]}`).join(", "));

    writeFileSync("src/modules/corpus-lab/offline/out/cloud-viz.json", JSON.stringify({
      pc1Var: +((100 * pc1.val) / totalVar).toFixed(1),
      pc2Var: +((100 * pc2.val) / totalVar).toFixed(1),
      pc1Load, pc2Load,
      families: famNames, famCount, centroids, points,
    }));
    console.log("families in sample:", famCount);
    console.log(`wrote cloud-viz.json (${points.length} points)`);

    expect(N).toBeGreaterThan(120_000);
    expect(points.length).toBeGreaterThan(2000);
  }, 600_000);
});
