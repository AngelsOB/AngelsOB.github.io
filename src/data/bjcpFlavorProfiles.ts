/**
 * BJCP 2021 Style Hop Flavor Target Profiles
 *
 * 9-axis hop flavor profiles for 68 BJCP styles, derived from BJCP 2021
 * guideline text cross-referenced with classic hop variety data and
 * brewing tradition.
 *
 * Scale: 0–5  (0 = irrelevant to style, 3 = notably present, max used = 3.5)
 * Ratings reflect the style's hop expression, not just the hops — malt-forward
 * styles get lower scores even when flavorful hops are used.
 */

import type { HopFlavorProfile } from "@/modules/beta-builder/domain/models/Presets";

// ─── American styles ────────────────────────────────────────────────

const AMERICAN: Record<string, HopFlavorProfile> = {
  // 18A Blonde Ale — low hop character, any variety acceptable
  "18A": {
    citrus: 1.0,
    tropicalFruit: 0.5,
    stoneFruit: 0.5,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.5,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 0.0,
  },
  // 18B American Pale Ale — Cascade-defined, moderate citrus/floral/pine
  "18B": {
    citrus: 2.5,
    tropicalFruit: 1.5,
    stoneFruit: 1.5,
    berry: 1.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 2.0,
  },
  // 19A American Amber Ale — balanced, citrusy common but not required
  "19A": {
    citrus: 2.0,
    tropicalFruit: 1.0,
    stoneFruit: 1.0,
    berry: 0.5,
    floral: 1.5,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 1.5,
  },
  // 19B California Common — Northern Brewer: herbal/resinous, BJCP: "citrusy inappropriate"
  "19B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 1.0,
    herbal: 3.0,
    spice: 1.5,
    resinPine: 2.5,
  },
  // 19C American Brown Ale — malt-forward, hops complement
  "19C": {
    citrus: 1.0,
    tropicalFruit: 0.5,
    stoneFruit: 0.5,
    berry: 0.5,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 0.5,
  },
  // 21A American IPA — broad hop canvas, citrus/pine forward
  "21A": {
    citrus: 3.0,
    tropicalFruit: 2.5,
    stoneFruit: 2.0,
    berry: 1.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 2.5,
  },
  // 21C Hazy IPA — fruit-forward, BJCP: "not grassy or herbal"
  "21C": {
    citrus: 2.5,
    tropicalFruit: 3.5,
    stoneFruit: 3.0,
    berry: 1.5,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.0,
    spice: 0.0,
    resinPine: 0.5,
  },
  // 22A Double IPA — West Coast resin peak + citrus
  "22A": {
    citrus: 3.0,
    tropicalFruit: 2.5,
    stoneFruit: 2.0,
    berry: 1.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 3.0,
  },
  // 22C American Barleywine — rich malt tempers hop expression, piney
  "22C": {
    citrus: 2.0,
    tropicalFruit: 1.0,
    stoneFruit: 1.0,
    berry: 0.5,
    floral: 1.0,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 2.5,
  },
  // 20A American Porter — BJCP: "may have a citrusy, berry, or tropical character"
  // American hops present but subdued by roast/chocolate malt (~50% of APA shape)
  "20A": {
    citrus: 1.0,
    tropicalFruit: 0.5,
    stoneFruit: 0.5,
    berry: 0.5,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 1.0,
  },
  // 20B American Stout — BJCP: "medium to low… citrusy, or resiny"
  // Roast dominates, hops provide background citrus/resin. Similar to porter but slightly more hop-assertive
  "20B": {
    citrus: 1.5,
    tropicalFruit: 0.5,
    stoneFruit: 0.0,
    berry: 0.5,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 1.5,
  },
  // 20C Imperial Stout — BJCP: "hop flavor can be moderately present… generally floral or fruity"
  // Rich malt complexity dominates; American versions may show citrus/pine, English versions floral
  "20C": {
    citrus: 1.0,
    tropicalFruit: 0.5,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 1.0,
  },
  // 22B American Strong Ale — BJCP: "medium to high… citrusy, fruity, or resinous"
  // Between American Amber and Barleywine — rich malt, assertive hops
  "22B": {
    citrus: 2.0,
    tropicalFruit: 1.0,
    stoneFruit: 0.5,
    berry: 0.5,
    floral: 1.0,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 2.0,
  },
  // 22D Wheatwine — BJCP: "low to moderate hoppy… citrusy, fruity, or herbal"
  // Wheat body + American hops at restrained levels
  "22D": {
    citrus: 1.0,
    tropicalFruit: 0.5,
    stoneFruit: 0.5,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 1.0,
  },
  // 21B Specialty IPA (parent) — broad category, use American IPA as base
  "21B": {
    citrus: 3.0,
    tropicalFruit: 2.5,
    stoneFruit: 2.0,
    berry: 1.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 2.5,
  },
  // 21B-Belgian IPA — American hop intensity meets Belgian yeast; continental spice blends with citrus/fruit
  "21B-Belgian IPA": {
    citrus: 2.0,
    tropicalFruit: 1.5,
    stoneFruit: 1.0,
    berry: 0.5,
    floral: 1.5,
    grassy: 0.5,
    herbal: 1.5,
    spice: 2.0,
    resinPine: 1.0,
  },
  // 21B-Black IPA — BJCP: "hop flavor should be prominent, same descriptors as IPA"
  // Roast darkens but hops still lead — slightly muted citrus/resin vs 21A
  "21B-Black IPA": {
    citrus: 2.5,
    tropicalFruit: 1.5,
    stoneFruit: 1.0,
    berry: 0.5,
    floral: 1.0,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 2.5,
  },
  // 21B-Brown IPA — BJCP: "similar to American IPA, but with caramel, chocolate, or toffee malt"
  // IPA hop character reduced ~20% by malt complexity
  "21B-Brown IPA": {
    citrus: 2.5,
    tropicalFruit: 1.5,
    stoneFruit: 1.5,
    berry: 0.5,
    floral: 1.0,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 2.0,
  },
  // 21B-Red IPA — BJCP: "similar to American IPA, but with prominent caramel/crystal malt"
  // Hop-forward with some malt attenuation
  "21B-Red IPA": {
    citrus: 2.5,
    tropicalFruit: 2.0,
    stoneFruit: 1.5,
    berry: 0.5,
    floral: 1.0,
    grassy: 0.5,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 2.5,
  },
  // 21B-Rye IPA — BJCP: "hop profile similar to American IPA" with spicy rye grain
  // Full IPA hop presence; rye adds its own spice, so hop spice reads slightly lower
  "21B-Rye IPA": {
    citrus: 3.0,
    tropicalFruit: 2.0,
    stoneFruit: 1.5,
    berry: 1.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 2.5,
  },
  // 21B-White IPA — Witbier meets IPA; citrus hops complement coriander/orange peel
  "21B-White IPA": {
    citrus: 2.5,
    tropicalFruit: 2.0,
    stoneFruit: 1.0,
    berry: 0.5,
    floral: 1.5,
    grassy: 0.5,
    herbal: 1.0,
    spice: 1.5,
    resinPine: 1.0,
  },
  // 21B-Brut IPA — BJCP: "very dry, highly attenuated, light body with prominent hop aroma"
  // Restrained late-hop character, fruit-forward but lighter touch than Hazy
  "21B-Brut IPA": {
    citrus: 2.0,
    tropicalFruit: 2.5,
    stoneFruit: 2.0,
    berry: 1.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 0.0,
    spice: 0.0,
    resinPine: 0.5,
  },
};

