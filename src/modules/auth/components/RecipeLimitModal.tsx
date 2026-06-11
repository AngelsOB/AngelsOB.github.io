'use client';

import { useState } from 'react';
import ModalOverlay from '@/components/ModalOverlay';
import Button from '../../../components/Button';
import { RECIPE_LIMIT } from '../tierAccess';
import { startCheckout } from '../stripeCheckout';

interface RecipeLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RecipeLimitModal({ isOpen, onClose }: RecipeLimitModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade(plan: 'monthly' | 'annual') {
    setLoading(true);
    await startCheckout(plan);
    setLoading(false);
  }

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🍺</div>
        <h2 className="text-xl font-bold mb-2">Recipe Limit Reached</h2>
        <p className="text-[var(--brew-text-secondary)] mb-4">
          You&apos;ve saved {RECIPE_LIMIT} recipes — that&apos;s the free tier limit.
          Upgrade to Premium for unlimited recipes and more.
        </p>
        <ul className="text-left text-sm text-[var(--brew-text-secondary)] mb-6 space-y-1.5 pl-4">
          <li>✓ Unlimited cloud recipes</li>
          <li>✓ BeerXML &amp; Markdown export</li>
          {/* <li>✓ Auto water salt calculator</li> */}
          {/* <li>✓ Enhanced brew mode</li> */}
          <li>✓ Buy a solo dev a pint — 🍺 Cheers!</li>
        </ul>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} fullWidth disabled={loading}>
            Not Now
          </Button>
          <Button variant="neon" onClick={() => handleUpgrade('monthly')} fullWidth loading={loading}>
            Upgrade — $1.99/mo
          </Button>
        </div>
        <p className="text-xs text-[var(--brew-text-tertiary)] mt-3">
          <button
            onClick={() => handleUpgrade('annual')}
            className="underline hover:text-[var(--brew-text-secondary)] transition-colors cursor-pointer"
            disabled={loading}
          >
            Or $19.99/year (save ~$4)
          </button>
          {' · '}You can also delete a recipe to free up a slot.
        </p>
      </div>
    </ModalOverlay>
  );
}
