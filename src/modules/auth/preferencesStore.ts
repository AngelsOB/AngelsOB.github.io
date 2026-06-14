"use client";

import { create } from "zustand";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";
import type { AttenuationModel } from "@/modules/recipe/services/RecipeCalculationService";

export type { AttenuationModel };

/**
 * Map a stored attenuation-model value to a current one. The lineup is now just
 * 'kinetic' (default) and 'linear'. Retired ids map to the nearest survivor:
 * the old kinetic models → 'kinetic'; the old formula/flat models → 'linear';
 * anything unrecognized → the default 'kinetic'.
 */
function migrateAttenuationModel(value: unknown): AttenuationModel {
  if (value === 'kinetic' || value === 'linear') return value;
  if (value === 'mash_adjusted' || value === 'simple') return 'linear';
  return 'kinetic'; // 'brandam_ode', 'enzyme_kinetics', unknown → kinetic
}

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
  attenuationModel: "kinetic" as AttenuationModel,
  isLoaded: false,

  loadPreferences: (userId: string) => {
    const docRef = doc(db, "userPreferences", userId);
    getDoc(docRef)
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          set({
            defaultRecipePublic: data.defaultRecipePublic ?? true,
            attenuationModel: migrateAttenuationModel(data.attenuationModel),
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