// ─── English styles ─────────────────────────────────────────────────

const ENGLISH: Record<string, HopFlavorProfile> = {
  // 11A Ordinary Bitter — floral/earthy EKG & Fuggles
  "11A": {
    citrus: 0.5,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 1.0,
    resinPine: 1.0,
  },
  // 11B Best Bitter — same hop character as 11A
  "11B": {
    citrus: 0.5,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 1.0,
    resinPine: 1.0,
  },
  // 11C Strong Bitter — elevated EKG/Challenger
  "11C": {
    citrus: 0.5,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.5,
    grassy: 0.5,
    herbal: 2.0,
    spice: 1.5,
    resinPine: 1.5,
  },
  // 12A British Golden Ale — most hop-forward non-IPA English style
  "12A": {
    citrus: 2.0,
    tropicalFruit: 0.5,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.5,
    grassy: 1.0,
    herbal: 2.0,
    spice: 1.5,
    resinPine: 0.5,
  },
  // 12B Australian Sparkling Ale — Pride of Ringwood, BJCP: "not floral"
  "12B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.0,
    grassy: 0.5,
    herbal: 2.5,
    spice: 2.0,
    resinPine: 2.0,
  },
  // 12C English IPA — most assertive English hop style, floral peak
  "12C": {
    citrus: 2.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 3.0,
    grassy: 1.0,
    herbal: 2.0,
    spice: 2.5,
    resinPine: 1.0,
  },
  // 13A Dark Mild — hops muted and rarely noticeable
  "13A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.0,
    resinPine: 0.0,
  },
  // 13B British Brown Ale — malt-dominant, light floral/earthy
  "13B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 1.0,
    spice: 0.5,
    resinPine: 0.0,
  },
  // 13C English Porter — BJCP: "low to moderate floral, earthy, or fruity hop aroma"
  // Same English hop triangle as Brown Ale but marginally more assertive (higher IBU)
  "13C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 1.0,
    spice: 0.5,
    resinPine: 0.5,
  },
  // 16D Foreign Extra Stout — BJCP: "moderate to no hop aroma… earthy, herbal, or floral"
  // Most hop-assertive dark British stout (IBU 50–70), but roast overwhelms hop flavor
  "16D": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 1.0,
    spice: 0.5,
    resinPine: 0.5,
  },
  // 17A British Strong Ale — BJCP: "hop aroma is moderate to moderately-high… floral, earthy, or fruity"
  // Same hop language as 11C Strong Bitter; EKG/Challenger at elevated rates
  "17A": {
    citrus: 0.5,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.5,
    grassy: 0.5,
    herbal: 2.0,
    spice: 1.5,
    resinPine: 1.5,
  },
  // 17C Wee Heavy — BJCP: "hop aroma is low to none"
  // Profoundly malt-forward, same near-zero territory as Scottish ales
  "17C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.0,
    spice: 0.0,
    resinPine: 0.0,
  },
  // 17D English Barley Wine — BJCP: "English hop character of floral, earthy, herbal, or marmalade-like"
  // Rich malt but hops more present than in Old Ale; English hop triangle at moderate intensity
  "17D": {
    citrus: 1.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 1.5,
    resinPine: 1.0,
  },
};

