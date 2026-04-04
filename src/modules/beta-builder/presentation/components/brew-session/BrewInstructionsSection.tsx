import type { Recipe } from '../../../domain/models/Recipe';
import type { SaltAdditions } from '../../../domain/services/WaterChemistryService';
import { SectionCard } from './SectionCard';
import { InstructionStep } from './InstructionStep';
import { InfoPill } from './InfoPill';
import { ReadOnlyNumber } from './ReadOnlyNumber';

const SALT_KEYS = ['gypsum_g', 'cacl2_g', 'epsom_g', 'nacl_g', 'nahco3_g'] as const;
type SaltKey = (typeof SALT_KEYS)[number];
const SALT_LABELS: Record<SaltKey, string> = {
  gypsum_g: 'Gypsum',
  cacl2_g: 'CaCl2',
  epsom_g: 'Epsom',
  nacl_g: 'NaCl',
  nahco3_g: 'NaHCO3',
};

interface BrewInstructionsSectionProps {
  recipe: Recipe;
  mashWaterL: number;
  spargeWaterL: number;
  strikeTempC: number;
  spargeTempC: number;
  pitchTempC: number | undefined;
  mashSalts: SaltAdditions;
  spargeSalts: SaltAdditions;
}

function formatNumber(value: number | undefined, digits: number) {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

export function BrewInstructionsSection({
  recipe,
  mashWaterL,
  spargeWaterL,
  strikeTempC,
  spargeTempC,
  pitchTempC,
  mashSalts,
  spargeSalts,
}: BrewInstructionsSectionProps) {
  const hasStarter = Boolean(recipe.yeasts?.[0]?.starter?.steps?.length);
  const baseStepNumber = hasStarter ? 1 : 0;

  return (
    <SectionCard title="Instructions" description="Brew day steps in order." tone="emerald">
      <div className="space-y-4">
        {hasStarter && (
          <InstructionStep number={1} title="Starter (if using)">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md bg-[var(--bg)] p-2 text-sm">
                <span className="text-gray-500">Packs</span>
                <ReadOnlyNumber
                  value={recipe.yeasts?.[0].starter?.packs}
                  format={(value) => value.toFixed(0)}
                />
              </div>
              {recipe.yeasts?.[0].starter?.steps?.map((step) => (
                <div key={step.id} className="rounded-md bg-[var(--bg)] p-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <InfoPill text={`${step.liters.toFixed(1)} L`} />
                    <InfoPill text={`${step.gravity.toFixed(3)} SG`} />
                  </div>
                </div>
              ))}
            </div>
          </InstructionStep>
        )}

        <InstructionStep number={baseStepNumber + 1} title="Warm strike + sparge water">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-[var(--bg)] p-2">
              <div className="text-xs text-gray-500 uppercase">Strike</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <InfoPill text={`${formatNumber(mashWaterL, 1)} L`} />
                <InfoPill text={`${strikeTempC.toFixed(1)} °C`} />
              </div>
            </div>
            <div className="rounded-md bg-[var(--bg)] p-2">
              <div className="text-xs text-gray-500 uppercase">Sparge</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <InfoPill text={`${formatNumber(spargeWaterL, 1)} L`} />
                <InfoPill text={`${spargeTempC.toFixed(0)} °C`} />
              </div>
            </div>
          </div>
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 2} title="Add water salts (strike + sparge)">
          {recipe.waterChemistry ? (
            <div className="space-y-2">
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
            <div className="text-sm text-gray-500">No water profile.</div>
          )}
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 3} title="Mash in">
          {recipe.fermentables.length === 0 ? (
            <div className="text-sm text-gray-500">No grains listed.</div>
          ) : (
            <div className="space-y-2">
              {recipe.fermentables.map((fermentable) => (
                <div
                  key={fermentable.id}
                  className="flex items-center justify-between rounded-md bg-[var(--bg)] px-3 py-2 text-sm"
                >
                  <span className="font-medium">{fermentable.name}</span>
                  <InfoPill text={`${fermentable.weightKg.toFixed(2)} kg`} />
                </div>
              ))}
            </div>
          )}
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 4} title="Mash steps">
          {recipe.mashSteps.length === 0 ? (
            <div className="text-sm text-gray-500">No mash steps.</div>
          ) : (
            <div className="space-y-2">
              {recipe.mashSteps.map((step) => (
                <div key={step.id} className="rounded-md bg-[var(--bg)] p-2 text-sm">
                  <div className="font-medium">{step.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <InfoPill text={`${step.temperatureC.toFixed(1)} °C`} />
                    <InfoPill text={`${step.durationMinutes.toFixed(0)} min`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 5} title="Pull grains and sparge">
          <div className="flex flex-wrap gap-2 text-sm">
            <InfoPill text={`Sparge ${formatNumber(spargeWaterL, 1)} L`} />
            <InfoPill text={`${spargeTempC.toFixed(0)} °C`} />
          </div>
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 6} title="Boil + hop additions">
          {recipe.hops.length === 0 ? (
            <div className="text-sm text-gray-500">No hop additions.</div>
          ) : (
            <div className="space-y-2">
              {recipe.hops.map((hop) => (
                <div key={hop.id} className="rounded-md bg-[var(--bg)] p-2 text-sm">
                  <div className="font-medium">{hop.name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <InfoPill text={`${hop.grams.toFixed(0)} g`} />
                    <InfoPill text={hop.type} />
                    {hop.timeMinutes !== undefined && (
                      <InfoPill text={`${hop.timeMinutes} min`} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 7} title="Cool and pitch yeast">
          <div className="flex flex-wrap gap-2 text-sm">
            {pitchTempC !== undefined ? (
              <InfoPill text={`Pitch at ${pitchTempC.toFixed(1)} °C`} />
            ) : (
              <span className="text-gray-500">Pitch temp not set.</span>
            )}
          </div>
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 8} title="Fermentation steps">
          {recipe.fermentationSteps.filter((step) => step.type !== 'conditioning' && step.type !== 'cold-crash')
            .length === 0 ? (
            <div className="text-sm text-gray-500">No fermentation steps.</div>
          ) : (
            <div className="space-y-2">
              {recipe.fermentationSteps
                .filter((step) => step.type !== 'conditioning' && step.type !== 'cold-crash')
                .map((step) => (
                  <div key={step.id} className="rounded-md bg-[var(--bg)] p-2 text-sm">
                    <div className="font-medium">{step.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <InfoPill text={`${step.temperatureC.toFixed(1)} °C`} />
                      <InfoPill text={`${step.durationDays.toFixed(0)} days`} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </InstructionStep>

        <InstructionStep number={baseStepNumber + 9} title="Conditioning steps">
          {recipe.fermentationSteps.filter((step) => step.type === 'conditioning' || step.type === 'cold-crash')
            .length === 0 ? (
            <div className="text-sm text-gray-500">No conditioning steps.</div>
          ) : (
            <div className="space-y-2">
              {recipe.fermentationSteps
                .filter((step) => step.type === 'conditioning' || step.type === 'cold-crash')
                .map((step) => (
                  <div key={step.id} className="rounded-md bg-[var(--bg)] p-2 text-sm">
                    <div className="font-medium">{step.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <InfoPill text={`${step.temperatureC.toFixed(1)} °C`} />
                      <InfoPill text={`${step.durationDays.toFixed(0)} days`} />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </InstructionStep>
      </div>
    </SectionCard>
  );
}
