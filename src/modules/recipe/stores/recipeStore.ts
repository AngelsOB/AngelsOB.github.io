'use client';

/**
 * Recipe Store
 *
 * This is like your SwiftUI ObservableObject with @Published properties.
 * Holds the current state and provides actions to modify it.
 * Coordinates between Repository (data) and UI (components).
 */

import { create } from 'zustand';
import { uid } from "@/utils/uid";
import type { Recipe, RecipeId, Fermentable, Hop, Yeast, MashStep, RecipeVersion, OtherIngredient } from '@/modules/recipe/models/Recipe';
import { recipeRepository } from '@/modules/recipe/repositories/RecipeRepository';
import { FirestoreRecipeRepository } from '@/modules/recipe/repositories/FirestoreRecipeRepository';
import { recipeVersionRepository } from '@/modules/recipe/repositories/RecipeVersionRepository';
import {
  beerXmlImportService,
  type BeerXmlImportResult,
} from '@/modules/recipe/services/BeerXmlImportService';
import { parseRecipeText as parseRecipeTextToDraft } from '@/modules/recipe/services/recipeTextParser';
import { textRecipeImportService } from '@/modules/recipe/services/textRecipeImportService';
import { hopEnrichmentService } from '@/modules/recipe/services/HopEnrichmentService';
import { toast } from '@/stores/toastStore';
import { useAuthStore, deriveUserState } from '@/modules/auth/authStore';
import { canCreateRecipe, RECIPE_LIMIT } from '@/modules/auth/tierAccess';
import { auth } from '@/config/firebase';
import { generateShareSlug } from '@/modules/sharing/slugUtils';
import { syncPublicIndex, unpublishRecipe } from '@/modules/sharing/publishService';
import { usePreferencesStore } from '@/modules/auth/preferencesStore';
import { processLabelImage } from '@/modules/labels/imageProcessor';
import { uploadLabel as uploadLabelToStorage, deleteLabel as deleteLabelFromStorage } from '@/modules/labels/labelService';

function getRecipeRepo() {
  const user = useAuthStore.getState().user;
  return user ? new FirestoreRecipeRepository(user.uid) : null;
}

/**
 * Check if the current user can create a new recipe.
 * Returns true if allowed, false if at limit (and shows a toast).
 */
function checkRecipeLimit(): boolean {
  const { user, recipeCount, subscriptionStatus, subscriptionCurrentPeriodEnd } = useAuthStore.getState();
  const userState = deriveUserState(user, subscriptionStatus, subscriptionCurrentPeriodEnd);
  if (canCreateRecipe(userState, recipeCount)) return true;
  toast.error(
    `You've reached the ${RECIPE_LIMIT}-recipe limit. Upgrade to Premium for unlimited recipes.`,
    { duration: 6000 },
  );
  return false;
}

/** IDs of recipes deleted this session — prevents stale network responses from restoring them */
const deletedIds = new Set<string>();

/**
 * Compare current recipe to the saved snapshot to detect unsaved changes.
 * Ignores `updatedAt` (mutates on every keystroke) and compares everything else.
 * Reference-equality fast path: snapshot is set to the exact same object on save/load.
 */
export function isRecipeDirty(current: Recipe | null, snapshot: Recipe | null): boolean {
  if (!current) return false;
  if (!snapshot) return false;
  if (current === snapshot) return false; // fast path: same reference → clean
  const a = { ...current, updatedAt: '' };
  const b = { ...snapshot, updatedAt: '' };
  return JSON.stringify(a) !== JSON.stringify(b);
}

