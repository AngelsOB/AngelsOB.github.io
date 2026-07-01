import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";

import IngredientHoverCard from "./IngredientHoverCard";
import type { IngredientStat } from "./types";

/** Generic responsive grid of labelled stat cells (hop acid/oil, yeast specs). */
export default function IngredientStatGrid({
  stats,
  minWidth = 120,
}: {
  stats: IngredientStat[];
  minWidth?: number;
}) {
  if (!stats.length) return null;
  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))`,
      }}
    >
      {stats.map((s) => (
        // A hint turns the whole cell into a cursor-following info card; the
        // wrapper sits OUTSIDE the card so the fixed tip clears its clipped box.
        <IngredientHoverCard
          key={s.label}
          tip={s.hint}
          tabIndex={s.hint ? 0 : undefined}
          ariaLabel={s.hint ? `${s.label}: ${s.value}. ${s.hint}` : undefined}
        >
          <HSCard shadow={1} padding="11px 13px" style={{ height: "100%" }}>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 9.5,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: hsTokens.muted,
                marginBottom: 5,
                textAlign: "center",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 16,
                color: hsTokens.ink,
                letterSpacing: "0.01em",
                textAlign: "center",
              }}
            >
              {s.value}
            </div>
          </HSCard>
        </IngredientHoverCard>
      ))}
    </div>
  );
}