// ─── Scottish & Irish styles ────────────────────────────────────────

const SCOTTISH_IRISH: Record<string, HopFlavorProfile> = {
  // 14A Scottish Light — "allowable" is the weakest BJCP descriptor
  "14A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.0,
    spice: 0.0,
    resinPine: 0.0,
  },
  // 14B Scottish Heavy — identical hop language to 14A
  "14B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.0,
    spice: 0.0,
    resinPine: 0.0,
  },
  // 14C Scottish Export — marginally increased bitterness
  "14C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.0,
    resinPine: 0.0,
  },
  // 15A Irish Red Ale — "usually not present"
  "15A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.0,
    resinPine: 0.0,
  },
  // 15B Irish Stout — allows "medium earthy hop flavor" as balance
  "15B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.0,
    resinPine: 0.0,
  },
  // 15C Irish Extra Stout — swaps floral for spice
  "15C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.0,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 0.0,
  },
};

// ─── German & Czech noble hop styles ────────────────────────────────

const GERMAN_CZECH: Record<string, HopFlavorProfile> = {
  // 3A Czech Pale Lager — 100% Saaz, moderate intensity
  "3A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 2.0,
    spice: 2.0,
    resinPine: 0.0,
  },
  // 3B Czech Premium Pale Lager — Pilsner Urquell, noble hop summit
  "3B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 3.0,
    grassy: 1.0,
    herbal: 2.5,
    spice: 3.0,
    resinPine: 0.0,
  },
  // 3D Czech Dark Lager — malt-dominant, Saaz restrained
  "3D": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.5,
    herbal: 1.0,
    spice: 1.5,
    resinPine: 0.0,
  },
  // 5A German Leichtbier — lighter-bodied German Pils
  "5A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 2.0,
    resinPine: 0.0,
  },
  // 5B Kölsch — subtle, balanced
  "5B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 1.5,
    resinPine: 0.0,
  },
  // 5C German Helles Exportbier — between Pils and Helles
  "5C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 2.0,
    resinPine: 0.0,
  },
  // 5D German Pils — most assertive German noble hop style
  "5D": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 3.0,
    grassy: 1.0,
    herbal: 2.0,
    spice: 3.0,
    resinPine: 0.0,
  },
  // 7A Vienna Lager — most malt-dominant in this group
  "7A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 0.0,
  },
  // 3C Czech Amber Lager — BJCP: "low to moderate Saaz hops… spicy, herbal"
  // Saaz-based like 3A but richer malt tempers hop presence slightly
  "3C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 1.5,
    resinPine: 0.0,
  },
  // 4A Munich Helles — BJCP: "low to moderately-low spicy, floral, or herbal hop aroma"
  // Malt-dominant showcase; noble hops provide subtle background. Below Exportbier intensity
  "4A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 1.0,
    spice: 1.5,
    resinPine: 0.0,
  },
  // 4B Festbier — BJCP: "Moderate to low hop aroma, with a floral, herbal, or spicy character"
  // Smooth, drinkable Oktoberfest-strength lager. Slightly more hop presence than Helles (4A)
  "4B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.0,
    spice: 2.0,
    resinPine: 0.0,
  },
  // 4C Helles Bock — BJCP: "Low to moderate hop aroma, which can have a spicy, herbal, or floral quality"
  // Like Helles but stronger; malt richness further mutes hop character
  "4C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 1.0,
    spice: 1.0,
    resinPine: 0.0,
  },
  // 6A Märzen — BJCP: "Low to no hop aroma… spicy, herbal, or floral notes from noble hops"
  // Toast/biscuit malt dominates, hops are minimal supporting character
  "6A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 0.0,
  },
  // 7B Altbier — BJCP: "Low to moderate spicy, peppery, or floral hop aroma"
  // Spalt-centric Düsseldorf style, more assertive hop character than Märzen
  "7B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 1.5,
    spice: 2.0,
    resinPine: 0.0,
  },
  // 8A Munich Dunkel — BJCP: "Hop aroma is low to none… spicy, herbal, or floral"
  // Deeply malt-forward; noble hops barely perceptible. Similar to Vienna but darker
  "8A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 1.0,
    resinPine: 0.0,
  },
  // 8B Schwarzbier — BJCP: "Low to moderate spicy, floral, or herbal hop aroma"
  // Dark but clean; slightly more hop-forward than Dunkel
  "8B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.0,
    herbal: 1.0,
    spice: 1.5,
    resinPine: 0.0,
  },
  // 27-Kellerbier (pale interpretation) — slightly enhanced Helles-like
  "27-Kellerbier": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 2.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 2.0,
    resinPine: 0.0,
  },
  // 27-Pre-Prohibition Lager — BJCP: "Low to moderate noble hop aroma"
  // Pre-Prohibition American lager with noticeable noble hop character (typically Cluster)
  "27-Pre-Prohibition Lager": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 1.0,
    spice: 1.5,
    resinPine: 0.0,
  },
  // X5 New Zealand Pilsner — NZ hops (Nelson Sauvin, Motueka) on a Pils base
  // Noble spire shape but with tropical/lime character from NZ hop varieties
  "X5": {
    citrus: 1.5,
    tropicalFruit: 2.0,
    stoneFruit: 1.0,
    berry: 0.5,
    floral: 2.0,
    grassy: 1.0,
    herbal: 1.0,
    spice: 1.5,
    resinPine: 0.0,
  },
};

