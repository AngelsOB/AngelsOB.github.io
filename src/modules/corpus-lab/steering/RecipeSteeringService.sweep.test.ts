/* eslint-disable no-console -- gated benchmark: sweeps engine variants and prints a comparison table */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { RecipeSteeringService, type SteeringQuery, type SteeringResult } from "./RecipeSteeringService";
import { loadCloud, DEFAULT_CLOUD_PATH } from "./loadCloud";
import type { CloudRecord } from "./featureSpace";
import { MALT_FLAVOR_KEYS } from "../maltFlavor";
import { HOP_FLAVOR_KEYS } from "../../recipe/models/Presets";
import { archetypeForPresetName } from "./reconstruction";

const RUN = !!process.env.BUILD_CLOUD && existsSync(DEFAULT_CLOUD_PATH);
const TIMEOUT_MS = 300_000;

// ── engine variants (ablation ladder), naive → full ──────────────────────────
// Each toggles one more piece of the machinery we built this session, so the
// table shows what each layer actually earns.
const VARIANTS: Array<{ name: string; flags: Partial<SteeringQuery> }> = [
  { name: "naive        ", flags: { candidates: 1, correctResidual: false, splitNeighbourhoods: false, styleGate: "none" } }, // single-shot, whole-cloud, no correction
  { name: "+adaptiveGate ", flags: { candidates: 1, correctResidual: false, splitNeighbourhoods: false } }, // stay in-style
  { name: "+rerank       ", flags: { candidates: 16, correctResidual: false, splitNeighbourhoods: false, wildness: 0.3 } },
  { name: "+correction   ", flags: { candidates: 16, correctResidual: true, splitNeighbourhoods: false, wildness: 0.3 } },
  { name: "full(+split)  ", flags: { candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 0.3 } },
];

// ── styles + a style-appropriate push to measure alignment on ────────────────
const STYLES: Array<{ label: string; style: string; needle: string; push: NonNullable<SteeringQuery["target"]> }> = [
  { label: "Hazy IPA    ", style: "Specialty IPA: New England IPA", needle: "new england", push: { hop: { tropicalFruit: 3.5 } } },
  { label: "American IPA ", style: "American IPA", needle: "american ipa", push: { hop: { resinPine: 3.5 } } },
  { label: "American Stout", style: "American Stout", needle: "american stout", push: { malt: { coffee: 2.5 } } },
  { label: "German Pils  ", style: "German Pils", needle: "german pils", push: { malt: { biscuit: 1.2 } } },
  { label: "Amber Ale    ", style: "American Amber Ale", needle: "american amber", push: { malt: { caramel: 2 } } },
  { label: "Saison       ", style: "Saison", needle: "saison", push: { malt: { honey: 1.2 } } },
  { label: "Munich Dunkel", style: "Munich Dunkel", needle: "munich dunkel", push: { malt: { caramel: 1.5 } } },
];

const percentile = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))] : 0);

