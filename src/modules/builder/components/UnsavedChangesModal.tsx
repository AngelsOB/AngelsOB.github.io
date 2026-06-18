'use client';

/**
 * Unsaved Changes Modal — Hop & Skip styled
 *
 * Subscribes to `unsavedChangesStore` and renders the confirmation dialog
 * when the guard intercepts a navigation. Uses HSModal + HSButton so the
 * dialog matches the HopSkip aesthetic (cream paper, ink borders, offset
 * shadow, accent stripe). The classic BetaBuilderPage also mounts this modal
 * for cross-UI consistency.
 *
 * Three actions, mapped 1:1 onto the store:
 *   - Save & leave → `handleSave()`  (runs the editor's save handler then proceeds)
 *   - Discard      → `handleDiscard()` (skips save and proceeds)
 *   - Cancel       → `handleCancel()` (closes modal, keeps user on page)
 */

import HSModal, {
  HSModalBody,
  HSModalFooter,
  HSModalHeader,
} from '@/modules/builder/components/modals/HSModal';
import HSButton from '@/modules/builder/components/HSButton';
import { hsTokens } from '@/modules/builder/tokens';
import { useUnsavedChangesStore } from '@/modules/recipe/stores/unsavedChangesStore';

export default function UnsavedChangesModal() {
  const isModalOpen = useUnsavedChangesStore((s) => s.isModalOpen);
  const isSaving = useUnsavedChangesStore((s) => s.isSaving);
  const saveError = useUnsavedChangesStore((s) => s.saveError);
  const handleSave = useUnsavedChangesStore((s) => s.handleSave);
  const handleDiscard = useUnsavedChangesStore((s) => s.handleDiscard);
  const handleCancel = useUnsavedChangesStore((s) => s.handleCancel);

  return (
    <HSModal
      isOpen={isModalOpen}
      onClose={handleCancel}
      size="sm"
      // Roast accent stripe — visually signals "attention, this matters".
      accent={hsTokens.roast}
      // Don't let a stray backdrop click discard work. The modal exists
      // precisely to avoid accidents.
      closeOnBackdropClick={false}
    >
      <HSModalHeader
        title="Unsaved changes"
        onClose={handleCancel}
      />
      <HSModalBody>
        <p
          style={{
            margin: 0,
            fontFamily: hsTokens.body,
            fontSize: 14,
            lineHeight: 1.5,
            color: hsTokens.ink,
          }}
        >
          You&apos;ve edited this recipe but haven&apos;t saved yet. Save your
          changes before leaving, or discard them and continue.
        </p>
        {saveError ? (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: '10px 12px',
              border: `2px solid ${hsTokens.roast}`,
              background: `color-mix(in oklch, ${hsTokens.roast} 10%, transparent)`,
              borderRadius: 8,
              fontFamily: hsTokens.body,
              fontSize: 13,
              color: hsTokens.ink,
            }}
          >
            {saveError}
          </div>
        ) : null}
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </HSButton>
        <HSButton
          variant="ink"
          color={hsTokens.roast}
          size="sm"
          onClick={handleDiscard}
          disabled={isSaving}
        >
          Discard
        </HSButton>
        <HSButton
          variant="solid"
          color={hsTokens.hops}
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save & leave'}
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}
