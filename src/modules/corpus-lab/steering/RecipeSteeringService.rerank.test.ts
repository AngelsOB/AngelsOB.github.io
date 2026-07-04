/* eslint-disable no-console -- gated measurement runner: prints alignment deltas for eyeballing */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { RecipeSteeringService, type SteeringQuery, type SteeringResult } from "./RecipeSteeringService";
import { loadCloud, DEFAULT_CLOUD_PATH } from "./loadCloud";
import { MALT_FLAVOR_KEYS } from "../maltFlavor";
import { HOP_FLAVOR_KEYS } from "../../recipe/models/Presets";

const RUN = !!process.env.BUILD_CLOUD && existsSync(DEFAULT_CLOUD_PATH);
const TIMEOUT_MS = 120_000;

/**
 * Alignment error we actually care about: how far the ACHIEVED flavour sits from
 * what the user asked for, ON THE AXES THEY PUSHED, normalised by each axis's
 * realistic ceiling (axisMax) so malt and hop axes are comparable. RMS over the
 * pushed axes; 0 = hit every pushed axis exactly. This is the number the rerank
 * is meant to drive down — measured independently of the (differently-weighted)
 * score the rerank optimises internally.
 */
function pushedAxisError(query: SteeringQuery, r: SteeringResult): number {
  const terms: number[] = [];
  for (const key of MALT_FLAVOR_KEYS) {
    const want = query.target?.malt?.[key];
    if (want == null) continue;
    const max = Math.max(r.axisMax.malt[key], 0.1);
    terms.push(((r.achievedFlavor.malt[key] - want) / max) ** 2);
  }
  for (const key of HOP_FLAVOR_KEYS) {
    const want = query.target?.hop?.[key];
    if (want == null) continue;
    const max = Math.max(r.axisMax.hop[key], 0.1);
    terms.push(((r.achievedFlavor.hop[key] - want) / max) ** 2);
  }
  if (terms.length === 0) return 0;
  return Math.sqrt(terms.reduce((s, t) => s + t, 0) / terms.length);
}

/** Representative single- and multi-axis pushes across styles. */
const QUERIES: Array<{ label: string; query: SteeringQuery }> = [
  { label: "IPA · berry 3.5", query: { style: "American IPA", target: { hop: { berry: 3.5 } } } },
  { label: "IPA · tropical 4.5", query: { style: "American IPA", target: { hop: { tropicalFruit: 4.5 } } } },
  { label: "IPA · resin/pine 4.5", query: { style: "American IPA", target: { hop: { resinPine: 4.5 } } } },
  { label: "IPA · floral 4 + herbal 3", query: { style: "American IPA", target: { hop: { floral: 4, herbal: 3 } } } },
  { label: "IPA · stone fruit 4", query: { style: "American IPA", target: { hop: { stoneFruit: 4 } } } },
  { label: "Pale Ale · citrus 4", query: { style: "American Pale Ale", target: { hop: { citrus: 4 } } } },
  { label: "Porter · coffee 3 + choc 2.5", query: { style: "American Porter", target: { malt: { coffee: 3, chocolate: 2.5 } } } },
  { label: "Amber · caramel 3", query: { style: "American Amber Ale", target: { malt: { caramel: 3 } } } },
];

