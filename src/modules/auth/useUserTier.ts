import { useAuthStore, deriveUserState } from './authStore';
import { canCreateRecipe } from './tierAccess';
import type { UserState } from './tierAccess';

interface UserTier {
  userState: UserState;
  recipeCount: number;
  canCreate: boolean;
  userDocLoaded: boolean;
}

export function useUserTier(): UserTier {
  const user = useAuthStore((s) => s.user);
  const recipeCount = useAuthStore((s) => s.recipeCount);
  const subscriptionStatus = useAuthStore((s) => s.subscriptionStatus);
  const subscriptionCurrentPeriodEnd = useAuthStore((s) => s.subscriptionCurrentPeriodEnd);
  const userDocLoaded = useAuthStore((s) => s.userDocLoaded);

  const userState = deriveUserState(user, subscriptionStatus, subscriptionCurrentPeriodEnd);

  return {
    userState,
    recipeCount,
    canCreate: canCreateRecipe(userState, recipeCount),
    userDocLoaded,
  };
}
