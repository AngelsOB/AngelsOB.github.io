'use client';

import type { Recipe, RecipeCalculations, Hop } from '../beta-builder/domain/models/Recipe';
import { packagingCalculationService as pkgCalc } from '../beta-builder/domain/services/PackagingCalculationService';
import { srmToRgb } from '../beta-builder/utils/srmColorUtils';
import HopFlavorRadar from '../beta-builder/presentation/components/HopFlavorRadar';
import ForkButton from './ForkButton';
import { useState } from 'react';
import { downloadTextFile, generateBeerXml, sanitizeFileName } from '../beta-builder/presentation/utils/recipeExport';
import Button from '../../components/Button';
import PhysicsCan from '../labels/PhysicsCan';
import UpgradeModal from '../auth/components/UpgradeModal';
import { useUserTier } from '../auth/useUserTier';
import { canAccess } from '../auth/tierAccess';

interface PublicRecipeViewProps {
  recipe: Recipe;
  calculations: RecipeCalculations;
  ownerName: string;
}

const fmt = (n: number | undefined, digits = 2): string => {
  if (n == null || Number.isNaN(n)) return '–';
  return Number(n).toFixed(digits);
};

const kgToLb = (kg: number) => kg * 2.2046226218;
const gToOz = (g: number) => g * 0.03527396195;
const cToF = (c: number) => (c * 9) / 5 + 32;

function formatHopUse(h: Hop): string {
  const labels: Record<string, string> = {
    boil: 'Boil', 'first wort': 'First Wort', whirlpool: 'Whirlpool',
    'dry hop': 'Dry Hop', mash: 'Mash',
  };
  return labels[h.type] || h.type;
}

function formatHopTime(h: Hop): string {
  if (h.type === 'boil' || h.type === 'first wort') return `${fmt(h.timeMinutes, 0)} min`;
  if (h.type === 'whirlpool') {
    const time = h.whirlpoolTimeMinutes ?? h.timeMinutes;
    const temp = h.temperatureC != null ? ` @ ${fmt(h.temperatureC, 0)}°C` : '';
    return `${fmt(time, 0)} min${temp}`;
  }
  if (h.type === 'dry hop') {
    const parts: string[] = [];
    if (h.dryHopStartDay != null) parts.push(`day ${h.dryHopStartDay}`);
    if (h.dryHopDays != null) parts.push(`${h.dryHopDays} days`);
    return parts.length > 0 ? parts.join(', ') : '–';
  }
  return h.timeMinutes != null ? `${fmt(h.timeMinutes, 0)} min` : '–';
}

