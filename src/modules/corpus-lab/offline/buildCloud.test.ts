/* eslint-disable no-console -- offline build/validation runner reports to stdout */
import { describe, it, expect } from "vitest";
import { existsSync, writeFileSync } from "node:fs";
import {
  composition,
  passesFilter,
  parseHopAddition,
  recipeToVector,
  type CorpusRecipe,
  type RecipeVector,
} from "./buildCloud";
import { MALT_FLAVOR_KEYS } from "../maltFlavor";
import { HOP_FLAVOR_KEYS } from "../../recipe/models/Presets";
import { streamRecords } from "./corpus.mjs";

const MALT = [...MALT_FLAVOR_KEYS] as Array<keyof RecipeVector["malt"]>;
const HOP = [...HOP_FLAVOR_KEYS] as Array<keyof RecipeVector["hop"]>;

// fermentable row = [weightKg, name, ppg, colorL, %ofGrist]
const ferm = (name: string, pct: number): Array<string | number> => [1, name, 35, 3, pct];
const rec = (over: Partial<CorpusRecipe>): CorpusRecipe => ({ method: "All Grain", batch: 20, og: 1.05, fg: 1.012, abv: 5, ibu: 30, color: 8, ...over });

// ── filter ───────────────────────────────────────────────────────────────────
describe("buildCloud — passesFilter", () => {
  it("keeps an all-grain grist", () => {
    expect(passesFilter(rec({ fermentables: [ferm("American - Pale 2-Row", 90), ferm("American - Caramel / Crystal 40L", 10)] }))).toBe(true);
  });
  it("drops Extract and Partial Mash methods", () => {
    const f = [ferm("American - Pale 2-Row", 100)];
    expect(passesFilter(rec({ method: "Extract", fermentables: f }))).toBe(false);
    expect(passesFilter(rec({ method: "Partial Mash", fermentables: f }))).toBe(false);
  });
  it("drops all-grain recipes with >5% extract", () => {
    expect(passesFilter(rec({ fermentables: [ferm("American - Pale 2-Row", 70), ferm("Dry Malt Extract - Light", 30)] }))).toBe(false);
  });
  it("keeps a recipe with a little fruit (≤20% adjunct) but drops fruit-dominant", () => {
    expect(passesFilter(rec({ fermentables: [ferm("American - Pale 2-Row", 90), ferm("Pumpkin", 10)] }))).toBe(true);
    expect(passesFilter(rec({ fermentables: [ferm("American - Pale 2-Row", 70), ferm("Pumpkin", 30)] }))).toBe(false);
  });
  it("composition renormalises to ~100%", () => {
    const c = composition(rec({ fermentables: [ferm("American - Pale 2-Row", 40), ferm("Corn Sugar - Dextrose", 10)] }));
    expect(c.grain + c.sugar).toBeCloseTo(100, 6);
  });
});

// ── hop parsing ───────────────────────────────────────────────────────────────
describe("buildCloud — parseHopAddition", () => {
  it("parses a whirlpool with °F temperature", () => {
    const h = parseHopAddition([42, "Citra", "Pellet", 13, "Whirlpool                     at 170 °F", "15 min", 9, 10]);
    expect(h?.type).toBe("whirlpool");
    expect(h?.temperatureC).toBeCloseTo(((170 - 32) * 5) / 9, 1);
  });
  it("parses dry hop and boil", () => {
    expect(parseHopAddition([28, "Mosaic", "Pellet", 12, "Dry Hop", "7 days", 0, 8])?.type).toBe("dry hop");
    expect(parseHopAddition([20, "Magnum", "Pellet", 14, "Boil", "60 min", 30, 5])?.type).toBe("boil");
  });
  it("skips zero-gram / nameless rows", () => {
    expect(parseHopAddition([0, "Citra", "Pellet", 13, "Boil", "60 min", 0, 0])).toBeNull();
  });
});

// ── vector ────────────────────────────────────────────────────────────────────
describe("buildCloud — recipeToVector", () => {
  it("a stout grist is roast/coffee-forward, a pale is grainy/caramel", () => {
    const stout = recipeToVector(rec({ fermentables: [ferm("American - Pale 2-Row", 80), ferm("American - Roasted Barley", 12), ferm("American - Chocolate", 8)] }));
    const pale = recipeToVector(rec({ fermentables: [ferm("American - Pale 2-Row", 90), ferm("American - Caramel / Crystal 40L", 10)] }));
    expect(stout.malt.roast + stout.malt.coffee).toBeGreaterThan(pale.malt.roast + pale.malt.coffee);
    expect(pale.malt.caramel).toBeGreaterThan(stout.malt.caramel);
  });
  it("a Citra dry-hop drives the hop citrus axis", () => {
    const v = recipeToVector(rec({ hops: [[56, "Citra", "Pellet", 13, "Dry Hop", "5 days", 0, 0]] }));
    expect(v.hop.citrus).toBeGreaterThan(1);
    expect(v.hop.citrus).toBeGreaterThan(v.hop.herbal);
  });
});

