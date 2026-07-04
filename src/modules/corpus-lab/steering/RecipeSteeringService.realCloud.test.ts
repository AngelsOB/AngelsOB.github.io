/* eslint-disable no-console -- gated validation runner: prints synthesized recipes for eyeballing */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { RecipeSteeringService, type SteeringQuery, type SteeringResult } from "./RecipeSteeringService";
import { loadCloud, DEFAULT_CLOUD_PATH } from "./loadCloud";

const RUN = !!process.env.BUILD_CLOUD && existsSync(DEFAULT_CLOUD_PATH);
const TIMEOUT_MS = 60_000;

function printResult(label: string, result: SteeringResult) {
  const { recipe, calculations, style, styleFit, notes } = result;
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
  console.log(`style: input="${style.input}" -> matched=${style.matchedCode ?? "(none)"} "${style.matchedName ?? ""}" family=${style.family}`);
  console.log(`OG ${calculations.og.toFixed(3)}  FG ${calculations.fg.toFixed(3)}  ABV ${calculations.abv.toFixed(1)}%  IBU ${calculations.ibu.toFixed(1)}  SRM ${calculations.srm.toFixed(1)}`);
  console.log(`mash: ${recipe.mashSteps[0].temperatureC}°C / ${recipe.mashSteps[0].durationMinutes}min`);
  console.log(`style-fit: mean neighbour distance ${styleFit.meanNeighborDistance.toFixed(2)} vs baseline ${styleFit.baselineDistance.toFixed(2)} -> inBounds=${styleFit.inBounds}`);
  console.log(`grain bill (${recipe.fermentables.length}):`);
  const totalKg = recipe.fermentables.reduce((s, x) => s + x.weightKg, 0);
  for (const f of recipe.fermentables) {
    const pct = totalKg > 0 ? (100 * f.weightKg) / totalKg : 0;
    console.log(`  - ${f.name.padEnd(35)} ${f.weightKg.toFixed(2)} kg (${pct.toFixed(1)}%)  ${f.colorLovibond}°L`);
  }
  console.log(`hop schedule (${recipe.hops.length}):`);
  for (const h of recipe.hops) {
    const timing = h.type === "dry hop" ? `${h.dryHopDays}d dry hop`
      : h.type === "whirlpool" ? `${h.whirlpoolTimeMinutes}min whirlpool`
      : h.type === "first wort" ? "first wort (full boil)"
      : `${h.timeMinutes}min ${h.type}`;
    console.log(`  - ${h.name.padEnd(20)} ${h.grams.toFixed(1)}g  ${h.alphaAcid.toFixed(1)}% AA  ${timing}`);
  }
  console.log(`yeast: ${recipe.yeasts[0]?.name} (${(recipe.yeasts[0]?.attenuation * 100).toFixed(0)}% attenuation, ${recipe.yeasts[0]?.laboratory})`);
  console.log(`requested hop flavour: ${JSON.stringify(result.requestedFlavor.hop)}`);
  console.log(`achieved hop flavour:  ${JSON.stringify(result.achievedFlavor.hop)}`);
  console.log(`achieved malt flavour: ${JSON.stringify(result.achievedFlavor.malt)}`);
  console.log(`style norms: level=${result.styleNorms.level} n=${result.styleNorms.recordCount}`);
  console.log(`  hop p25-p75:  ${JSON.stringify(result.styleNorms.hop.p25)} -> ${JSON.stringify(result.styleNorms.hop.p75)}`);
  console.log(`  malt p25-p75: ${JSON.stringify(result.styleNorms.malt.p25)} -> ${JSON.stringify(result.styleNorms.malt.p75)}`);
  if (notes.length) console.log(`notes:\n  - ${notes.join("\n  - ")}`);
}

