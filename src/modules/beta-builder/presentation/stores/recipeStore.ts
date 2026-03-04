'use client';

/**
 * Recipe Store
 *
 * This is like your SwiftUI ObservableObject with @Published properties.
 * Holds the current state and provides actions to modify it.
 * Coordinates between Repository (data) and UI (components).
 */

import { create } from 'zustand';
import type { Recipe, RecipeId, Fermentable, Hop, Yeast, MashStep, RecipeVersion, OtherIngredient } from '../../domain/models/Recipe';
import { recipeRepository } from '../../domain/repositories/RecipeRepository';
import { FirestoreRecipeRepository } from '../../domain/repositories/FirestoreRecipeRepository';
import { recipeVersionRepository } from '../../domain/repositories/RecipeVersionRepository';
import { beerXmlImportService } from '../../domain/services/BeerXmlImportService';
import { hopEnrichmentService } from '../../domain/services/HopEnrichmentService';
import { toast } from '../../../../stores/toastStore';
import { useAuthStore } from '../../../auth/authStore';
import { generateShareSlug } from '../../../sharing/slugUtils';
import { usePreferencesStore } from '../../../auth/preferencesStore';
import { auth } from '@/config/firebase';

function getRecipeRepo() {
  const user = useAuthStore.getState().user;
  return user ? new FirestoreRecipeRepository(user.uid) : null;
}

