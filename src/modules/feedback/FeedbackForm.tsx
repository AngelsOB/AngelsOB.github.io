'use client';

/**
 * Shared feedback form, used in two places:
 *  • inline at the bottom of the homepage (StageFeedback)
 *  • inside the global FeedbackModal opened from the footer
 *
 * Both wrappers supply their own heading/chrome; this renders just the fields
 * and the submit button. Posts through submitFeedback() → /api/feedback.
 * Identity is attached automatically when the visitor is signed in; signed-out
 * visitors get an optional email field so they can leave a contact for a reply.
 */

import { useId, useState, type CSSProperties } from 'react';

import HSButton from '@/modules/builder/components/HSButton';
import { hsTokens } from '@/modules/builder/tokens';
import { useAuthStore } from '@/modules/auth/authStore';
import { toast } from '@/stores/toastStore';

import { submitFeedback, type FeedbackCategory } from './submitFeedback';

const MAX_MESSAGE_LENGTH = 4000;

const CATEGORIES: { key: FeedbackCategory; label: string; accent: string }[] = [
  { key: 'idea', label: 'Idea', accent: hsTokens.water },
  { key: 'bug', label: 'Bug', accent: hsTokens.roast },
  { key: 'praise', label: 'Praise', accent: hsTokens.hops },
  { key: 'other', label: 'Other', accent: hsTokens.muted },
];

const inputBaseStyle: CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 15,
  background: hsTokens.cream2,
  border: `1.5px solid ${hsTokens.ink}`,
  borderRadius: 10,
  padding: '10px 12px',
  color: hsTokens.ink,
  outline: 'none',
  width: '100%',
  boxShadow: hsTokens.sh1,
};

const labelStyle: CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: hsTokens.muted,
};

interface FeedbackFormProps {
  /** Called after a successful submit — the modal uses this to close. */
  onDone?: () => void;
}

export default function FeedbackForm({ onDone }: FeedbackFormProps) {
  const user = useAuthStore((s) => s.user);

  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const messageId = useId();
  const emailId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmed = message.trim();
    if (!trimmed) {
      toast.warning('Add a quick note before sending.');
      return;
    }

    setSubmitting(true);
    const result = await submitFeedback({
      message: trimmed,
      category,
      email: !user && email.trim() ? email.trim() : undefined,
      honeypot,
    });
    setSubmitting(false);

    if (result.ok) {
      toast.success('Thanks — your feedback is in.');
      setMessage('');
      setEmail('');
      setCategory('idea');
      onDone?.();
    } else {
      toast.error(result.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}
    >
      {/* Category chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={labelStyle}>What&apos;s this about?</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((c) => {
            const selected = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                aria-pressed={selected}
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 14px',
                  borderRadius: 999,
                  border: `1.5px solid ${hsTokens.ink}`,
                  background: selected ? c.accent : hsTokens.cream2,
                  color: selected ? '#fff' : hsTokens.ink,
                  boxShadow: selected ? hsTokens.sh1 : 'none',
                  transition: 'background 0.12s ease, box-shadow 0.12s ease',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label htmlFor={messageId} style={labelStyle}>
          Your feedback
          <span style={{ color: hsTokens.roast, marginLeft: 4 }}>*</span>
        </label>
        <textarea
          id={messageId}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          placeholder="What's working, what's not, what you wish it did…"
          rows={4}
          required
          style={{
            ...inputBaseStyle,
            resize: 'vertical',
            minHeight: 90,
            lineHeight: 1.4,
          }}
        />
        <span
          style={{
            alignSelf: 'flex-end',
            fontFamily: hsTokens.body,
            fontSize: 11,
            color: hsTokens.muted,
          }}
        >
          {message.length}/{MAX_MESSAGE_LENGTH}
        </span>
      </div>

      {/* Optional email — signed-out only (signed-in identity comes from the token) */}
      {!user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor={emailId} style={labelStyle}>
            Email (optional)
          </label>
          <input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="So I can reply, if you'd like"
            autoComplete="email"
            style={inputBaseStyle}
          />
        </div>
      ) : null}

      {/* Honeypot — visually hidden; bots fill it, humans don't */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />

      <HSButton
        type="submit"
        variant="solid"
        color={hsTokens.malt}
        fullWidth
        disabled={submitting}
      >
        {submitting ? 'Sending…' : 'Send feedback'}
      </HSButton>
    </form>
  );
}
