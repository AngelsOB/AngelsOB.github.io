import type { SessionActuals } from '../../../domain/models/BrewSession';
import type { RecipeCalculations } from '../../../domain/models/Recipe';
import { SectionCard } from './SectionCard';
import { EditableNumber } from './EditableNumber';

interface GravityTrackingSectionProps {
  calculations: RecipeCalculations | null;
  actuals: SessionActuals;
  onUpdateActual: (updates: Partial<SessionActuals>) => void;
}

function formatNumber(value: number | undefined, digits: number) {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

export function GravityTrackingSection({
  calculations,
  actuals,
  onUpdateActual,
}: GravityTrackingSectionProps) {
  return (
    <SectionCard title="Gravity" description="Expected vs recorded for this session." tone="amber">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md bg-[var(--bg)] p-3">
          <div className="text-xs text-gray-500 uppercase">Original Gravity</div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-500">Expected</span>
            <span className="font-medium">{formatNumber(calculations?.og, 3)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Recorded</span>
            <EditableNumber
              value={actuals.originalGravity}
              onCommit={(value) => onUpdateActual({ originalGravity: value })}
              step={0.001}
              format={(value) => value.toFixed(3)}
            />
          </div>
        </div>
        <div className="rounded-md bg-[var(--bg)] p-3">
          <div className="text-xs text-gray-500 uppercase">Final Gravity</div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-500">Expected</span>
            <span className="font-medium">{formatNumber(calculations?.fg, 3)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Recorded</span>
            <EditableNumber
              value={actuals.finalGravity}
              onCommit={(value) => onUpdateActual({ finalGravity: value })}
              step={0.001}
              format={(value) => value.toFixed(3)}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
