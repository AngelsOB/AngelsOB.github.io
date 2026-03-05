import { create } from "zustand";
import {
  signInWithPopup,
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
    // signInWithPopup works on both desktop and mobile.
    // signInWithRedirect is broken on most mobile browsers due to
    // third-party cookie restrictions (silently fails).
    await signInWithPopup(auth, googleProvider);
  },

  signOut: async () => {
    await firebaseSignOut(auth);
  },
}));
