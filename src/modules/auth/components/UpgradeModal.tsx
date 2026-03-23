'use client';

import { useState } from 'react';
import ModalOverlay from '../../beta-builder/presentation/components/ModalOverlay';
import Button from '../../../components/Button';
import { startCheckout } from '../stripeCheckout';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional context message shown above the benefits list */
  reason?: string;
}

export default function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    await startCheckout(plan);
    // If we're still here, checkout redirect failed — re-enable the button
    setLoading(false);
  }

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">⭐</div>
        <h2 className="text-xl font-bold mb-2">Upgrade to Premium</h2>
        {reason && (
          <p className="text-[var(--brew-text-secondary)] mb-4">
            {reason}
          </p>
        )}
        <ul className="text-left text-sm text-[var(--brew-text-secondary)] mb-5 space-y-1.5 pl-4">
          <li>✓ Unlimited cloud recipes</li>
          <li>✓ BeerXML &amp; Markdown export</li>
          {/* <li>✓ Auto water salt calculator</li> */}
          {/* <li>✓ Enhanced brew mode</li> */}
          <li>✓ Buy a solo dev a pint — 🍺 Cheers!</li>
        </ul>

        {/* Plan toggle */}
        <div className="flex rounded-lg border border-[rgb(var(--border))] overflow-hidden mb-5 text-sm">
          <button
            onClick={() => setPlan('monthly')}
            className={`flex-1 py-2 px-3 transition-colors cursor-pointer ${
              plan === 'monthly'
                ? 'bg-[var(--brew-accent-600)] text-white font-medium'
                : 'text-[var(--brew-text-secondary)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]'
            }`}
          >
            $1.99/mo
          </button>
          <button
            onClick={() => setPlan('annual')}
            className={`flex-1 py-2 px-3 transition-colors cursor-pointer ${
              plan === 'annual'
                ? 'bg-[var(--brew-accent-600)] text-white font-medium'
                : 'text-[var(--brew-text-secondary)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]'
            }`}
          >
            $19.99/yr <span className="text-xs opacity-75">(save ~$4)</span>
          </button>
        </div>

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} fullWidth disabled={loading}>
            Not Now
          </Button>
          <Button variant="neon" onClick={handleUpgrade} fullWidth loading={loading}>
            Upgrade
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
}
