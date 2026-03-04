/**
 * Equipment Store
 *
 * Zustand store for managing equipment profiles.
 * Coordinates between the EquipmentRepository and UI components.
 */

import { create } from 'zustand';
import type { EquipmentProfile } from '../../domain/models/Equipment';
import { EquipmentRepository } from '../../domain/repositories/EquipmentRepository';
import { FirestoreEquipmentRepository } from '../../domain/repositories/FirestoreEquipmentRepository';
import { useAuthStore } from '../../../auth/authStore';

function getEquipmentRepo() {
  const user = useAuthStore.getState().user;
  return user ? new FirestoreEquipmentRepository(user.uid) : null;
}

interface EquipmentStore {
  // State
  profiles: EquipmentProfile[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadProfiles: () => Promise<void>;
  saveCustomProfile: (profile: EquipmentProfile) => Promise<void>;
  deleteCustomProfile: (name: string) => Promise<void>;
  clearCache: () => void;
}

export const useEquipmentStore = create<EquipmentStore>((set) => ({
  // Initial state
  profiles: [],
  isLoading: false,
  error: null,

  // Load all profiles
  loadProfiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const firestoreRepo = getEquipmentRepo();
      const repo = firestoreRepo ?? EquipmentRepository;
      const profiles = await repo.loadAll();
      set({ profiles, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load equipment profiles',
        isLoading: false
      });
    }
  },

  // Save a custom profile
  saveCustomProfile: async (profile: EquipmentProfile) => {
    try {
      const firestoreRepo = getEquipmentRepo();
      const repo = firestoreRepo ?? EquipmentRepository;
      await repo.saveCustomProfile(profile);
      const profiles = await repo.loadAll();
      set({ profiles, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save equipment profile'
      });
    }
  },

  // Delete a custom profile
  deleteCustomProfile: async (name: string) => {
    try {
      const firestoreRepo = getEquipmentRepo();
      const repo = firestoreRepo ?? EquipmentRepository;
      await repo.deleteCustomProfile(name);
      const profiles = await repo.loadAll();
      set({ profiles, error: null });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete equipment profile'
      });
    }
  },

  // Clear cache
  clearCache: () => {
    const firestoreRepo = getEquipmentRepo();
    if (firestoreRepo) {
      firestoreRepo.clearCache();
    } else {
      EquipmentRepository.clearCache();
    }
    set({ profiles: [] });
  },
}));
