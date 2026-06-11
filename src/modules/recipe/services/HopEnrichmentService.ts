/**
 * Hop Enrichment Service
 *
 * Enriches hop data with flavor profiles from the preset database.
 * Used during import (BeerXML, JSON) to fill in missing flavor data.
 */

import { HOP_PRESETS, type HopFlavorProfile } from '@/utils/presets';

/** Case-insensitive map from hop name → flavor profile */
const hopFlavorLookup = new Map<string, HopFlavorProfile>(
  HOP_PRESETS
    .filter((p) => p.flavor)
    .map((p) => [p.name.toLowerCase(), p.flavor!])
);

class HopEnrichmentService {
  /**
   * Look up a hop's flavor profile by name.
   * Returns undefined if no match found.
   */
  getFlavorByName(hopName: string): HopFlavorProfile | undefined {
    return hopFlavorLookup.get(hopName.toLowerCase());
  }

  /**
   * Enrich a single hop with flavor data if missing.
   * Returns the hop unchanged if it already has a flavor.
   */
  enrichHop<T extends { name: string; flavor?: HopFlavorProfile }>(hop: T): T {
    if (hop.flavor) return hop;
    const flavor = this.getFlavorByName(hop.name);
    return flavor ? { ...hop, flavor } : hop;
  }

  /**
   * Enrich an array of hops with flavor data where missing.
   */
  enrichHops<T extends { name: string; flavor?: HopFlavorProfile }>(hops: T[]): T[] {
    return hops.map((hop) => this.enrichHop(hop));
  }
}

export const hopEnrichmentService = new HopEnrichmentService();