type RecipeStore = {
  // State (like @Published properties)
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  isLoading: boolean;
  error: string | null;

  // Actions (like your manager methods)
  loadRecipes: () => void;
  loadRecipe: (id: RecipeId) => void;
  createNewRecipe: () => void;
  duplicateRecipe: (id: RecipeId) => void;
  updateRecipe: (updates: Partial<Recipe>) => void;
  saveCurrentRecipe: () => void;
  deleteRecipe: (id: RecipeId) => void;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  importFromBeerXml: (xml: string) => Recipe | null;
  importFromJson: (json: string) => Recipe | null;

  // Ingredient actions
  addFermentable: (fermentable: Fermentable) => void;
  updateFermentable: (id: string, updates: Partial<Fermentable>) => void;
  removeFermentable: (id: string) => void;
  addHop: (hop: Hop) => void;
  updateHop: (id: string, updates: Partial<Hop>) => void;
  removeHop: (id: string) => void;
  addYeast: (yeast: Yeast) => void;
  updateYeast: (id: string, updates: Partial<Yeast>) => void;
  removeYeast: (id: string) => void;

  // Other ingredient actions
  addOtherIngredient: (ingredient: OtherIngredient) => void;
  updateOtherIngredient: (id: string, updates: Partial<OtherIngredient>) => void;
  removeOtherIngredient: (id: string) => void;

  // Mash step actions
  addMashStep: (mashStep: MashStep) => void;
  updateMashStep: (id: string, updates: Partial<MashStep>) => void;
  removeMashStep: (id: string) => void;
  reorderMashSteps: (startIndex: number, endIndex: number) => void;

  // Version control actions
  createNewVersion: (recipeId: RecipeId, changeNotes?: string) => void;
  createVariation: (recipeId: RecipeId, newName: string) => void;
  loadVersionHistory: (recipeId: RecipeId) => RecipeVersion[];
  restoreVersion: (recipeId: RecipeId, versionNumber: number) => void;
};

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  // Initial state
  recipes: [],
  currentRecipe: null,
  isLoading: false,
  error: null,

  // Load all recipes
  loadRecipes: () => {
    set({ isLoading: true, error: null });
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.loadAllAsync().then(
        (recipes) => set({ recipes, isLoading: false }),
        (err) => { console.error('[Firestore] Failed to load recipes:', err); set({ error: 'Failed to load recipes', isLoading: false }); },
      );
      return;
    }
    const result = recipeRepository.loadAllSafe();
    if (result.ok) {
      set({ recipes: result.data, isLoading: false });
    } else {
      // Data is corrupted but still in localStorage
      const rawData = result.rawData;
      set({ recipes: [], error: 'Recipe data appears corrupted', isLoading: false });
      toast.error('Recipe data could not be loaded. Your data is still saved.', {
        duration: 0, // Don't auto-dismiss
        action: {
          label: 'Copy Raw Data',
          onClick: () => {
            navigator.clipboard.writeText(rawData);
            toast.success('Raw data copied to clipboard');
          },
        },
      });
    }
  },

  // Load a specific recipe (uses already-fetched list when available)
  loadRecipe: (id: RecipeId) => {
    const cached = get().recipes.find((r) => r.id === id);
    if (cached) {
      set({ currentRecipe: cached, isLoading: false, error: null });
      return;
    }
    set({ isLoading: true, error: null });
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.loadByIdAsync(id).then(
        (recipe) => set({ currentRecipe: recipe, isLoading: false }),
        () => set({ error: 'Failed to load recipe', isLoading: false }),
      );
      return;
    }
    try {
      const recipe = recipeRepository.loadById(id);
      set({ currentRecipe: recipe, isLoading: false });
    } catch {
      set({ error: 'Failed to load recipe', isLoading: false });
    }
  },

  // Create a new recipe with defaults
  createNewRecipe: () => {
    const defaultPublic = usePreferencesStore.getState().defaultRecipePublic;
    const newRecipe: Recipe = {
      id: crypto.randomUUID(),
      name: 'New Recipe',
      style: undefined,
      notes: undefined,
      tags: [],
      isPublic: defaultPublic,
      currentVersion: 1,
      batchVolumeL: 20,
      equipment: {
        boilTimeMin: 60,
        boilOffRateLPerHour: 4,
        mashEfficiencyPercent: 75,
        mashThicknessLPerKg: 2.7,
        grainAbsorptionLPerKg: 0.8,
        mashTunDeadspaceLiters: 2.0,
        mashTunLossLiters: 0,
        kettleLossLiters: 1.0,
        hopsAbsorptionLPerKg: 0.7,
        chillerLossLiters: 0,
        fermenterLossLiters: 0.5,
        coolingShrinkagePercent: 4.0,
      },
      fermentables: [],
      hops: [],
      yeasts: [],
      otherIngredients: [],
      mashSteps: [],
      fermentationSteps: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: newRecipe });
  },

  // Duplicate an existing recipe
  duplicateRecipe: (id: RecipeId) => {
    set({ isLoading: true, error: null });
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.loadByIdAsync(id).then(async (original) => {
        if (!original) {
          set({ error: 'Recipe not found', isLoading: false });
          return;
        }
        const duplicate: Recipe = {
          ...original,
          id: crypto.randomUUID(),
          name: `${original.name} (Copy)`,
          currentVersion: 1,
          parentRecipeId: undefined,
          parentVersionNumber: undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await firestoreRepo.saveAsync(duplicate);
        const recipes = await firestoreRepo.loadAllAsync();
        set({ recipes, currentRecipe: duplicate, isLoading: false });
      }).catch(() => set({ error: 'Failed to duplicate recipe', isLoading: false }));
      return;
    }
    try {
      const original = recipeRepository.loadById(id);
      if (!original) {
        set({ error: 'Recipe not found', isLoading: false });
        return;
      }

      // Create a copy with new ID and updated timestamps
      const duplicate: Recipe = {
        ...original,
        id: crypto.randomUUID(),
        name: `${original.name} (Copy)`,
        currentVersion: 1,
        parentRecipeId: undefined,
        parentVersionNumber: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save the duplicate
      recipeRepository.save(duplicate);

      // Load all recipes to update the list
      const recipes = recipeRepository.loadAll();
      set({ recipes, currentRecipe: duplicate, isLoading: false });
    } catch {
      set({ error: 'Failed to duplicate recipe', isLoading: false });
    }
  },

  // Update current recipe (doesn't save to storage yet)
  updateRecipe: (updates: Partial<Recipe>) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Save current recipe to storage
  saveCurrentRecipe: () => {
    const current = get().currentRecipe;
    if (!current) return;

    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      // Auto-generate slug for public recipes that don't have one
      let recipeToSave = current;
      const needsSlug = current.isPublic !== false && !current.shareSlug;
      if (needsSlug) {
        recipeToSave = {
          ...current,
          isPublic: true,
          shareSlug: generateShareSlug(current.name),
          publishedAt: current.publishedAt || new Date().toISOString(),
        };
        set({ currentRecipe: recipeToSave });
      }

      firestoreRepo.saveAsync(recipeToSave).then(
        () => {
          get().loadRecipes();
          set({ error: null });

          // Sync publicRecipeIndex in the background for public recipes
          if (recipeToSave.isPublic) {
            const user = auth.currentUser;
            if (user) {
              user.getIdToken().then((token) => {
                fetch('/api/publish', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ recipeId: recipeToSave.id }),
                }).catch(() => { /* fire-and-forget */ });
              }).catch(() => { /* ignore token errors */ });
            }
          }
        },
        (err) => { console.error('[Firestore] Failed to save recipe:', err); set({ error: 'Failed to save recipe' }); },
      );
      return;
    }
    try {
      recipeRepository.save(current);
      // Reload recipes list
      get().loadRecipes();
      set({ error: null });
    } catch {
      set({ error: 'Failed to save recipe' });
    }
  },

  // Delete a recipe
  deleteRecipe: (id: RecipeId) => {
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.deleteAsync(id).then(
        () => {
          const current = get().currentRecipe;
          if (current?.id === id) set({ currentRecipe: null });
          get().loadRecipes();
          set({ error: null });
        },
        () => set({ error: 'Failed to delete recipe' }),
      );
      return;
    }
    try {
      recipeRepository.delete(id);
      // Clear current recipe if it was deleted
      const current = get().currentRecipe;
      if (current?.id === id) {
        set({ currentRecipe: null });
      }
      // Reload recipes list
      get().loadRecipes();
      set({ error: null });
    } catch {
      set({ error: 'Failed to delete recipe' });
    }
  },

  // Set current recipe directly
  setCurrentRecipe: (recipe: Recipe | null) => {
    set({ currentRecipe: recipe });
  },

  // Import BeerXML and persist
  importFromBeerXml: (xml: string) => {
    try {
      const recipe = beerXmlImportService.parse(xml);
      if (!recipe) {
        set({ error: 'Failed to import BeerXML' });
        return null;
      }
      const firestoreRepo = getRecipeRepo();
      if (firestoreRepo) {
        firestoreRepo.saveAsync(recipe).then(() => get().loadRecipes());
      } else {
        recipeRepository.save(recipe);
        const recipes = recipeRepository.loadAll();
        set({ recipes });
      }
      set({ error: null });
      return recipe;
    } catch {
      set({ error: 'Failed to import BeerXML' });
      return null;
    }
  },

  // Import JSON and persist
  importFromJson: (json: string) => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== 'object' || !parsed.name) {
        set({ error: 'Invalid recipe JSON' });
        return null;
      }
      const now = new Date().toISOString();
      // Enrich hops missing flavor profiles from presets
      const hops = Array.isArray(parsed.hops)
        ? hopEnrichmentService.enrichHops(parsed.hops)
        : parsed.hops;
      const recipe: Recipe = {
        ...parsed,
        hops,
        id: crypto.randomUUID(),
        currentVersion: 1,
        parentRecipeId: undefined,
        parentVersionNumber: undefined,
        createdAt: now,
        updatedAt: now,
      };
      const firestoreRepo = getRecipeRepo();
      if (firestoreRepo) {
        firestoreRepo.saveAsync(recipe).then(() => get().loadRecipes());
      } else {
        recipeRepository.save(recipe);
        const recipes = recipeRepository.loadAll();
        set({ recipes });
      }
      set({ error: null });
      return recipe;
    } catch {
      set({ error: 'Failed to import JSON' });
      return null;
    }
  },

  // Add a fermentable
  addFermentable: (fermentable: Fermentable) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      fermentables: [...current.fermentables, fermentable],
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Update a fermentable
  updateFermentable: (id: string, updates: Partial<Fermentable>) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      fermentables: current.fermentables.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Remove a fermentable
  removeFermentable: (id: string) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      fermentables: current.fermentables.filter((f) => f.id !== id),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Add a hop
  addHop: (hop: Hop) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      hops: [...current.hops, hop],
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Update a hop
  updateHop: (id: string, updates: Partial<Hop>) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      hops: current.hops.map((h) => (h.id === id ? { ...h, ...updates } : h)),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Remove a hop
  removeHop: (id: string) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      hops: current.hops.filter((h) => h.id !== id),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Add yeast
  addYeast: (yeast: Yeast) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      yeasts: [...current.yeasts, yeast],
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Update yeast
  updateYeast: (id: string, updates: Partial<Yeast>) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      yeasts: current.yeasts.map((y) =>
        y.id === id ? { ...y, ...updates } : y
      ),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Remove yeast
  removeYeast: (id: string) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      yeasts: current.yeasts.filter((y) => y.id !== id),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Add an other ingredient
  addOtherIngredient: (ingredient: OtherIngredient) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      otherIngredients: [...(current.otherIngredients || []), ingredient],
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Update an other ingredient
  updateOtherIngredient: (id: string, updates: Partial<OtherIngredient>) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      otherIngredients: (current.otherIngredients || []).map((i) =>
        i.id === id ? { ...i, ...updates } : i
      ),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Remove an other ingredient
  removeOtherIngredient: (id: string) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      otherIngredients: (current.otherIngredients || []).filter((i) => i.id !== id),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Add a mash step
  addMashStep: (mashStep: MashStep) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      mashSteps: [...current.mashSteps, mashStep],
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Update a mash step
  updateMashStep: (id: string, updates: Partial<MashStep>) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      mashSteps: current.mashSteps.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Remove a mash step
  removeMashStep: (id: string) => {
    const current = get().currentRecipe;
    if (!current) return;

    const updated = {
      ...current,
      mashSteps: current.mashSteps.filter((s) => s.id !== id),
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Reorder mash steps (for drag-and-drop)
  reorderMashSteps: (startIndex: number, endIndex: number) => {
    const current = get().currentRecipe;
    if (!current) return;

    const steps = [...current.mashSteps];
    const [removed] = steps.splice(startIndex, 1);
    steps.splice(endIndex, 0, removed);

    const updated = {
      ...current,
      mashSteps: steps,
      updatedAt: new Date().toISOString(),
    };
    set({ currentRecipe: updated });
  },

  // Create a new version of a recipe (saves current state as snapshot)
  createNewVersion: (recipeId: RecipeId, changeNotes?: string) => {
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.loadByIdAsync(recipeId).then(async (recipe) => {
        if (!recipe) { set({ error: 'Recipe not found' }); return; }
        const versionSnapshot: RecipeVersion = {
          id: crypto.randomUUID(),
          recipeId: recipe.id,
          versionNumber: recipe.currentVersion,
          createdAt: new Date().toISOString(),
          changeNotes,
          recipeSnapshot: { ...recipe },
        };
        recipeVersionRepository.save(versionSnapshot);
        const updatedRecipe: Recipe = {
          ...recipe,
          currentVersion: recipe.currentVersion + 1,
          updatedAt: new Date().toISOString(),
        };
        await firestoreRepo.saveAsync(updatedRecipe);
        get().loadRecipes();
        set({ error: null });
      }).catch(() => set({ error: 'Failed to create new version' }));
      return;
    }
    try {
      const recipe = recipeRepository.loadById(recipeId);
      if (!recipe) {
        set({ error: 'Recipe not found' });
        return;
      }

      // Save current state as a version snapshot
      const versionSnapshot: RecipeVersion = {
        id: crypto.randomUUID(),
        recipeId: recipe.id,
        versionNumber: recipe.currentVersion,
        createdAt: new Date().toISOString(),
        changeNotes,
        recipeSnapshot: { ...recipe },
      };

      recipeVersionRepository.save(versionSnapshot);

      // Increment version number on the main recipe
      const updatedRecipe: Recipe = {
        ...recipe,
        currentVersion: recipe.currentVersion + 1,
        updatedAt: new Date().toISOString(),
      };

      recipeRepository.save(updatedRecipe);

      // Reload recipes
      get().loadRecipes();
      set({ error: null });
    } catch {
      set({ error: 'Failed to create new version' });
    }
  },

  // Create a variation (fork) of a recipe
  createVariation: (recipeId: RecipeId, newName: string) => {
    set({ isLoading: true, error: null });
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.loadByIdAsync(recipeId).then(async (original) => {
        if (!original) { set({ error: 'Recipe not found', isLoading: false }); return; }
        const variation: Recipe = {
          ...original,
          id: crypto.randomUUID(),
          name: newName,
          currentVersion: 1,
          parentRecipeId: original.id,
          parentVersionNumber: original.currentVersion,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await firestoreRepo.saveAsync(variation);
        const recipes = await firestoreRepo.loadAllAsync();
        set({ recipes, currentRecipe: variation, isLoading: false });
      }).catch(() => set({ error: 'Failed to create variation', isLoading: false }));
      return;
    }
    try {
      const original = recipeRepository.loadById(recipeId);
      if (!original) {
        set({ error: 'Recipe not found', isLoading: false });
        return;
      }

      // Create a variation with new ID and parent reference
      const variation: Recipe = {
        ...original,
        id: crypto.randomUUID(),
        name: newName,
        currentVersion: 1,
        parentRecipeId: original.id,
        parentVersionNumber: original.currentVersion,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save the variation
      recipeRepository.save(variation);

      // Load all recipes to update the list
      const recipes = recipeRepository.loadAll();
      set({ recipes, currentRecipe: variation, isLoading: false });
    } catch {
      set({ error: 'Failed to create variation', isLoading: false });
    }
  },

  // Load version history for a recipe
  loadVersionHistory: (recipeId: RecipeId): RecipeVersion[] => {
    try {
      return recipeVersionRepository.loadByRecipeId(recipeId);
    } catch {
      set({ error: 'Failed to load version history' });
      return [];
    }
  },

  // Restore a previous version (creates new version from old snapshot)
  restoreVersion: (recipeId: RecipeId, versionNumber: number) => {
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.loadByIdAsync(recipeId).then(async (currentRecipe) => {
        if (!currentRecipe) { set({ error: 'Recipe not found' }); return; }
        const version = recipeVersionRepository.loadByRecipeIdAndVersion(recipeId, versionNumber);
        if (!version) { set({ error: 'Version not found' }); return; }
        const currentSnapshot: RecipeVersion = {
          id: crypto.randomUUID(),
          recipeId: currentRecipe.id,
          versionNumber: currentRecipe.currentVersion,
          createdAt: new Date().toISOString(),
          changeNotes: `Auto-save before restoring v${versionNumber}`,
          recipeSnapshot: { ...currentRecipe },
        };
        recipeVersionRepository.save(currentSnapshot);
        const restoredRecipe: Recipe = {
          ...version.recipeSnapshot,
          id: currentRecipe.id,
          currentVersion: currentRecipe.currentVersion + 1,
          updatedAt: new Date().toISOString(),
        };
        await firestoreRepo.saveAsync(restoredRecipe);
        const recipes = await firestoreRepo.loadAllAsync();
        set({ recipes, currentRecipe: restoredRecipe, error: null });
      }).catch(() => set({ error: 'Failed to restore version' }));
      return;
    }
    try {
      const currentRecipe = recipeRepository.loadById(recipeId);
      if (!currentRecipe) {
        set({ error: 'Recipe not found' });
        return;
      }

      const version = recipeVersionRepository.loadByRecipeIdAndVersion(recipeId, versionNumber);
      if (!version) {
        set({ error: 'Version not found' });
        return;
      }

      // First, save current state as a version before restoring
      const currentSnapshot: RecipeVersion = {
        id: crypto.randomUUID(),
        recipeId: currentRecipe.id,
        versionNumber: currentRecipe.currentVersion,
        createdAt: new Date().toISOString(),
        changeNotes: `Auto-save before restoring v${versionNumber}`,
        recipeSnapshot: { ...currentRecipe },
      };
      recipeVersionRepository.save(currentSnapshot);

      // Restore the old version's data but keep the recipe ID and increment version
      const restoredRecipe: Recipe = {
        ...version.recipeSnapshot,
        id: currentRecipe.id, // Keep the same ID
        currentVersion: currentRecipe.currentVersion + 1,
        updatedAt: new Date().toISOString(),
      };

      recipeRepository.save(restoredRecipe);

      // Reload recipes and set as current
      const recipes = recipeRepository.loadAll();
      set({ recipes, currentRecipe: restoredRecipe, error: null });
    } catch {
      set({ error: 'Failed to restore version' });
    }
  },
}));
