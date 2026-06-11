"use client";

import { create } from "zustand";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import type { AttenuationModel } from "@/modules/recipe/services/RecipeCalculationService";

export type { AttenuationModel };

type PreferencesState = {
  defaultRecipePublic: boolean;
  attenuationModel: AttenuationModel;
  isLoaded: boolean;
  loadPreferences: (userId: string) => void;
  setDefaultRecipePublic: (value: boolean, userId: string) => void;
  setAttenuationModel: (value: AttenuationModel, userId: string) => void;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  defaultRecipePublic: true,
  attenuationModel: "linear" as AttenuationModel,
  isLoaded: false,

  loadPreferences: (userId: string) => {
    const docRef = doc(db, "userPreferences", userId);
    getDoc(docRef)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({
            defaultRecipePublic: data.defaultRecipePublic ?? true,
            attenuationModel: data.attenuationModel ?? "linear",
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

  setAttenuationModel: (value: AttenuationModel, userId: string) => {
    set({ attenuationModel: value });
    const docRef = doc(db, "userPreferences", userId);
    setDoc(docRef, { attenuationModel: value }, { merge: true }).catch(
      (err) => console.error("[preferences] Failed to save:", err)
    );
  },
}));