// ── full corpus build (gated: BUILD_CLOUD=1 and raw data present) ──────────────
const RAW = "src/modules/corpus-lab/raw/recipes_full.txt";
const HEAVY = !!process.env.BUILD_CLOUD && existsSync(RAW);

type Acc = { n: number; og: number; fg: number; abv: number; ibu: number; srm: number; buGu: number; maltBody: number; malt: Record<string, number>; hop: Record<string, number> };
const newAcc = (): Acc => ({ n: 0, og: 0, fg: 0, abv: 0, ibu: 0, srm: 0, buGu: 0, maltBody: 0, malt: Object.fromEntries(MALT.map((k) => [k, 0])), hop: Object.fromEntries(HOP.map((k) => [k, 0])) });

describe.runIf(HEAVY)("buildCloud — full corpus (gated)", () => {
  it("filters, vectorises, validates clustering, writes per-style summary", async () => {
    const byStyle = new Map<string, Acc>();
    let kept = 0;
    const { parsed } = await streamRecords((r: CorpusRecipe) => {
      if (!passesFilter(r)) return;
      const v = recipeToVector(r);
      kept++;
      const a = byStyle.get(v.style) ?? newAcc();
      a.n++; a.og += v.og; a.fg += v.fg; a.abv += v.abv; a.ibu += v.ibu; a.srm += v.srm; a.buGu += v.buGu; a.maltBody += v.maltBody;
      for (const k of MALT) a.malt[k] += v.malt[k];
      for (const k of HOP) a.hop[k] += v.hop[k];
      byStyle.set(v.style, a);
    });

    console.log(`\nparsed ${parsed} | kept ${kept} (${((100 * kept) / parsed).toFixed(1)}%) | ${byStyle.size} styles`);

    const meanMalt = (s: string) => { const a = byStyle.get(s)!; return Object.fromEntries(MALT.map((k) => [k, a.malt[k] / a.n])); };
    const meanHop = (s: string) => { const a = byStyle.get(s)!; return Object.fromEntries(HOP.map((k) => [k, a.hop[k] / a.n])); };
    const show = (s: string) => {
      const a = byStyle.get(s); if (!a) return;
      const m = meanMalt(s); const h = meanHop(s);
      console.log(`${s} (n=${a.n}) OG ${(a.og / a.n).toFixed(3)} IBU ${(a.ibu / a.n).toFixed(0)} SRM ${(a.srm / a.n).toFixed(1)}`);
      console.log(`   malt: ${MALT.map((k) => `${k} ${m[k].toFixed(1)}`).join("  ")}`);
      console.log(`   hop:  ${HOP.map((k) => `${k} ${h[k].toFixed(1)}`).join("  ")}`);
    };
    ["American IPA", "American Pale Ale", "American Stout", "Russian Imperial Stout", "American Light Lager", "Saison"].forEach(show);

    // validation: roasty styles vs pale styles separate in malt space
    const stout = meanMalt("American Stout"); const ipa = meanMalt("American IPA");
    expect((stout.roast as number) + (stout.coffee as number)).toBeGreaterThan((ipa.roast as number) + (ipa.coffee as number));
    // hop-forward styles vs lager separate in hop space
    const ipaHop = meanHop("American IPA"); const lagerHop = meanHop("American Light Lager");
    expect((ipaHop.citrus as number) + (ipaHop.tropicalFruit as number)).toBeGreaterThan((lagerHop.citrus as number) + (lagerHop.tropicalFruit as number));
    expect(kept).toBeGreaterThan(120_000);

    // write per-style "typical brew" summary (facts-only, committable)
    const summary: Record<string, unknown> = {};
    for (const [style, a] of byStyle) {
      if (a.n < 50) continue;
      summary[style] = {
        n: a.n,
        og: +(a.og / a.n).toFixed(4), fg: +(a.fg / a.n).toFixed(4), abv: +(a.abv / a.n).toFixed(2),
        ibu: +(a.ibu / a.n).toFixed(1), srm: +(a.srm / a.n).toFixed(1), buGu: +(a.buGu / a.n).toFixed(2),
        maltBody: +(a.maltBody / a.n).toFixed(3),
        malt: Object.fromEntries(MALT.map((k) => [k, +(a.malt[k] / a.n).toFixed(2)])),
        hop: Object.fromEntries(HOP.map((k) => [k, +(a.hop[k] / a.n).toFixed(2)])),
      };
    }
    writeFileSync("src/modules/corpus-lab/offline/out/style-summary.json", JSON.stringify(summary, null, 0));
    console.log(`\nwrote style-summary.json (${Object.keys(summary).length} styles with n≥50)`);
  }, 300_000);
});
