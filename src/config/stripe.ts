import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Lazy Stripe client initialization.
 * Avoids crashing during Next.js static builds when STRIPE_SECRET_KEY is absent.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}
