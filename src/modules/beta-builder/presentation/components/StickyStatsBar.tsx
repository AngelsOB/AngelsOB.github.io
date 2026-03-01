/**
 * StickyStatsBar - Compact sticky header/footer showing key recipe calculations.
 *
 * Used in BetaBuilderPage to display recipe stats that appear when scrolling
 * past the main calculated values section. Supports both top and bottom positioning.
 */

import { srmToRgb } from '../../utils/srmColorUtils';

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
  position: 'top' | 'bottom';
  isVisible: boolean;
}

export default function StickyStatsBar({
  calculations,
  position,
  isVisible,
}: StickyStatsBarProps) {
  const positionClasses =
    position === 'top'
      ? 'top-0 border-b'
      : 'bottom-0 border-t';

  const translateClasses = isVisible
    ? 'translate-y-0 opacity-100'
    : position === 'top'
      ? '-translate-y-full opacity-0'
      : 'translate-y-full opacity-0';

  return (
    <div
      className={`fixed left-0 right-0 bg-[rgb(var(--brew-card))]/25 backdrop-blur-md border-[rgb(var(--brew-border))] shadow-lg z-40 transition-all duration-300 ease-in-out ${positionClasses} ${translateClasses}`}
    >
      {/* Scrollable stats strip — snaps on mobile, centered on desktop */}
      <div className="max-w-4xl mx-auto px-2 sm:px-8 py-2 overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 sm:gap-4 sm:justify-between min-w-max sm:min-w-0">
          {/* ABV */}
          <div className="text-center shrink-0 min-w-[3.5rem]">
            <div className="brew-gauge-label">ABV</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              {calculations.abv.toFixed(1)}%
            </div>
          </div>

          {/* OG */}
          <div className="text-center shrink-0 min-w-[3.5rem]">
            <div className="brew-gauge-label">OG</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              {calculations.og.toFixed(3)}
            </div>
          </div>

          {/* FG */}
          <div className="text-center shrink-0 min-w-[3.5rem]">
            <div className="brew-gauge-label">FG</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              {calculations.fg.toFixed(3)}
            </div>
          </div>

          {/* IBU */}
          <div className="text-center shrink-0 min-w-[2.5rem]">
            <div className="brew-gauge-label">IBU</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              {calculations.ibu.toFixed(0)}
            </div>
          </div>

          {/* SRM with Color */}
          <div className="flex items-center justify-center gap-1.5 shrink-0">
            <div
              className="w-5 h-5 sm:w-7 sm:h-7 rounded-full ring-2 ring-white/30 shadow-sm shrink-0"
              style={{ backgroundColor: srmToRgb(calculations.srm) }}
            />
            <div>
              <div className="brew-gauge-label">SRM</div>
              <div className="brew-gauge-value text-base sm:text-lg">
                {calculations.srm.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Calories */}
          <div className="text-center shrink-0 min-w-[2.5rem]">
            <div className="brew-gauge-label">Cal</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              {calculations.calories}
            </div>
          </div>

          {/* Carbs */}
          <div className="text-center shrink-0 min-w-[2.5rem]">
            <div className="brew-gauge-label">Carbs</div>
            <div className="brew-gauge-value text-base sm:text-lg">
              {calculations.carbsG.toFixed(1)}g
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
