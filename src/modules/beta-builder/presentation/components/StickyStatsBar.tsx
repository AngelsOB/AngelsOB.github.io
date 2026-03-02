/**
 * StickyStatsBar - Compact sticky header/footer showing key recipe calculations.
 *
 * Used in BetaBuilderPage to display recipe stats that appear when scrolling
 * past the main calculated values section. Supports both top and bottom positioning.
 */

import AnimatedValue from "./AnimatedValue";
import BeerGlass from "./BeerGlass";

export interface RecipeCalculations {
  abv: number;
  og: number;
  fg: number;
  ibu: number;
  srm: number;
  calories: number;
  carbsG: number;
}

interface StickyStatsBarProps {
  calculations: RecipeCalculations;
  position: "top" | "bottom";
  isVisible: boolean;
}

export default function StickyStatsBar({ calculations, position, isVisible }: StickyStatsBarProps) {
  const positionClasses = position === "top" ? "top-0 border-b" : "bottom-0 border-t";

  const translateClasses = isVisible
    ? "translate-y-0 opacity-100"
    : position === "top"
      ? "-translate-y-full opacity-0"
      : "translate-y-full opacity-0";

  return (
    <div
      className={`fixed right-0 left-0 z-40 border-[rgb(var(--brew-border))] bg-[rgb(var(--brew-card))]/25 shadow-lg backdrop-blur-md transition-all duration-300 ease-in-out ${positionClasses} ${translateClasses}`}
    >
      {/* Scrollable stats strip — snaps on mobile, centered on desktop */}
      <div className="scrollbar-hide mx-auto max-w-4xl overflow-x-auto px-2 py-2 sm:px-8">
        <div className="flex min-w-max gap-3 sm:min-w-0 sm:justify-between sm:gap-4">
          {/* ABV */}
          <div className="min-w-[3.5rem] shrink-0 text-center">
            <div className="brew-gauge-label">ABV</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              <AnimatedValue value={calculations.abv} decimals={1} suffix="%" />
            </div>
          </div>

          {/* OG */}
          <div className="min-w-[3.5rem] shrink-0 text-center">
            <div className="brew-gauge-label">OG</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              <AnimatedValue value={calculations.og} decimals={3} />
            </div>
          </div>

          {/* FG */}
          <div className="min-w-[3.5rem] shrink-0 text-center">
            <div className="brew-gauge-label">FG</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              <AnimatedValue value={calculations.fg} decimals={3} />
            </div>
          </div>

          {/* IBU */}
          <div className="min-w-[2.5rem] shrink-0 text-center">
            <div className="brew-gauge-label">IBU</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              <AnimatedValue value={calculations.ibu} decimals={0} />
            </div>
          </div>

          {/* SRM — glass spans full height beside label + number */}
          <div className="-ml-2 flex shrink-0 items-center gap-1 sm:-ml-1.5">
            <div className="text-center">
              <div className="brew-gauge-label">SRM</div>
              <div className="brew-gauge-value text-base sm:text-lg">
                <AnimatedValue value={calculations.srm} decimals={1} />
              </div>
            </div>
            <BeerGlass
              srm={calculations.srm}
              className="h-full w-auto shrink-0 gap-1 self-stretch drop-shadow-sm"
              style={{ minHeight: "3rem", maxHeight: "3.5rem" }}
            />
          </div>

          {/* Calories */}
          <div className="min-w-[2.5rem] shrink-0 text-center">
            <div className="brew-gauge-label">Cal</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              <AnimatedValue value={calculations.calories} decimals={0} />
            </div>
          </div>

          {/* Carbs */}
          <div className="min-w-[2.5rem] shrink-0 text-center">
            <div className="brew-gauge-label">Carbs</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              <AnimatedValue value={calculations.carbsG} decimals={1} suffix="g" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
