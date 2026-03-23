import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/config/firebase-admin';
import { getStripe } from '@/config/stripe';

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const { plan } = await req.json();
    if (plan !== 'monthly' && plan !== 'annual') {
      return NextResponse.json({ error: 'Invalid plan. Must be "monthly" or "annual".' }, { status: 400 });
    }

    const priceId = plan === 'monthly'
      ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY
      : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_ANNUAL;

    if (!priceId) {
      console.error(`[Checkout] Missing price ID env var for plan: ${plan}`);
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get or create Stripe customer
    const userRef = adminDb.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data();

    let stripeCustomerId = userData?.stripeCustomerId as string | null;

    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: decoded.email ?? undefined,
        metadata: { firebaseUserId: decoded.uid },
      });
      stripeCustomerId = customer.id;
      await userRef.update(
        JSON.parse(JSON.stringify({ stripeCustomerId })),
      );
    }

    // Create checkout session
    const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: decoded.uid },
      success_url: `${baseUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/recipes`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[API] Checkout error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
