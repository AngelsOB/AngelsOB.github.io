'use client';

/**
 * Start Session Modal
 *
 * Modal for creating a new brew session from a recipe.
 * User can choose to brew as-is or modify the recipe first.
 */

import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Recipe } from '../../domain/models/Recipe';
import { useBrewSessionStore } from '../stores/brewSessionStore';

interface StartSessionModalProps {
  recipe: Recipe;
  onClose: () => void;
}

export default function StartSessionModal({ recipe, onClose }: StartSessionModalProps) {
  const navigate = useNavigate();
  const { createSession, saveCurrentSession } = useBrewSessionStore();
  const [brewDate, setBrewDate] = useState(new Date().toISOString().split('T')[0]);

  const handleStartAsIs = () => {
    // Create session with recipe as-is
    const session = createSession(recipe);
    session.brewDate = new Date(brewDate).toISOString();
    saveCurrentSession();

    // Navigate to session tracker
    navigate(`/recipes/sessions/${session.id}`);
    onClose();
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-session-title"
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="bg-[var(--card)] rounded-lg p-6 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 id="start-session-title" className="text-xl font-semibold">Start Brew Session</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Recipe Info */}
        <div className="mb-6 p-4 bg-[var(--bg)] rounded-lg">
          <div className="font-semibold text-lg mb-2">{recipe.name}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Version {recipe.currentVersion}
            {recipe.style && ` • ${recipe.style}`}
          </div>
        </div>

        {/* Brew Date */}
        <label className="block mb-6">
          <span className="block text-sm font-medium mb-2">
            Brew Date
          </span>
          <input
            type="date"
            value={brewDate}
            onChange={(e) => setBrewDate(e.target.value)}
            className="w-full px-3 py-2 border border-[rgb(var(--border))] rounded-md bg-[var(--bg)]"
          />
        </label>

        {/* Info */}
        <div className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">
            A brew session tracks what you actually brew versus what the recipe specifies.
          </p>
          <p>
            You can modify ingredients and amounts, then record actual measurements during your brew day.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-[rgb(var(--border))] rounded-md hover:bg-[var(--bg)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStartAsIs}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  );
}