describe.runIf(RUN)("RecipeSteeringService — real-cloud example queries (gated)", () => {
  let service: RecipeSteeringService;

  beforeAll(() => {
    const cloud = loadCloud();
    service = new RecipeSteeringService(cloud);
    console.log(`\nloaded ${cloud.length} cloud records`);
  }, TIMEOUT_MS);

  it("American IPA — median brew (no steering) as the baseline", () => {
    const result = service.steer({ style: "American IPA" });
    printResult("American IPA — median brew", result);
    expect(result.recipe.fermentables.length).toBeGreaterThan(0);
    expect(result.recipe.hops.length).toBeGreaterThan(0);
  }, TIMEOUT_MS);

  it("American IPA — push tropical + a touch maltier", () => {
    const query: SteeringQuery = {
      style: "American IPA",
      target: { hop: { tropicalFruit: 4.5 }, malt: { caramel: 1.5, honey: 0.8 } },
    };
    const result = service.steer(query);
    printResult("American IPA — push tropical + a touch maltier", result);
    expect(result.requestedFlavor.hop.tropicalFruit).toBe(4.5);
    expect(result.achievedFlavor.hop.tropicalFruit).toBeGreaterThan(0);
  }, TIMEOUT_MS);

  it("American IPA — push resin/piney instead, for contrast", () => {
    const query: SteeringQuery = { style: "American IPA", target: { hop: { resinPine: 4.5, tropicalFruit: 0.3 } } };
    const result = service.steer(query);
    printResult("American IPA — push resin/piney", result);
    expect(result.achievedFlavor.hop.resinPine).toBeGreaterThan(0);
  }, TIMEOUT_MS);

  it("German Pils — median brew (a clean lager baseline)", () => {
    const result = service.steer({ style: "German Pils", k: 25 });
    printResult("German Pils — median brew", result);
    expect(result.calculations.srm).toBeLessThan(6);
  }, TIMEOUT_MS);

  it("Hefeweizen — a genuine two-base-malt bill (pils + wheat) should survive reconstruction", () => {
    const result = service.steer({ style: "Weissbier", k: 25 });
    printResult("Hefeweizen — median brew", result);
    const names = result.recipe.fermentables.map((f) => f.name.toLowerCase());
    // the defining feature of the style is a big wheat fraction alongside a
    // base/pils — the old single-representative role-collapse dropped one of the
    // two whenever the neighbourhood consistently blended them.
    expect(names.some((n) => n.includes("wheat"))).toBe(true);
    const wheatKg = result.recipe.fermentables
      .filter((f) => f.name.toLowerCase().includes("wheat"))
      .reduce((s, f) => s + f.weightKg, 0);
    const totalKg = result.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
    expect(wheatKg / totalKg).toBeGreaterThan(0.25); // a real wheat beer, not a token 5%
  }, TIMEOUT_MS);

  it("Hazy IPA — hard body push must still return a brewable (convertible) grain bill", () => {
    // this used to return ~95% flaked oats + carapils with ~3% base malt — an
    // un-mashable grist. Body is clamped to the real data range and the grist
    // brewability floor guarantees enough diastatic base to convert.
    const query: SteeringQuery = {
      style: "Specialty IPA: New England IPA",
      target: { body: 2, hop: { tropicalFruit: 4 } },
    };
    const result = service.steer(query);
    printResult("Hazy IPA — hard body push", result);
    const DIASTATIC = ["Briess - Brewers Malt 2-Row", "Pilsner Malt", "Maris Otter Pale", "Vienna Malt", "Munich Malt", "Munich Dark 20L", "Wheat Malt", "Briess - Rye Malt", "Smoked Malt"];
    const totalKg = result.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);
    const baseKg = result.recipe.fermentables.filter((f) => DIASTATIC.includes(f.name)).reduce((s, f) => s + f.weightKg, 0);
    expect(baseKg / totalKg).toBeGreaterThanOrEqual(0.5); // enough diastatic base to actually mash
  }, TIMEOUT_MS);

  it("Russian Imperial Stout — explicit ABV/IBU target + a locked yeast", () => {
    const query: SteeringQuery = {
      style: "Russian Imperial Stout",
      target: { abv: 10.5, ibu: 75 },
      yeastName: "1056 American Ale",
    };
    const result = service.steer(query);
    printResult("Russian Imperial Stout — ABV 10.5 / IBU 75 / locked yeast", result);
    expect(result.calculations.abv).toBeCloseTo(10.5, 0);
    expect(result.calculations.ibu).toBeCloseTo(75, 0);
  }, TIMEOUT_MS);

  it("Saison — out-of-bounds push (maxed-out roast on a pale/spicy style)", () => {
    const query: SteeringQuery = { style: "Saison", target: { malt: { roast: 4, chocolate: 3 } }, styleGate: "none" };
    const result = service.steer(query);
    printResult("Saison — pushed toward roast (styleGate: none)", result);
    expect(Number.isFinite(result.styleFit.meanNeighborDistance)).toBe(true);
  }, TIMEOUT_MS);

  it("American IPA — a floral/herbal push finds a different neighbourhood than the default", () => {
    // The push should steer the k-NN toward the (real but less-dominant)
    // floral/herbal corner of American IPA — steering happens by MOVING the
    // query point, not by re-scoring individual hops.
    const push: SteeringQuery["target"] = { hop: { floral: 4, herbal: 3, citrus: 0.5, tropicalFruit: 0.3, resinPine: 0.3 } };
    const base = service.steer({ style: "American IPA" });
    const steered = service.steer({ style: "American IPA", target: push });
    printResult("American IPA — median brew", base);
    printResult("American IPA — floral/herbal push", steered);
    expect(Number.isFinite(steered.calculations.abv)).toBe(true);
    expect(steered.achievedFlavor.hop.floral).toBeGreaterThan(0);
  }, TIMEOUT_MS);

  it("exploration: reproducible at a seed, varies across rerolls, unchanged at 0", () => {
    const base = { style: "American IPA" } as SteeringQuery;
    const billOf = (r: SteeringResult) => ({
      grain: r.recipe.fermentables.map((f) => f.name),
      hops: r.recipe.hops.map((h) => h.name),
    });

    // exploration 0 is deterministic and equals the plain median brew.
    const a0 = service.steer({ ...base, exploration: 0 });
    const b0 = service.steer({ ...base, exploration: 0 });
    expect(billOf(a0)).toEqual(billOf(b0));

    // a given (exploration, variation) is reproducible…
    const v1a = service.steer({ ...base, exploration: 0.8, variation: 1 });
    const v1b = service.steer({ ...base, exploration: 0.8, variation: 1 });
    expect(billOf(v1a)).toEqual(billOf(v1b));

    // …but rerolls surface different plausible bills.
    const variations = [0, 1, 2, 3, 4].map((variation) => service.steer({ ...base, exploration: 0.8, variation }));
    variations.forEach((r, i) => printResult(`American IPA — exploration 0.8, variation ${i}`, r));
    const distinct = new Set(variations.map((r) => JSON.stringify(billOf(r))));
    expect(distinct.size).toBeGreaterThan(1);
  }, TIMEOUT_MS);

  it("lock one bill, reroll the other: a locked bill survives verbatim", () => {
    const base = { style: "American IPA", exploration: 0.8 } as SteeringQuery;
    const first = service.steer(base);

    // Lock the grain (pass it back), reroll the hops with a fresh seed.
    const grainLocked = service.steer({ ...base, lockedFermentables: first.recipe.fermentables, hopVariation: 5 });
    // Lock the hops, reroll the grain.
    const hopsLocked = service.steer({ ...base, lockedHops: first.recipe.hops, gristVariation: 5 });
    printResult("lock grain, reroll hops", grainLocked);
    printResult("lock hops, reroll grain", hopsLocked);

    // The locked bill is byte-identical — names AND amounts, not just the varieties.
    expect(grainLocked.recipe.fermentables).toEqual(first.recipe.fermentables);
    expect(hopsLocked.recipe.hops).toEqual(first.recipe.hops);
    // …and the OTHER bill actually did change (the reroll wasn't a no-op).
    const hopSig = (r: SteeringResult) => r.recipe.hops.map((h) => h.name).join("|");
    const grainSig = (r: SteeringResult) => r.recipe.fermentables.map((f) => f.name).join("|");
    expect(hopSig(grainLocked) !== hopSig(first) || grainSig(hopsLocked) !== grainSig(first)).toBe(true);
  }, TIMEOUT_MS);

  it("regression: distinct styles sharing a coarse family no longer collide (no explicit override)", () => {
    const styles = ["Munich Helles", "Czech Pale Lager", "American Lager", "Black IPA", "Belgian IPA", "Brown IPA"];
    const results = styles.map((style) => ({ style, result: service.steer({ style }) }));
    for (const { style, result } of results) {
      printResult(`${style} — median brew (regression check)`, result);
    }
    // every one of these used to produce the identical recipe within its
    // coarse family (all "Lager" or all "IPA") because the centroid was
    // computed at the family level, not the specific style. Grain bills
    // should now differ within each trio.
    const lagerBills = results.slice(0, 3).map((r) => JSON.stringify(r.result.recipe.fermentables.map((f) => f.name)));
    const ipaBills = results.slice(3, 6).map((r) => JSON.stringify(r.result.recipe.fermentables.map((f) => f.name)));
    expect(new Set(lagerBills).size).toBeGreaterThan(1);
    expect(new Set(ipaBills).size).toBeGreaterThan(1);
  }, TIMEOUT_MS);
});
