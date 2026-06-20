'use client';

/**
 * Equipment Repository
 *
 * Handles loading and caching of equipment profiles from presets and localStorage.
 * Follows the repository pattern to abstract data access.
 *
 * Note: Methods are async despite current synchronous localStorage operations.
 * This maintains a consistent API for consumers and allows future migration
 * to an async backend (e.g., IndexedDB, remote API) without breaking changes.
 */

import { devError } from '@/utils/logger';
import { deduplicateBy } from '@/utils/array';
import type { EquipmentProfile } from '../models/Equipment';
import { EQUIPMENT_PRESETS } from '../models/Equipment';

const CUSTOM_EQUIPMENT_KEY = 'beta-builder:custom-equipment';

class EquipmentRepositoryImpl {
  private cache: EquipmentProfile[] | null = null;

  /**
   * Load all equipment profiles (presets + custom)
   */
  async loadAll(): Promise<EquipmentProfile[]> {
    if (this.cache) {
      return this.cache;
    }

    // Load built-in presets
    const presets = [...EQUIPMENT_PRESETS];

    // Load custom profiles from localStorage
    const customProfiles = this.loadCustomProfiles();

    // Combine and deduplicate by name (custom overrides preset, keep-first)
    const allProfiles = [...customProfiles, ...presets];
    const uniqueProfiles = deduplicateBy(allProfiles, (p) => p.name);

    this.cache = uniqueProfiles;
    return uniqueProfiles;
  }

  /**
   * Save a custom equipment profile
   */
  async saveCustomProfile(profile: EquipmentProfile): Promise<void> {
    const customProfiles = this.loadCustomProfiles();

    // Mark as custom
    const customProfile: EquipmentProfile = { ...profile, isCustom: true };

    // Update or add
    const existingIndex = customProfiles.findIndex(p => p.name === profile.name);
    if (existingIndex >= 0) {
      customProfiles[existingIndex] = customProfile;
    } else {
      customProfiles.push(customProfile);
    }

    // Save to localStorage
    localStorage.setItem(CUSTOM_EQUIPMENT_KEY, JSON.stringify(customProfiles));

    // Clear cache to force reload
    this.cache = null;
  }

  /**
   * Delete a custom equipment profile
   */
  async deleteCustomProfile(name: string): Promise<void> {
    const customProfiles = this.loadCustomProfiles();
    const filtered = customProfiles.filter(p => p.name !== name);

    localStorage.setItem(CUSTOM_EQUIPMENT_KEY, JSON.stringify(filtered));

    // Clear cache to force reload
    this.cache = null;
  }

  /**
   * Find a profile by name
   */
  async findByName(name: string): Promise<EquipmentProfile | undefined> {
    const profiles = await this.loadAll();
    return profiles.find(p => p.name === name);
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache = null;
  }

  // Private helper methods

  private loadCustomProfiles(): EquipmentProfile[] {
    try {
      const stored = localStorage.getItem(CUSTOM_EQUIPMENT_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as EquipmentProfile[];
    } catch (error) {
      devError('Failed to load custom equipment profiles:', error);
      return [];
    }
  }
}

// Export singleton instance
export const EquipmentRepository = new EquipmentRepositoryImpl();
