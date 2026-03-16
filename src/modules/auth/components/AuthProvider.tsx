"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { useAuthStore } from "../authStore";
import { useRecipeStore } from "../../beta-builder/presentation/stores/recipeStore";
import { useEquipmentStore } from "../../beta-builder/presentation/stores/equipmentStore";
import { useBrewSessionStore } from "../../beta-builder/presentation/stores/brewSessionStore";

/**
 * Read (or create on first sign-in) the users/{userId} document
 * and push tier/subscription state into authStore.
 */
async function syncUserDoc(userId: string, displayName: string | null, email: string | null, photoURL: string | null) {
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const data = snap.data();
    useAuthStore.getState().setUserDoc({
      tier: data.tier ?? 'free',
      recipeCount: data.recipeCount ?? 0,
      subscriptionStatus: data.subscriptionStatus ?? 'none',
      subscriptionCurrentPeriodEnd: data.subscriptionCurrentPeriodEnd ?? null,
      stripeCustomerId: data.stripeCustomerId ?? null,
    });
  } else {
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
    await setDoc(userRef, JSON.parse(JSON.stringify(newDoc)));
    useAuthStore.getState().setUserDoc({
      tier: 'free',
      recipeCount: 0,
      subscriptionStatus: 'none',
      subscriptionCurrentPeriodEnd: null,
      stripeCustomerId: null,
    });
  }
}

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // Read/create user doc (tier, recipeCount, subscription)
        syncUserDoc(user.uid, user.displayName, user.email, user.photoURL).catch(
          (err) => console.error('[Auth] Failed to sync user doc:', err),
        );
      } else {
        useAuthStore.getState().clearUserDoc();
      }

      // Auth changed (login/logout) — force re-fetch from the correct repo
      useRecipeStore.getState().loadRecipes(true);
      useEquipmentStore.getState().loadProfiles();
      useBrewSessionStore.getState().loadSessions();
    });

    return unsubscribe;
  }, [setUser, setLoading]);

  return <>{children}</>;
}