type RecipeStore = {
  // State (like @Published properties)
  recipes: Recipe[];
  currentRecipe: Recipe | null;
  /**
   * Snapshot of the recipe as last persisted (or loaded from storage).
   * Used by the unsaved-changes guard to detect dirty state without
   * an explicit isDirty flag on every mutator. Compared to currentRecipe
   * via `isRecipeDirty`, ignoring updatedAt.
   */
  savedSnapshot: Recipe | null;
  isLoading: boolean;
  error: string | null;
  /** True once recipes have been fetched from Firestore/localStorage this session */
  recipesLoaded: boolean;
  /**
   * IDs of recipes that live in THIS device's localStorage. When signed in,
   * these are recipes created while signed out — shown alongside cloud
   * recipes but not shareable until they migrate to Firestore on save.
   */
  localRecipeIds: Set<string>;

  // Actions (like your manager methods)
  loadRecipes: (force?: boolean) => void;
  loadRecipe: (id: RecipeId) => void;
  createNewRecipe: () => void;
  duplicateRecipe: (id: RecipeId) => void;
  updateRecipe: (updates: Partial<Recipe>) => void;
  /** Persists the current recipe; resolves true on success, false on failure. */
  saveCurrentRecipe: () => Promise<boolean>;
  deleteRecipe: (id: RecipeId) => void;
  setCurrentRecipe: (recipe: Recipe | null) => void;
  /**
   * Parse BeerXML and surface low-confidence preset matches for review.
   * Does NOT persist — call `commitImportedRecipe` once the user resolves matches.
   */
  parseBeerXml: (xml: string) => BeerXmlImportResult | null;
  /**
   * Parse free-form pasted recipe text (book/forum/notes) and surface
   * low-confidence preset matches for review. Does NOT persist.
   */
  parseRecipeText: (text: string) => BeerXmlImportResult | null;
  /** Persist a recipe that came from an import flow (post-review). */
  commitImportedRecipe: (recipe: Recipe) => Promise<Recipe | null>;
  importFromJson: (json: string) => Recipe | null;

  // Ingredient actions
  addFermentable: (fermentable: Fermentable) => void;
  updateFermentable: (id: string, updates: Partial<Fermentable>) => void;
  removeFermentable: (id: string) => void;
  reorderFermentables: (startIndex: number, endIndex: number) => void;
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

  // Label actions
  uploadLabel: (file: File) => Promise<void>;
  removeLabel: () => Promise<void>;
};

