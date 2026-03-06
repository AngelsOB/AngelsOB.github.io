'use client';

/**
 * Custom Water Ingredient Modal Component
 *
 * Modal for adding a custom ingredient with a name and category.
 */

import { useState } from "react";
import type { OtherIngredientCategory } from "../../../domain/models/Recipe";
import ModalOverlay from "../ModalOverlay";
import { CATEGORY_LABELS } from "./constants";

type Props = {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when the modal closes */
  onClose: () => void;
  /** Callback when a custom ingredient is added */
  onAdd: (name: string, category: OtherIngredientCategory) => void;
};

export default function CustomWaterIngredientModal({
  isOpen,
  onClose,
  onAdd,
}: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<OtherIngredientCategory>("other");

  const handleClose = () => {
    setName("");
    setCategory("other");
    onClose();
  };

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, category);
    handleClose();
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} size="sm">
      <div className="p-4">
        <h3 className="brew-section-title mb-4">Custom Ingredient</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="custom-water-ingredient-name" className="block text-xs mb-1 text-muted">
              Name
            </label>
            <input
              id="custom-water-ingredient-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingredient name"
              autoFocus
              data-autofocus
              className="brew-input w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
          </div>
          <div>
            <label htmlFor="custom-water-ingredient-category" className="block text-xs mb-1 text-muted">
              Category
            </label>
            <select
              id="custom-water-ingredient-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as OtherIngredientCategory)}
              className="brew-input w-full"
            >
              {(Object.keys(CATEGORY_LABELS) as OtherIngredientCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleClose}
              className="brew-btn-ghost flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="brew-btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
