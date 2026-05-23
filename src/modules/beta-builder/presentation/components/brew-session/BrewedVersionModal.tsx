import type { Recipe, RecipeCalculations } from '../../../domain/models/Recipe';
import OLD_FermentableSection from '../OLD_FermentableSection';
import OLD_HopSection from '../OLD_HopSection';
import YeastSection from '../YeastSection';
import WaterSection from '../WaterSection';
import OLD_MashScheduleSection from '../OLD_MashScheduleSection';
import OLD_FermentationSection from '../OLD_FermentationSection';
import { EquipmentSection } from '../EquipmentSection';

interface BrewedVersionModalProps {
  isOpen: boolean;
  recipe: Recipe | null;
  calculations: RecipeCalculations | null;
  onRecipeNameChange: (name: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function BrewedVersionModal({
  isOpen,
  recipe,
  calculations,
  onRecipeNameChange,
  onCancel,
  onSave,
}: BrewedVersionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="w-[95vw] max-w-6xl max-h-[92vh] bg-[var(--bg)] rounded-xl shadow-2xl border border-[rgb(var(--border))] overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[rgb(var(--border))] bg-white/80 dark:bg-gray-900/50">
          <div className="flex-1">
            <div className="text-xs text-gray-500">Brewed version editor</div>
            <input
              type="text"
              value={recipe?.name ?? ''}
              onChange={(e) => onRecipeNameChange(e.target.value)}
              className="w-full text-xl font-semibold bg-transparent border-b border-transparent focus:border-[rgb(var(--border))] outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-[rgb(var(--border))] rounded-md hover:bg-[var(--bg)]"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Save Brewed Version
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(92vh-80px)] space-y-6">
          {recipe ? (
            <>
              <EquipmentSection />
              <OLD_FermentableSection />
              <OLD_HopSection />
              <YeastSection />
              <WaterSection calculations={calculations} recipe={recipe} />
              <OLD_MashScheduleSection />
              <OLD_FermentationSection />
            </>
          ) : (
            <div className="text-sm text-gray-500">Loading editor…</div>
          )}
        </div>
      </div>
    </div>
  );
}
