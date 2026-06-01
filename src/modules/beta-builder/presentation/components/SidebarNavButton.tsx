"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { publishRecipe, unpublishRecipe } from "../../../sharing/publishService";
import { generateShareSlug } from "../../../sharing/slugUtils";
import { useRecipeStore } from "../stores/recipeStore";
import { toast } from "../../../../stores/toastStore";
import type { Recipe } from "../../domain/models/Recipe";

interface SidebarNavButtonProps {
  backPath: string;
  backLabel: string;
  /**
   * Optional override for the back-button click. When provided, this runs
   * instead of `router.push(backPath)` — the recipe editor uses this to route
   * navigation through the unsaved-changes guard.
   */
  onBackClick?: () => void;
  showShareControl?: boolean;
  isPublic?: boolean;
  shareSlug?: string;
  recipeName?: string;
  recipeId?: string;
  onPublished?: (slug: string) => void;
  onUnpublished?: () => void;
}

export default function SidebarNavButton({
  backPath,
  backLabel,
  onBackClick,
  showShareControl,
  isPublic,
  shareSlug,
  recipeId,
  onPublished,
  onUnpublished,
}: SidebarNavButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  const shareUrl = shareSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${shareSlug}`
    : "";

  function toggleDropdown() {
    if (!dropdownOpen && statusRef.current) {
      const rect = statusRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left });
    }
    setDropdownOpen(!dropdownOpen);
  }

  // Click outside + Escape to close
  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  async function handleMakePublic() {
    if (!recipeId) return;
    setIsLoading(true);
    try {
      const recipes = useRecipeStore.getState().recipes;
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) throw new Error("Recipe not found");

      const slug = recipe.shareSlug || generateShareSlug(recipe.name);
      const now = new Date().toISOString();

      const recipeToPublish: Recipe = {
        ...recipe,
        isPublic: true,
        shareSlug: slug,
        publishedAt: recipe.publishedAt || now,
      };

      await publishRecipe(recipeToPublish);
      onPublished?.(slug);
      toast.success("Recipe is now public!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish recipe");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMakePrivate() {
    if (!recipeId) return;
    setIsLoading(true);
    try {
      await unpublishRecipe(recipeId);
      onUnpublished?.();
      toast.success("Recipe is now private");
      setDropdownOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to make recipe private");
    } finally {
      setIsLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  const dropdown = dropdownOpen ? createPortal(
    <div
      ref={dropdownRef}
      className="sidebar-nav-dropdown"
      style={{ position: "fixed", top: dropdownPos.top, left: dropdownPos.left }}
    >
      <div className="sidebar-nav-dropdown-status">
        <span className={`sidebar-nav-dot ${isPublic ? "is-public" : "is-private"}`} />
        <span>{isPublic ? "Shared" : "Private"}</span>
      </div>

      {isPublic && shareSlug && (
        <div className="sidebar-nav-dropdown-link">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="brew-input text-xs"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button onClick={handleCopy} className="sidebar-nav-copy-btn">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}

      <button
        className="sidebar-nav-toggle-btn"
        onClick={isPublic ? handleMakePrivate : handleMakePublic}
        disabled={isLoading}
      >
        {isLoading ? "Updating..." : isPublic ? "Make Private" : "Make Public"}
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={containerRef} className="sidebar-nav-button-wrapper" style={{ pointerEvents: "auto" }}>
      <div className="sidebar-nav-button brew-btn-ghost">
        {/* Left region: navigation */}
        <button
          className="sidebar-nav-back"
          onClick={onBackClick ?? (() => router.push(backPath))}
        >
          <span className="sidebar-nav-arrow">&#8592;</span>
          <span className="sidebar-nav-label">{backLabel}</span>
        </button>

        {showShareControl && (
          <>
            <span className="sidebar-nav-divider" />
            <button
              ref={statusRef}
              className="sidebar-nav-status"
              onClick={toggleDropdown}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              title={isPublic ? "Public — click to manage sharing" : "Private — click to share"}
            >
              <span className={`sidebar-nav-dot ${isPublic ? "is-public" : "is-private"}`} />
            </button>
          </>
        )}
      </div>
      {dropdown}
    </div>
  );
}
