/**
 * Yeast Laboratory Icon Utilities
 *
 * Maps yeast laboratories to their favicon images.
 * Provides lookup function with fuzzy matching for laboratory names.
 */

import escarpmentFavicon from "../../../../assets/yeast-favicons/escarpment-favicon.png";
import fermentisFavicon from "../../../../assets/yeast-favicons/fermentis-favicon.png";
import imperialFavicon from "../../../../assets/yeast-favicons/imperial-favicon.svg";
import lallemandFavicon from "../../../../assets/yeast-favicons/lallemand-favicon.png";
import omegaFavicon from "../../../../assets/yeast-favicons/omega-favicon.png";
import whitelabsFavicon from "../../../../assets/yeast-favicons/whitelabs-favicon.jpg";
import wyeastFavicon from "../../../../assets/yeast-favicons/wyeast-favicon.png";

/** Helper to get the src string from a Next.js image import */
function src(img: string | { src: string }): string {
  return typeof img === "string" ? img : img.src;
}

/** Mapping of laboratory names to their favicon images */
export const LABORATORY_FAVICONS: Record<string, string> = {
  "Escarpment Labs": src(escarpmentFavicon),
  "Fermentis": src(fermentisFavicon),
  "Imperial Yeast": src(imperialFavicon),
  "Lallemand": src(lallemandFavicon),
  "Omega Yeast": src(omegaFavicon),
  "White Labs": src(whitelabsFavicon),
  "Wyeast": src(wyeastFavicon),
};

/**
 * Get the favicon URL for a yeast laboratory.
 * Supports both exact and fuzzy matching of laboratory names.
 */
export function getYeastLabFavicon(laboratory: string | undefined): string | null {
  if (!laboratory) return null;

  // Try direct match
  if (LABORATORY_FAVICONS[laboratory]) {
    return LABORATORY_FAVICONS[laboratory];
  }

  // Try fuzzy match
  const labLower = laboratory.toLowerCase();
  for (const [key, value] of Object.entries(LABORATORY_FAVICONS)) {
    const keyLower = key.toLowerCase();
    if (labLower.includes(keyLower) || keyLower.includes(labLower)) {
      return value;
    }
  }

  return null;
}
