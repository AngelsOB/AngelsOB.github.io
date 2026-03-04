'use client';

/**
 * RecipeVersionRepository
 *
 * Manages recipe version snapshots in localStorage.
 * Each time a recipe is modified, a new version snapshot is created.
 */

import { devError } from '../../../../utils/logger';
import type { RecipeVersion } from '../models/Recipe';

export class RecipeVersionRepository {
  private readonly STORAGE_KEY = 'beer-recipe-versions-v1';

  /**
   * Load all versions for a specific recipe
   */
  loadByRecipeId(recipeId: string): RecipeVersion[] {
    try {
      const allVersions = this.loadAll();
      return allVersions
        .filter((v) => v.recipeId === recipeId)
        .sort((a, b) => a.versionNumber - b.versionNumber);
    } catch (error) {
      devError('Failed to load recipe versions:', error);
      return [];
    }
  }

  /**
   * Load a specific version of a recipe
   */
  loadByRecipeIdAndVersion(recipeId: string, versionNumber: number): RecipeVersion | null {
    try {
      const versions = this.loadByRecipeId(recipeId);
      return versions.find((v) => v.versionNumber === versionNumber) ?? null;
    } catch (error) {
      devError('Failed to load recipe version:', error);
      return null;
    }
  }

  /**
   * Load all versions from storage
   */
  private loadAll(): RecipeVersion[] {
    try {
      const json = localStorage.getItem(this.STORAGE_KEY);
      if (!json) return [];

      const versions = JSON.parse(json) as RecipeVersion[];
      return versions;
    } catch (error) {
      devError('Failed to load all versions:', error);
      return [];
    }
  }

  /**
   * Save a new version snapshot
   */
  save(version: RecipeVersion): void {
    try {
      const allVersions = this.loadAll();

      // Check if this version already exists
      const existingIndex = allVersions.findIndex(
        (v) => v.recipeId === version.recipeId && v.versionNumber === version.versionNumber
      );

      if (existingIndex >= 0) {
        // Update existing version (shouldn't happen normally, but handle it)
        allVersions[existingIndex] = version;
      } else {
        // Add new version
        allVersions.push(version);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allVersions));
    } catch (error) {
      devError('Failed to save recipe version:', error);
      throw new Error('Could not save recipe version. Storage may be full.');
    }
  }

  /**
   * Delete all versions for a specific recipe (when recipe is deleted)
   */
  deleteByRecipeId(recipeId: string): void {
    try {
      const allVersions = this.loadAll();
      const filtered = allVersions.filter((v) => v.recipeId !== recipeId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      devError('Failed to delete recipe versions:', error);
      throw new Error('Could not delete recipe versions.');
    }
  }

  /**
   * Delete all versions (for testing/reset)
   */
  deleteAll(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      devError('Failed to clear recipe versions:', error);
    }
  }

  /**
   * Get the latest version number for a recipe
   */
  getLatestVersionNumber(recipeId: string): number {
    const versions = this.loadByRecipeId(recipeId);
    if (versions.length === 0) return 0;
    return Math.max(...versions.map((v) => v.versionNumber));
  }
}

// Export singleton instance
export const recipeVersionRepository = new RecipeVersionRepository();
