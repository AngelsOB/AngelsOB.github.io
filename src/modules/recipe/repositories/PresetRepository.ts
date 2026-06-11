'use client';

/**
 * PresetRepository
 *
 * Handles loading preset data (fermentables, hops, yeasts) from both:
 * 1. Generated preset databases (committed with the app)
 * 2. User custom presets (stored in localStorage)
 *
 * This repository provides:
 * - Memoized preset loading (load once, cache in memory)
 * - Merging of generated + custom presets
 * - Deduplication by name
 * - Saving custom presets
 */

import { devError } from "@/utils/logger";
import type { FermentablePreset, HopPreset, YeastPreset } from "../models/Presets";
import {
  FERMENTABLE_PRESETS,
  groupFermentables,
  type FermentableGroup,
} from "@/modules/recipe/data/fermentablePresets";
import { HOP_PRESETS, groupHops, type HopCategory } from "@/modules/recipe/data/hopPresets";
import { YEAST_PRESETS, groupYeasts, type YeastCategory } from "@/modules/recipe/data/yeastPresets";

// Storage keys for custom presets
const CUSTOM_FERMENTABLES_KEY = "beta-custom-fermentables-v1";
const CUSTOM_HOPS_KEY = "beta-custom-hops-v1";
const CUSTOM_YEASTS_KEY = "beta-custom-yeasts-v1";

/**
 * PresetRepository class
 *
 * Provides access to preset databases with caching and custom preset support.
 */
export class PresetRepository {
  // In-memory cache
  private fermentablePresetsCache: FermentablePreset[] | null = null;
  private hopPresetsCache: HopPreset[] | null = null;
  private yeastPresetsCache: YeastPreset[] | null = null;

  /**
   * Load all fermentable presets (generated + custom)
   *
   * Results are cached in memory. Subsequent calls return the cached value.
   */
  loadFermentablePresets(): FermentablePreset[] {
    // Return cached if available
    if (this.fermentablePresetsCache) {
      return this.fermentablePresetsCache;
    }

    // Load custom presets from localStorage
    const custom = this.loadCustomFermentables();

    // Merge generated + custom, deduplicating by name (custom overrides generated)
    const byName = new Map<string, FermentablePreset>();

    // Add generated presets first
    for (const preset of FERMENTABLE_PRESETS) {
      byName.set(preset.name, preset);
    }

    // Add custom presets (will override if same name)
    for (const preset of custom) {
      byName.set(preset.name, preset);
    }

    // Convert back to array and cache
    this.fermentablePresetsCache = Array.from(byName.values());

    return this.fermentablePresetsCache;
  }

  /**
   * Load fermentable presets grouped by category
   */
  loadFermentablePresetsGrouped(): Array<{
    label: FermentableGroup;
    items: FermentablePreset[];
  }> {
    const presets = this.loadFermentablePresets();
    return groupFermentables(presets);
  }

  /**
   * Save a custom fermentable preset
   */
  saveFermentablePreset(preset: FermentablePreset): void {
    const custom = this.loadCustomFermentables();

    // Check if already exists
    const index = custom.findIndex((p) => p.name === preset.name);

    if (index >= 0) {
      // Update existing
      custom[index] = preset;
    } else {
      // Add new
      custom.push(preset);
    }

    // Save to localStorage
    localStorage.setItem(CUSTOM_FERMENTABLES_KEY, JSON.stringify(custom));

    // Clear cache to force reload next time
    this.fermentablePresetsCache = null;
  }

