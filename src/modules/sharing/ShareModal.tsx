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
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${shareSlug}`
    : '';

  async function getAuthToken(): Promise<string | null> {
    const user = auth.currentUser;
    if (!user) {
      toast.error('You must be signed in to share recipes');
      return null;
    }
    return user.getIdToken();
  }

  async function handleMakePublic() {
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
        let errorMsg = 'Failed to publish';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Response wasn't JSON — use status text
          errorMsg = `Server error (${res.status})`;
        }
        throw new Error(errorMsg);
      }

      let slug: string;
      try {
        const data = await res.json();
        slug = data.slug;
      } catch {
        throw new Error('Invalid response from server');
      }

      onPublished(slug);
      toast.success('Recipe is now public!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish recipe');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMakePrivate() {
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
        let errorMsg = 'Failed to make private';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = `Server error (${res.status})`;
        }
        throw new Error(errorMsg);
      }

      onUnpublished();
      toast.success('Recipe is now private');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to make recipe private');
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
          Share Recipe
        </h2>

        {isPublic && shareSlug ? (
          /* Public — show the link */
          <div className="space-y-4">
            <p className="text-sm text-[var(--fg-muted)]">
              <strong>{recipeName}</strong> is public. Anyone with the link can view it.
            </p>

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

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMakePrivate}
                loading={isLoading}
                className="text-red-600 dark:text-red-400"
              >
                Make Private
              </Button>
              <Button variant="tonal" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* Private — offer to make public */
          <div className="space-y-4">
            <p className="text-sm text-[var(--fg-muted)]">
              <strong>{recipeName}</strong> is private. Make it public to get a shareable link.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="neon"
                size="sm"
                onClick={handleMakePublic}
                loading={isLoading}
              >
                Make Public
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
