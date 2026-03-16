import { create } from "zustand";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/config/firebase";
import type { UserState } from "./tierAccess";

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';

interface UserDoc {
  tier: 'free' | 'premium';
  recipeCount: number;
  subscriptionStatus: SubscriptionStatus;
  subscriptionCurrentPeriodEnd: string | null;
  stripeCustomerId: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;

  // Tier & subscription state (from users/{userId} doc)
  tier: 'free' | 'premium';
  recipeCount: number;
  subscriptionStatus: SubscriptionStatus;
  subscriptionCurrentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  userDocLoaded: boolean;

  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setUserDoc: (doc: UserDoc) => void;
  clearUserDoc: () => void;
  /** Update recipeCount optimistically (e.g., +1 on create, -1 on delete) */
  adjustRecipeCount: (delta: number) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const USER_DOC_DEFAULTS: UserDoc = {
  tier: 'free',
  recipeCount: 0,
  subscriptionStatus: 'none',
  subscriptionCurrentPeriodEnd: null,
  stripeCustomerId: null,
};

/**
 * Derive the effective UserState from subscription fields.
 * Premium if subscription is active, past_due (Stripe retrying),
 * or canceled but still within the paid period.
 */
export function deriveUserState(
  user: User | null,
  subscriptionStatus: SubscriptionStatus,
  subscriptionCurrentPeriodEnd: string | null,
): UserState {
  if (!user) return 'anonymous';
  if (subscriptionStatus === 'active' || subscriptionStatus === 'past_due') return 'premium';
  if (
    subscriptionStatus === 'canceled' &&
    subscriptionCurrentPeriodEnd &&
    new Date(subscriptionCurrentPeriodEnd) > new Date()
  ) {
    return 'premium';
  }
  return 'free';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,

  // User doc defaults
  ...USER_DOC_DEFAULTS,
  userDocLoaded: false,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),

  setUserDoc: (doc) => set({
    tier: doc.tier,
    recipeCount: doc.recipeCount,
    subscriptionStatus: doc.subscriptionStatus,
    subscriptionCurrentPeriodEnd: doc.subscriptionCurrentPeriodEnd,
    stripeCustomerId: doc.stripeCustomerId,
    userDocLoaded: true,
  }),

  clearUserDoc: () => set({ ...USER_DOC_DEFAULTS, userDocLoaded: false }),

  adjustRecipeCount: (delta) => {
    const current = get().recipeCount;
    set({ recipeCount: Math.max(0, current + delta) });
  },

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
