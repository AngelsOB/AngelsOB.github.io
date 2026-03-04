"use client";

import { useEffect } from "react";
import { onAuthStateChanged, getRedirectResult } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useAuthStore } from "../authStore";
import { useRecipeStore } from "../../beta-builder/presentation/stores/recipeStore";
import { useEquipmentStore } from "../../beta-builder/presentation/stores/equipmentStore";
import { useBrewSessionStore } from "../../beta-builder/presentation/stores/brewSessionStore";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    // Handle redirect result (mobile sign-in flow)
    getRedirectResult(auth).catch(() => {
      // Redirect result errors are non-fatal (e.g., no redirect pending)
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      // Re-fetch data from the correct repo (localStorage or Firestore)
      useRecipeStore.getState().loadRecipes();
      useEquipmentStore.getState().loadProfiles();
      useBrewSessionStore.getState().loadSessions();
    });

    return unsubscribe;
  }, [setUser, setLoading]);

  return <>{children}</>;
}
