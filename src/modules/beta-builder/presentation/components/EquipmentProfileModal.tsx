'use client';

/**
 * Equipment Profile Modal Component
 *
 * Modal for selecting or creating equipment profiles.
 */

import { useState } from 'react';
import { useEquipmentStore } from '../stores/equipmentStore';
import type { EquipmentProfile } from '../../domain/models/Equipment';
import Input from '@components/Input';
import Button from '@components/Button';
import ModalOverlay from './ModalOverlay';

interface EquipmentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (profile: EquipmentProfile) => void;
  onCreateCustom: () => void;
}

export const EquipmentProfileModal = ({
  isOpen,
  onClose,
  onSelect,
  onCreateCustom,
}: EquipmentProfileModalProps) => {
  const { profiles } = useEquipmentStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter profiles by search term
  const filteredProfiles = profiles.filter((profile) =>
    profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group profiles by type (preset vs custom)
  const presetProfiles = filteredProfiles.filter(p => !p.isCustom);
  const customProfiles = filteredProfiles.filter(p => p.isCustom);

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="3xl">
        {/* Header */}
        <div className="p-6 border-b border-[rgb(var(--brew-border-subtle))]">
          <div className="flex items-center justify-between mb-4">
            <h2 id="modal-title" className="text-xl font-bold">
              Select Equipment Profile
            </h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-[var(--fg-strong)] transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search equipment profiles..."
            fullWidth
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Preset Profiles */}
          {presetProfiles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                Preset Profiles
              </h3>
              <div className="space-y-2">
                {presetProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.name}
                    profile={profile}
                    onSelect={() => onSelect(profile)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Custom Profiles */}
          {customProfiles.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                Custom Profiles
              </h3>
              <div className="space-y-2">
                {customProfiles.map((profile) => (
                  <ProfileCard
                    key={profile.name}
                    profile={profile}
                    onSelect={() => onSelect(profile)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {filteredProfiles.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted">
                No equipment profiles found
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[rgb(var(--brew-border-subtle))] flex gap-3">
          <Button variant="neon" onClick={onCreateCustom}>
            + Create Custom
          </Button>
          <Button variant="outline" onClick={onClose} fullWidth>
            Cancel
          </Button>
        </div>
    </ModalOverlay>
  );
};

// Profile Card Component
interface ProfileCardProps {
  profile: EquipmentProfile;
  onSelect: () => void;
}

const ProfileCard = ({ profile, onSelect }: ProfileCardProps) => {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-4 border border-[rgb(var(--brew-border-subtle))] rounded-lg hover:border-[var(--brew-accent-400)] hover:bg-[color-mix(in oklch, var(--brew-card-inset) 40%, transparent)] transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold">
            {profile.name}
          </h4>
          {profile.isCustom && (
            <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
              Custom
            </span>
          )}
        </div>
      </div>

      {profile.description && (
        <p className="text-sm text-muted mb-3">
          {profile.description}
        </p>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-muted">Batch:</span>{' '}
          <span className="font-semibold">
            {profile.batchSizeL.toFixed(1)}L
          </span>
        </div>
        <div>
          <span className="text-muted">Boil:</span>{' '}
          <span className="font-semibold">
            {profile.boilTimeMin}min
          </span>
        </div>
        <div>
          <span className="text-muted">Mash Eff:</span>{' '}
          <span className="font-semibold">
            {profile.mashEfficiency}%
          </span>
        </div>
        <div>
          <span className="text-muted">BH Eff:</span>{' '}
          <span className="font-semibold">
            {profile.brewhouseEfficiency}%
          </span>
        </div>
      </div>
    </button>
  );
};
