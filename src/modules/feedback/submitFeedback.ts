'use client';

/**
 * Client helper for posting feedback to /api/feedback.
 *
 * The write happens server-side (admin SDK) so the `feedback` collection stays
 * fully locked in Firestore rules while still accepting anonymous submissions.
 * When the visitor is signed in we attach their ID token so the server can
 * record who sent it; otherwise the submission is anonymous.
 */

import { auth } from '@/config/firebase';

export type FeedbackCategory = 'bug' | 'idea' | 'praise' | 'other';

export interface FeedbackInput {
  message: string;
  category: FeedbackCategory;
  /** Optional contact email — only collected from signed-out visitors. */
  email?: string;
  /** Honeypot — must stay empty for genuine submissions. */
  honeypot?: string;
}

export interface SubmitFeedbackResult {
  ok: boolean;
  error?: string;
}

export async function submitFeedback(input: FeedbackInput): Promise<SubmitFeedbackResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const user = auth.currentUser;
  if (user) {
    try {
      headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
    } catch {
      // Token fetch failed — fall through and submit anonymously.
    }
  }

  const path = typeof window !== 'undefined' ? window.location.pathname : '';

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: input.message,
        category: input.category,
        email: input.email,
        honeypot: input.honeypot,
        path,
      }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error || 'Something went wrong. Please try again.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}
