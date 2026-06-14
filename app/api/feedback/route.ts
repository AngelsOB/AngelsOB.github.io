import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminDb, adminAuth } from '@/config/firebase-admin';

/**
 * Feedback intake.
 *
 * POST { message, category, email?, honeypot?, path? } → writes a doc to the
 * `feedback` collection via the admin SDK. The collection is fully locked in
 * Firestore rules; this server route is the only writer, which lets anonymous
 * visitors submit without opening an unauthenticated client-write rule.
 *
 * Guards: optional auth (identity attached when signed in, never required),
 * length caps, a honeypot field, and a light per-IP rate limit.
 */

const MAX_MESSAGE_LENGTH = 4000;
const MAX_EMAIL_LENGTH = 200;
const MAX_PATH_LENGTH = 300;
const VALID_CATEGORIES = new Set(['bug', 'idea', 'praise', 'other']);

// Light per-IP rate limit: max submissions per rolling window.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

// Hash the IP so raw addresses never become document IDs.
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

async function consumeRateLimit(ipHash: string): Promise<boolean> {
  const ref = adminDb.collection('feedbackRateLimits').doc(ipHash);
  const nowMs = Date.now();
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const windowStart = (data?.windowStart as number | undefined) ?? 0;
    const within = nowMs - windowStart < RATE_WINDOW_MS;
    const count = within ? ((data?.count as number) ?? 0) : 0;
    if (count >= RATE_LIMIT) return false;
    tx.set(ref, { windowStart: within ? windowStart : nowMs, count: count + 1 });
    return true;
  });
}

export async function POST(req: NextRequest) {
  try {
    // Optional auth — attach identity when present, but never require it.
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        userId = decoded.uid;
        userEmail = decoded.email ?? null;
        userName = decoded.name ?? null;
      } catch {
        // Invalid token → treat as anonymous (do not 401).
      }
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    const { message, category, email, honeypot, path } = body;

    // Honeypot — silently accept without writing so bots don't learn.
    if (typeof honeypot === 'string' && honeypot.trim()) {
      return NextResponse.json({ ok: true });
    }

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    const cat =
      typeof category === 'string' && VALID_CATEGORIES.has(category) ? category : 'other';

    // Rate limit (signed-in and anonymous alike — a cheap abuse safeguard).
    if (!(await consumeRateLimit(hashIp(clientIp(req))))) {
      return NextResponse.json(
        { error: "You've sent a lot of feedback recently. Please try again later." },
        { status: 429 },
      );
    }

    const doc = JSON.parse(
      JSON.stringify({
        message: message.trim(),
        category: cat,
        // Prefer the verified account email; else the optional one they typed.
        email:
          userEmail ??
          (typeof email === 'string' && email.trim()
            ? email.trim().slice(0, MAX_EMAIL_LENGTH)
            : null),
        userId,
        userName,
        path: typeof path === 'string' ? path.slice(0, MAX_PATH_LENGTH) : null,
        userAgent: req.headers.get('user-agent')?.slice(0, 400) ?? null,
        status: 'new',
        createdAt: new Date().toISOString(),
      }),
    );

    await adminDb.collection('feedback').add(doc);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('feedback POST failed', err);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