export const useRecipeStore = create<RecipeStore>((set, get) => ({
  // Initial state
  recipes: [],
  currentRecipe: null,
  savedSnapshot: null,
  isLoading: false,
  error: null,
  recipesLoaded: false,
  localRecipeIds: new Set<string>(),

  // Load all recipes with stale-while-revalidate pattern
  loadRecipes: (force?: boolean) => {
    if (!force && get().recipesLoaded) return;

    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      // Only show loading spinner when we have no recipes at all
      if (get().recipes.length === 0) {
        set({ isLoading: true, error: null });
      }

      // Recipes created while signed out still live in this device's
      // localStorage — show them alongside cloud recipes. They migrate to
      // Firestore the next time the user saves them (see saveCurrentRecipe).
      // Normalized to private: sharing a local recipe is an explicit
      // post-sign-in opt-in, never inherited from the signed-out default.
      const localResult = recipeRepository.loadAllSafe();
      const localRecipes = (localResult.ok ? localResult.data : []).map(
        (r) => ({ ...r, isPublic: false }),
      );
      set({ localRecipeIds: new Set(localRecipes.map((r) => r.id)) });
      const withLocal = (cloud: Recipe[]) => {
        const cloudIds = new Set(cloud.map((r) => r.id));
        return [...cloud, ...localRecipes.filter((r) => !cloudIds.has(r.id))]
          .filter((r) => !deletedIds.has(r.id))
          .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
      };

      firestoreRepo.loadAllWithCache(
        // Cache hit callback — show stale data immediately
        (cachedRecipes) => {
          set({
            recipes: withLocal(cachedRecipes),
            isLoading: false,
            recipesLoaded: true,
          });
        },
      ).then(
        // Network response — update with fresh data
        (freshRecipes) => {
          set({
            recipes: withLocal(freshRecipes),
            isLoading: false,
            recipesLoaded: true,
          });
        },
        (err) => {
          console.error('[Firestore] Failed to load recipes:', err);
          // If we already displayed cached data, don't show error
          if (get().recipesLoaded) return;
          set({ error: 'Failed to load recipes', isLoading: false });
        },
      );
      return;
    }
    set({ isLoading: true, error: null });
    const result = recipeRepository.loadAllSafe();
    if (result.ok) {
      set({
        recipes: result.data,
        isLoading: false,
        recipesLoaded: true,
        localRecipeIds: new Set(result.data.map((r) => r.id)),
      });
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

  // Load a specific recipe (uses in-memory cache, then IndexedDB cache, then network)
  loadRecipe: (id: RecipeId) => {
    // 1. Already displaying this recipe (e.g. set by RecipeListPage before navigation)
    if (get().currentRecipe?.id === id) {
      // Re-sync snapshot to current — if we got here via setCurrentRecipe,
      // the snapshot is already aligned; this is just defensive.
      const existing = get().currentRecipe;
      set({ isLoading: false, error: null, savedSnapshot: existing });
      return;
    }

    // 2. Check recipes array cache
    const cached = get().recipes.find((r) => r.id === id);
    if (cached) {
      set({ currentRecipe: cached, savedSnapshot: cached, isLoading: false, error: null });
      return;
    }

    // 3. Local (this-device) recipes live in localStorage even when signed
    // in — they were created while signed out and never reached Firestore.
    // Signed-in views normalize them to private: sharing is an explicit
    // opt-in that happens after the recipe migrates to the cloud on save.
    const local = recipeRepository.loadById(id);
    if (local) {
      const normalized = useAuthStore.getState().user ? { ...local, isPublic: false } : local;
      set({ currentRecipe: normalized, savedSnapshot: normalized, isLoading: false, error: null });
      return;
    }

    // 4. Need to fetch — show loading
    set({ isLoading: true, error: null });

    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      // Try IndexedDB cache first for instant display, then fetch fresh
      firestoreRepo.loadByIdFromCache(id).then((cachedRecipe) => {
        if (cachedRecipe) {
          set({ currentRecipe: cachedRecipe, savedSnapshot: cachedRecipe, isLoading: false, error: null });
        }
      });
      firestoreRepo.loadByIdAsync(id).then(
        (recipe) => {
          if (recipe) {
            set({ currentRecipe: recipe, savedSnapshot: recipe, isLoading: false, error: null });
          } else if (!get().currentRecipe || get().currentRecipe?.id !== id) {
            // Fetch succeeded but there's no such recipe for this user
            // (deleted, never existed, or owned by someone else). Surface it
            // as not-found instead of leaving the UI spinning forever.
            set({ error: 'Recipe not found', isLoading: false });
          } else {
            // A cached copy is already on screen — just stop the spinner.
            set({ isLoading: false });
          }
        },
        () => {
          if (!get().currentRecipe || get().currentRecipe?.id !== id) {
            set({ error: 'Failed to load recipe', isLoading: false });
          }
        },
      );
      return;
    }

    // Signed out and not in localStorage (checked in step 3 above).
    set({ error: 'Recipe not found', isLoading: false });
  },

  // Create a new recipe with defaults
  createNewRecipe: () => {
    // Signed-out recipes live in localStorage and can't be shared — they stay
    // private until the user signs in and flips the share toggle (the recipe
    // then migrates to the cloud on save).
    const user = useAuthStore.getState().user;
    const defaultPublic = user ? usePreferencesStore.getState().defaultRecipePublic : false;
    const newRecipe: Recipe = {
      id: uid(),
      // Empty by default so the "Untitled recipe" placeholder shows.
      // saveCurrentRecipe() fills in a fallback if the user never names it.
      name: '',
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
    // Snapshot = the fresh recipe → blank state is "clean" (no dirty prompt until edits)
    set({ currentRecipe: newRecipe, savedSnapshot: newRecipe });
  },

  // Duplicate an existing recipe. The copy starts unshared — it must earn
  // its own slug when published (never inherit the original's).
  duplicateRecipe: (id: RecipeId) => {
    set({ isLoading: true, error: null });
    const makeDuplicate = (original: Recipe): Recipe => ({
      ...original,
      id: uid(),
      name: `${original.name} (Copy)`,
      currentVersion: 1,
      parentRecipeId: undefined,
      parentVersionNumber: undefined,
      isPublic: false,
      shareSlug: undefined,
      publishedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      firestoreRepo.loadByIdAsync(id).then(async (remote) => {
        // Local (this-device) recipes aren't in Firestore — the copy still
        // goes to the cloud since the user is signed in.
        const original = remote ?? recipeRepository.loadById(id);
        if (!original) {
          set({ error: 'Recipe not found', isLoading: false });
          return;
        }
        const duplicate = makeDuplicate(original);
        if (!checkRecipeLimit()) { set({ isLoading: false }); return; }
        await firestoreRepo.saveNewAsync(duplicate);
        useAuthStore.getState().adjustRecipeCount(1);
        set({ recipes: [...get().recipes, duplicate], currentRecipe: duplicate, savedSnapshot: duplicate, isLoading: false });
        toast.success(`Duplicated "${original.name}"`);
      }).catch(() => set({ error: 'Failed to duplicate recipe', isLoading: false }));
      return;
    }
    try {
      const original = recipeRepository.loadById(id);
      if (!original) {
        set({ error: 'Recipe not found', isLoading: false });
        return;
      }

      const duplicate = makeDuplicate(original);
      recipeRepository.save(duplicate);
      const localRecipeIds = new Set(get().localRecipeIds);
      localRecipeIds.add(duplicate.id);
      set({ recipes: [...get().recipes, duplicate], currentRecipe: duplicate, savedSnapshot: duplicate, isLoading: false, localRecipeIds });
      toast.success(`Duplicated "${original.name}"`);
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

  // Save current recipe to storage. Resolves true on success, false on failure.
  // Updates `savedSnapshot` optimistically before the network call so the
  // unsaved-changes guard sees clean state during the in-flight save.
  // Rolls the snapshot back if the save errors out.
  saveCurrentRecipe: async () => {
    const raw = get().currentRecipe;
    if (!raw) return false;
    // Fall back to a default name if the user never typed one.
    const trimmed = (raw.name ?? '').trim();
    const current = trimmed ? raw : { ...raw, name: 'Untitled Recipe' };
    if (current !== raw) set({ currentRecipe: current });
    const prevSnapshot = get().savedSnapshot;

    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      // A recipe still in localStorage was created while signed out — this
      // save migrates it to the cloud (new Firestore doc, then the local
      // copy is removed).
      const isLocal = recipeRepository.loadById(current.id) !== null;

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

      // Detect new vs update — new recipes use saveNewAsync (transactional, increments recipeCount)
      const isNew = isLocal || !get().recipes.some((r) => r.id === recipeToSave.id);

      // Belt-and-suspenders: UI disables save button, but guard here too
      if (isNew && !checkRecipeLimit()) return false;

      // Optimistically mark clean — the guard treats currentRecipe == snapshot as clean.
      set({ savedSnapshot: recipeToSave });

      try {
        if (isNew) {
          await firestoreRepo.saveNewAsync(recipeToSave);
        } else {
          await firestoreRepo.saveAsync(recipeToSave);
        }
      } catch (err) {
        // Roll back the optimistic snapshot — user still has unsaved changes.
        console.error('[Firestore] Failed to save recipe:', err);
        set({ savedSnapshot: prevSnapshot, error: 'Failed to save recipe' });
        return false;
      }

      // Migration complete — drop the localStorage copy. If the delete
      // throws, the merge in loadRecipes shadows the stale local copy anyway.
      if (isLocal) {
        try {
          recipeRepository.delete(recipeToSave.id);
        } catch { /* cloud copy is saved; stale local copy is shadowed */ }
        const localRecipeIds = new Set(get().localRecipeIds);
        localRecipeIds.delete(recipeToSave.id);
        set({ localRecipeIds });
      }

      // Update local array instead of re-fetching from Firestore
      const recipes = get().recipes;
      const idx = recipes.findIndex((r) => r.id === recipeToSave.id);
      const updated = idx >= 0
        ? recipes.map((r) => r.id === recipeToSave.id ? recipeToSave : r)
        : [...recipes, recipeToSave];
      set({ recipes: updated, error: null });

      // Optimistically update recipeCount for new recipes
      if (isNew) {
        useAuthStore.getState().adjustRecipeCount(1);
      }

      // Sync publicRecipeIndex in the background. Publish when the saved
      // recipe is public; unpublish when it just transitioned public→private
      // on an existing (non-new) recipe so the browse listing stays in sync.
      if (recipeToSave.isPublic !== false) {
        syncPublicIndex(recipeToSave);
      } else if (!isNew && prevSnapshot && prevSnapshot.isPublic !== false) {
        unpublishRecipe(recipeToSave.id).catch(() => { /* fire-and-forget */ });
      }
      return true;
    }

    // localStorage path (anonymous users)
    try {
      // Optimistically mark clean before the (synchronous) save.
      set({ savedSnapshot: current });
      recipeRepository.save(current);
      // Update local array instead of re-reading localStorage
      const recipes = get().recipes;
      const idx = recipes.findIndex((r) => r.id === current.id);
      const updated = idx >= 0
        ? recipes.map((r) => r.id === current.id ? current : r)
        : [...recipes, current];
      set({ recipes: updated, error: null });
      return true;
    } catch {
      set({ savedSnapshot: prevSnapshot, error: 'Failed to save recipe' });
      return false;
    }
  },

  // Delete a recipe
  deleteRecipe: (id: RecipeId) => {
    // Optimistic update — remove from UI immediately
    const previousRecipes = get().recipes;
    const current = get().currentRecipe;
    if (current?.id === id) set({ currentRecipe: null });
    set({ recipes: previousRecipes.filter((r) => r.id !== id), error: null });
    deletedIds.add(id);

    const user = useAuthStore.getState().user;
    // Local (this-device) recipes never went through the API — delete them
    // from localStorage even when signed in.
    const isLocal = recipeRepository.loadById(id) !== null;
    if (user && !isLocal) {
      // Server-side delete via admin SDK (bypasses Firestore security rules)
      auth.currentUser?.getIdToken().then((token) =>
        fetch('/api/recipes/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ recipeId: id }),
        }),
      ).then((res) => {
        if (!res?.ok) throw new Error('Server delete failed');
        // Optimistically update recipeCount (admin route already decremented in Firestore)
        useAuthStore.getState().adjustRecipeCount(-1);
      }).catch((err) => {
        console.error('[API] Failed to delete recipe:', err);
        // Rollback on failure
        deletedIds.delete(id);
        set({ recipes: previousRecipes, error: null });
        toast.error('Failed to delete recipe');
      });
      return;
    }

    try {
      recipeRepository.delete(id);
      const localRecipeIds = new Set(get().localRecipeIds);
      localRecipeIds.delete(id);
      set({ localRecipeIds });
    } catch {
      // Rollback on failure
      deletedIds.delete(id);
      set({ recipes: previousRecipes, error: null });
      toast.error('Failed to delete recipe');
    }
  },

  // Set current recipe directly
  setCurrentRecipe: (recipe: Recipe | null) => {
    // Reset the snapshot in lockstep — a freshly-set recipe is "clean".
    set({ currentRecipe: recipe, savedSnapshot: recipe });
  },

  // Parse BeerXML without persisting; caller resolves matches then commits.
  parseBeerXml: (xml: string) => {
    try {
      const result = beerXmlImportService.parse(xml);
      if (!result?.recipe) {
        set({ error: 'Failed to import BeerXML' });
        return null;
      }
      set({ error: null });
      return result;
    } catch {
      set({ error: 'Failed to import BeerXML' });
      return null;
    }
  },

  // Parse pasted recipe text without persisting; caller resolves matches then commits.
  parseRecipeText: (text: string) => {
    try {
      const draft = parseRecipeTextToDraft(text);
      const result = textRecipeImportService.fromDraft(draft);
      set({ error: null });
      return result;
    } catch {
      set({ error: 'Failed to parse recipe text' });
      return null;
    }
  },

  // Persist a recipe coming from the import flow (after match review).
  commitImportedRecipe: async (recipe: Recipe) => {
    const firestoreRepo = getRecipeRepo();
    if (firestoreRepo) {
      if (!checkRecipeLimit()) return null;
      try {
        await firestoreRepo.saveNewAsync(recipe);
        useAuthStore.getState().adjustRecipeCount(1);
        set({ recipes: [...get().recipes, recipe], error: null });
        return recipe;
      } catch {
        set({ error: 'Failed to save imported recipe' });
        return null;
      }
    }
    try {
      // Signed-out imports are local-only and can't be shared — keep private.
      const localRecipe: Recipe = { ...recipe, isPublic: false };
      recipeRepository.save(localRecipe);
      const localRecipeIds = new Set(get().localRecipeIds);
      localRecipeIds.add(localRecipe.id);
      set({ recipes: [...get().recipes, localRecipe], error: null, localRecipeIds });
      return localRecipe;
    } catch {
      set({ error: 'Failed to save imported recipe' });
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
      const firestoreRepo = getRecipeRepo();
      const recipe: Recipe = {
        ...parsed,
        hops,
        id: uid(),
        currentVersion: 1,
        parentRecipeId: undefined,
        parentVersionNumber: undefined,
        // Never inherit share state from exported JSON — an import is a new,
        // unpublished recipe (and signed-out imports can't be shared at all).
        shareSlug: undefined,
        publishedAt: undefined,
        isPublic: firestoreRepo ? parsed.isPublic : false,
        createdAt: now,
        updatedAt: now,
      };
      if (firestoreRepo) {
        if (!checkRecipeLimit()) return null;
        firestoreRepo.saveNewAsync(recipe).then(() => {
          useAuthStore.getState().adjustRecipeCount(1);
          set({ recipes: [...get().recipes, recipe] });
        });
      } else {
        recipeRepository.save(recipe);
        const localRecipeIds = new Set(get().localRecipeIds);
        localRecipeIds.add(recipe.id);
        set({ recipes: [...get().recipes, recipe], localRecipeIds });
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

  // Reorder fermentables (for drag-and-drop of the grain bill)
  reorderFermentables: (startIndex: number, endIndex: number) => {
    const current = get().currentRecipe;
    if (!current) return;

    const fermentables = [...current.fermentables];
    const [removed] = fermentables.splice(startIndex, 1);
    fermentables.splice(endIndex, 0, removed);

    const updated = {
      ...current,
      fermentables,
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
          id: uid(),
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
        set({ recipes: get().recipes.map((r) => r.id === recipeId ? updatedRecipe : r), error: null });
      }).catch(() => set({ error: 'Failed to create new version' }));
      return;
    }
    try {
      const recipe = recipeRepository.loadById(recipeId);
      if (!recipe) {
        set({ error: 'Recipe not found' });
        return;
      }

      const versionSnapshot: RecipeVersion = {
        id: uid(),
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

      recipeRepository.save(updatedRecipe);
      set({ recipes: get().recipes.map((r) => r.id === recipeId ? updatedRecipe : r), error: null });
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
          id: uid(),
          name: newName,
          currentVersion: 1,
          parentRecipeId: original.id,
          parentVersionNumber: original.currentVersion,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (!checkRecipeLimit()) { set({ isLoading: false }); return; }
        await firestoreRepo.saveNewAsync(variation);
        useAuthStore.getState().adjustRecipeCount(1);
        set({ recipes: [...get().recipes, variation], currentRecipe: variation, isLoading: false });
      }).catch(() => set({ error: 'Failed to create variation', isLoading: false }));
      return;
    }
    try {
      const original = recipeRepository.loadById(recipeId);
      if (!original) {
        set({ error: 'Recipe not found', isLoading: false });
        return;
      }

      const variation: Recipe = {
        ...original,
        id: uid(),
        name: newName,
        currentVersion: 1,
        parentRecipeId: original.id,
        parentVersionNumber: original.currentVersion,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      recipeRepository.save(variation);
      set({ recipes: [...get().recipes, variation], currentRecipe: variation, isLoading: false });
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
          id: uid(),
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
        set({ recipes: get().recipes.map((r) => r.id === recipeId ? restoredRecipe : r), currentRecipe: restoredRecipe, error: null });
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
        id: uid(),
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
      set({ recipes: get().recipes.map((r) => r.id === recipeId ? restoredRecipe : r), currentRecipe: restoredRecipe, error: null });
    } catch {
      set({ error: 'Failed to restore version' });
    }
  },

  // Upload a label image for the current recipe
  uploadLabel: async (file: File) => {
    const current = get().currentRecipe;
    const user = useAuthStore.getState().user;
    if (!current || !user) {
      toast.error('Sign in and open a recipe to upload a label.');
      return;
    }

    try {
      const { blob, wasCompressed } = await processLabelImage(file);
      const downloadUrl = await uploadLabelToStorage(user.uid, current.id, blob);
      get().updateRecipe({ labelUrl: downloadUrl });
      get().saveCurrentRecipe();
      toast.success(wasCompressed ? 'Label uploaded (image was compressed to fit)' : 'Label uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload label');
    }
  },

  // Remove the label from the current recipe
  removeLabel: async () => {
    const current = get().currentRecipe;
    const user = useAuthStore.getState().user;
    if (!current || !user) return;

    try {
      await deleteLabelFromStorage(user.uid, current.id);
      get().updateRecipe({ labelUrl: undefined });
      get().saveCurrentRecipe();
      toast.success('Label removed');
    } catch {
      toast.error('Failed to remove label');
    }
  },
}));
