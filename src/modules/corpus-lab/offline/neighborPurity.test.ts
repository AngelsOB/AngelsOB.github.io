/* eslint-disable no-console -- offline analysis runner reports to stdout */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { family } from "./styleFamily";

const CLOUD = "src/modules/corpus-lab/offline/out/cloud.ndjson";
const RUN = !!process.env.BUILD_CLOUD && existsSync(CLOUD);

describe.runIf(RUN)("neighborPurity — k-NN style purity, sweeping yeast weight (gated)", () => {
  it("shows how adding a weighted yeast multi-hot tightens yeast-driven families", () => {
    const FAMS = ["IPA", "Pale/Blonde", "Amber/Brown", "Stout/Porter", "Lager", "Wheat", "Belgian", "Sour/Wild", "Strong", "Other"];
    const fi = (f: string) => FAMS.indexOf(f);

    const lines = readFileSync(CLOUD, "utf8").split("\n").filter(Boolean);
    const N = lines.length, D = 23;
    const feats: number[][] = [];
    const fams = new Int8Array(N);
    const yc: (string | null)[] = [];
    const ys: string[][] = [];
    const srb: boolean[] = [], srl: boolean[] = [];
    for (let i = 0; i < N; i++) {
      const r = JSON.parse(lines[i]);
      const grav = (r.og - 1) * 1000;
      feats.push([...r.m, ...r.h, grav, r.ibu, r.srm, grav > 0 ? r.ibu / grav : 0, r.mb]);
      fams[i] = fi(family(r.s));
      yc.push(r.yc ?? null);
      ys.push(Array.isArray(r.ys) ? r.ys : []);
      srb.push(!!r.srb); srl.push(!!r.srl);
    }

    // yeast class vocab: top-40 base classes by usage
    const cnt = new Map<string, number>();
    for (const c of yc) if (c) cnt.set(c, (cnt.get(c) || 0) + 1);
    const vocab = new Map([...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([c], i) => [c, i]));
    const BRETT = vocab.size; vocab.set("__brett", BRETT); // dedicated souring dims (always present)
    const LACTO = vocab.size; vocab.set("__lacto", LACTO);
    const OWN = 1.0, SUB = 0.5;
    // sparse yeast block per record: Map<vocabIdx, weight>, plus its squared norm
    const yblk: Map<number, number>[] = [];
    const ynorm2 = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const m = new Map<number, number>();
      if (yc[i] && vocab.has(yc[i]!)) m.set(vocab.get(yc[i]!)!, OWN);
      for (const s of ys[i]) if (vocab.has(s)) { const idx = vocab.get(s)!; if (!m.has(idx)) m.set(idx, SUB); }
      if (srb[i]) m.set(BRETT, OWN);
      if (srl[i]) m.set(LACTO, OWN);
      yblk.push(m);
      let n2 = 0; for (const w of m.values()) n2 += w * w; ynorm2[i] = n2;
    }

    // standardise the 23 continuous dims
    const mean = new Array(D).fill(0), std = new Array(D).fill(0);
    for (const v of feats) for (let j = 0; j < D; j++) mean[j] += v[j];
    for (let j = 0; j < D; j++) mean[j] /= N;
    for (const v of feats) for (let j = 0; j < D; j++) { const d = v[j] - mean[j]; std[j] += d * d; }
    for (let j = 0; j < D; j++) std[j] = Math.sqrt(std[j] / N) || 1;
    const Z = (i: number) => { const z = new Float64Array(D); for (let j = 0; j < D; j++) z[j] = (feats[i][j] - mean[j]) / std[j]; return z; };

    const candIdx: number[] = []; for (let i = 0; i < N; i += Math.ceil(N / 15000)) candIdx.push(i);
    const candZ = candIdx.map(Z);
    const queryIdx: number[] = []; for (let i = 7; i < N; i += Math.ceil(N / 700)) queryIdx.push(i);
    const K = 25;

    function purityAt(W: number) {
      const W2 = W * W;
      const hist = FAMS.map(() => new Array(FAMS.length).fill(0));
      const qCount = new Array(FAMS.length).fill(0);
      for (const qi of queryIdx) {
        const qz = Z(qi), qf = fams[qi], qy = yblk[qi], qn2 = ynorm2[qi];
        const kd = new Float64Array(K).fill(Infinity); const kf = new Int8Array(K).fill(-1);
        let worst = Infinity, wIdx = 0;
        for (let c = 0; c < candZ.length; c++) {
          const ci = candIdx[c]; if (ci === qi) continue;
          const cz = candZ[c]; let d = 0;
          for (let j = 0; j < D; j++) { const t = qz[j] - cz[j]; d += t * t; }
          if (W2 > 0) { let dot = 0; for (const [k, w] of qy) { const cw = yblk[ci].get(k); if (cw) dot += w * cw; } d += W2 * (qn2 + ynorm2[ci] - 2 * dot); }
          if (d < worst) { kd[wIdx] = d; kf[wIdx] = fams[ci]; worst = -1; for (let i = 0; i < K; i++) if (kd[i] > worst) { worst = kd[i]; wIdx = i; } }
        }
        qCount[qf]++;
        for (let i = 0; i < K; i++) if (kf[i] >= 0) hist[qf][kf[i]]++;
      }
      const same = (f: number) => { const t = hist[f].reduce((a, b) => a + b, 0); return t ? (100 * hist[f][f]) / t : 0; };
      let os = 0, ot = 0; for (let f = 0; f < FAMS.length; f++) { os += hist[f][f]; ot += hist[f].reduce((a, b) => a + b, 0); }
      return { overall: (100 * os) / ot, byFam: FAMS.map((_, f) => same(f)) };
    }

    console.log(`\nyeast weight sweep (k=${K}, ${queryIdx.length} queries vs ${candZ.length} candidates, vocab=${vocab.size} classes)\n`);
    console.log(["W ", "overall", "IPA", "Belgian", "Sour", "Lager", "Wheat", "Stout"].map((s) => s.padStart(8)).join(""));
    for (const W of [0, 1, 2, 3, 4]) {
      const r = purityAt(W);
      const row = [W.toFixed(0), r.overall.toFixed(0), r.byFam[fi("IPA")].toFixed(0), r.byFam[fi("Belgian")].toFixed(0), r.byFam[fi("Sour/Wild")].toFixed(0), r.byFam[fi("Lager")].toFixed(0), r.byFam[fi("Wheat")].toFixed(0), r.byFam[fi("Stout/Porter")].toFixed(0)];
      console.log(row.map((s) => s.padStart(8)).join(""));
    }
    expect(vocab.size).toBeGreaterThan(0);
  }, 600_000);
});
