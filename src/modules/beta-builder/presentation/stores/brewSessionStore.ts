/**
 * Brew Session Store
 *
 * Manages brew session state and actions.
 * Coordinates between BrewSessionRepository and UI components.
 */

import { create } from 'zustand';
import type {
  BrewSession,
  SessionId,
  SessionActuals,
  SessionStatus,
} from '../../domain/models/BrewSession';
import { type Recipe, deepCloneRecipe } from '../../domain/models/Recipe';
import { brewSessionRepository } from '../../domain/repositories/BrewSessionRepository';
import { FirestoreBrewSessionRepository } from '../../domain/repositories/FirestoreBrewSessionRepository';
import { brewSessionCalculationService } from '../../domain/services/BrewSessionCalculationService';
import { useAuthStore } from '../../../auth/authStore';

function getSessionRepo() {
  const user = useAuthStore.getState().user;
  return user ? new FirestoreBrewSessionRepository(user.uid) : null;
}

type BrewSessionStore = {
  // State
  sessions: BrewSession[];
  currentSession: BrewSession | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadSessions: () => void;
  loadSession: (id: SessionId) => void;
  loadSessionsByRecipeId: (recipeId: string) => BrewSession[];
  createSession: (recipe: Recipe) => BrewSession;
  updateSession: (updates: Partial<BrewSession>) => void;
  updateBrewDayRecipe: (updates: Partial<Recipe>) => void;
  updateActuals: (actuals: Partial<SessionActuals>) => void;
  updateStatus: (status: SessionStatus) => void;
  saveCurrentSession: () => void;
  deleteSession: (id: SessionId) => void;
  setCurrentSession: (session: BrewSession | null) => void;
};

export const useBrewSessionStore = create<BrewSessionStore>((set, get) => ({
  // Initial state
  sessions: [],
  currentSession: null,
  isLoading: false,
  error: null,

  // Load all sessions
  loadSessions: () => {
    set({ isLoading: true, error: null });
    const firestoreRepo = getSessionRepo();
    if (firestoreRepo) {
      firestoreRepo.loadAllAsync().then(
        (sessions) => set({ sessions, isLoading: false }),
        () => set({ error: 'Failed to load sessions', isLoading: false }),
      );
      return;
    }
    try {
      const sessions = brewSessionRepository.loadAll();
      set({ sessions, isLoading: false });
    } catch {
      set({ error: 'Failed to load sessions', isLoading: false });
    }
  },

  // Load a specific session
  loadSession: (id: SessionId) => {
    set({ isLoading: true, error: null });
    const firestoreRepo = getSessionRepo();
    if (firestoreRepo) {
      firestoreRepo.loadByIdAsync(id).then(
        (session) => set({ currentSession: session, isLoading: false }),
        () => set({ error: 'Failed to load session', isLoading: false }),
      );
      return;
    }
    try {
      const session = brewSessionRepository.loadById(id);
      set({ currentSession: session, isLoading: false });
    } catch {
      set({ error: 'Failed to load session', isLoading: false });
    }
  },

  // Load sessions for a recipe
  loadSessionsByRecipeId: (recipeId: string): BrewSession[] => {
    const firestoreRepo = getSessionRepo();
    if (firestoreRepo) {
      // Trigger async load and return empty — store will update via loadSessions
      firestoreRepo.loadByRecipeIdAsync(recipeId).then(
        (sessions) => set({ sessions }),
      );
      return [];
    }
    try {
      return brewSessionRepository.loadByRecipeId(recipeId);
    } catch {
      set({ error: 'Failed to load recipe sessions' });
      return [];
    }
  },

  // Create a new session from a recipe
  createSession: (recipe: Recipe): BrewSession => {
    const newSession: BrewSession = {
      id: crypto.randomUUID(),
      recipeId: recipe.id,
      recipeVersionNumber: recipe.currentVersion,
      recipeName: recipe.name,
      originalRecipe: deepCloneRecipe(recipe), // Snapshot original
      brewDayRecipe: deepCloneRecipe(recipe),  // Clone for modifications
      actuals: {},
      brewDate: new Date().toISOString(),
      status: 'planning',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    set({ currentSession: newSession });
    return newSession;
  },

  // Update current session
  updateSession: (updates: Partial<BrewSession>) => {
    const current = get().currentSession;
    if (!current) return;

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    set({ currentSession: updated });
  },

  // Update brew day recipe (modifications made on brew day)
  updateBrewDayRecipe: (updates: Partial<Recipe>) => {
    const current = get().currentSession;
    if (!current) return;

    const updated = {
      ...current,
      brewDayRecipe: {
        ...current.brewDayRecipe,
        ...updates,
      },
      updatedAt: new Date().toISOString(),
    };
    set({ currentSession: updated });
  },

  // Update actual measurements
  updateActuals: (actuals: Partial<SessionActuals>) => {
    const current = get().currentSession;
    if (!current) return;

    const updatedActuals = {
      ...current.actuals,
      ...actuals,
    };

    // Auto-calculate derived metrics using domain service
    const calculated = brewSessionCalculationService.calculateSessionMetrics(
      current.originalRecipe,
      current.brewDayRecipe,
      updatedActuals
    );

    const updated = {
      ...current,
      actuals: updatedActuals,
      calculated,
      updatedAt: new Date().toISOString(),
    };
    set({ currentSession: updated });
  },

  // Update session status
  updateStatus: (status: SessionStatus) => {
    const current = get().currentSession;
    if (!current) return;

    const updated = {
      ...current,
      status,
      updatedAt: new Date().toISOString(),
    };
    set({ currentSession: updated });
  },

  // Save current session to storage
  saveCurrentSession: () => {
    const current = get().currentSession;
    if (!current) return;

    const firestoreRepo = getSessionRepo();
    if (firestoreRepo) {
      firestoreRepo.saveAsync(current).then(
        () => { get().loadSessions(); set({ error: null }); },
        () => set({ error: 'Failed to save session' }),
      );
      return;
    }
    try {
      brewSessionRepository.save(current);
      // Reload sessions list
      get().loadSessions();
      set({ error: null });
    } catch {
      set({ error: 'Failed to save session' });
    }
  },

  // Delete a session
  deleteSession: (id: SessionId) => {
    const firestoreRepo = getSessionRepo();
    if (firestoreRepo) {
      firestoreRepo.deleteAsync(id).then(
        () => {
          const current = get().currentSession;
          if (current?.id === id) set({ currentSession: null });
          get().loadSessions();
          set({ error: null });
        },
        () => set({ error: 'Failed to delete session' }),
      );
      return;
    }
    try {
      brewSessionRepository.delete(id);
      // Clear current session if it was deleted
      const current = get().currentSession;
      if (current?.id === id) {
        set({ currentSession: null });
      }
      // Reload sessions list
      get().loadSessions();
      set({ error: null });
    } catch {
      set({ error: 'Failed to delete session' });
    }
  },

  // Set current session directly
  setCurrentSession: (session: BrewSession | null) => {
    set({ currentSession: session });
  },
}));
