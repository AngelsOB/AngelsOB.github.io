"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      // Auth changed (login/logout) — force re-fetch from the correct repo
      useRecipeStore.getState().loadRecipes(true);
      useEquipmentStore.getState().loadProfiles();
      useBrewSessionStore.getState().loadSessions();
    });

    return unsubscribe;
  }, [setUser, setLoading]);

  return <>{children}</>;
}
