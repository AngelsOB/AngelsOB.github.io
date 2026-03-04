'use client';

import { useState } from 'react';
import ModalOverlay from '../beta-builder/presentation/components/ModalOverlay';
import Button from '../../components/Button';
import { toast } from '../../stores/toastStore';
import { publishRecipe, unpublishRecipe } from './publishService';
import { useRecipeStore } from '../beta-builder/presentation/stores/recipeStore';
import { generateShareSlug } from './slugUtils';
import type { Recipe } from '../beta-builder/domain/models/Recipe';

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

  async function handleMakePublic() {
    setIsLoading(true);
    try {
      const recipes = useRecipeStore.getState().recipes;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) throw new Error('Recipe not found');

      const slug = recipe.shareSlug || generateShareSlug(recipe.name);
      const now = new Date().toISOString();

      const recipeToPublish: Recipe = {
        ...recipe,
        isPublic: true,
        shareSlug: slug,
        publishedAt: recipe.publishedAt || now,
      };

      await publishRecipe(recipeToPublish);
      onPublished(slug);
      toast.success('Recipe is now public!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish recipe');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMakePrivate() {
    setIsLoading(true);
    try {
      await unpublishRecipe(recipeId);
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
