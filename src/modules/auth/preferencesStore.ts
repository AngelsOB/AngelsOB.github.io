"use client";

import { create } from "zustand";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";

type PreferencesState = {
  defaultRecipePublic: boolean;
  isLoaded: boolean;
  loadPreferences: (userId: string) => void;
  setDefaultRecipePublic: (value: boolean, userId: string) => void;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  defaultRecipePublic: true,
  isLoaded: false,

  loadPreferences: (userId: string) => {
    const docRef = doc(db, "userPreferences", userId);
    getDoc(docRef)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({
            defaultRecipePublic: data.defaultRecipePublic ?? true,
            isLoaded: true,
          });
        } else {
          set({ isLoaded: true });
        }
      })
      .catch(() => {
        set({ isLoaded: true });
      });
  },

  setDefaultRecipePublic: (value: boolean, userId: string) => {
    set({ defaultRecipePublic: value });
    const docRef = doc(db, "userPreferences", userId);
    setDoc(docRef, { defaultRecipePublic: value }, { merge: true }).catch(
      (err) => console.error("[preferences] Failed to save:", err)
    );
  },
}));