describe.runIf(RUN)("RecipeSteeringService — rerank alignment measurement (gated)", () => {
  let service: RecipeSteeringService;
  beforeAll(() => {
    service = new RecipeSteeringService(loadCloud());
  }, TIMEOUT_MS);

  it("split neighbourhoods: a conflicting malt+hop push draws each bill from its own dense region", () => {
    // Roasty malt AND tropical hops — each common alone, the combination rare, so a
    // single joint query lands in a sparse corner. Split should draw a coherent
    // roast-forward grain from real dark beers and tropical hops from real IPAs.
    const query: SteeringQuery = {
      style: "American IPA",
      target: { malt: { roast: 3, chocolate: 2 }, hop: { tropicalFruit: 4 } },
      candidates: 16, wildness: 0.5, correctResidual: true,
    };
    const joint = service.steer({ ...query, splitNeighbourhoods: false });
    const splitR = service.steer({ ...query, splitNeighbourhoods: true });

    const summarize = (label: string, r: SteeringResult) => {
      const totalKg = r.recipe.fermentables.reduce((s, x) => s + x.weightKg, 0) || 1;
      const grain = r.recipe.fermentables.map((f) => `${f.name} ${(100 * f.weightKg / totalKg).toFixed(0)}%`).join(", ");
      const hops = [...new Set(r.recipe.hops.map((h) => h.name))].join(", ");
      console.log(`\n${label}: styleFit ${r.styleFit.band} (ratio ${r.styleFit.ratio.toFixed(2)})`);
      console.log(`  grain: ${grain}`);
      console.log(`  hops:  ${hops}`);
      console.log(`  achieved — malt roast ${r.achievedFlavor.malt.roast.toFixed(2)} / choc ${r.achievedFlavor.malt.chocolate.toFixed(2)} | hop tropical ${r.achievedFlavor.hop.tropicalFruit.toFixed(2)}`);
    };
    summarize("JOINT (split off)", joint);
    summarize("SPLIT (split on)", splitR);

    // Both stay brewable; split must keep BOTH the roast push and the tropical push
    // (the joint version tends to compromise one away in the sparse middle).
    expect(splitR.recipe.fermentables.length).toBeGreaterThan(0);
    expect(splitR.recipe.hops.length).toBeGreaterThan(0);
    expect(splitR.achievedFlavor.malt.roast).toBeGreaterThan(0.5);
    expect(splitR.achievedFlavor.hop.tropicalFruit).toBeGreaterThan(0.5);
  }, TIMEOUT_MS);

  it("diagnose: what's actually in the American Light Lager neighbourhood (matching noise)?", () => {
    const cloud = loadCloud();
    const byId = new Map(cloud.map((r) => [r.id, r]));
    const CRYSTAL = ["crystal-light", "crystal-medium", "crystal-dark", "special-b"];
    const r = service.steer({ style: "American Light Lager", candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 0.3 });
    const nb = r.neighborhood.recordIds.map((id) => byId.get(id)).filter(Boolean) as typeof cloud;
    const styleCounts = new Map<string, number>();
    for (const x of nb) styleCounts.set(x.s, (styleCounts.get(x.s) ?? 0) + 1);
    console.log(`\nAmerican Light Lager neighbourhood (${nb.length} records), raw styles present:`);
    for (const [s, n] of [...styleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(3)}×  ${s}`);
    const withCrystal = nb.filter((x) => CRYSTAL.some((c) => (x.g[c] ?? 0) > 0));
    console.log(`  → ${withCrystal.length}/${nb.length} of the neighbourhood use crystal`);
    const srm = nb.map((x) => x.srm).sort((a, b) => a - b);
    console.log(`  SRM range: ${srm[0]?.toFixed(1)}–${srm[srm.length - 1]?.toFixed(1)} (a real light lager is ~2-4)`);

    // Would a BJCP-SRM data-quality filter isolate the REAL light lagers? Look at all
    // corpus recipes literally labeled "American Light Lager", banded by SRM.
    const all = cloud.filter((x) => x.s === "American Light Lager");
    const usesCrystal = (x: typeof all[number]) => CRYSTAL.some((c) => (x.g[c] ?? 0) > 0);
    for (const [lo, hi] of [[0, 4], [4, 8], [8, 99]] as const) {
      const band = all.filter((x) => x.srm >= lo && x.srm < hi);
      const cry = band.filter(usesCrystal).length;
      console.log(`  SRM ${lo}-${hi}: ${band.length} recs (${(100 * band.length / all.length).toFixed(0)}%), ${band.length ? (100 * cry / band.length).toFixed(0) : "0"}% use crystal`);
    }
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: are clean lagers actually style-locked, or falling back to the broad family?", () => {
    const styles = ["American Light Lager", "American Lager", "International Pale Lager", "Munich Helles", "German Pils", "Czech Pale Lager"];
    console.log("\nclean-lager style-lock check (crystal shouldn't appear):");
    for (const style of styles) {
      const r = service.steer({ style, candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 0.3 });
      const totalKg = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      const cry = r.recipe.fermentables.filter((f) => /crystal|caramel|special b/i.test(f.name));
      const cryPct = (100 * cry.reduce((s, f) => s + f.weightKg, 0) / totalKg).toFixed(0);
      const widened = r.notes.find((n) => n.includes("widened") || n.includes("family") || n.includes("fewer than"));
      console.log(`  ${style.padEnd(24)} centroid=${r.styleNorms.level.padEnd(6)} n=${String(r.styleNorms.recordCount).padStart(5)} fam=${r.style.family.padEnd(6)} crystal=${cryPct}%`);
      console.log(`      bill: ${r.recipe.fermentables.map((f) => f.name).join(", ")}`);
      if (widened) console.log(`      note: ${widened}`);
    }
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: escalation sanity across styles (did we break stouts / malty lagers)?", () => {
    const grist = (style: string, target?: SteeringQuery["target"]) => {
      const r = service.steer({ style, target, correctResidual: true, splitNeighbourhoods: true, candidates: 16, wildness: 0.3 });
      const totalKg = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      const bill = r.recipe.fermentables.map((f) => `${f.name} ${(100 * f.weightKg / totalKg).toFixed(0)}%`).join(", ");
      const m = r.achievedFlavor.malt;
      return `${bill}\n      achieved: caramel ${m.caramel.toFixed(2)} roast ${m.roast.toFixed(2)} choc ${m.chocolate.toFixed(2)} coffee ${m.coffee.toFixed(2)} honey ${m.honey.toFixed(2)} biscuit ${m.biscuit.toFixed(2)}`;
    };
    const cases: Array<[string, string, SteeringQuery["target"] | undefined]> = [
      ["American Stout", "American Stout", undefined],
      ["American Stout + coffee 3", "American Stout", { malt: { coffee: 3 } }],
      ["Munich Helles", "Munich Helles", undefined],
      ["Munich Helles + honey 1.5", "Munich Helles", { malt: { honey: 1.5 } }],
      ["Munich Dunkel + caramel 2", "Munich Dunkel", { malt: { caramel: 2 } }],
      ["Vienna Lager", "Vienna Lager", undefined],
      ["American Amber Ale + caramel 2.5", "American Amber Ale", { malt: { caramel: 2.5 } }],
      ["Doppelbock", "Doppelbock", undefined],
    ];
    console.log("\nescalation sanity across styles:");
    for (const [label, style, target] of cases) console.log(`  ${label}:\n      ${grist(style, target)}`);
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: gentlest-first escalation — munich for small pushes, crystal only for big?", () => {
    const style = "Specialty IPA: New England IPA";
    const grist = (target: SteeringQuery["target"]) => {
      const r = service.steer({ style, target, correctResidual: true, splitNeighbourhoods: true, candidates: 16, wildness: 0.3 });
      const totalKg = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      return r.recipe.fermentables.map((f) => `${f.name} ${(100 * f.weightKg / totalKg).toFixed(0)}%`).join(", ");
    };
    console.log("\nescalation on a hazy — which depth grain does each push reach for:");
    console.log(`  caramel 0.5 (small): ${grist({ malt: { caramel: 0.5 } })}`);
    console.log(`  caramel 1.2 (med):   ${grist({ malt: { caramel: 1.2 } })}`);
    console.log(`  caramel 2.5 (big):   ${grist({ malt: { caramel: 2.5 } })}`);
    console.log(`  honey 1.0:           ${grist({ malt: { honey: 1.0 } })}`);
    console.log(`  honey 2.0 (big):     ${grist({ malt: { honey: 2.0 } })}`);
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: is the hazy neighbourhood polluted by other styles (crystal leak)?", () => {
    const cloud = loadCloud();
    const byId = new Map(cloud.map((r) => [r.id, r]));
    const style = "Specialty IPA: New England IPA";
    const crystalPct = (q: SteeringQuery) => {
      const r = service.steer(q);
      const totalKg = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      const cry = r.recipe.fermentables.filter((f) => /crystal|caramel|special b/i.test(f.name));
      return 100 * cry.reduce((s, f) => s + f.weightKg, 0) / totalKg;
    };
    const configs: Array<[string, SteeringQuery["styleGate"] | "default"]> = [["default(adaptive)", "default"], ["family", "family"], ["strict", "strict"]];
    for (const [gate, styleGate] of configs) {
      const q: SteeringQuery = { style, styleGate: styleGate === "default" ? undefined : styleGate, candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 0.3 };
      const r = service.steer(q);
      const nb = r.neighborhood.recordIds.map((id) => byId.get(id)).filter(Boolean) as typeof cloud;
      const isNeipa = nb.filter((x) => x.s.toLowerCase().includes("new england") || x.s.toLowerCase().includes("hazy")).length;
      const styleCounts = new Map<string, number>();
      for (const x of nb) styleCounts.set(x.s, (styleCounts.get(x.s) ?? 0) + 1);
      const topStyles = [...styleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s, n]) => `${s}×${n}`).join(", ");
      const crystalTakes = [0, 1, 2, 3, 4, 5, 6, 7].filter((v) => crystalPct({ ...q, gristVariation: v, hopVariation: v }) > 0.5).length;
      console.log(`\ngate=${gate}: neighbourhood ${isNeipa}/${nb.length} actually hazy | crystal in ${crystalTakes}/8 takes`);
      console.log(`  top styles in neighbourhood: ${topStyles}`);
    }
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: what depth grains do corpus hazies actually use (crystal vs munich vs vienna)?", () => {
    const cloud = loadCloud();
    const GROUPS: Record<string, string[]> = {
      crystal: ["crystal-light", "crystal-medium", "crystal-dark", "special-b"],
      munich: ["munich-light", "munich-dark"],
      vienna: ["vienna"],
      honeyMalt: ["honey-malt"],
      melanoidin: ["melanoidin"],
    };
    const report = (needle: string) => {
      const recs = cloud.filter((r) => r.s.toLowerCase().includes(needle));
      console.log(`\n${needle} (${recs.length} recs):`);
      for (const [name, slugs] of Object.entries(GROUPS)) {
        const used = recs.filter((r) => slugs.some((s) => (r.g[s] ?? 0) > 0)).length;
        const meanPct = recs.reduce((sum, r) => sum + slugs.reduce((a, s) => a + (r.g[s] ?? 0), 0), 0) / (recs.length || 1);
        console.log(`  ${name.padEnd(11)}: ${(100 * used / (recs.length || 1)).toFixed(0)}% use it, mean ${meanPct.toFixed(1)}% of grist`);
      }
    };
    report("new england");
    report("american ipa");
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: crystal into a hazy across rerolls and pushes (Studio config)?", () => {
    const style = "Specialty IPA: New England IPA";
    const base: SteeringQuery = { style, candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 0.3 };
    const crystalPct = (q: SteeringQuery) => {
      const r = service.steer(q);
      const totalKg = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      const cry = r.recipe.fermentables.filter((f) => /crystal|caramel|special b/i.test(f.name));
      return 100 * cry.reduce((s, f) => s + f.weightKg, 0) / totalKg;
    };
    const scan = (label: string, extra: Partial<SteeringQuery>) => {
      const pcts = [0, 1, 2, 3, 4, 5, 6, 7].map((v) => crystalPct({ ...base, ...extra, gristVariation: v, hopVariation: v }));
      const withCrystal = pcts.filter((p) => p > 0.5).length;
      console.log(`  ${label}: crystal in ${withCrystal}/8 takes | pcts [${pcts.map((p) => p.toFixed(0)).join(",")}]`);
    };
    console.log(`\nNEIPA crystal across 8 rerolls, Studio config:`);
    scan("no push        ", {});
    scan("caramel 2 push ", { target: { malt: { caramel: 2 } } });
    scan("honey 1.5 push ", { target: { malt: { honey: 1.5 } } });
    scan("tropical 4 push", { target: { hop: { tropicalFruit: 4 } } });
    scan("body +0.2 push ", { target: { body: 0.2 } });
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: does the Studio config (rerank) pull crystal into a hazy at rest?", () => {
    const style = "Specialty IPA: New England IPA";
    const crystalPct = (q: SteeringQuery) => {
      const r = service.steer(q);
      const totalKg = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      const cry = r.recipe.fermentables.filter((f) => /crystal|caramel|special b/i.test(f.name));
      const pct = 100 * cry.reduce((s, f) => s + f.weightKg, 0) / totalKg;
      return { pct, bill: r.recipe.fermentables.map((f) => f.name).join(", "), caramel: r.achievedFlavor.malt.caramel, wantCaramel: r.requestedFlavor.malt.caramel };
    };
    console.log(`\nNEIPA crystal at REST under different configs:`);
    const configs: Array<[string, SteeringQuery]> = [
      ["bare default (candidates 1)", { style }],
      ["Studio (16 cand, corr, split, wild .3)", { style, candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 0.3 }],
      ["16 cand, wildness 1", { style, candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 1 }],
      ["16 cand, wildness 0", { style, candidates: 16, correctResidual: true, splitNeighbourhoods: true, wildness: 0 }],
    ];
    for (const [label, q] of configs) {
      const c = crystalPct(q);
      console.log(`  ${label}: crystal ${c.pct.toFixed(0)}% | caramel achieved ${c.caramel.toFixed(2)} vs centroid ${c.wantCaramel.toFixed(2)}\n      [${c.bill}]`);
    }
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: where does crystal come from — corpus prevalence vs our reconstruction?", () => {
    const cloud = loadCloud();
    const CRYSTAL = ["crystal-light", "crystal-medium", "crystal-dark", "special-b"];
    const styleCrystal = (needle: string) => {
      const recs = cloud.filter((r) => r.s.toLowerCase().includes(needle));
      if (recs.length === 0) return `(no records for "${needle}")`;
      const withCrystal = recs.filter((r) => CRYSTAL.some((c) => (r.g[c] ?? 0) > 0));
      const meanCrystalPct = recs.reduce((s, r) => s + CRYSTAL.reduce((a, c) => a + (r.g[c] ?? 0), 0), 0) / recs.length;
      return `${recs.length} recs | ${(100 * withCrystal.length / recs.length).toFixed(0)}% use crystal | mean crystal ${meanCrystalPct.toFixed(1)}% of grist`;
    };
    const ourGrist = (style: string) => {
      const r = service.steer({ style });
      const totalKg = r.recipe.fermentables.reduce((s, f) => s + f.weightKg, 0) || 1;
      const cry = r.recipe.fermentables.filter((f) => /crystal|caramel|special b/i.test(f.name));
      const cryPct = (100 * cry.reduce((s, f) => s + f.weightKg, 0) / totalKg).toFixed(0);
      return `our base grist crystal = ${cryPct}% [${r.recipe.fermentables.map((f) => f.name).join(", ")}]`;
    };
    console.log("\ncrystal — corpus prevalence vs our reconstruction:");
    for (const [style, needle] of [["American IPA", "american ipa"], ["Specialty IPA: New England IPA", "new england"], ["American Pale Ale", "american pale ale"], ["German Pils", "german pils"]] as const) {
      console.log(`\n${style}:`);
      console.log(`  corpus: ${styleCrystal(needle)}`);
      console.log(`  ${ourGrist(style)}`);
    }
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: a small honey push on a hazy IPA — frozen / weird grain bill?", () => {
    const style = "Specialty IPA: New England IPA";
    const base = service.steer({ style });
    const honeyMed = (base.styleNorms.malt.p25.honey + base.styleNorms.malt.p75.honey) / 2;
    console.log(`\nNEIPA honey — median ${honeyMed.toFixed(2)}, no-push achieved ${base.achievedFlavor.malt.honey.toFixed(2)}, axisMax(rim) ${base.axisMax.malt.honey.toFixed(2)}`);

    const grainSig = (r: SteeringResult) => r.recipe.fermentables.map((f) => `${f.name}`).join(" + ");
    const probe = (label: string, q: SteeringQuery) => {
      const takes = [0, 1, 2, 3, 4, 5].map((v) => service.steer({ ...q, gristVariation: v, hopVariation: v, candidates: 16 }));
      const distinct = new Set(takes.map(grainSig)).size;
      const r0 = takes[0];
      console.log(`\n${label}: ${distinct} distinct grain bills / 6 takes | styleFit ${r0.styleFit.band} (ratio ${r0.styleFit.ratio.toFixed(2)}) | achieved honey ${r0.achievedFlavor.malt.honey.toFixed(2)} (want ${q.target?.malt?.honey?.toFixed(2) ?? "—"})`);
      console.log(`  bill: ${grainSig(r0)}`);
    };

    const honeyTarget = honeyMed + 0.15; // the "tiny push just past the median" the user described
    probe("no push (baseline)", { style });
    probe("honey push · split OFF · corr ON", { style, target: { malt: { honey: honeyTarget } }, correctResidual: true, splitNeighbourhoods: false, wildness: 0.3 });
    probe("honey push · split ON · corr ON", { style, target: { malt: { honey: honeyTarget } }, correctResidual: true, splitNeighbourhoods: true, wildness: 0.3 });
    probe("honey push · split ON · corr OFF", { style, target: { malt: { honey: honeyTarget } }, correctResidual: false, splitNeighbourhoods: true, wildness: 0.3 });
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("diagnose: does split neighbourhoods reduce hop reroll variety?", () => {
    const fullSig = (r: SteeringResult) => r.recipe.hops.map((h) => `${h.name}@${h.timeMinutes ?? h.whirlpoolTimeMinutes ?? h.dryHopDays ?? 0}`).join(",");
    const namesSig = (r: SteeringResult) => [...new Set(r.recipe.hops.map((h) => h.name))].sort().join(",");
    const probe = (label: string, q: SteeringQuery) => {
      const takes = [0, 1, 2, 3, 4, 5, 6, 7].map((v) => service.steer({ ...q, gristVariation: v, hopVariation: v, candidates: 16 }));
      console.log(`${label}: ${new Set(takes.map(fullSig)).size} full / ${new Set(takes.map(namesSig)).size} by-variety distinct / 8 takes`);
    };
    console.log("\nhop reroll variety — split OFF vs ON:");
    for (const [label, target] of [["no push", undefined], ["tropical 4 push", { hop: { tropicalFruit: 4 } }]] as const) {
      probe(`  ${label} · split OFF`, { style: "American IPA", target, wildness: 0.3, splitNeighbourhoods: false });
      probe(`  ${label} · split ON `, { style: "American IPA", target, wildness: 0.3, splitNeighbourhoods: true });
    }
    // Does pushing a MALT axis freeze the HOPS (collateral of picking one whole-recipe candidate)?
    console.log("\nHOP variety under a MALT push (does a malt push freeze hops?):");
    probe("  honey(malt) push · corr ON ", { style: "American IPA", target: { malt: { honey: 1.5 } }, correctResidual: true, wildness: 0.3, splitNeighbourhoods: true });
    probe("  no push (control)          ", { style: "American IPA", wildness: 0.3, splitNeighbourhoods: true });
    expect(true).toBe(true);
  }, TIMEOUT_MS);

  it("reroll pool: distinct 'another take' recipes even at creativity 0", () => {
    // The complaint: at low creativity, "Another take" barely changed, because the
    // rerank always returned the single best of a fresh 16. Now a reroll surfaces a
    // different near-best from the pool. This should hold even at exploration 0.
    const base: SteeringQuery = { style: "American IPA", target: { hop: { berry: 3 } }, candidates: 16, wildness: 0.3, exploration: 0 };
    const sig = (r: SteeringResult) => [
      ...r.recipe.fermentables.map((f) => f.name),
      "|",
      ...r.recipe.hops.map((h) => `${h.name}@${h.timeMinutes ?? h.whirlpoolTimeMinutes ?? h.dryHopDays ?? 0}`),
    ].join(",");

    // A fresh query (seed 0) is deterministic and returns the single best.
    expect(sig(service.steer(base))).toBe(sig(service.steer(base)));

    // Rerolls (bumped seeds) surface distinct takes — collect over several.
    const takes = [1, 2, 3, 4, 5, 6].map((v) => sig(service.steer({ ...base, gristVariation: v, hopVariation: v })));
    const distinct = new Set(takes).size;
    console.log(`\nreroll variation at creativity 0: ${distinct} distinct recipes across ${takes.length} takes`);
    // A given reroll is still reproducible…
    expect(sig(service.steer({ ...base, gristVariation: 3, hopVariation: 3 }))).toBe(takes[2]);
    // …and we get real variety (was ~1 before the pool pick).
    expect(distinct).toBeGreaterThanOrEqual(3);
  }, TIMEOUT_MS);

  it("reranking reduces mean pushed-axis error vs the single-shot baseline", () => {
    const N = 16;
    const rows: Array<{ label: string; base: number; rerank0: number; rerank1: number }> = [];

    for (const { label, query } of QUERIES) {
      const base = service.steer({ ...query, candidates: 1 });
      const rerank0 = service.steer({ ...query, candidates: N, wildness: 0 });
      const rerank1 = service.steer({ ...query, candidates: N, wildness: 1 });
      rows.push({
        label,
        base: pushedAxisError(query, base),
        rerank0: pushedAxisError(query, rerank0),
        rerank1: pushedAxisError(query, rerank1),
      });
    }

    console.log(`\npushed-axis alignment error (lower = closer to the ask); ${N} candidates`);
    console.log(`${"query".padEnd(30)} ${"baseline".padStart(10)} ${"rerank w0".padStart(10)} ${"rerank w1".padStart(10)}`);
    for (const r of rows) {
      console.log(`${r.label.padEnd(30)} ${r.base.toFixed(3).padStart(10)} ${r.rerank0.toFixed(3).padStart(10)} ${r.rerank1.toFixed(3).padStart(10)}`);
    }
    const mean = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0) / rows.length;
    const mBase = mean((r) => r.base);
    const mR0 = mean((r) => r.rerank0);
    const mR1 = mean((r) => r.rerank1);
    console.log(`${"MEAN".padEnd(30)} ${mBase.toFixed(3).padStart(10)} ${mR0.toFixed(3).padStart(10)} ${mR1.toFixed(3).padStart(10)}`);
    console.log(`improvement: w0 ${(100 * (1 - mR0 / mBase)).toFixed(1)}%  ·  w1 ${(100 * (1 - mR1 / mBase)).toFixed(1)}%`);

    // Rerank (candidate 0 = baseline) can only match or beat the baseline on its
    // own weighted score; on the pushed-axis proxy it should clearly improve on
    // average, and wildness 1 (pushed-only) should be at least as good as w0.
    expect(mR0).toBeLessThan(mBase);
    expect(mR1).toBeLessThanOrEqual(mR0 + 1e-9);
  }, TIMEOUT_MS);

  it("k-sweep: does a wider neighbourhood let malt targets land? (diagnostic)", () => {
    // Hypothesis: the malt flatline is neighbourhood starvation — ask an IPA-ish
    // region for caramel and nothing nearby HAS caramel, so no candidate can
    // produce it. If so, widening k should raise the achieved value. If achieved
    // stays pinned regardless of k, it's a reachability ceiling (target above
    // what any real grist makes on our model), not a neighbourhood-size problem.
    const probes: Array<{ label: string; style: string; axisKind: "malt" | "hop"; axis: string; want: number }> = [
      { label: "Amber · caramel 3", style: "American Amber Ale", axisKind: "malt", axis: "caramel", want: 3 },
      { label: "IPA · caramel 3 (sparse-for-style)", style: "American IPA", axisKind: "malt", axis: "caramel", want: 3 },
      { label: "Porter · coffee 3", style: "American Porter", axisKind: "malt", axis: "coffee", want: 3 },
      { label: "IPA · berry 3.5 (hop control)", style: "American IPA", axisKind: "hop", axis: "berry", want: 3.5 },
    ];
    const ks = [40, 100, 200, 400];
    const N = 16;

    console.log(`\nk-sweep: achieved value on the pushed axis (want in header), ${N} candidates, wildness 1`);
    console.log(`${"probe".padEnd(38)} ${"want".padStart(6)} ${"ceil".padStart(6)} ${ks.map((k) => `k=${k}`.padStart(8)).join("")}`);
    for (const p of probes) {
      const target = p.axisKind === "malt" ? { malt: { [p.axis]: p.want } } : { hop: { [p.axis]: p.want } };
      const achievedByK = ks.map((k) => {
        const r = service.steer({ style: p.style, target, k, candidates: N, wildness: 1 });
        return p.axisKind === "malt" ? r.achievedFlavor.malt[p.axis as keyof typeof r.achievedFlavor.malt] : r.achievedFlavor.hop[p.axis as keyof typeof r.achievedFlavor.hop];
      });
      // axisMax (realistic ceiling) is global, style-independent — read it once.
      const probe = service.steer({ style: p.style, target, k: 40 });
      const ceil = p.axisKind === "malt" ? probe.axisMax.malt[p.axis as keyof typeof probe.axisMax.malt] : probe.axisMax.hop[p.axis as keyof typeof probe.axisMax.hop];
      console.log(`${p.label.padEnd(38)} ${p.want.toFixed(1).padStart(6)} ${ceil.toFixed(2).padStart(6)} ${achievedByK.map((a) => a.toFixed(2).padStart(8)).join("")}`);
      // The finding: malt achieved barely moves with k (fraction-driven, not
      // neighbourhood-starved), and every axis's realistic ceiling sits well
      // below a raw 0-5 ask — so a target of 3 is partly just over-scale.
      expect(ceil).toBeLessThan(p.want);
      expect(achievedByK.every((a) => Number.isFinite(a))).toBe(true);
    }
  }, TIMEOUT_MS);

  it("residual correction (#3) closes more of the malt gap than rerank alone", () => {
    const probes: Array<{ label: string; style: string; axis: "caramel" | "coffee" | "nutty"; want: number }> = [
      { label: "Amber · caramel 3", style: "American Amber Ale", axis: "caramel", want: 3 },
      { label: "IPA · caramel 3", style: "American IPA", axis: "caramel", want: 3 },
      { label: "Porter · coffee 3", style: "American Porter", axis: "coffee", want: 3 },
      { label: "Brown · nutty 3", style: "American Brown Ale", axis: "nutty", want: 3 },
    ];

    console.log(`\nmalt gap: achieved on the pushed axis, rerank-only vs rerank+#3 (16 candidates, wildness 1)`);
    console.log(`${"probe".padEnd(24)} ${"want".padStart(6)} ${"ceil".padStart(6)} ${"rerank".padStart(8)} ${"+corr".padStart(8)} ${"closed".padStart(8)}`);
    let improvedCount = 0;
    for (const p of probes) {
      const target = { malt: { [p.axis]: p.want } };
      const base = service.steer({ style: p.style, target, candidates: 16, wildness: 1, correctResidual: false });
      const corr = service.steer({ style: p.style, target, candidates: 16, wildness: 1, correctResidual: true });
      const ceil = base.axisMax.malt[p.axis];
      const a0 = base.achievedFlavor.malt[p.axis];
      const a1 = corr.achievedFlavor.malt[p.axis];
      // fraction of the reachable-headroom gap (achieved -> ceiling) that #3 closed
      const headroom = Math.max(1e-6, ceil - a0);
      const closed = Math.max(0, (a1 - a0) / headroom);
      if (a1 > a0 + 1e-3) improvedCount++;
      console.log(`${p.label.padEnd(24)} ${p.want.toFixed(1).padStart(6)} ${ceil.toFixed(2).padStart(6)} ${a0.toFixed(2).padStart(8)} ${a1.toFixed(2).padStart(8)} ${(closed * 100).toFixed(0).padStart(7)}%`);
      expect(a1).toBeGreaterThanOrEqual(a0 - 1e-6); // correction never lowers the pushed axis
    }
    // It should genuinely help on most malt pushes (the whole point of #3).
    expect(improvedCount).toBeGreaterThanOrEqual(3);
  }, TIMEOUT_MS);

  it("dial-5 reachability: can #1+#3 reach 1.25x axisMax (the proposed top-of-dial)?", () => {
    // The 0-4 normalization proposal: realistic recipes fill 0-4 (axisMax = dial 4),
    // and 4-5 is headroom #3 unlocks, so dial-5 maps to 1.25x axisMax. This only
    // works if steering can actually GET there. Ratio ~1.0 = dial-5 is honest.
    const HEADROOM = 1.25;
    const malt: Array<keyof import("../maltFlavor").MaltFlavorProfile> = ["caramel", "coffee", "chocolate", "roast", "biscuit", "honey", "nutty"];
    const hop: Array<keyof import("../../recipe/models/Presets").HopFlavorProfile> = ["citrus", "tropicalFruit", "berry", "resinPine", "floral"];

    console.log(`\ndial-5 reachability: achieved vs 1.25x axisMax (want ratio ~1.0). style=American IPA`);
    console.log(`${"axis".padEnd(16)} ${"axisMax".padStart(8)} ${"dial5".padStart(8)} ${"achieved".padStart(9)} ${"ratio".padStart(7)}`);
    const report = (kind: "malt" | "hop", axis: string) => {
      const probe = service.steer({ style: "American IPA" });
      const axisMax = kind === "malt" ? probe.axisMax.malt[axis as keyof typeof probe.axisMax.malt] : probe.axisMax.hop[axis as keyof typeof probe.axisMax.hop];
      const dial5 = axisMax * HEADROOM;
      const target = kind === "malt" ? { malt: { [axis]: dial5 } } : { hop: { [axis]: dial5 } };
      const r = service.steer({ style: "American IPA", target, candidates: 16, wildness: 1, correctResidual: true });
      const achieved = kind === "malt" ? r.achievedFlavor.malt[axis as keyof typeof r.achievedFlavor.malt] : r.achievedFlavor.hop[axis as keyof typeof r.achievedFlavor.hop];
      const ratio = achieved / Math.max(1e-6, dial5);
      console.log(`${(kind + ":" + axis).padEnd(16)} ${axisMax.toFixed(2).padStart(8)} ${dial5.toFixed(2).padStart(8)} ${achieved.toFixed(2).padStart(9)} ${ratio.toFixed(2).padStart(7)}`);
      return ratio;
    };
    const maltRatios = malt.map((a) => report("malt", a));
    const hopRatios = hop.map((a) => report("hop", a));
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    console.log(`mean ratio — malt (with #3): ${mean(maltRatios).toFixed(2)}   hop (rerank only, #3 is malt-side): ${mean(hopRatios).toFixed(2)}`);
    expect(maltRatios.every((r) => Number.isFinite(r))).toBe(true);
  }, TIMEOUT_MS);

  it("candidates=1 is byte-identical to omitting the field (no behaviour change by default)", () => {
    const q: SteeringQuery = { style: "American IPA", target: { hop: { berry: 3.5 } } };
    const a = service.steer(q);
    const b = service.steer({ ...q, candidates: 1 });
    const sig = (r: SteeringResult) => JSON.stringify({
      f: r.recipe.fermentables.map((x) => [x.name, x.weightKg]),
      h: r.recipe.hops.map((x) => [x.name, x.grams, x.timeMinutes]),
      y: r.recipe.yeasts[0]?.name,
    });
    expect(sig(a)).toBe(sig(b));
  }, TIMEOUT_MS);
});
