import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/config/firebase-admin';
import { getStripe } from '@/config/stripe';

/**
 * Look up the user document by their Stripe customer ID.
 * Used for subscription.updated/deleted events where userId isn't in metadata.
 */
async function getUserRefByStripeCustomerId(customerId: string) {
  const snapshot = await adminDb
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return snapshot.docs[0].ref;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) {
          console.error('[Webhook] checkout.session.completed missing userId in metadata');
          break;
        }

        const subscriptionId = session.subscription as string;
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const periodEnd = subscription.items.data[0]?.current_period_end;

        await adminDb.collection('users').doc(userId).update(
          JSON.parse(JSON.stringify({
            tier: 'premium',
            subscriptionStatus: 'active',
            stripeCustomerId: session.customer as string,
            subscriptionCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          })),
        );
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userRef = await getUserRefByStripeCustomerId(subscription.customer as string);
        if (!userRef) {
          console.error('[Webhook] subscription.updated — no user found for customer:', subscription.customer);
          break;
        }

        const status = subscription.cancel_at_period_end
          ? 'canceled'
          : subscription.status === 'past_due'
            ? 'past_due'
            : 'active';

        const tier = (status === 'active' || status === 'past_due') ? 'premium' : undefined;
        const periodEnd = subscription.items.data[0]?.current_period_end;

        const update: Record<string, unknown> = {
          subscriptionStatus: status,
          subscriptionCurrentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        };
        if (tier) update.tier = tier;

        await userRef.update(JSON.parse(JSON.stringify(update)));
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userRef = await getUserRefByStripeCustomerId(subscription.customer as string);
        if (!userRef) {
          console.error('[Webhook] subscription.deleted — no user found for customer:', subscription.customer);
          break;
        }

        await userRef.update({
          tier: 'free',
          subscriptionStatus: 'none',
          subscriptionCurrentPeriodEnd: null,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const userRef = await getUserRefByStripeCustomerId(invoice.customer as string);
        if (!userRef) {
          console.error('[Webhook] invoice.payment_failed — no user found for customer:', invoice.customer);
          break;
        }

        await userRef.update({ subscriptionStatus: 'past_due' });
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    // Log but still return 200 to prevent Stripe retries for internal errors
    console.error(`[Webhook] Error processing ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}
