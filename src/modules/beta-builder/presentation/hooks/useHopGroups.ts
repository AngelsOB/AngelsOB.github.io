'use client';

import { useMemo } from "react";
import type { Hop } from "../../domain/models/Recipe";
import type { HopFlavorProfile } from "../../domain/models/Presets";
import { recipeCalculationService } from "../../domain/services/RecipeCalculationService";

export type HopGroup = {
  varietyName: string;
  alphaAcid: number;
  flavor?: HopFlavorProfile;
  additions: Hop[];
  totalGrams: number;
  totalIBU: number;
  gramsPerLiter: number;
};

export function useHopGroups(
  hops: Hop[],
  batchVolumeL: number,
  og: number
): HopGroup[] {
  return useMemo(() => {
    const groupMap = new Map<string, Hop[]>();

    for (const hop of hops) {
      const existing = groupMap.get(hop.name);
      if (existing) {
        existing.push(hop);
      } else {
        groupMap.set(hop.name, [hop]);
      }
    }

    const batchVolumeGal = batchVolumeL * 0.264172;

    return Array.from(groupMap.entries()).map(([name, additions]) => {
      const first = additions[0];
      const totalGrams = additions.reduce((sum, h) => sum + h.grams, 0);
      const totalIBU = additions.reduce(
        (sum, h) =>
          sum + recipeCalculationService.calculateSingleHopIBU(h, og, batchVolumeGal),
        0
      );

      return {
        varietyName: name,
        alphaAcid: first.alphaAcid,
        flavor: first.flavor,
        additions,
        totalGrams,
        totalIBU,
        gramsPerLiter: batchVolumeL > 0 ? totalGrams / batchVolumeL : 0,
      };
    });
  }, [hops, batchVolumeL, og]);
}