/** @deprecated Classic UI. Migrating to HS — see HOPSKIP_MIGRATION_PRD.md §1.2. */
export default function PublicRecipeView({ recipe, calculations: calc, ownerName }: PublicRecipeViewProps) {
  const srmColor = srmToRgb(calc.srm);
  const totalGrainKg = recipe.fermentables.reduce((s, f) => s + f.weightKg, 0);

  const hopOrder: Record<string, number> = {
    'first wort': 0, boil: 1, whirlpool: 2, mash: 3, 'dry hop': 4,
  };
  const sortedHops = [...recipe.hops].sort((a, b) => {
    const oa = hopOrder[a.type] ?? 5;
    const ob = hopOrder[b.type] ?? 5;
    if (oa !== ob) return oa - ob;
    if (a.type === 'dry hop' && b.type === 'dry hop') {
      return (a.dryHopStartDay ?? Infinity) - (b.dryHopStartDay ?? Infinity);
    }
    return (b.timeMinutes ?? 0) - (a.timeMinutes ?? 0);
  });

  const hopFlavorSeries = recipe.hops
    .filter((h) => h.flavor)
    .map((h) => ({ name: h.name, flavor: h.flavor! }));

  const { userState } = useUserTier();
  const exportAllowed = canAccess('export', userState);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  function handleExportBeerXml() {
    if (!exportAllowed) { setIsUpgradeModalOpen(true); return; }
    const xml = generateBeerXml(recipe);
    const filename = `${sanitizeFileName(recipe.name)}.xml`;
    downloadTextFile(filename, xml, 'application/xml;charset=utf-8');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        {/* SRM color bar */}
        <div
          className="h-2 rounded-full mb-4"
          style={{ backgroundColor: srmColor }}
        />
        {recipe.labelUrl && (
          <PhysicsCan
            labelUrl={recipe.labelUrl}
            srmColor={srmColor}
          />
        )}
        <h1 className="text-3xl font-bold text-[var(--fg-strong)]">{recipe.name}</h1>
        {recipe.style && (
          <p className="text-lg italic text-[var(--fg-muted)] mt-1">{recipe.style}</p>
        )}
        <p className="text-sm text-[var(--fg-muted)] mt-2">
          Recipe by <span className="font-medium text-[var(--fg-strong)]">{ownerName}</span>
        </p>
        {recipe.notes && (
          <p className="mt-3 text-sm text-[var(--fg-muted)] whitespace-pre-line border-l-2 border-[var(--brew-accent-300)] pl-3">
            {recipe.notes}
          </p>
        )}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.tags.map((tag) => (
              <span key={tag} className="brew-chip text-xs">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="brew-section">
        <h2 className="brew-section-title mb-4">Vital Statistics</h2>
        <div className="grid grid-cols-5 gap-3 text-center">
          {[
            { label: 'ABV', value: `${fmt(calc.abv, 1)}%` },
            { label: 'OG', value: fmt(calc.og, 3) },
            { label: 'FG', value: fmt(calc.fg, 3) },
            { label: 'IBU', value: fmt(calc.ibu, 0) },
            { label: 'SRM', value: fmt(calc.srm, 1), color: srmColor },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <div className="text-xs uppercase tracking-wider text-[var(--fg-muted)] mb-1">{label}</div>
              <div className="text-xl font-bold text-[var(--fg-strong)]" style={color ? { color } : undefined}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center mt-4 text-sm">
          <div>
            <span className="text-[var(--fg-muted)]">Batch: </span>
            <span className="font-medium">{fmt(recipe.batchVolumeL, 1)} L</span>
          </div>
          <div>
            <span className="text-[var(--fg-muted)]">Calories: </span>
            <span className="font-medium">{fmt(calc.calories, 0)}/12oz</span>
          </div>
          <div>
            <span className="text-[var(--fg-muted)]">Efficiency: </span>
            <span className="font-medium">{fmt(recipe.equipment.mashEfficiencyPercent, 0)}%</span>
          </div>
        </div>
      </div>

      {/* Fermentables */}
      {recipe.fermentables.length > 0 && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Fermentables</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--fg-muted)] border-b border-[var(--brew-accent-200)]">
                  <th className="pb-2">Grain</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">%</th>
                  <th className="pb-2 text-right">Color</th>
                </tr>
              </thead>
              <tbody>
                {recipe.fermentables.map((f) => {
                  const pct = totalGrainKg > 0 ? (f.weightKg / totalGrainKg) * 100 : 0;
                  return (
                    <tr key={f.id} className="border-b border-[var(--brew-accent-100)]">
                      <td className="py-2 font-medium">{f.name}</td>
                      <td className="py-2 text-right text-[var(--fg-muted)]">
                        {fmt(f.weightKg, 2)} kg ({fmt(kgToLb(f.weightKg), 2)} lb)
                      </td>
                      <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(pct, 1)}%</td>
                      <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(f.colorLovibond, 0)} °L</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hops */}
      {recipe.hops.length > 0 && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Hops</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--fg-muted)] border-b border-[var(--brew-accent-200)]">
                  <th className="pb-2">Hop</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2 text-right">AA</th>
                  <th className="pb-2">Use</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {sortedHops.map((h) => (
                  <tr key={h.id} className="border-b border-[var(--brew-accent-100)]">
                    <td className="py-2 font-medium">{h.name}</td>
                    <td className="py-2 text-right text-[var(--fg-muted)]">
                      {fmt(h.grams, 0)} g ({fmt(gToOz(h.grams), 2)} oz)
                    </td>
                    <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(h.alphaAcid, 1)}%</td>
                    <td className="py-2 text-[var(--fg-muted)]">{formatHopUse(h)}</td>
                    <td className="py-2 text-[var(--fg-muted)]">{formatHopTime(h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Hop Flavor Radar */}
          {hopFlavorSeries.length > 0 && (
            <div className="mt-6 flex justify-center">
              <HopFlavorRadar
                series={hopFlavorSeries}
                colorStrategy="dominant"
                labelColorize
                showLegend
                size={280}
              />
            </div>
          )}
        </div>
      )}

      {/* Yeast */}
      {recipe.yeasts.length > 0 && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Yeast</h2>
          <div className="space-y-2">
            {recipe.yeasts.map((y) => (
              <div key={y.id} className="text-sm">
                <span className="font-medium">{y.name}</span>
                {y.laboratory && <span className="text-[var(--fg-muted)]"> ({y.laboratory})</span>}
                <span className="text-[var(--fg-muted)]"> — {fmt(y.attenuation * 100, 0)}% attenuation</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Ingredients */}
      {recipe.otherIngredients && recipe.otherIngredients.length > 0 && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Other Ingredients</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--fg-muted)] border-b border-[var(--brew-accent-200)]">
                  <th className="pb-2">Ingredient</th>
                  <th className="pb-2 text-right">Amount</th>
                  <th className="pb-2">Timing</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recipe.otherIngredients.map((i) => (
                  <tr key={i.id} className="border-b border-[var(--brew-accent-100)]">
                    <td className="py-2 font-medium">{i.name}</td>
                    <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(i.amount, 1)} {i.unit}</td>
                    <td className="py-2 text-[var(--fg-muted)] capitalize">{i.timing}</td>
                    <td className="py-2 text-[var(--fg-muted)]">{i.notes || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mash Schedule */}
      {recipe.mashSteps.length > 0 && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Mash Schedule</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--fg-muted)] border-b border-[var(--brew-accent-200)]">
                  <th className="pb-2">Step</th>
                  <th className="pb-2 text-right">Temperature</th>
                  <th className="pb-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recipe.mashSteps.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--brew-accent-100)]">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-right text-[var(--fg-muted)]">
                      {fmt(s.temperatureC, 0)}°C ({fmt(cToF(s.temperatureC), 0)}°F)
                    </td>
                    <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(s.durationMinutes, 0)} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Water Chemistry */}
      {recipe.waterChemistry && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Water Chemistry</h2>
          {(recipe.waterChemistry.sourceProfileName || recipe.waterChemistry.targetStyleName) && (
            <p className="text-sm text-[var(--fg-muted)] mb-3">
              Source: <strong>{recipe.waterChemistry.sourceProfileName || '–'}</strong>
              {' → '}Target: <strong>{recipe.waterChemistry.targetStyleName || '–'}</strong>
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--fg-muted)] border-b border-[var(--brew-accent-200)]">
                  <th className="pb-2"></th>
                  <th className="pb-2 text-right">Ca</th>
                  <th className="pb-2 text-right">Mg</th>
                  <th className="pb-2 text-right">Na</th>
                  <th className="pb-2 text-right">Cl</th>
                  <th className="pb-2 text-right">SO4</th>
                  <th className="pb-2 text-right">HCO3</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--brew-accent-100)]">
                  <td className="py-2 font-medium">Source</td>
                  <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(recipe.waterChemistry.sourceProfile.Ca, 0)}</td>
                  <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(recipe.waterChemistry.sourceProfile.Mg, 0)}</td>
                  <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(recipe.waterChemistry.sourceProfile.Na, 0)}</td>
                  <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(recipe.waterChemistry.sourceProfile.Cl, 0)}</td>
                  <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(recipe.waterChemistry.sourceProfile.SO4, 0)}</td>
                  <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(recipe.waterChemistry.sourceProfile.HCO3, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fermentation Schedule */}
      {recipe.fermentationSteps.length > 0 && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Fermentation</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-[var(--fg-muted)] border-b border-[var(--brew-accent-200)]">
                  <th className="pb-2">Step</th>
                  <th className="pb-2 text-right">Temperature</th>
                  <th className="pb-2 text-right">Duration</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {recipe.fermentationSteps.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--brew-accent-100)]">
                    <td className="py-2 font-medium">{s.name || s.type}</td>
                    <td className="py-2 text-right text-[var(--fg-muted)]">
                      {fmt(s.temperatureC, 0)}°C ({fmt(cToF(s.temperatureC), 0)}°F)
                    </td>
                    <td className="py-2 text-right text-[var(--fg-muted)]">{fmt(s.durationDays, 0)} days</td>
                    <td className="py-2 text-[var(--fg-muted)]">{s.notes || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Packaging */}
      {recipe.packaging && (
        <div className="brew-section">
          <h2 className="brew-section-title mb-4">Packaging</h2>
          {(() => {
            const pkg = recipe.packaging!;
            const highTemp = pkgCalc.highestFermTemp(recipe.fermentationSteps);
            const residual = pkgCalc.residualCo2(highTemp);
            const hasBottle = pkg.methods.includes('bottle');
            const hasKeg = pkg.methods.includes('keg');
            const methodLabel = pkg.methods.length === 2 ? 'Bottle + Keg' : hasBottle ? 'Bottling' : 'Kegging';
            return (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-[var(--fg-muted)]">
                  <span>Method: <strong className="text-[var(--fg-strong)]">{methodLabel}</strong></span>
                  <span>Target CO₂: <strong className="text-[var(--fg-strong)]">{fmt(pkg.targetCo2Volumes, 1)}</strong> vol</span>
                  <span>Residual CO₂: <strong className="text-[var(--fg-strong)]">{fmt(residual, 2)}</strong> vol</span>
                </div>
                {hasBottle && pkg.primingSugarType && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[var(--fg-muted)]">
                    <span>Priming sugar: <strong className="text-[var(--fg-strong)]">{Math.round(pkgCalc.primingSugarGrams(pkg.targetCo2Volumes, residual, recipe.batchVolumeL, pkg.primingSugarType))} g</strong> {pkgCalc.sugarLabel(pkg.primingSugarType)}</span>
                    {(pkg.bottles?.length ?? 0) > 0
                      ? pkg.bottles!.map((b, i) => (
                          <span key={i}>
                            <strong className="text-[var(--fg-strong)]">{b.count}</strong> x {pkgCalc.bottleSizeML(b.size)} ml
                          </span>
                        ))
                      : pkg.bottleSize && (
                          <span>Bottles: <strong className="text-[var(--fg-strong)]">{pkgCalc.numberOfBottles(recipe.batchVolumeL, pkg.bottleSize)}</strong> x {pkgCalc.bottleSizeML(pkg.bottleSize)} ml</span>
                        )
                    }
                  </div>
                )}
                {hasKeg && pkg.servingTempC != null && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[var(--fg-muted)]">
                    <span>Serving pressure: <strong className="text-[var(--fg-strong)]">{fmt(pkgCalc.forcedCarbonationPsi(pkg.servingTempC, pkg.targetCo2Volumes), 1)} PSI</strong> at {fmt(pkg.servingTempC, 0)}°C</span>
                  </div>
                )}
                {pkg.notes && (
                  <p className="text-[var(--fg-muted)] italic">{pkg.notes}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <ForkButton recipeId={recipe.id} recipeName={recipe.name} />
        <Button variant="ghost" size="sm" onClick={handleExportBeerXml} className={!exportAllowed ? "opacity-50" : ""}>
          Export BeerXML
        </Button>
      </div>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        reason="Export is a Premium feature."
      />
    </div>
  );
}
