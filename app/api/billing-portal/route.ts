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

    // Get stripeCustomerId from user doc
    const userRef = adminDb.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    const stripeCustomerId = userSnap.data()?.stripeCustomerId as string | null;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'No active subscription to manage' },
        { status: 400 },
      );
    }

    const baseUrl = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/account`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[API] Billing portal error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