describe.runIf(RUN)("RecipeSteeringService — engine variant sweep (gated benchmark)", () => {
  let service: RecipeSteeringService;
  let cloud: CloudRecord[];
  beforeAll(() => {
    cloud = loadCloud();
    service = new RecipeSteeringService(cloud);
  }, TIMEOUT_MS);

  it("sweeps naive → full across styles and reports in-style / representativeness / alignment", () => {
    // Per-style corpus stats: which grain archetypes are genuinely in-style (used
    // by ≥10% of the style's real recipes), and the p10–p90 flavour range.
    const styleStats = new Map<string, { grainPrev: Record<string, number>; band: { malt: Array<[number, number]>; hop: Array<[number, number]> } }>();
    for (const { needle } of STYLES) {
      const recs = cloud.filter((r) => r.s.toLowerCase().includes(needle));
      const grainPrev: Record<string, number> = {};
      for (const r of recs) for (const a of Object.keys(r.g)) if ((r.g[a] ?? 0) > 0) grainPrev[a] = (grainPrev[a] ?? 0) + 1;
      for (const a of Object.keys(grainPrev)) grainPrev[a] /= recs.length || 1;
      const band = {
        malt: MALT_FLAVOR_KEYS.map((_, i) => { const v = recs.map((r) => r.m[i]).sort((a, b) => a - b); return [percentile(v, 0.1), percentile(v, 0.9)] as [number, number]; }),
        hop: HOP_FLAVOR_KEYS.map((_, i) => { const v = recs.map((r) => r.h[i]).sort((a, b) => a - b); return [percentile(v, 0.1), percentile(v, 0.9)] as [number, number]; }),
      };
      styleStats.set(needle, { grainPrev, band });
    }

    // off-style grain rate: share of grain weight in archetypes <10% of the style uses.
    const offStyleRate = (r: SteeringResult, needle: string) => {
      const { grainPrev } = styleStats.get(needle)!;
      const total = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      let off = 0;
      for (const f of r.recipe.fermentables) {
        const arch = archetypeForPresetName(f.name);
        if (arch && (grainPrev[arch] ?? 0) < 0.1) off += f.weightKg;
      }
      return off / total;
    };
    // representativeness: fraction of the 18 flavour axes whose achieved value sits
    // inside the style's real p10–p90 band.
    const inBandRate = (r: SteeringResult, needle: string) => {
      const { band } = styleStats.get(needle)!;
      let inb = 0;
      MALT_FLAVOR_KEYS.forEach((k, i) => { const v = r.achievedFlavor.malt[k]; if (v >= band.malt[i][0] - 1e-6 && v <= band.malt[i][1] + 1e-6) inb++; });
      HOP_FLAVOR_KEYS.forEach((k, i) => { const v = r.achievedFlavor.hop[k]; if (v >= band.hop[i][0] - 1e-6 && v <= band.hop[i][1] + 1e-6) inb++; });
      return inb / (MALT_FLAVOR_KEYS.length + HOP_FLAVOR_KEYS.length);
    };
    // alignment error on the pushed axes (normalised RMS, scaled by axisMax).
    const pushErr = (q: SteeringQuery, r: SteeringResult) => {
      const terms: number[] = [];
      for (const k of MALT_FLAVOR_KEYS) { const w = q.target?.malt?.[k]; if (w == null) continue; terms.push(((r.achievedFlavor.malt[k] - w) / Math.max(r.axisMax.malt[k], 0.1)) ** 2); }
      for (const k of HOP_FLAVOR_KEYS) { const w = q.target?.hop?.[k]; if (w == null) continue; terms.push(((r.achievedFlavor.hop[k] - w) / Math.max(r.axisMax.hop[k], 0.1)) ** 2); }
      return terms.length ? Math.sqrt(terms.reduce((s, t) => s + t, 0) / terms.length) : 0;
    };

    // Accumulate metrics per variant across all styles.
    const agg = VARIANTS.map(() => ({ off: 0, inband: 0, align: 0, n: 0 }));
    for (let vi = 0; vi < VARIANTS.length; vi++) {
      for (const st of STYLES) {
        const rest = service.steer({ style: st.style, ...VARIANTS[vi].flags });
        agg[vi].off += offStyleRate(rest, st.needle);
        agg[vi].inband += inBandRate(rest, st.needle);
        const pq: SteeringQuery = { style: st.style, target: st.push, ...VARIANTS[vi].flags };
        agg[vi].align += pushErr(pq, service.steer(pq));
        agg[vi].n += 1;
      }
    }

    console.log(`\nENGINE VARIANT SWEEP — averaged over ${STYLES.length} styles (lower off-style & align = better; higher in-band = better)\n`);
    console.log(`${"variant".padEnd(15)} ${"off-style%".padStart(11)} ${"in-band%".padStart(10)} ${"alignErr".padStart(10)}`);
    VARIANTS.forEach((v, i) => {
      const a = agg[i];
      console.log(`${v.name} ${(100 * a.off / a.n).toFixed(1).padStart(10)}% ${(100 * a.inband / a.n).toFixed(0).padStart(9)}% ${(a.align / a.n).toFixed(3).padStart(10)}`);
    });

    // The full stack should beat naive on all three axes.
    const naive = agg[0], full = agg[VARIANTS.length - 1];
    expect(full.off / full.n).toBeLessThanOrEqual(naive.off / naive.n + 1e-6); // no worse off-style
    expect(full.align / full.n).toBeLessThan(naive.align / naive.n); // better alignment
  }, TIMEOUT_MS);
});
