'use client';

import { useState } from 'react';

import HSModal, {
  HSModalBody,
  HSModalFooter,
  HSModalHeader,
} from '@/modules/builder/components/modals/HSModal';
import HSButton from '@/modules/builder/components/HSButton';
import { hsTokens } from '@/modules/builder/tokens';
import { startCheckout } from '../stripeCheckout';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional context message shown above the benefits list */
  reason?: string;
}

const BENEFITS = [
  'Unlimited cloud recipes',
  'BeerXML & Markdown export',
  'Buy a solo dev a pint — 🍺 Cheers!',
];

export default function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    await startCheckout(plan);
    // If we're still here, the checkout redirect failed — re-enable the button.
    setLoading(false);
  }

  const planButton = (id: 'monthly' | 'annual', label: React.ReactNode) => {
    const active = plan === id;
    return (
      <button
        type="button"
        onClick={() => setPlan(id)}
        style={{
          flex: 1,
          appearance: 'none',
          margin: 0,
          padding: '9px 14px',
          background: active ? hsTokens.ink : 'transparent',
          color: active ? hsTokens.paper : hsTokens.muted,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 999,
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <HSModal isOpen={isOpen} onClose={onClose} size="sm" accent={hsTokens.malt}>
      <HSModalHeader title="Upgrade to Premium" onClose={onClose} />
      <HSModalBody>
        {reason ? (
          <p
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              lineHeight: 1.5,
              color: hsTokens.muted,
              margin: '0 0 16px',
            }}
          >
            {reason}
          </p>
        ) : null}

        <ul
          style={{
            listStyle: 'none',
            margin: '0 0 18px',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {BENEFITS.map((b) => (
            <li
              key={b}
              style={{
                fontFamily: hsTokens.body,
                fontSize: 14,
                color: hsTokens.ink,
                display: 'flex',
                gap: 8,
              }}
            >
              <span aria-hidden style={{ color: hsTokens.hops, fontWeight: 700 }}>
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>

        <div style={{ display: 'flex', gap: 8 }}>
          {planButton('monthly', '$1.99/mo')}
          {planButton(
            'annual',
            <>
              $19.99/yr <span style={{ fontSize: 11, opacity: 0.75 }}>(save ~$4)</span>
            </>,
          )}
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton variant="ghost" onClick={onClose} disabled={loading}>
          Not now
        </HSButton>
        <HSButton variant="solid" color={hsTokens.malt} onClick={handleUpgrade} disabled={loading}>
          {loading ? 'Redirecting…' : 'Upgrade'}
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}
