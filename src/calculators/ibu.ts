/**
 * IBU (bitterness) model — single source of truth for the per-hop math.
 *
 * Tinseth isomerization for kettle/whirlpool additions, plus a humulinone +
 * dissolved-alpha model for dry hops. RecipeCalculationService delegates here so
 * the formula lives in exactly one place (mirrors @/calculators/abv).
 */

import type { Hop } from "@/modules/recipe/models/Recipe";
import { LITERS_TO_GALLONS } from "./units";

/** Tinseth utilization for a kettle addition. */
export function tinsethUtilization(minutes: number, wortGravity: number): number {
  const gravityFactor = 1.65 * Math.pow(0.000125, wortGravity - 1);
  const timeFactor = (1 - Math.exp(-0.04 * minutes)) / 4.15;
  return gravityFactor * timeFactor;
}

/** Whirlpool utilization with temperature adjustment. */
export function whirlpoolUtilization(
  minutes: number,
  tempC: number,
  wortGravity: number,
): number {
  const clampedTemp = Math.max(60, Math.min(100, tempC));
  const tempFactor = tempC <= 60 ? 0 : Math.pow((clampedTemp - 60) / 40, 1.8);
  return tinsethUtilization(minutes, wortGravity) * tempFactor;
}

/**
 * IBU contribution from a single hop addition.
 *
 * `ibuVolumeGal` is the post-boil (kettle) volume in gallons — the volume the
 * iso-alpha is dissolved in at flameout (standard Tinseth convention).
 * Kettle additions (boil, first wort, mash) use `boilGravity` (boil average);
 * whirlpool uses `og` since it happens after the boil. `boilTimeMin` anchors
 * first-wort hops to the full boil duration. A +10% utilization factor is
 * applied to the isomerization model (assumes pellet hops, the common case;
 * matches Brewer's Friend / Brewfather defaults).
 */
export function singleHopIBU(
  hop: Hop,
  og: number,
  ibuVolumeGal: number,
  boilGravity: number = og,
  boilTimeMin: number = 60,
): number {
  const { alphaAcid, grams, type, timeMinutes = 0, temperatureC = 80, whirlpoolTimeMinutes } = hop;

  // --- Dry hop: humulinone dissolution model (not Tinseth) ---
  // Dry hopping contributes bitterness via humulinone (oxidized alpha acid)
  // extraction, NOT via thermal isomerization. Requires its own model.
  //
  // Science basis (Maye et al. 2016, Lafontaine & Shellhammer 2017):
  //   - Pellet hops contain ~0.3-0.5% humulinones by weight (use 0.4% avg)
  //   - ~75% of humulinones extract into beer at fermentation temps in 24h
  //   - Extraction rate drops at very high dry-hop rates (saturation)
  //   - Humulinones have an IBU spectrophotometer response factor of 0.54
  //     (i.e. 1 mg/L humulinones ≈ 0.54 IBU on a spectrophotometer)
  //   - Non-isomerized alpha acids also dissolve (~1% at fermentation temps),
  //     contributing at ~0.62 IBU response factor per mg/L
  if (type === "dry hop") {
    const beerVolumeL = ibuVolumeGal / LITERS_TO_GALLONS;
    const dryHopRateGL = grams / beerVolumeL;

    // Humulinone contribution
    const humulinoneFraction = 0.004; // ~0.4% of hop weight is humulinones (pellets)
    const humulinoneMg = grams * humulinoneFraction * 1000; // convert g → mg
    // Extraction efficiency: ~75% at moderate rates, decreasing at high rates
    // Maye 2016: ~98% at 0.5 lb/bbl (~4 g/L), ~47% at 2 lb/bbl (~16 g/L)
    const extractionRate = 0.75 * Math.exp(-0.04 * Math.max(0, dryHopRateGL - 4));
    const humulinonePpm = (humulinoneMg * extractionRate) / beerVolumeL;
    const humulinoneIbu = humulinonePpm * 0.54;

    // Non-isomerized alpha acid contribution
    // ~1% of alpha acids dissolve at fermentation temps
    // (5.9% figure from Alchemy Overlord SMPH is for hot-side oxidation, not cold dry hop)
    // Calibrated against Maye 2016: 142g Centennial/10%AA/16L → +18.5 IBU measured
    const alphaAcidMg = grams * (alphaAcid / 100) * 1000;
    const dissolvedAaMg = alphaAcidMg * 0.01;
    const dissolvedAaPpm = dissolvedAaMg / beerVolumeL;
    const alphaAcidIbu = dissolvedAaPpm * 0.62;

    return humulinoneIbu + alphaAcidIbu;
  }

  // --- All other types: Tinseth isomerization model ---
  let utilization = 0;

  switch (type) {
    case "boil":
      utilization = tinsethUtilization(timeMinutes, boilGravity);
      break;
    case "first wort":
      // FWH steeps for the entire boil, so anchor utilization to the full boil
      // time (the per-hop time is intentionally unset for FWH). The +20 min
      // bonus reflects extra isomerization during lauter/heat-up.
      utilization = tinsethUtilization(boilTimeMin + 20, boilGravity);
      break;
    case "whirlpool": {
      // Post-boil addition: wort is at OG by now, so use og (not the boil average).
      // Use whirlpoolTimeMinutes if available, fallback to timeMinutes for backward compatibility
      const wpTime = whirlpoolTimeMinutes ?? timeMinutes ?? 15;
      utilization = whirlpoolUtilization(wpTime, temperatureC, og);
      break;
    }
    case "mash":
      // BeerSmith approach: -80% reduction vs equivalent boil (i.e. 20% of boil utilization)
      // Mash temps (~65°C) are well below isomerization threshold; minimal carryover
      utilization = tinsethUtilization(timeMinutes || 5, boilGravity) * 0.2;
      break;
  }

  // Pellet utilization bonus: +10% on the Tinseth isomerization model, matching
  // Brewer's Friend's documented default and Brewfather's pellet handling. Whole
  // leaf gets no bonus (lower utilization than pellets); an unset form defaults
  // to pellet (the common case). Dry hop returned earlier, so it's unaffected.
  if (hop.form !== "leaf") utilization *= 1.1;

  // Tinseth formula using imperial units
  // Convert grams to ounces, then calculate AAU
  const oz = grams / 28.3495;
  const aau = oz * alphaAcid; // Alpha Acid Units
  const ibu = (aau * utilization * 75) / ibuVolumeGal;

  return ibu;
}
