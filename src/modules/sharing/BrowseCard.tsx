'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { uid } from '@/utils/uid';
import { srmToRgb } from '../beta-builder/utils/srmColorUtils';
import { findSeedRecipe } from '@/data/seed-recipes';
import {
  downloadTextFile,
  generateBeerXml,
  generateRecipeMarkdown,
  sanitizeFileName,
} from '../beta-builder/presentation/utils/recipeExport';
import { RecipeCalculationService } from '../beta-builder/domain/services/RecipeCalculationService';
import { useAuthStore } from '../auth/authStore';
import { useUserTier } from '../auth/useUserTier';
import { canAccess } from '../auth/tierAccess';
import UpgradeModal from '../auth/components/UpgradeModal';
import { toast } from '../../stores/toastStore';
import ScalableText from '@/components/ScalableText';
import type { Recipe } from '../beta-builder/domain/models/Recipe';

const calcService = new RecipeCalculationService();

export type BrowseRecipe = {
  id: string;
  name: string;
  style: string;
  ownerName: string;
  ownerId?: string;
  shareSlug: string;
  stats: { og?: number; fg?: number; ibu?: number; srm?: number; abv?: number };
  tags: string[];
  hopNames: string[];
  publishedAt: string;
  forkCount: number;
  ratingAvg?: number;
  ratingCount?: number;
  source?: 'official' | 'community';
  labelUrl?: string;
};

