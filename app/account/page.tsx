'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/modules/auth/authStore';
import { useUserTier } from '@/modules/auth/useUserTier';
import { startCheckout, openBillingPortal } from '@/modules/auth/stripeCheckout';
import Button from '@/components/Button';

function AccountContent() {
  const user = useAuthStore((s) => s.user);
  const subscriptionStatus = useAuthStore((s) => s.subscriptionStatus);
  const subscriptionCurrentPeriodEnd = useAuthStore((s) => s.subscriptionCurrentPeriodEnd);
  const { userState, recipeCount } = useUserTier();
  const searchParams = useSearchParams();
  const [showSuccess, setShowSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Show success banner when returning from Stripe Checkout
  useEffect(() => {
    if (searchParams.get('session_id')) {
      setShowSuccess(true);
    }
  }, [searchParams]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Account</h1>
        <p className="text-[var(--brew-text-secondary)]">Sign in to manage your account.</p>
      </div>
    );
  }

  const periodEnd = subscriptionCurrentPeriodEnd
    ? new Date(subscriptionCurrentPeriodEnd).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  async function handleUpgrade(plan: 'monthly' | 'annual') {
    setCheckoutLoading(true);
    await startCheckout(plan);
    setCheckoutLoading(false);
  }

  async function handleManage() {
    setPortalLoading(true);
    await openBillingPortal();
    setPortalLoading(false);
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Success banner */}
      {showSuccess && userState === 'premium' && (
        <div className="mb-6 rounded-lg bg-[color-mix(in_oklch,var(--brew-accent-600)_12%,transparent)] border border-[var(--brew-accent-600)] p-4 text-center">
          <p className="text-lg font-semibold">Welcome to Premium! 🎉</p>
          <p className="text-sm text-[var(--brew-text-secondary)] mt-1">
            Thanks for your support. Cheers! 🍺
          </p>
        </div>
      )}

      {/* Processing banner — shown when returning from checkout but webhook hasn't fired yet */}
      {showSuccess && userState !== 'premium' && (
        <div className="mb-6 rounded-lg bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)] border border-[rgb(var(--border))] p-4 text-center">
          <p className="text-sm text-[var(--brew-text-secondary)]">
            Processing your payment... This page will update automatically.
          </p>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-8">Account</h1>

      {/* User info */}
      <section className="mb-8">
        <div className="flex items-center gap-4">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="h-12 w-12 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-[var(--coral-600)] text-white flex items-center justify-center text-lg font-medium">
              {(user.displayName ?? user.email ?? '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-medium">{user.displayName}</p>
            <p className="text-sm text-[var(--brew-text-secondary)]">{user.email}</p>
          </div>
        </div>
      </section>

      {/* Subscription status */}
      <section className="rounded-lg border border-[rgb(var(--border))] p-5">
        <h2 className="text-lg font-semibold mb-4">Subscription</h2>

        {userState === 'free' && (
          <>
            <p className="text-[var(--brew-text-secondary)] mb-1">
              You&apos;re on the <span className="font-medium text-[var(--fg-strong)]">Free</span> plan.
            </p>
            <p className="text-sm text-[var(--brew-text-secondary)] mb-5">
              {recipeCount} / 5 recipes used. Upgrade for unlimited recipes, export, and more.
            </p>
            <div className="flex gap-3">
              <Button
                variant="neon"
                onClick={() => handleUpgrade('monthly')}
                loading={checkoutLoading}
              >
                Upgrade — $1.99/mo
              </Button>
              <Button
                variant="outline"
                onClick={() => handleUpgrade('annual')}
                loading={checkoutLoading}
              >
                $19.99/yr (save ~$4)
              </Button>
            </div>
          </>
        )}

        {userState === 'premium' && subscriptionStatus === 'active' && (
          <>
            <p className="text-[var(--brew-text-secondary)] mb-1">
              You&apos;re on <span className="font-medium text-[var(--fg-strong)]">Premium</span>. 🍺
            </p>
            {periodEnd && (
              <p className="text-sm text-[var(--brew-text-secondary)] mb-5">
                Next billing date: {periodEnd}
              </p>
            )}
            <Button variant="outline" onClick={handleManage} loading={portalLoading}>
              Manage Subscription
            </Button>
          </>
        )}

        {userState === 'premium' && subscriptionStatus === 'canceled' && (
          <>
            <p className="text-[var(--brew-text-secondary)] mb-1">
              Your subscription has been canceled.
            </p>
            {periodEnd && (
              <p className="text-sm text-[var(--brew-text-secondary)] mb-5">
                You&apos;ll retain Premium access until <span className="font-medium">{periodEnd}</span>.
              </p>
            )}
            <Button
              variant="neon"
              onClick={() => handleUpgrade('monthly')}
              loading={checkoutLoading}
            >
              Resubscribe
            </Button>
          </>
        )}

        {userState === 'premium' && subscriptionStatus === 'past_due' && (
          <>
            <div className="mb-4 rounded-lg bg-[color-mix(in_oklch,var(--brew-danger-600)_10%,transparent)] border border-[var(--brew-danger-600)] p-3">
              <p className="text-sm font-medium text-[var(--brew-danger-600)]">
                Your last payment failed. We&apos;re retrying automatically.
              </p>
              <p className="text-xs text-[var(--brew-text-secondary)] mt-1">
                Your Premium access continues while we retry. Update your payment method to avoid interruption.
              </p>
            </div>
            <Button variant="outline" onClick={handleManage} loading={portalLoading}>
              Update Payment Method
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense>
      <AccountContent />
    </Suspense>
  );
}
