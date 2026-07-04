import { describe, test, expect } from "vitest";
import {
  maltArchetypeForFermentable,
  aggregateMaltFlavorFrom,
  MALT_ARCHETYPES_BY_SLUG,
  MALT_FLAVOR_KEYS,
  type MaltFlavorProfile,
} from "./maltFlavor";

// The lexicon + aggregation math is pinned by the corpus-lab test suite
// (src/modules/corpus-lab/maltFlavor.test.ts, running through the re-export).
// This file covers what the promotion ADDED: the runtime name→archetype
// matcher, and the builder path fermentable-names → aggregate profile.

/** Match helper — archetype slug only. */
function slug(name: string, colorLovibond?: number): string {
  return maltArchetypeForFermentable(name, colorLovibond).archetype;
}

/** Builder-path aggregate: names+colours+weights → profile via the matcher. */
function profileFor(
  items: Array<{ name: string; colorLovibond: number; weightKg: number }>
): MaltFlavorProfile {
  return aggregateMaltFlavorFrom(
    items
      .map((it) => {
        const arch = MALT_ARCHETYPES_BY_SLUG.get(slug(it.name, it.colorLovibond));
        return arch
          ? { flavor: arch.flavor, intensity: arch.intensity, amount: it.weightKg }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  );
}

function argmax(p: MaltFlavorProfile): keyof MaltFlavorProfile {
  let best = MALT_FLAVOR_KEYS[0] as keyof MaltFlavorProfile;
  for (const k of MALT_FLAVOR_KEYS) if (p[k] > p[best]) best = k;
  return best;
}

describe("maltArchetypeForFermentable — real preset names", () => {
  test("base malts", () => {
    expect(slug("Briess - Brewers Malt 2-Row", 1.8)).toBe("base-pale");
    expect(slug("1886 Malt House - NY Pilsner Malt", 1.7)).toBe("pilsner");
    expect(slug("Maris Otter Pale", 3.7)).toBe("maris-otter");
    expect(slug("Golden Promise", 2.5)).toBe("maris-otter");
    expect(slug("Vienna Malt", 3.5)).toBe("vienna");
    expect(slug("Munich Malt", 9)).toBe("munich-light");
    expect(slug("Munich Dark 20L", 20)).toBe("munich-dark");
    expect(slug("Wheat Malt", 2)).toBe("wheat-malt");
    expect(slug("Briess - Rye Malt", 3.7)).toBe("rye-malt");
    expect(slug("Acidulated Malt", 3)).toBe("acidulated");
  });

  test("crystal family splits by colour, name-Lovibond preferred over data colour", () => {
    expect(slug("Caramel / Crystal 20L", 20)).toBe("crystal-light");
    expect(slug("Avangard - Crystal 10L", 10)).toBe("crystal-light");
    expect(slug("Caramel / Crystal 60L", 60)).toBe("crystal-medium");
    expect(slug("Crystal 90L", 90)).toBe("crystal-dark");
    // "Caramel 40" carries no "L" token in the name — the data colour decides.
    expect(slug("1886 Malt House - Caramel 40", 40)).toBe("crystal-medium");
    // A name-Lovibond beats a (contradictory) data colour.
    expect(slug("Crystal 15L", 90)).toBe("crystal-light");
    expect(slug("Weyermann - CaraMunich III", 56)).toBe("crystal-medium");
    expect(slug("Special B", 150)).toBe("special-b");
    expect(slug("Carapils (Dextrine Malt)", 1.8)).toBe("dextrine");
  });

  test("toasted & specialty", () => {
    expect(slug("Biscuit Malt", 25)).toBe("biscuit-malt");
    expect(slug("Victory", 28)).toBe("victory-amber");
    expect(slug("Amber", 35)).toBe("amber-malt");
    expect(slug("Aromatic Malt", 20)).toBe("aromatic");
    expect(slug("Melanoidin", 30)).toBe("melanoidin");
    expect(slug("Honey Malt", 25)).toBe("honey-malt");
    expect(slug("Brown Malt", 65)).toBe("brown-malt");
    expect(slug("Abbey Malt", 20)).toBe("melanoidin");
    expect(slug("Weyermann - Smoked Malt", 3)).toBe("smoked-malt");
  });

  test("roasted family — specific names before generic 'black/chocolate'", () => {
    expect(slug("Roasted Barley", 450)).toBe("roasted-barley");
    expect(slug("Weyermann - Carafa Special Type II", 415)).toBe("carafa-dehusked");
    expect(slug("Pale Chocolate", 200)).toBe("pale-chocolate");
    expect(slug("Chocolate Malt", 350)).toBe("chocolate-malt");
    expect(slug("Black Patent", 500)).toBe("black-malt");
    expect(slug("Briess - Midnight Wheat Malt", 550)).toBe("black-malt");
  });

  test("flaked adjuncts", () => {
    expect(slug("Flaked Oats", 1)).toBe("flaked-oats");
    expect(slug("Flaked Wheat", 1)).toBe("flaked-wheat");
    expect(slug("Torrified Wheat", 2)).toBe("torrified-wheat");
    expect(slug("Flaked Barley", 1.5)).toBe("flaked-barley");
    expect(slug("Flaked Corn", 1)).toBe("flaked-corn");
    expect(slug("Flaked Rice", 1)).toBe("flaked-rice");
  });

  test("non-malt pseudo archetypes (no flavour vector — never chart)", () => {
    expect(slug("Corn Sugar - Dextrose", 0)).toBe("sugar");
    expect(slug("Honey", 1)).toBe("honey-sugar");
    expect(slug("Lactose (Milk Sugar)", 1)).toBe("lactose");
    expect(slug("Muntons - Light Dry Malt Extract", 4)).toBe("extract");
    expect(slug("Rice Hulls", 0)).toBe("lauter");
    expect(slug("Candi Syrup - Belgian Candi Syrup - D-180", 180)).toBe("dark-candi-syrup");
    for (const pseudo of ["sugar", "honey-sugar", "lactose", "extract", "lauter", "adjunct", "unknown"]) {
      expect(MALT_ARCHETYPES_BY_SLUG.has(pseudo)).toBe(false);
    }
    // dark-candi-syrup IS in the lexicon (it moves the flavour vector)
    expect(MALT_ARCHETYPES_BY_SLUG.has("dark-candi-syrup")).toBe(true);
  });

  test("brand-only names fall back to colour", () => {
    expect(slug("Admiral - Kilnsmith", 2)).toBe("base-pale");
    expect(slug("Admiral - Kilnsmith", 40)).toBe("crystal-medium");
    expect(slug("Admiral - Kilnsmith", 350)).toBe("black-malt");
    // the 7–34°L keyword-less gap is deliberately left unknown
    expect(slug("Admiral - Kilnsmith", 20)).toBe("unknown");
  });
});

describe("builder path — grist names → aggregate profile", () => {
  test("dry stout reads coffee-first (roasted barley anchors it)", () => {
    const p = profileFor([
      { name: "Briess - Brewers Malt 2-Row", colorLovibond: 1.8, weightKg: 3.5 },
      { name: "Flaked Barley", colorLovibond: 1.5, weightKg: 1.0 },
      { name: "Roasted Barley", colorLovibond: 450, weightKg: 0.5 },
    ]);
    expect(argmax(p)).toBe("coffee");
    expect(p.roast).toBeGreaterThan(p.grainy);
  });

  test("hefeweizen reads grainy-first", () => {
    const p = profileFor([
      { name: "Wheat Malt", colorLovibond: 2, weightKg: 2.5 },
      { name: "1886 Malt House - NY Pilsner Malt", colorLovibond: 1.7, weightKg: 2.5 },
    ]);
    expect(argmax(p)).toBe("grainy");
    expect(p.roast).toBe(0);
  });

  test("sugar-only bill charts nothing", () => {
    const p = profileFor([{ name: "Corn Sugar - Dextrose", colorLovibond: 0, weightKg: 1 }]);
    for (const k of MALT_FLAVOR_KEYS) expect(p[k]).toBe(0);
  });
});
