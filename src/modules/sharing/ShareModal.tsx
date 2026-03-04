'use client';

import { useState } from 'react';
import ModalOverlay from '../beta-builder/presentation/components/ModalOverlay';
import Button from '../../components/Button';
import { auth } from '@/config/firebase';
import { toast } from '../../stores/toastStore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeId: string;
  recipeName: string;
  isPublic: boolean;
  shareSlug?: string;
  onPublished: (slug: string) => void;
  onUnpublished: () => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  recipeId,
  recipeName,
  isPublic,
  shareSlug,
  onPublished,
  onUnpublished,
}: ShareModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareSlug
    ? `${window.location.origin}/r/${shareSlug}`
    : '';

  async function getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
      toast.error('You must be signed in to share recipes');
      return null;
    }
    return user.getIdToken();
  }

  async function handlePublish() {
    const token = await getAuthToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish');
      }

      const { slug } = await res.json();
      onPublished(slug);
      toast.success('Recipe published! Share the link with anyone.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish recipe');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnpublish() {
    const token = await getAuthToken();
    if (!token) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/unpublish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to unpublish');
      }

      onUnpublished();
      toast.success('Recipe is now private');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unpublish recipe');
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="md">
      <div className="p-6 space-y-5">
        <h2 id="share-modal-title" className="text-lg font-bold text-[var(--fg-strong)]">
          {isPublic ? 'Recipe Shared' : 'Share Recipe'}
        </h2>

        {isPublic ? (
          /* Published state */
          <div className="space-y-4">
            <p className="text-sm text-[var(--fg-muted)]">
              <strong>{recipeName}</strong> is public. Anyone with the link can view it.
            </p>

            {/* Share URL */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="brew-input flex-1 text-sm"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnpublish}
                loading={isLoading}
                className="text-red-600 dark:text-red-400"
              >
                Unshare
              </Button>
              <Button variant="tonal" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Unpublished state */
          <div className="space-y-4">
            <p className="text-sm text-[var(--fg-muted)]">
              Make <strong>{recipeName}</strong> public? Anyone with the link will be able
              to view and fork this recipe.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="neon"
                size="sm"
                onClick={handlePublish}
                loading={isLoading}
              >
                Publish
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
