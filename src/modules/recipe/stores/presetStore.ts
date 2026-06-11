/**
 * Preset Store
 *
 * Manages cached presets for fermentables, hops, and yeasts.
 * Loads from PresetRepository and caches in memory for performance.
 */

import { create } from "zustand";
import { devError } from "@/utils/logger";
import type { FermentablePreset, HopPreset, YeastPreset } from "@/modules/recipe/models/Presets";
import { presetRepository } from "@/modules/recipe/repositories/PresetRepository";
import type { FermentableGroup } from "@/modules/recipe/data/fermentablePresets";
import type { HopCategory } from "@/modules/recipe/data/hopPresets";
import type { YeastCategory } from "@/modules/recipe/data/yeastPresets";

type PresetStore = {
  // State
  fermentablePresets: FermentablePreset[];
  fermentablePresetsGrouped: Array<{ label: FermentableGroup; items: FermentablePreset[] }>;
  hopPresets: HopPreset[];
  hopPresetsGrouped: Array<{ label: HopCategory; items: HopPreset[] }>;
  yeastPresets: YeastPreset[];
  yeastPresetsGrouped: Array<{ label: YeastCategory; items: YeastPreset[] }>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFermentablePresets: () => void;
  loadHopPresets: () => void;
  loadYeastPresets: () => void;
  saveFermentablePreset: (preset: FermentablePreset) => void;
  saveHopPreset: (preset: HopPreset) => void;
  saveYeastPreset: (preset: YeastPreset) => void;
  clearCache: () => void;
};

export const usePresetStore = create<PresetStore>((set, get) => ({
  // Initial state
  fermentablePresets: [],
  fermentablePresetsGrouped: [],
  hopPresets: [],
  hopPresetsGrouped: [],
  yeastPresets: [],
  yeastPresetsGrouped: [],
  isLoading: false,
  error: null,

  // Load fermentable presets
  loadFermentablePresets: () => {
    // Skip if already loaded
    if (get().fermentablePresets.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const fermentablePresets = presetRepository.loadFermentablePresets();
      const fermentablePresetsGrouped = presetRepository.loadFermentablePresetsGrouped();
      set({ fermentablePresets, fermentablePresetsGrouped, isLoading: false });
    } catch (error) {
      set({ error: "Failed to load fermentable presets", isLoading: false });
      devError("Error loading fermentable presets:", error);
    }
  },

  // Load hop presets
  loadHopPresets: () => {
    // Skip if already loaded
    if (get().hopPresets.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const hopPresets = presetRepository.loadHopPresets();
      const hopPresetsGrouped = presetRepository.loadHopPresetsGrouped();
      set({ hopPresets, hopPresetsGrouped, isLoading: false });
    } catch (error) {
      set({ error: "Failed to load hop presets", isLoading: false });
      devError("Error loading hop presets:", error);
    }
  },

  // Load yeast presets
  loadYeastPresets: () => {
    // Skip if already loaded
    if (get().yeastPresets.length > 0) {
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const yeastPresets = presetRepository.loadYeastPresets();
      const yeastPresetsGrouped = presetRepository.loadYeastPresetsGrouped();
      set({ yeastPresets, yeastPresetsGrouped, isLoading: false });
    } catch (error) {
      set({ error: "Failed to load yeast presets", isLoading: false });
      devError("Error loading yeast presets:", error);
    }
  },

  // Save a custom fermentable preset
  saveFermentablePreset: (preset: FermentablePreset) => {
    try {
      presetRepository.saveFermentablePreset(preset);
      // Reload presets
      presetRepository.clearCache();
      set({
        fermentablePresets: [],
        fermentablePresetsGrouped: [],
      });
      get().loadFermentablePresets();
    } catch (error) {
      set({ error: "Failed to save fermentable preset" });
      devError("Error saving fermentable preset:", error);
    }
  },

  // Save a custom hop preset
  saveHopPreset: (preset: HopPreset) => {
    try {
      presetRepository.saveHopPreset(preset);
      // Reload presets
      presetRepository.clearCache();
      set({ hopPresets: [], hopPresetsGrouped: [] });
      get().loadHopPresets();
    } catch (error) {
      set({ error: "Failed to save hop preset" });
      devError("Error saving hop preset:", error);
    }
  },

  // Save a custom yeast preset
  saveYeastPreset: (preset: YeastPreset) => {
    try {
      presetRepository.saveYeastPreset(preset);
      // Reload presets
      presetRepository.clearCache();
      set({ yeastPresets: [], yeastPresetsGrouped: [] });
      get().loadYeastPresets();
    } catch (error) {
      set({ error: "Failed to save yeast preset" });
      devError("Error saving yeast preset:", error);
    }
  },

  // Clear all cached presets
  clearCache: () => {
    presetRepository.clearCache();
    set({
      fermentablePresets: [],
      fermentablePresetsGrouped: [],
      hopPresets: [],
      hopPresetsGrouped: [],
      yeastPresets: [],
      yeastPresetsGrouped: [],
    });
  },
}));
