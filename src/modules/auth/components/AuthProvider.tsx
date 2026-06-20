"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { stripUndefined } from "@/utils/firestore";
import { useAuthStore } from "../authStore";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { useEquipmentStore } from "@/modules/recipe/stores/equipmentStore";
import { useBrewSessionStore } from "@/modules/recipe/stores/brewSessionStore";
import { hydrateLastUsedSource } from "@/modules/recipe/services/sourceWaterPrefs";
import { usePreferencesStore } from "@/modules/auth/preferencesStore";

/**
 * Ensure the users/{userId} document exists (create on first sign-in).
 * Returns the doc ref for the snapshot listener to subscribe to.
 */
async function ensureUserDoc(userId: string, displayName: string | null, email: string | null, photoURL: string | null) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // First sign-in — create user doc with defaults
    const newDoc = {
      displayName: displayName ?? '',
      email: email ?? '',
      photoURL: photoURL ?? null,
      createdAt: new Date().toISOString(),
      tier: 'free' as const,
      recipeCount: 0,
      subscriptionStatus: 'none' as const,
      stripeCustomerId: null,
      subscriptionCurrentPeriodEnd: null,
    };
    await setDoc(userRef, stripUndefined(newDoc));
  }

  return userRef;
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const unsubSnapshotRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      // Clean up previous snapshot listener
      unsubSnapshotRef.current?.();
      unsubSnapshotRef.current = null;

      if (user) {
        // Load this user's calculation/sharing preferences (FG model, etc.)
        // from userPreferences/{uid}. Independent of the users/{uid} doc.
        usePreferencesStore.getState().loadPreferences(user.uid);

        // Ensure user doc exists, then subscribe to real-time updates
        ensureUserDoc(user.uid, user.displayName, user.email, user.photoURL)
          .then((userRef) => {
            unsubSnapshotRef.current = onSnapshot(userRef, (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                useAuthStore.getState().setUserDoc({
                  tier: data.tier ?? 'free',
                  recipeCount: data.recipeCount ?? 0,
                  subscriptionStatus: data.subscriptionStatus ?? 'none',
                  subscriptionCurrentPeriodEnd: data.subscriptionCurrentPeriodEnd ?? null,
                  stripeCustomerId: data.stripeCustomerId ?? null,
                });
                // Per-user prefs piggyback on the same snapshot: adopt the
                // account's last-used source water when it's fresher than
                // this device's copy (cross-device continuity).
                hydrateLastUsedSource(data);
              }
            });
          })
          .catch((err) => console.error('[Auth] Failed to sync user doc:', err));
      } else {
        useAuthStore.getState().clearUserDoc();
      }

      // Auth changed (login/logout) — force re-fetch from the correct repo
      useRecipeStore.getState().loadRecipes(true);
      useEquipmentStore.getState().loadProfiles();
      useBrewSessionStore.getState().loadSessions();
    });

    return () => {
      unsubscribe();
      unsubSnapshotRef.current?.();
    };
  }, [setUser, setLoading]);

  return <>{children}</>;
}
