"use client";

import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { Recipe, RecipeId } from "../models/Recipe";
import type { LoadResult } from "./RecipeRepository";

export class FirestoreRecipeRepository {
  constructor(private readonly userId: string) {}

  private get recipesRef() {
    return collection(db, "recipes");
  }

  loadAllSafe(): LoadResult<Recipe[]> {
    // Firestore data is always valid JSON — corruption isn't possible.
    // This method exists for interface compatibility; use loadAll() directly.
    return { ok: true, data: this.loadAll() };
  }

  loadAll(): Recipe[] {
    // Synchronous interface — returns empty array and triggers async load.
    // The store layer handles async loading via loadRecipesAsync().
    return [];
  }

  async loadAllAsync(): Promise<Recipe[]> {
    const q = query(
      this.recipesRef,
      where("ownerId", "==", this.userId),
      orderBy("updatedAt", "desc"),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Recipe);
  }

  /**
   * Stale-while-revalidate: returns cached data instantly via callback,
   * then fetches fresh data from the network and returns it.
   */
  async loadAllWithCache(
    onCacheHit: (recipes: Recipe[]) => void,
  ): Promise<Recipe[]> {
    const q = query(
      this.recipesRef,
      where("ownerId", "==", this.userId),
      orderBy("updatedAt", "desc"),
    );

    // Step 1: Try IndexedDB cache (instant, no network)
    try {
      const cachedSnapshot = await getDocsFromCache(q);
      if (!cachedSnapshot.empty) {
        onCacheHit(
          cachedSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Recipe),
        );
      }
    } catch {
      // Cache miss or IndexedDB unavailable — continue to network
    }

    // Step 2: Always fetch fresh from network
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Recipe);
  }

  /**
   * Try to load a single recipe from IndexedDB cache (no network).
   * Returns null on cache miss.
   */
  async loadByIdFromCache(id: RecipeId): Promise<Recipe | null> {
    try {
      const docRef = doc(this.recipesRef, id);
      const snap = await getDocFromCache(docRef);
      if (snap.exists()) return { id: snap.id, ...snap.data() } as Recipe;
    } catch {
      // Cache miss
    }
    return null;
  }

  loadById(_id: RecipeId): Recipe | null {
    // Synchronous interface for compatibility — returns null.
    // Use loadByIdAsync() for actual data.
    return null;
  }

  async loadByIdAsync(id: RecipeId): Promise<Recipe | null> {
    const docRef = doc(this.recipesRef, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Recipe;
  }

  save(recipe: Recipe): void {
    // Fire-and-forget for interface compatibility
    this.saveAsync(recipe);
  }

  async saveAsync(recipe: Recipe): Promise<void> {
    const docRef = doc(this.recipesRef, recipe.id);
    const { id: _id, ...data } = recipe;
    // JSON round-trip strips undefined values at all nesting levels
    // (Firestore rejects documents containing undefined)
    const clean = JSON.parse(JSON.stringify({
      ...data,
      ownerId: this.userId,
      isPublic: (data as Record<string, unknown>).isPublic ?? true,
      updatedAt: new Date().toISOString(),
    }));
    await setDoc(docRef, clean);
  }

  delete(id: RecipeId): void {
    this.deleteAsync(id);
  }

  async deleteAsync(id: RecipeId): Promise<void> {
    await deleteDoc(doc(this.recipesRef, id));
  }

  deleteAll(): void {
    // Not implemented for Firestore — too dangerous for cloud data
  }

  isStorageAvailable(): boolean {
    return true;
  }
}