  /**
   * Load custom fermentables from localStorage
   */
  private loadCustomFermentables(): FermentablePreset[] {
    try {
      const json = localStorage.getItem(CUSTOM_FERMENTABLES_KEY);
      if (!json) return [];

      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];

      return parsed;
    } catch (error) {
      devError("Error loading custom fermentables:", error);
      return [];
    }
  }

  /**
   * Load all hop presets (generated + custom)
   */
  loadHopPresets(): HopPreset[] {
    // Return cached if available
    if (this.hopPresetsCache) {
      return this.hopPresetsCache;
    }

    // Load custom presets from localStorage
    const custom = this.loadCustomHops();

    // Merge generated + custom, deduplicating by name (custom overrides generated)
    const byName = new Map<string, HopPreset>();

    // Add generated presets first
    for (const preset of HOP_PRESETS) {
      byName.set(preset.name, preset);
    }

    // Add custom presets (will override if same name)
    for (const preset of custom) {
      byName.set(preset.name, preset);
    }

    // Convert back to array and cache
    this.hopPresetsCache = Array.from(byName.values());

    return this.hopPresetsCache;
  }

  /**
   * Load hop presets grouped by category
   */
  loadHopPresetsGrouped(): Array<{
    label: HopCategory;
    items: HopPreset[];
  }> {
    const presets = this.loadHopPresets();
    return groupHops(presets);
  }

  /**
   * Load custom hops from localStorage
   */
  private loadCustomHops(): HopPreset[] {
    try {
      const json = localStorage.getItem(CUSTOM_HOPS_KEY);
      if (!json) return [];

      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];

      return parsed;
    } catch (error) {
      devError("Error loading custom hops:", error);
      return [];
    }
  }

  /**
   * Save a custom hop preset
   */
  saveHopPreset(preset: HopPreset): void {
    const custom = this.loadCustomHops();

    // Check if already exists
    const index = custom.findIndex((p) => p.name === preset.name);

    if (index >= 0) {
      // Update existing
      custom[index] = preset;
    } else {
      // Add new
      custom.push(preset);
    }

    // Save to localStorage
    localStorage.setItem(CUSTOM_HOPS_KEY, JSON.stringify(custom));

    // Clear cache to force reload next time
    this.hopPresetsCache = null;
  }

  /**
   * Load all yeast presets (generated + custom)
   */
  loadYeastPresets(): YeastPreset[] {
    // Return cached if available
    if (this.yeastPresetsCache) {
      return this.yeastPresetsCache;
    }

    // Load custom presets from localStorage
    const custom = this.loadCustomYeasts();

    // Merge generated + custom, deduplicating by name (custom overrides generated)
    const byName = new Map<string, YeastPreset>();

    // Add generated presets first
    for (const preset of YEAST_PRESETS) {
      byName.set(preset.name, preset);
    }

    // Add custom presets (will override if same name)
    for (const preset of custom) {
      byName.set(preset.name, preset);
    }

    // Convert back to array and cache
    this.yeastPresetsCache = Array.from(byName.values());

    return this.yeastPresetsCache;
  }

  /**
   * Load yeast presets grouped by category
   */
  loadYeastPresetsGrouped(): Array<{
    label: YeastCategory;
    items: YeastPreset[];
  }> {
    const presets = this.loadYeastPresets();
    return groupYeasts(presets);
  }

  /**
   * Load custom yeasts from localStorage
   */
  private loadCustomYeasts(): YeastPreset[] {
    try {
      const json = localStorage.getItem(CUSTOM_YEASTS_KEY);
      if (!json) return [];

      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return [];

      return parsed;
    } catch (error) {
      devError("Error loading custom yeasts:", error);
      return [];
    }
  }

  /**
   * Save a custom yeast preset
   */
  saveYeastPreset(preset: YeastPreset): void {
    const custom = this.loadCustomYeasts();

    // Check if already exists
    const index = custom.findIndex((p) => p.name === preset.name);

    if (index >= 0) {
      // Update existing
      custom[index] = preset;
    } else {
      // Add new
      custom.push(preset);
    }

    // Save to localStorage
    localStorage.setItem(CUSTOM_YEASTS_KEY, JSON.stringify(custom));

    // Clear cache to force reload next time
    this.yeastPresetsCache = null;
  }

  /**
   * Clear all caches
   *
   * Useful for testing or when presets are updated externally
   */
  clearCache(): void {
    this.fermentablePresetsCache = null;
    this.hopPresetsCache = null;
    this.yeastPresetsCache = null;
  }
}

// Export a singleton instance
export const presetRepository = new PresetRepository();
