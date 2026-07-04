"use client";

import { useEffect, useState } from "react";

import type { Hop } from "@/modules/recipe/models/Recipe";
import type { HopFlavorProfile } from "@/modules/recipe/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/recipe/models/Presets";
import { hopFlavorCalculationService } from "@/modules/recipe/services/HopFlavorCalculationService";
import type { BuilderMockData } from "../lib/mapRecipeToBuilderMock";

// Recipe-mode flavor profiles for the mock's radars, as plain arrays in radar
// order (HOP_FLAVOR_KEYS / MALT_FLAVOR_KEYS). Tour mode (no data) stays null —
// the radars keep their hardcoded sample and none of this loads.
//
// Bundle discipline: the hop preset database (~90KB gz) was deliberately
// deferred off every page — so preset lookups happen in an effect behind a
// dynamic import() that only fires when a hop lacks an inline flavor vector,
// and the malt lexicon is dynamic-imported the same way. Statically this file
// only pulls types, HOP_FLAVOR_KEYS, and the data-free calculation service.

export type MockFlavors = {
  /** Combined hop flavor estimate, 0..1 per axis. Null until computed. */
  hop: number[] | null;
  /** Per-variety flavor (0..1 per axis) for the hop bill's mini radars. */
  hopByName: Map<string, number[]> | null;
  /** Aggregated grist flavor, raw 0-5-ish values (the radar scales per-axis). */
  malt: number[] | null;
};

const EMPTY: MockFlavors = { hop: null, hopByName: null, malt: null };

export function useMockFlavors(data?: BuilderMockData): MockFlavors {
  const [flavors, setFlavors] = useState<MockFlavors>(EMPTY);

  useEffect(() => {
    if (!data) {
      setFlavors(EMPTY);
      return;
    }
    let cancelled = false;
    (async () => {
      // ── Hops: inline flavor first, preset lookup only for the gaps ──
      const byName = new Map<string, HopFlavorProfile>();
      for (const h of data.hops) {
        if (h.flavor && !byName.has(h.name)) byName.set(h.name, h.flavor);
      }
      if (data.hops.some((h) => !byName.has(h.name))) {
        const { hopEnrichmentService } = await import(
          "@/modules/recipe/services/HopEnrichmentService"
        );
        for (const h of data.hops) {
          if (byName.has(h.name)) continue;
          const f = hopEnrichmentService.getFlavorByName(h.name);
          if (f) byName.set(h.name, f);
        }
      }
      const hopsForCalc: Hop[] = data.hops.map((h, i) => ({
        id: `mock-${i}`,
        name: h.name,
        alphaAcid: 0, // unused by the flavor aggregation
        grams: h.grams,
        type: h.hopType,
        timeMinutes: h.timeMinutes,
        temperatureC: h.temperatureC,
        whirlpoolTimeMinutes: h.whirlpoolTimeMinutes,
      }));
      const combined =
        byName.size > 0
          ? hopFlavorCalculationService.calculateCombinedFlavor(hopsForCalc, byName, data.batchL)
          : null;
      const hop = HOP_FLAVOR_KEYS.map((k) => (combined ? (combined[k] ?? 0) / 5 : 0));
      const hopByName = new Map<string, number[]>();
      for (const [name, f] of byName) {
        hopByName.set(name, HOP_FLAVOR_KEYS.map((k) => (f[k] ?? 0) / 5));
      }

      // ── Grist: archetype-match each grain, aggregate with the shared math ──
      const { MALT_FLAVOR_KEYS, MALT_ARCHETYPES_BY_SLUG, maltArchetypeForFermentable, aggregateMaltFlavorFrom } =
        await import("@/modules/recipe/data/maltFlavor");
      const items = data.grains
        .map((g) => {
          const m = maltArchetypeForFermentable(g.name, g.lovibond);
          const arch = MALT_ARCHETYPES_BY_SLUG.get(m.archetype);
          // Pseudo archetypes (sugar / extract / unknown) have no lexicon
          // entry and simply don't chart — same rule as GrainFlavorCard.
          return arch ? { flavor: arch.flavor, intensity: arch.intensity, amount: g.lb } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      const profile = aggregateMaltFlavorFrom(items);
      const malt = MALT_FLAVOR_KEYS.map((k) => profile[k]);

      if (!cancelled) setFlavors({ hop, hopByName, malt });
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return flavors;
}
