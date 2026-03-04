import { create } from "zustand";
import {
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/config/firebase";

interface AuthState {
  user: User | null;
  isLoading: boolean;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  signInWithGoogle: async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      // If popup is blocked (e.g. Safari), fall back to redirect
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "auth/popup-blocked"
      ) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        throw error;
      }
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
  },
}));
