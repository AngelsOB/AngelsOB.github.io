"use client";

import { LazyMotion, domAnimation } from "framer-motion";

import IngredientIndexClient from "../IngredientIndexClient";
import type {
  IngredientGroup,
  IngredientRow,
  IngredientSubFilter,
} from "../types";
import { getYeast } from "./yeastKind";
import YeastMorphCard from "./YeastMorphCard";

/**
 * Yeast wrapper around the generic index. Yeast has no flavor radar, so each
 * card leads with its lab (accent stripe + favicon + type tag) and morphs in
 * place on a dwell — blurring in the full spec block plus the cross-lab
 * "same strain" and substitute chips, exactly like the hop morph card. No
 * compare toolbar; this stays the plain searchable browse the brewer wants.
 */
export default function YeastIndexClient(props: {
  basePath: string;
  label: string;
  rows: IngredientRow[];
  groups: IngredientGroup[];
  subFilter?: IngredientSubFilter;
  searchHint?: string;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <IngredientIndexClient
        {...props}
        renderCard={(row) => (
          <YeastMorphCard
            row={row}
            preset={getYeast(row.slug)}
            basePath={props.basePath}
          />
        )}
      />

      {/* Linked strain pills inside the morph overlay — bordered cream pills
          that fill with the yeast accent on hover (the substitute/same-strain
          chips). Defined once here so it isn't re-emitted per card. */}
      <style>{`
        .yeast-morph-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--hs-cream);
          border: 1px solid color-mix(in oklab, var(--hs-ink) 30%, transparent);
          border-radius: 999px;
          padding: 3px 9px;
          font-size: 10.5px;
          font-weight: 600;
          color: var(--hs-ink);
          font-family: var(--font-space-grotesk), system-ui, sans-serif;
          text-decoration: none;
          transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
        }
        a.yeast-morph-chip:hover {
          background: #ee7755;
          border-color: var(--hs-ink);
          color: var(--hs-paper);
        }
        .yeast-morph-chip--static { opacity: 0.85; }
      `}</style>
    </LazyMotion>
  );
}
