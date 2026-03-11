'use client';

import { useRouter } from "next/navigation";
import type { SessionStatus } from '../../../domain/models/BrewSession';

interface BrewSessionHeaderProps {
  recipeName: string;
  brewDate: string;
  recipeVersionNumber: number;
  brewedVersionNumber?: number;
  status: SessionStatus;
  onStatusChange: (status: SessionStatus) => void;
  onEditBrewedVersion: () => void;
  onSave: () => void;
}

export function BrewSessionHeader({
  recipeName,
  brewDate,
  recipeVersionNumber,
  brewedVersionNumber,
  status,
  onStatusChange,
  onEditBrewedVersion,
  onSave,
}: BrewSessionHeaderProps) {
  const router = useRouter();

  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/recipes')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Recipes
        </button>
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as SessionStatus)}
            className="px-3 py-1 border border-[rgb(var(--border))] rounded-md bg-[var(--bg)]"
          >
            <option value="planning">Planning</option>
            <option value="brewing">Brewing</option>
            <option value="fermenting">Fermenting</option>
            <option value="conditioning">Conditioning</option>
            <option value="completed">Completed</option>
          </select>
          <button
            onClick={onEditBrewedVersion}
            className="px-3 py-1 text-sm border border-[rgb(var(--border))] rounded-md hover:bg-[var(--bg)]"
          >
            Edit Brewed Version
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
      <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
        {recipeName}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>Brewed: {new Date(brewDate).toLocaleDateString()}</span>
        <span>Version {recipeVersionNumber}</span>
        {brewedVersionNumber && (
          <span>Brewed v{brewedVersionNumber}</span>
        )}
      </div>
    </header>
  );
}