// ─── Belgian styles ─────────────────────────────────────────────────

const BELGIAN: Record<string, HopFlavorProfile> = {
  // 24B Belgian Pale Ale — hops subordinate to yeast
  "24B": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.5,
    herbal: 1.0,
    spice: 1.0,
    resinPine: 0.0,
  },
  // 25B Saison — most hop-forward Belgian style
  "25B": {
    citrus: 0.5,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.5,
    grassy: 1.0,
    herbal: 2.0,
    spice: 2.0,
    resinPine: 0.0,
  },
  // 25C Belgian Golden Strong Ale — Duvel's "distinctive grassy hop aromas"
  "25C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.5,
    grassy: 1.0,
    herbal: 2.0,
    spice: 1.5,
    resinPine: 0.0,
  },
  // 24A Witbier — BJCP: "Low hop aroma, none to a light spicy, herbal, or earthy quality"
  // Hops heavily overshadowed by coriander/orange peel spice; minimal presence
  "24A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 0.5,
    grassy: 0.0,
    herbal: 0.5,
    spice: 0.5,
    resinPine: 0.0,
  },
  // 24C Bière de Garde — BJCP: "Low to moderate hop aroma… often floral, herbal, or spicy"
  // French farmhouse lager; continental hops at moderate levels subordinate to malt
  "24C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.5,
    herbal: 1.0,
    spice: 1.0,
    resinPine: 0.0,
  },
  // 25A Belgian Blond Ale — BJCP: "Low to moderate spicy, herbal, or floral hop character"
  // Between Belgian Pale and Tripel; Saaz/Styrian Goldings at gentle levels
  "25A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.5,
    herbal: 1.5,
    spice: 1.5,
    resinPine: 0.0,
  },
  // 26A Belgian Single — BJCP: "Low to medium-low hop aroma… spicy, herbal, or floral character"
  // Lightest monastic ale; continental hops at restrained levels
  "26A": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.0,
    grassy: 0.5,
    herbal: 1.0,
    spice: 1.0,
    resinPine: 0.0,
  },
  // 26C Belgian Tripel — BJCP: "Low to moderate spicy, herbal, or floral hop character"
  // More hop-forward than Dubbel; continental hops complement fruity yeast esters
  "26C": {
    citrus: 0.0,
    tropicalFruit: 0.0,
    stoneFruit: 0.0,
    berry: 0.0,
    floral: 1.5,
    grassy: 0.5,
    herbal: 1.5,
    spice: 1.5,
    resinPine: 0.0,
  },
};

