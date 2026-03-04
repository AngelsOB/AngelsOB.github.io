'use client';

/**
 * Version History Modal
 *
 * Displays the version history tree for a recipe
 * Shows all versions with timestamps, change notes, and restore capability
 */

import { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import type { Recipe, RecipeVersion } from '../../domain/models/Recipe';
import type { BrewSession } from '../../domain/models/BrewSession';
import { useRecipeStore } from '../stores/recipeStore';
import { recipeRepository } from '../../domain/repositories/RecipeRepository';
import { brewSessionRepository } from '../../domain/repositories/BrewSessionRepository';
import Button from '@components/Button';
import ModalOverlay from './ModalOverlay';

interface VersionHistoryModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
}

interface TreeNode {
  version: RecipeVersion | 'current';
  children: TreeNode[];
  variations: Recipe[];
}

export default function VersionHistoryModal({ recipe, isOpen, onClose }: VersionHistoryModalProps) {
  const router = useRouter();
  const { loadVersionHistory } = useRecipeStore();
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [sessions, setSessions] = useState<BrewSession[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    const history = loadVersionHistory(recipe.id);
    setVersions(history);

    // Load all recipes to find variations
    const all = recipeRepository.loadAll();
    setAllRecipes(all);
    // Load sessions for this recipe
    const recipeSessions = brewSessionRepository.loadByRecipeId(recipe.id);
    setSessions(recipeSessions);
  }, [recipe.id, loadVersionHistory, isOpen]);

  // Build tree structure
  const buildTree = (): TreeNode => {
    const sortedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);

    // Find variations that branched from this recipe
    const variations = allRecipes.filter(r => r.parentRecipeId === recipe.id);

    // Group variations by the version they forked from
    const variationsByVersion = new Map<number, Recipe[]>();
    for (const variation of variations) {
      if (variation.parentVersionNumber) {
        const existing = variationsByVersion.get(variation.parentVersionNumber) || [];
        existing.push(variation);
        variationsByVersion.set(variation.parentVersionNumber, existing);
      }
    }

    const root: TreeNode = {
      version: 'current',
      children: [],
      variations: variationsByVersion.get(recipe.currentVersion) || []
    };

    // Build linear chain of versions
    let currentNode = root;
    for (let i = sortedVersions.length - 1; i >= 0; i--) {
      const version = sortedVersions[i];
      const node: TreeNode = {
        version,
        children: [],
        variations: variationsByVersion.get(version.versionNumber) || []
      };
      currentNode.children.push(node);
      currentNode = node;
    }

    return root;
  };

  const tree = buildTree();

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isCurrent = node.version === 'current';
    const version = node.version === 'current' ? null : node.version;

    return (
      <div key={isCurrent ? 'current' : version?.id}>
        {/* Main version node */}
        <div className="flex items-start gap-3">
          {/* Vertical line connector */}
          {depth > 0 && (
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-[rgb(var(--brew-border-subtle))]" />
            </div>
          )}

          {/* Version card */}
          <div className="flex-1">
            {isCurrent ? (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div>
                      <div className="font-semibold text-green-700 dark:text-green-400">
                        Version {recipe.currentVersion} (Current)
                      </div>
                      <div className="text-sm text-muted">
                        Last updated: {new Date(recipe.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                className="mb-4 p-4 border border-[rgb(var(--brew-border-subtle))] rounded-lg hover:shadow-md hover:border-[var(--brew-accent-400)] transition-all bg-[rgb(var(--brew-card)/0.6)] cursor-pointer"
                onClick={() => {
                  router.push(`/recipes/${recipe.id}/versions/${version!.versionNumber}`);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    router.push(`/recipes/${recipe.id}/versions/${version!.versionNumber}`);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <div className="flex-1">
                      <div className="font-semibold text-blue-700 dark:text-blue-400">
                        Version {version!.versionNumber}
                      </div>
                      <div className="text-sm text-muted">
                        {new Date(version!.createdAt).toLocaleString()}
                      </div>
                      {version!.changeNotes && (
                        <div className="text-sm mt-1">
                          {version!.changeNotes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-muted">
                    Click to view →
                  </div>
                </div>
              </div>
            )}

            {/* Brew sessions tied to this version */}
            {(() => {
              const versionNumber = isCurrent ? recipe.currentVersion : version!.versionNumber;
              const versionSessions = sessions.filter(
                (session) => session.recipeVersionNumber === versionNumber
              );
              if (versionSessions.length === 0) {
                return null;
              }

              return (
                <div className="ml-8 mb-4">
                  <div className="text-xs uppercase tracking-wide text-muted mb-2">
                    Brew Sessions ({versionSessions.length})
                  </div>
                  <div className="space-y-2">
                    {versionSessions.map((session) => (
                      <div
                        key={session.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => router.push(`/recipes/sessions/${session.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            router.push(`/recipes/sessions/${session.id}`);
                          }
                        }}
                        className="p-3 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50 dark:bg-amber-900/20 cursor-pointer hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium">
                              {new Date(session.brewDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted">
                              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                            </div>
                          </div>
                          <div className="text-xs text-muted">
                            OG {session.actuals.originalGravity?.toFixed(3) ?? '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Show variations that branched from this version */}
            {node.variations.length > 0 && (
              <div className="ml-8 mb-4">
                {node.variations.map((variation) => (
                  <div key={variation.id} className="relative mb-3">
                    {/* Branch connector */}
                    <div className="absolute -left-8 top-1/2 w-8 h-px bg-purple-300 dark:bg-purple-600" />
                    <div className="absolute -left-8 top-1/2 w-2 h-2 rounded-full bg-purple-500 -translate-y-1/2" />

                    <div className="p-3 border-2 border-purple-300 dark:border-purple-700 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-4 h-4 text-purple-600 dark:text-purple-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <div>
                          <div className="font-semibold text-purple-700 dark:text-purple-400">
                            {variation.name}
                          </div>
                          <div className="text-xs text-muted">
                            Variation (v{variation.currentVersion}) • Created {new Date(variation.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Render children (previous versions) */}
        {node.children.map((child) => (
          <div key={child.version === 'current' ? 'current' : (child.version as RecipeVersion).id} className="ml-6">
            {renderTreeNode(child, depth + 1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} size="3xl">
        {/* Header */}
        <div className="p-6 border-b border-[rgb(var(--brew-border-subtle))] flex items-center justify-between">
          <div>
            <h3 id="modal-title" className="text-xl font-semibold">Version History: {recipe.name}</h3>
            {recipe.parentRecipeId && (
              <p className="text-sm text-muted mt-1">
                Variation of: {allRecipes.find(r => r.id === recipe.parentRecipeId)?.name || 'Unknown'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted hover:text-[var(--fg-strong)] transition-colors"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Version Tree */}
          {versions.length === 0 && tree.variations.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p>No version history yet.</p>
              <p className="text-sm mt-2">
                Versions will appear here when you create new versions of this recipe.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {renderTreeNode(tree)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[rgb(var(--brew-border-subtle))] flex justify-end">
          <Button variant="neon" onClick={onClose}>
            Close
          </Button>
        </div>
    </ModalOverlay>
  );
}
