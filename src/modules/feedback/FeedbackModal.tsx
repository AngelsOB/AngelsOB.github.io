'use client';

/**
 * Global feedback modal (mounted once in ClientShell, mirroring
 * <ImportRecipeFlow />). Opened from anywhere via useFeedbackStore.open() —
 * currently the footer's "Feedback" button.
 *
 * Uses the HS modal system (HSModal + header/body) so it matches the in-app
 * modals (import, hops, equipment).
 */

import HSModal, {
  HSModalBody,
  HSModalHeader,
} from '@/modules/builder/components/modals/HSModal';
import { hsTokens } from '@/modules/builder/tokens';

import FeedbackForm from './FeedbackForm';
import { useFeedbackStore } from './feedbackStore';

export default function FeedbackModal() {
  const isOpen = useFeedbackStore((s) => s.isOpen);
  const close = useFeedbackStore((s) => s.close);

  return (
    <HSModal isOpen={isOpen} onClose={close} size="md" accent={hsTokens.malt}>
      <HSModalHeader kicker="got a minute? —" title="Send feedback" onClose={close} />
      <HSModalBody>
        <FeedbackForm onDone={close} />
      </HSModalBody>
    </HSModal>
  );
}
