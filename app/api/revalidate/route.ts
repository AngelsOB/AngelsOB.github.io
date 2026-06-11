import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { adminAuth } from '@/config/firebase-admin';

/**
 * On-demand ISR revalidation, called fire-and-forget by the client after
 * publish / republish / unpublish so the public surfaces update immediately
 * instead of waiting out the hourly revalidate window.
 *
 * Auth: any signed-in user. The endpoint only flushes caches (the rendered
 * pages re-read Firestore, which is the source of truth), so ownership checks
 * aren't needed — but requiring a valid ID token keeps it from being an
 * anonymous cache-busting target.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let slug: unknown;
    try {
      ({ slug } = await req.json());
    } catch {
      /* no body — fine, revalidate the listing surfaces only */
    }

    revalidatePath('/');
    revalidatePath('/browse');
    revalidatePath('/recipes/all');
    revalidatePath('/sitemap.xml');
    revalidatePath(`/u/${decoded.uid}`);
    if (typeof slug === 'string' && slug) {
      revalidatePath(`/r/${slug}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API] Revalidate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
