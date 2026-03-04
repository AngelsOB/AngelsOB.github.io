/**
 * Other Ingredients Panel Component
 *
 * Displays and manages additional brewing ingredients like finings,
 * spices, water agents, and herbs. Supports inline editing of amounts,
 * units, and timing for each ingredient.
 */

import type { OtherIngredient } from "../../../domain/models/Recipe";
import { CATEGORY_LABELS, CATEGORY_COLORS, UNITS, TIMINGS } from "./constants";

type Props = {
  /** List of other ingredients in the recipe */
  ingredients: OtherIngredient[];
  /** Callback to open the ingredient picker modal */
  onOpenPicker: () => void;
  /** Callback when an ingredient is updated */
  onUpdate: (id: string, changes: Partial<OtherIngredient>) => void;
  /** Callback when an ingredient is removed */
  onRemove: (id: string) => void;
};

export default function OtherIngredientsPanel({
  ingredients,
  onOpenPicker,
  onUpdate,
  onRemove,
}: Props) {
  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--fg-strong)' }}>
          Other Ingredients
        </h3>
        <button
          onClick={onOpenPicker}
          className="brew-btn-primary text-sm"
        >
          + Add
        </button>
      </div>

      {ingredients.length === 0 ? (
        <div className="text-sm text-muted italic">
          No additional ingredients — finings, spices, water agents, etc.
        </div>
      ) : (
        <div className="space-y-2">
          {ingredients.map((ing) => (
            <div
              key={ing.id}
              className="brew-ingredient-row flex items-center gap-2"
            >
              {/* Category badge */}
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                  CATEGORY_COLORS[ing.category] || CATEGORY_COLORS.other
                }`}
              >
                {CATEGORY_LABELS[ing.category] || "Other"}
              </span>

              {/* Name */}
              <span className="text-sm font-medium truncate min-w-0 flex-shrink">
                {ing.name}
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Timing */}
              <select
                value={ing.timing}
                onChange={(e) =>
                  onUpdate(ing.id, {
                    timing: e.target.value as OtherIngredient["timing"],
                  })
                }
                className="brew-input text-xs px-1.5 py-1 shrink-0"
              >
                {TIMINGS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {/* Amount + Unit */}
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={ing.amount || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const isDiscrete = ["tablet", "packet", "capsule"].includes(ing.unit);
                    onUpdate(ing.id, {
                      amount: isDiscrete ? Math.round(val) : val,
                    });
                  }}
                  step={["tablet", "packet", "capsule"].includes(ing.unit) ? 1 : 0.1}
                  min="0"
                  placeholder="0"
                  className="brew-input w-16 text-xs px-1.5 py-1 text-right"
                />
                <select
                  value={ing.unit}
                  onChange={(e) => {
                    const unit = e.target.value;
                    const isDiscrete = ["tablet", "packet", "capsule"].includes(unit);
                    onUpdate(ing.id, {
                      unit,
                      amount: isDiscrete ? Math.round(ing.amount || 0) : ing.amount,
                    });
                  }}
                  className="brew-input text-xs px-1 py-1"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hover-reveal actions */}
              <div className="brew-row-actions">
                <button
                  onClick={() => onRemove(ing.id)}
                  className="brew-row-action-btn brew-danger-text"
                  aria-label={`Remove ${ing.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
