"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LazyMotion, domAnimation } from "framer-motion";

import { hsTokens } from "@/modules/builder/tokens";
import HSButton from "@/modules/builder/components/HSButton";
import HSCard from "@/modules/builder/components/HSCard";
import IngredientIndexClient from "../IngredientIndexClient";
import type {
  IngredientGroup,
  IngredientRow,
  IngredientSubFilter,
} from "../types";
import { HOP_PRESETS } from "@/modules/recipe/data/hopPresets";
import { getHop } from "./hopKind";
import HopMorphCard from "./HopMorphCard";

const MAX_COMPARE = 6;

/**
 * Hop wrapper around the generic index. Renders each card as a HopMorphCard
 * (dwell-morph), and layers in browse-style compare selection: a Compare toggle
 * turns the cards into selectable tiles, and a floating bar sends the chosen
 * hops to /hops/compare. Picking hops there directly still works too.
 */
export default function HopIndexClient(props: {
  basePath: string;
  label: string;
  rows: IngredientRow[];
  groups: IngredientGroup[];
  subFilter?: IngredientSubFilter;
  searchHint?: string;
}) {
  const router = useRouter();
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < MAX_COMPARE) next.add(slug);
      return next;
    });
  }, []);

  const handleCompare = () => {
    if (selected.size < 2) return;
    router.push(`/hops/compare?hops=${Array.from(selected).join(",")}`);
  };

  return (
    <LazyMotion features={domAnimation}>
      <IngredientIndexClient
        {...props}
        toolbar={
          <HSButton
            variant={compareMode ? "solid" : "ghost"}
            color={hsTokens.water}
            size="sm"
            onClick={() => {
              const next = !compareMode;
              setCompareMode(next);
              if (!next) setSelected(new Set());
            }}
          >
            Compare
          </HSButton>
        }
        renderCard={(row) => (
          <HopMorphCard
            row={row}
            preset={getHop(row.slug)}
            library={HOP_PRESETS}
            basePath={props.basePath}
            compareMode={compareMode}
            isSelected={selected.has(row.slug)}
            onToggleSelect={toggleSelect}
          />
        )}
      />

      {compareMode && selected.size >= 1 ? (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
        >
          <HSCard shadow={4} padding="14px 22px" bg={hsTokens.paper}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  color: hsTokens.ink,
                }}
              >
                {selected.size} hop{selected.size !== 1 ? "s" : ""} selected
              </span>
              <HSButton
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </HSButton>
              <HSButton
                variant="solid"
                color={hsTokens.water}
                size="sm"
                disabled={selected.size < 2}
                onClick={handleCompare}
              >
                {selected.size < 2
                  ? `Compare (${2 - selected.size} more)`
                  : "Compare"}
              </HSButton>
            </div>
          </HSCard>
        </div>
      ) : null}
    </LazyMotion>
  );
}
