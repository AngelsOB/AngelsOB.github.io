'use client';

import { auth } from '@/config/firebase';
import { toast } from '../../stores/toastStore';

/**
 * Start a Stripe Checkout session and redirect the user to the hosted payment page.
 */
export async function startCheckout(plan: 'monthly' | 'annual'): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    toast.error('You must be signed in to upgrade.');
    return;
  }

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan }),
  });

  if (!res.ok) {
    toast.error('Failed to start checkout. Please try again.');
    return;
  }

  const { url } = await res.json();
  if (url) {
    window.location.href = url;
  } else {
    toast.error('Failed to start checkout. Please try again.');
  }
}

/**
 * Open the Stripe Billing Portal for subscription management.
 */
export async function openBillingPortal(): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) {
    toast.error('You must be signed in.');
    return;
  }

  const res = await fetch('/api/billing-portal', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    toast.error('Failed to open subscription management. Please try again.');
    return;
  }

  const { url } = await res.json();
  if (url) {
    window.location.href = url;
  } else {
    toast.error('Failed to open subscription management. Please try again.');
  }
}
