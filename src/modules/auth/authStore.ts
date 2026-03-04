import { create } from "zustand";
import {
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/config/firebase";

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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
    // Mobile browsers don't support popups reliably — use redirect
    if (isMobile()) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      // Any popup failure (blocked, closed, etc.) — fall back to redirect
      await signInWithRedirect(auth, googleProvider);
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
  },
}));