export function BrowseCard({
  recipe,
  isNavigating,
  onNavigate,
}: {
  recipe: BrowseRecipe;
  isNavigating?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const srmColor = recipe.stats.srm != null ? srmToRgb(recipe.stats.srm) : 'rgb(220, 190, 140)';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const { userState } = useUserTier();
  const exportAllowed = canAccess('export', userState);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  /** Fetch the full Recipe object (seed or Firestore). */
  async function getFullRecipe(): Promise<Recipe | null> {
    if (recipe.source === 'official') {
      return findSeedRecipe(recipe.id) ?? null;
    }
    const snap = await getDoc(doc(db, 'recipes', recipe.id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Recipe;
  }

  async function handleFork(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);

    if (!user) {
      try { await signInWithGoogle(); } catch { return; }
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    setIsBusy(true);
    try {
      const full = await getFullRecipe();
      if (!full) { toast.error('Could not load recipe'); return; }

      const now = new Date().toISOString();
      const newId = uid();

      // Strip owner/sharing fields
      const { isPublic: _, shareSlug: _s, publishedAt: _p, ownerId: _o, ...fields } =
        full as Recipe & { ownerId?: string };

      const forkedData = JSON.parse(JSON.stringify({
        ...fields,
        ownerId: currentUser.uid,
        name: `${full.name} (Fork)`,
        isPublic: false,
        currentVersion: 1,
        parentRecipeId: recipe.id,
        parentVersionNumber: full.currentVersion || 1,
        parentRecipeName: full.name,
        parentRecipeOwnerName: recipe.ownerName,
        parentRecipeShareSlug: recipe.shareSlug || undefined,
        createdAt: now,
        updatedAt: now,
      }));

      await setDoc(doc(db, 'recipes', newId), forkedData);

      // Best-effort: increment fork count
      if (recipe.source !== 'official') {
        try {
          await updateDoc(doc(db, 'publicRecipeIndex', recipe.id), {
            forkCount: increment(1),
          });
        } catch { /* ok */ }
      }

      toast.success(`Forked "${recipe.name}" to your recipes`);
      router.push(`/recipes/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fork failed');
    } finally {
      setIsBusy(false);
    }
  }

  function handleCopyShareLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);

    const path = recipe.source === 'official'
      ? `/r/seed/${recipe.id}`
      : `/r/${recipe.shareSlug}`;
    navigator.clipboard.writeText(`${window.location.origin}${path}`);
    toast.success('Share link copied');
  }

  async function handleExport(
    format: 'markdown' | 'json' | 'beerxml' | 'copy-md',
    e: React.MouseEvent,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    if (!exportAllowed) { setIsUpgradeModalOpen(true); return; }
    setIsBusy(true);

    try {
      const full = await getFullRecipe();
      if (!full) { toast.error('Could not load recipe data'); return; }

      const calculations = calcService.calculate(full);
      const filename = sanitizeFileName(full.name);

      switch (format) {
        case 'markdown':
          downloadTextFile(`${filename}.md`, generateRecipeMarkdown(full, calculations));
          break;
        case 'copy-md':
          await navigator.clipboard.writeText(generateRecipeMarkdown(full, calculations));
          toast.success('Markdown copied to clipboard');
          break;
        case 'json':
          downloadTextFile(`${filename}.json`, JSON.stringify(full, null, 2), 'application/json');
          break;
        case 'beerxml':
          downloadTextFile(`${filename}.xml`, generateBeerXml(full), 'text/xml');
          break;
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div
      className={`group brew-recipe-card relative cursor-pointer overflow-visible ${isMenuOpen ? 'z-30' : 'z-10'}`}
      style={{ '--card-srm': srmColor } as React.CSSProperties}
      role="link"
      tabIndex={0}
      onClick={() => {
        onNavigate?.();
        const path = recipe.source === 'official'
          ? `/r/seed/${recipe.id}`
          : `/r/${recipe.shareSlug}`;
        router.push(path);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onNavigate?.();
          const path = recipe.source === 'official'
            ? `/r/seed/${recipe.id}`
            : `/r/${recipe.shareSlug}`;
          router.push(path);
        }
      }}
    >
      {(isNavigating || isBusy) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-[var(--brew-card)]/40">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brew-accent-300)] border-t-[var(--brew-accent-700)]" />
        </div>
      )}
      <div className="rounded-xl bg-[var(--brew-card)]" style={{ containerType: 'inline-size' }}>
        {/* SRM Color Strip */}
        <div className="h-2 w-full rounded-t-xl" style={{ backgroundColor: srmColor }} />

        {/* Header */}
        <div className="border-b border-[rgb(var(--brew-border))] p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                {recipe.labelUrl && (
                  <img
                    src={recipe.labelUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
                    loading="lazy"
                  />
                )}
                <ScalableText className="min-w-0 flex-1 font-extrabold tracking-tight" minScale={0.75} maxLines={2} style={{ fontSize: 'clamp(1rem, calc(8px + 3cqw), 1.5rem)' }}>
                  {recipe.name}
                </ScalableText>
                {recipe.source === 'official' && (
                  <span className="mt-1 shrink-0 rounded-full bg-[var(--brew-accent-200)] py-0.5 font-bold uppercase tracking-wider text-[var(--brew-accent-700)]" style={{ fontSize: 'clamp(6px, calc(4px + 1cqw), 10px)', padding: '2px clamp(4px, calc(2px + 0.8cqw), 8px)' }}>
                    Example Recipe
                  </span>
                )}
              </div>
              {recipe.style && (
                <p className="text-muted truncate text-xs italic">{recipe.style}</p>
              )}
              <p className="text-muted text-xs mt-1">
                by{' '}
                {recipe.ownerId ? (
                  <span
                    role="link"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      router.push(`/u/${recipe.ownerId}`);
                    }}
                    className="hover:underline cursor-pointer"
                  >
                    {recipe.ownerName}
                  </span>
                ) : (
                  recipe.ownerName
                )}
                {recipe.forkCount > 0 && (
                  <span className="ml-2 opacity-60">
                    {recipe.forkCount} {recipe.forkCount === 1 ? 'fork' : 'forks'}
                  </span>
                )}
              </p>
            </div>
            {/* Right column: menu + rating */}
            <div className="flex shrink-0 flex-col items-end gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              {/* Actions menu trigger */}
              <div className="relative">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMenuOpen((prev) => !prev);
                }}
                className="brew-tag shadow-sm"
                title="Recipe actions"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
              {isMenuOpen && (
                // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                <div
                  className="absolute right-0 top-full -m-4 mt-2 z-30 p-4"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onMouseLeave={() => setIsMenuOpen(false)}
                >
                  <div className="w-44 overflow-hidden rounded-lg border border-[rgb(var(--brew-border))] bg-[var(--brew-card)] shadow-lg">
                    <button
                      onClick={handleFork}
                      className="brew-menu-item w-full text-left"
                    >
                      {user ? 'Fork to My Recipes' : 'Sign in to Fork'}
                    </button>
                    <button
                      onClick={handleCopyShareLink}
                      className="brew-menu-item w-full text-left"
                    >
                      Copy Share Link
                    </button>
                    <div className="my-1 border-t border-[rgb(var(--brew-border))]" />
                    <button
                      onClick={(e) => handleExport('markdown', e)}
                      className={`brew-menu-item w-full text-left${!exportAllowed ? ' opacity-50' : ''}`}
                    >
                      Export Markdown
                    </button>
                    <button
                      onClick={(e) => handleExport('copy-md', e)}
                      className={`brew-menu-item w-full text-left${!exportAllowed ? ' opacity-50' : ''}`}
                    >
                      Copy Markdown
                    </button>
                    <button
                      onClick={(e) => handleExport('json', e)}
                      className={`brew-menu-item w-full text-left${!exportAllowed ? ' opacity-50' : ''}`}
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={(e) => handleExport('beerxml', e)}
                      className={`brew-menu-item w-full text-left${!exportAllowed ? ' opacity-50' : ''}`}
                    >
                      Export BeerXML
                    </button>
                  </div>
                </div>
              )}
              </div>

              {/* Rating — in header, right-aligned */}
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const avg = recipe.ratingAvg ?? 0;
                    const fraction = Math.min(1, Math.max(0, avg - (star - 1)));
                    const pct = Math.round(fraction * 100);
                    const gradientId = `star-${recipe.id}-${star}`;
                    return (
                      <svg
                        key={star}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {pct > 0 && pct < 100 && (
                          <defs>
                            <linearGradient id={gradientId}>
                              <stop offset={`${pct}%`} stopColor="var(--brew-accent-500)" />
                              <stop offset={`${pct}%`} stopColor="transparent" />
                            </linearGradient>
                          </defs>
                        )}
                        <polygon
                          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                          fill={
                            pct === 100
                              ? 'var(--brew-accent-500)'
                              : pct > 0
                              ? `url(#${gradientId})`
                              : 'none'
                          }
                          stroke={
                            pct > 0 ? 'var(--brew-accent-500)' : 'var(--brew-accent-300)'
                          }
                        />
                      </svg>
                    );
                  })}
                </div>
                {(recipe.ratingCount ?? 0) > 0 ? (
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--brew-accent-700)' }}>
                    {(recipe.ratingAvg ?? 0).toFixed(1)}
                    <span className="ml-1 font-normal text-[var(--fg-muted)]">
                      ({recipe.ratingCount})
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-[var(--fg-muted)] opacity-50">No ratings</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-0 px-4 py-3">
          <div className="pr-2">
            <div className="brew-gauge-label text-[10px]">ABV</div>
            <div
              className="font-handwritten-alt text-sm tabular-nums"
              style={{ color: 'var(--brew-accent-700)' }}
            >
              {recipe.stats.abv != null ? `${recipe.stats.abv.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
            <div className="brew-gauge-label text-[10px]">IBU</div>
            <div className="font-handwritten-alt text-sm tabular-nums">
              {recipe.stats.ibu != null ? recipe.stats.ibu : '—'}
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
            <div className="brew-gauge-label text-[10px]">SRM</div>
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: srmColor }}
              />
              <span className="font-handwritten-alt text-sm tabular-nums">
                {recipe.stats.srm != null ? Math.round(recipe.stats.srm) : '—'}
              </span>
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] px-2">
            <div className="brew-gauge-label text-[10px]">OG</div>
            <div className="font-handwritten-alt text-sm tabular-nums">
              {recipe.stats.og != null ? recipe.stats.og.toFixed(3) : '—'}
            </div>
          </div>
          <div className="border-l border-[color-mix(in_oklch,var(--brew-accent-200)_25%,transparent)] pl-2">
            <div className="brew-gauge-label text-[10px]">FG</div>
            <div className="font-handwritten-alt text-sm tabular-nums">
              {recipe.stats.fg != null ? recipe.stats.fg.toFixed(3) : '—'}
            </div>
          </div>
        </div>

        {/* Tags */}
        {recipe.tags.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap gap-1">
              {recipe.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="brew-tag">
                  {tag}
                </span>
              ))}
              {recipe.tags.length > 3 && (
                <span className="brew-tag">+{recipe.tags.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="rounded-b-xl border-t border-[rgb(var(--brew-border))] bg-[var(--brew-card-inset)] p-3">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>
              {recipe.publishedAt
                ? new Date(recipe.publishedAt).toISOString().slice(0, 10)
                : ''}
            </span>
            {(recipe.forkCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 opacity-60">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="18" r="3" />
                  <circle cx="6" cy="6" r="3" />
                  <circle cx="18" cy="6" r="3" />
                  <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
                  <path d="M12 12v3" />
                </svg>
                {recipe.forkCount} {recipe.forkCount === 1 ? 'fork' : 'forks'}
              </span>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        reason="Export is a Premium feature."
      />
    </div>
  );
}
