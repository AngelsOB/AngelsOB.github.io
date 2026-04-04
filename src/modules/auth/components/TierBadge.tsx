'use client';

import { useUserTier } from '../useUserTier';

export default function TierBadge() {
  const { userState } = useUserTier();

  if (userState === 'anonymous') return null;

  return (
    <span
      className="inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={
        userState === 'premium'
          ? { background: 'color-mix(in oklch, var(--brew-accent-400) 20%, transparent)', color: 'var(--brew-accent-600)' }
          : { background: 'color-mix(in oklch, var(--fg-muted) 12%, transparent)', color: 'var(--fg-muted)' }
      }
    >
      {userState === 'premium' ? 'Premium' : 'Free'}
    </span>
  );
}
