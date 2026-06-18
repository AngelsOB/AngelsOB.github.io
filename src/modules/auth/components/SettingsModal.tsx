'use client';

import HSModal, {
  HSModalBody,
  HSModalFooter,
  HSModalHeader,
} from '@/modules/builder/components/modals/HSModal';
import HSButton from '@/modules/builder/components/HSButton';
import { hsTokens } from '@/modules/builder/tokens';
import { useAuthStore } from '@/modules/auth/authStore';
import { usePreferencesStore, type AttenuationModel } from '@/modules/auth/preferencesStore';

const FG_MODEL_DESCRIPTIONS: Record<AttenuationModel, string> = {
  kinetic:
    'Simulates the mash enzymology: β-amylase, α-amylase, and limit dextrinase across each rest, with in-mash thermal denaturation. The most accurate on our validation data. Recommended.',
  linear:
    'A simple mash-temperature formula that matches Grainfather. Less accurate, but handy for cross-checking against other software.',
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const labelStyle = {
  fontFamily: hsTokens.body,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase' as const,
  color: hsTokens.muted,
};

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const user = useAuthStore((s) => s.user);
  const attenuationModel = usePreferencesStore((s) => s.attenuationModel);
  const setAttenuationModel = usePreferencesStore((s) => s.setAttenuationModel);

  return (
    <HSModal isOpen={isOpen} onClose={onClose} size="md" accent={hsTokens.water}>
      <HSModalHeader title="Settings" onClose={onClose} />
      <HSModalBody>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 14,
            lineHeight: 1.5,
            color: hsTokens.muted,
            margin: '0 0 18px',
          }}
        >
          Tune how recipe stats are estimated. Changes apply instantly across the builder and brew
          sheet.
        </p>

        <div
          style={{
            background: hsTokens.cream2,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <label htmlFor="fg-model" style={labelStyle}>
            Final gravity model
          </label>
          <select
            id="fg-model"
            value={attenuationModel}
            onChange={(e) => user && setAttenuationModel(e.target.value as AttenuationModel, user.uid)}
            disabled={!user}
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 10,
              padding: '10px 12px',
              color: hsTokens.ink,
              outline: 'none',
              width: '100%',
              boxShadow: hsTokens.sh1,
              cursor: user ? 'pointer' : 'not-allowed',
              opacity: user ? 1 : 0.6,
            }}
          >
            <option value="kinetic">Kinetic — mash simulation (recommended)</option>
            <option value="linear">Linear — matches other apps</option>
          </select>
          <p
            style={{
              fontFamily: hsTokens.body,
              fontSize: 13,
              lineHeight: 1.5,
              color: hsTokens.muted,
              margin: '2px 0 0',
            }}
          >
            {FG_MODEL_DESCRIPTIONS[attenuationModel]}
          </p>
          {!user ? (
            <p
              style={{
                fontFamily: hsTokens.script,
                fontSize: 14,
                color: hsTokens.muted,
                margin: '2px 0 0',
              }}
            >
              Sign in to save this preference to your account.
            </p>
          ) : null}
        </div>
      </HSModalBody>
      <HSModalFooter align="end">
        <HSButton variant="ink" color={hsTokens.malt} onClick={onClose}>
          Done
        </HSButton>
      </HSModalFooter>
    </HSModal>
  );
}
