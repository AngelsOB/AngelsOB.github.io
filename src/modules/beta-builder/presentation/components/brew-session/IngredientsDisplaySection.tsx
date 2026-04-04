import type { Recipe } from '../../../domain/models/Recipe';
import type { SessionActuals } from '../../../domain/models/BrewSession';
import type { SaltAdditions } from '../../../domain/services/WaterChemistryService';
import { SectionCard } from './SectionCard';
import { IngredientCard } from './IngredientCard';
import { SubSectionHeader } from './SubSectionHeader';
import { ReadOnlyNumber } from './ReadOnlyNumber';
import { EditableNumber } from './EditableNumber';

const SALT_KEYS = ['gypsum_g', 'cacl2_g', 'epsom_g', 'nacl_g', 'nahco3_g'] as const;
type SaltKey = (typeof SALT_KEYS)[number];
const SALT_LABELS: Record<SaltKey, string> = {
  gypsum_g: 'Gypsum',
  cacl2_g: 'CaCl2',
  epsom_g: 'Epsom',
  nacl_g: 'NaCl',
  nahco3_g: 'NaHCO3',
};

interface IngredientsDisplaySectionProps {
  recipe: Recipe;
  mashWaterL: number;
  spargeWaterL: number;
  mashSalts: SaltAdditions;
  spargeSalts: SaltAdditions;
  actuals: SessionActuals;
  onUpdateActual: (updates: Partial<SessionActuals>) => void;
}

function formatNumber(value: number | undefined, digits: number) {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

export function IngredientsDisplaySection({
  recipe,
  mashWaterL,
  spargeWaterL,
  mashSalts,
  spargeSalts,
  actuals,
  onUpdateActual,
}: IngredientsDisplaySectionProps) {
  return (
    <SectionCard
      title="Ingredients"
      description="Read-only view. Use Edit Brewed Version to adjust."
      tone="slate"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <IngredientCard tone="fermentables">
          <div className="space-y-3">
            <SubSectionHeader title="Grains" />
            {recipe.fermentables.length === 0 && (
              <div className="text-sm text-gray-500">No fermentables listed.</div>
            )}
            <div className="space-y-2">
              {recipe.fermentables.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md bg-[var(--bg)] p-2">
                  <div>
                    <div className="text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-gray-500">{f.colorLovibond} L</div>
                  </div>
                  <ReadOnlyNumber
                    value={f.weightKg}
                    format={(value) => value.toFixed(2)}
                    suffix=" kg"
                    className="text-sm font-semibold"
                  />
                </div>
              ))}
            </div>
          </div>
        </IngredientCard>

        <IngredientCard tone="hops">
          <div className="space-y-3">
            <SubSectionHeader title="Hops" />
            {recipe.hops.length === 0 && (
              <div className="text-sm text-gray-500">No hops listed.</div>
            )}
            <div className="space-y-2">
              {recipe.hops.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-md bg-[var(--bg)] p-2">
                  <div>
                    <div className="text-sm font-medium">{h.name}</div>
                    <div className="text-xs text-gray-500">
                      {h.type}
                      {h.timeMinutes !== undefined && ` • ${h.timeMinutes} min`}
                    </div>
                  </div>
                  <ReadOnlyNumber
                    value={h.grams}
                    format={(value) => value.toFixed(0)}
                    suffix=" g"
                    className="text-sm font-semibold"
                  />
                </div>
              ))}
            </div>
          </div>
        </IngredientCard>

        <IngredientCard tone="yeast" className="md:col-span-2">
          <div className="space-y-3">
            <SubSectionHeader title="Yeast" />
            {recipe.yeasts?.[0] ? (
              <div className="space-y-2 rounded-md bg-[var(--bg)] p-3">
                <div className="text-sm font-medium">{recipe.yeasts?.[0].name}</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Type</span>
                    <span className="font-medium capitalize">
                      {recipe.yeasts?.[0].starter?.yeastType
                        ? recipe.yeasts?.[0].starter.yeastType.replace('-', ' ')
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Packs</span>
                    <ReadOnlyNumber
                      value={recipe.yeasts?.[0].starter?.packs}
                      format={(value) => value.toFixed(0)}
                    />
                  </div>
                </div>
                {recipe.yeasts?.[0].starter?.steps?.length ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {recipe.yeasts?.[0].starter.mfgDate && (
                      <div className="flex items-center justify-between col-span-2">
                        <span className="text-gray-500">Mfg</span>
                        <span className="font-medium">{recipe.yeasts?.[0].starter.mfgDate}</span>
                      </div>
                    )}
                    {recipe.yeasts?.[0].starter.slurryLiters !== undefined && (
                      <div className="flex items-center justify-between col-span-2">
                        <span className="text-gray-500">Slurry</span>
                        <span className="font-medium">
                          {recipe.yeasts?.[0].starter.slurryLiters.toFixed(1)} L
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                No yeast selected.
              </div>
            )}
          </div>
        </IngredientCard>

        <IngredientCard tone="water" className="md:col-span-2">
          <div className="space-y-3">
            <SubSectionHeader title="Water & Salts" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-md bg-[var(--bg)] p-3">
                <div className="text-xs text-gray-500 uppercase">Strike Water</div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500">Target</span>
                  <span className="font-medium">{formatNumber(mashWaterL, 1)} L</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Actual</span>
                  <EditableNumber
                    value={actuals.strikeWaterL}
                    onCommit={(value) => onUpdateActual({ strikeWaterL: value })}
                    step={0.1}
                    format={(value) => value.toFixed(1)}
                    suffix=" L"
                  />
                </div>
              </div>
              <div className="rounded-md bg-[var(--bg)] p-3">
                <div className="text-xs text-gray-500 uppercase">Sparge Water</div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-500">Target</span>
                  <span className="font-medium">{formatNumber(spargeWaterL, 1)} L</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Actual</span>
                  <EditableNumber
                    value={actuals.spargeWaterL}
                    onCommit={(value) => onUpdateActual({ spargeWaterL: value })}
                    step={0.1}
                    format={(value) => value.toFixed(1)}
                    suffix=" L"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-md bg-[var(--bg)] p-3">
              <div className="text-xs text-gray-500 uppercase">Salts (grams)</div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mt-2">
                <span>Salt</span>
                <span>Strike</span>
                <span>Sparge</span>
              </div>
              {recipe.waterChemistry ? (
                <div className="space-y-2 mt-2">
                  {SALT_KEYS.map((key) => (
                    <div key={key} className="grid grid-cols-3 gap-2 items-center text-sm">
                      <span className="text-gray-600">{SALT_LABELS[key]}</span>
                      <ReadOnlyNumber
                        value={mashSalts[key]}
                        format={(value) => value.toFixed(2)}
                        suffix=" g"
                      />
                      <ReadOnlyNumber
                        value={spargeSalts[key]}
                        format={(value) => value.toFixed(2)}
                        suffix=" g"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 mt-2">
                  No water profile.
                </div>
              )}
            </div>
          </div>
        </IngredientCard>
      </div>
    </SectionCard>
  );
}