// ─── BJCP hop guideline notes ─────────────────────────────────────
// Short, brewer-friendly summaries of each style's hop character
// per the BJCP 2021 guidelines.

const BJCP_HOP_NOTES: Record<string, string> = {
  // American
  "18A": "Low hop character; any variety acceptable. Hop presence should not overshadow the light malt body.",
  "18B": "Moderate to moderately-high hop character. Citrus, floral, pine, and resinous qualities typical of classic American varieties.",
  "19A": "Low to moderate hop presence. Citrusy character common but not required; hops balance a noticeable caramel malt backbone.",
  "19B": "Moderate hop character dominated by woody, rustic, and minty Northern Brewer. Citrusy and fruity hop character inappropriate for the style.",
  "19C": "Low to moderate hop flavor. American varieties provide a mild citrus or resinous complement to chocolate and caramel malt.",
  "21A": "Medium-high to high hop aroma and flavor. Broad canvas — citrus, pine, tropical, stone fruit, floral, melon, and berry all acceptable.",
  "21C": "Prominent hop aroma and flavor featuring tropical, stone fruit, citrus, and berry. Grassy and herbal character not appropriate.",
  "22A": "High to very high hop intensity. Resinous, citrusy, and tropical qualities pushed to the limit; hop character should be the star.",
  "22C": "Moderately high hop character, often pine or citrus-driven. Balanced by significant malt richness and alcohol warmth.",
  "20A": "Low to moderate American hop character. Citrus, berry, or tropical notes acceptable but should complement, not dominate, roast character.",
  "20B": "Medium to low hop flavor. Citrusy or resinous American hop character; hops provide a counterpoint to assertive roast and coffee notes.",
  "20C": "Hop flavor can be moderately present. Generally floral or fruity; style splits between American (citrus/pine) and English (earthy/floral) variants.",
  "22B": "Medium to high hop character — citrusy, fruity, or resinous. Sits between an American Amber Ale and a Barleywine in hop intensity.",
  "22D": "Low to moderate hop flavor. Citrusy, fruity, or herbal character; wheat body dominates the profile over hop expression.",
  "21B": "Hop character varies by sub-style. Generally IPA-level hop intensity with the base character of the sub-style's defining twist.",
  "21B-Belgian IPA": "American hop intensity meets Belgian yeast character. Expect citrus and fruit from hops alongside peppery yeast spice.",
  "21B-Black IPA": "Prominent hop flavor as in American IPA, but roast malt adds complexity. Citrus and pine dominate; avoid harsh roast clashing with hops.",
  "21B-Brown IPA": "IPA hop character slightly muted by caramel and chocolate malt. Citrus, pine, and tropical notes still clearly present.",
  "21B-Red IPA": "Strong hop flavor similar to American IPA. Crystal malt sweetness provides a platform for citrus, pine, and tropical hop character.",
  "21B-Rye IPA": "Full IPA hop presence. Rye grain adds its own spicy quality, complementing the citrus and pine from American hops.",
  "21B-White IPA": "Moderate to high hop character, typically citrus and fruit-forward. Hops blend with witbier spice additions (coriander, orange peel).",
  "21B-Brut IPA": "Prominent hop aroma but restrained bitterness. Tropical and fruit-forward character on a bone-dry, highly attenuated, champagne-like body.",

  // English
  "11A": "Low to moderate hop flavor. Earthy, floral character from traditional English hops like East Kent Goldings and Fuggles.",
  "11B": "Moderate hop flavor. Same earthy and floral English hop character as Ordinary Bitter, with slightly more assertive presence.",
  "11C": "Moderately high hop flavor. Earthy, floral, and herbal English hop character at elevated intensity; this is the hoppiest of the Bitters.",
  "12A": "Moderate to moderately-high hop character. The most hop-forward non-IPA English style; modern English hops add citrus alongside floral/earthy notes.",
  "12B": "Moderate hop character. Pride of Ringwood hops contribute distinctive herbal, resinous quality; floral character not typical.",
  "12C": "Moderately high to high hop flavor. Peak English hop expression — floral and earthy character from generous late additions of English varieties.",
  "13A": "Very low hop flavor, rarely noticeable. Malt and dark sugar character dominate this session-strength ale.",
  "13B": "Low hop flavor. Light floral or earthy English hop presence serves as quiet balance to biscuity, caramelly malt.",
  "13C": "Low to moderate hop flavor. Earthy and floral English hop character; hops support the balance rather than define the beer.",
  "16D": "Moderate to no hop flavor. Earthy, herbal, or floral notes possible; the most hop-assertive dark British stout, but roast still dominates.",
  "17A": "Moderate to moderately-high hop flavor. Floral, earthy English hop character at the same intensity as Strong Bitter, with more malt complexity behind it.",
  "17C": "Very low to no hop character. Profoundly malt-forward with caramel and toffee; hops exist only for minimal balance.",
  "17D": "Moderate hop flavor. English hop character — floral, earthy, herbal, with hints of marmalade. Rich malt balances but doesn't bury the hops.",

  // Scottish & Irish
  "14A": "Negligible hop character. Deeply malt-accented; hops are merely \"allowable\" per guidelines — the weakest hop descriptor.",
  "14B": "Negligible hop character. Identical hop language to Scottish Light; malt sweetness and a touch of roast define the beer.",
  "14C": "Minimal hop character. Marginally more bitterness than the lighter Scottish ales, but hop flavor remains in the background.",
  "15A": "Very low hop flavor, usually not perceptible. Mild caramel and toast dominate; hops provide only structural bitterness.",
  "15B": "Low hop character. Medium earthy hop flavor may be present for balance; roast barley bitterness is the defining character.",
  "15C": "Low hop character. Earthy and herbal notes possible; slightly more hop presence than Irish Stout but roast and dark fruit dominate.",

  // German & Czech
  "3A": "Moderate Saaz hop character — spicy, herbal, with gentle floral notes. Clean lager fermentation lets the noble hops come through clearly.",
  "3B": "High Saaz hop intensity — the noble hop summit. Rich spicy, herbal, and floral character with firm bitterness; the gold standard for Saaz expression.",
  "3C": "Low to moderate Saaz character. Spicy and herbal noble hop notes, but amber malt richness tempers the hop expression compared to paler versions.",
  "3D": "Low Saaz hop character. Spicy and herbal notes restrained by dark malt sweetness; hops provide balance rather than flavor.",
  "4A": "Low to moderately-low hop character. Subtle spicy, floral, or herbal noble hop background; this is a malt-showcase style.",
  "4B": "Moderate to low hop character. Spicy, floral, or herbal noble hops — slightly more prominent than Munich Helles, supporting the smooth drinkability.",
  "4C": "Low to moderate hop character. Noble hop spice and floral notes present but malt richness and higher gravity dominate the profile.",
  "5A": "Moderate noble hop character. Spicy, floral, and herbal notes similar to German Pils but on a lighter, lower-gravity body.",
  "5B": "Low to moderate hop flavor. Subtle noble hop character — floral and spicy — supporting a delicate balance between malt and hops.",
  "5C": "Moderate noble hop character. Sits between the subtlety of Helles and the assertiveness of Pils; floral, herbal, and spicy.",
  "5D": "Medium to high noble hop character — the most hop-assertive German lager. Prominent spicy, floral, and herbal qualities; firm dry finish.",
  "6A": "Very low to no hop flavor. Toast and biscuit malt completely dominate; noble hops provide minimal background balance.",
  "7A": "Low hop flavor. Subtle spicy noble hop character provides gentle balance to the elegant malt profile.",
  "7B": "Low to moderate hop character. Spalt hops give a distinctive peppery, spicy quality more assertive than most amber German lagers.",
  "8A": "Very low hop flavor. Noble hops barely perceptible beneath rich Munich malt character; spicy and herbal if detected at all.",
  "8B": "Low to moderate hop character. Noble hop spice and floral notes slightly more prominent than Munich Dunkel despite the dark appearance.",
  "27-Kellerbier": "Low to moderate noble hop character. Slightly enhanced hop presence compared to the base Helles or Märzen, allowed by minimal filtration.",
  "27-Pre-Prohibition Lager": "Low to moderate hop character. Noble or early American varieties; noticeably hoppier than modern American lagers.",
  "X5": "Moderate to high hop character from New Zealand varieties. Tropical, lime, and gooseberry notes on a crisp Pilsner base — a modern twist on the noble hop spire.",

  // Belgian
  "24A": "Very low hop flavor. Hops almost entirely overshadowed by coriander and orange peel spice additions.",
  "24B": "Low hop flavor. Floral, herbal, or spicy continental hops subordinate to the fruity and spicy Belgian yeast character.",
  "24C": "Low to moderate hop character. Continental hops — floral, herbal, or spicy — play a supporting role to malt and subtle yeast character.",
  "25A": "Low to moderate hop character. Spicy, herbal, or floral continental hops; sits between Belgian Pale Ale and Tripel in hop intensity.",
  "25B": "Medium to high hop character — the most hop-forward Belgian style. Earthy, herbal, and peppery continental hops complement the spicy yeast.",
  "25C": "Low to moderate hop character. Grassy and herbal continental hops in the Duvel tradition; yeast fruitiness is more prominent.",
  "26A": "Low to medium-low hop character. Restrained continental hops — spicy, herbal, or floral — in the lightest monastic style.",
  "26C": "Low to moderate hop character. Continental hops — spicy, herbal, or floral — complement the fruity yeast esters of this strong golden ale.",
};

