/**
 * Salt Summary Component
 *
 * Collapsed view showing salt additions with auto-calculated
 * mash/sparge split amounts.
 */

import type { SaltAdditions } from "../../../domain/services/WaterChemistryService";
import { SALT_SHORT_LABELS } from "./constants";

type Props = {
  /** Total salt additions configured for the recipe */
  saltAdditions: Partial<SaltAdditions>;
  /** Salt amounts for mash water (auto-calculated) */
  mashSalts: Partial<SaltAdditions>;
  /** Salt amounts for sparge water (auto-calculated) */
  spargeSalts: Partial<SaltAdditions>;
  /** Name of the source water profile */
  sourceProfileName?: string;
};

export default function OLD_SaltSummary({
  saltAdditions,
  mashSalts,
  spargeSalts,
  sourceProfileName,
}: Props) {
  const hasSalts = Object.values(saltAdditions).some((v) => v && v > 0);

  return (
    <div>
      {hasSalts && (
        <div className="text-xs text-muted mb-3">
          Added to {sourceProfileName || "Custom"}:
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.keys(SALT_SHORT_LABELS) as Array<keyof SaltAdditions>).map(
          (saltKey) => {
            const totalAmount = saltAdditions[saltKey] || 0;
            const mashAmount = mashSalts[saltKey] || 0;
            const spargeAmount = spargeSalts[saltKey] || 0;

            if (totalAmount === 0) return null;

            return (
              <div
                key={saltKey}
                className="rounded-lg p-3"
                style={{ background: 'color-mix(in oklch, var(--brew-accent-900) 15%, color-mix(in oklch, var(--brew-card-inset) 35%, transparent))', border: '1px solid color-mix(in oklch, var(--brew-accent-700) 15%, rgb(var(--brew-border-subtle)))', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.04)' }}
              >
                <div className="text-xs brew-link mb-1 font-medium">
                  {SALT_SHORT_LABELS[saltKey]}
                </div>
                <div className="text-lg font-bold" style={{ color: 'var(--fg-strong)' }}>
                  {totalAmount.toFixed(1)}
                  <span className="text-sm ml-1">g total</span>
                </div>
                <div className="text-xs text-muted mt-1 space-y-0.5">
                  <div>Mash: {mashAmount.toFixed(1)}g</div>
                  <div>Sparge: {spargeAmount.toFixed(1)}g</div>
                </div>
              </div>
            );
          }
        )}
        {!hasSalts && (
          <div className="col-span-full text-sm text-muted italic">
            No salts added yet
          </div>
        )}
      </div>
    </div>
  );
}