// ─── Merged map & lookup ────────────────────────────────────────────

const BJCP_FLAVOR_PROFILES: Record<string, HopFlavorProfile> = {
  ...AMERICAN,
  ...ENGLISH,
  ...SCOTTISH_IRISH,
  ...GERMAN_CZECH,
  ...BELGIAN,
};

/**
 * Look up the hop flavor target for a BJCP style.
 * Accepts the full recipe style string ("21A. American IPA") or just the code ("21A").
 * Returns null for styles without a profile — the radar overlay should not render.
 */
export function getBjcpFlavorProfile(
  style?: string
): HopFlavorProfile | null {
  if (!style) return null;
  const code = style.split(".")[0]?.trim();
  if (!code) return null;
  return BJCP_FLAVOR_PROFILES[code] ?? null;
}

/**
 * Get the style name from the recipe style string for display in the legend.
 * "21A. American IPA" → "American IPA Target"
 */
export function getBjcpFlavorLabel(style: string): string {
  const parts = style.split(".");
  const name = parts.length > 1 ? parts.slice(1).join(".").trim() : style;
  return `${name} Target`;
}

/**
 * Get the BJCP guideline hop character note for a style.
 * Returns null for styles without a profile.
 */
export function getBjcpHopNote(style?: string): string | null {
  if (!style) return null;
  const code = style.split(".")[0]?.trim();
  if (!code) return null;
  return BJCP_HOP_NOTES[code] ?? null;
}
