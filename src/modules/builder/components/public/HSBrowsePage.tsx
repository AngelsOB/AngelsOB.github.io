"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  collection,
  query,
  orderBy,
  getDocs,
  getDocsFromCache,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "@/config/firebase";

import { hsTokens } from "../../tokens";
import HSButton from "../HSButton";
import HSCard from "../HSCard";
import HSScriptNote from "../HSScriptNote";
import HSBrowseCard, { type BrowseRecipe } from "./HSBrowseCard";
import HSPreviewColumn from "./HSPreviewColumn";
import { cardPathFor, loadFullPublicRecipe } from "./loadFullPublicRecipe";
import { usePreviewState } from "./usePreviewState";
import { useCanPreview, usePreviewWidth } from "./usePreviewLayout";

type SortOption = "newest" | "popular" | "top-rated";
const MAX_COMPARE = 8;
const TILT_CYCLE = [-0.6, 0.5, -0.4, 0.7, -0.3, 0.6];

interface Props {
  initialRecipes: BrowseRecipe[];
}

function mapDocs(docs: QueryDocumentSnapshot<DocumentData>[]): BrowseRecipe[] {
  return docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name || "",
      subtitle: data.subtitle || undefined,
      style: data.style || "",
      ownerName: data.ownerName || "Anonymous Brewer",
      ownerId: data.ownerId || "",
      shareSlug: data.shareSlug || "",
      stats: data.stats || {},
      tags: data.tags || [],
      hopNames: data.hopNames || [],
      publishedAt: data.publishedAt || "",
      forkCount: data.forkCount || 0,
      ratingSum: data.ratingSum || 0,
      ratingCount: data.ratingCount || 0,
      ratingAvg: data.ratingCount > 0 ? (data.ratingSum || 0) / data.ratingCount : 0,
      labelUrl: data.labelUrl || undefined,
      source: data.source,
    } as BrowseRecipe;
  });
}

const controlInputStyle: React.CSSProperties = {
  fontFamily: hsTokens.body,
  fontSize: 13,
  fontWeight: 500,
  background: hsTokens.paper,
  color: hsTokens.ink,
  border: `2px solid ${hsTokens.ink}`,
  borderRadius: 999,
  padding: "9px 16px",
  outline: "none",
};

export default function HSBrowsePage({ initialRecipes }: Props) {
  const router = useRouter();
  const [recipes, setRecipes] = useState<BrowseRecipe[]>(initialRecipes);
  const [isLoading, setIsLoading] = useState(initialRecipes.length === 0);
  const [sort, setSort] = useState<SortOption>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const canPreview = useCanPreview();
  const prefersReducedMotion = useReducedMotion();
  const previewWidth = usePreviewWidth();
  const preview = usePreviewState({ canPreview, disabled: compareMode });
  const previewSelectedId = preview.selection?.id;

  const handlePreviewSelect = useCallback(
    (r: BrowseRecipe) => {
      void preview.handleSelect({
        id: r.id,
        openHref: cardPathFor(r),
        loadFull: () => loadFullPublicRecipe(r),
      });
    },
    [preview],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCompare = useCallback(() => {
    if (selectedIds.size < 2) return;
    router.push(`/browse/compare?ids=${Array.from(selectedIds).join(",")}`);
  }, [selectedIds, router]);

  const fetchRecipes = useCallback(async () => {
    setError(null);
    const q = query(collection(db, "publicRecipeIndex"), orderBy("publishedAt", "desc"));
    try {
      const cachedSnapshot = await getDocsFromCache(q);
      if (!cachedSnapshot.empty) {
        setRecipes(mapDocs(cachedSnapshot.docs));
        setIsLoading(false);
      }
    } catch {
      /* cache miss */
    }
    try {
      if (recipes.length === 0) setIsLoading(true);
      const snapshot = await getDocs(q);
      setRecipes(mapDocs(snapshot.docs));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes. Please try again.");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const allRecipes = useMemo(() => {
    const sorted = [...recipes].sort((a, b) => {
      if (sort === "top-rated") {
        const diff = (b.ratingAvg || 0) - (a.ratingAvg || 0);
        if (diff !== 0) return diff;
        return (b.ratingCount || 0) - (a.ratingCount || 0);
      }
      if (sort === "popular") return (b.forkCount || 0) - (a.forkCount || 0);
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return sorted;
  }, [recipes, sort]);

  const availableStyles = useMemo(() => {
    const styles = new Set<string>();
    for (const r of allRecipes) {
      if (r.style) styles.add(r.style);
    }
    return Array.from(styles).sort();
  }, [allRecipes]);

  const filteredRecipes = useMemo(() => {
    let result = allRecipes;
    if (styleFilter) {
      result = result.filter((r) => r.style === styleFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.style.toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.hopNames.some((h) => h.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [allRecipes, searchQuery, styleFilter]);

  const showSkeleton = isLoading && !error && recipes.length === 0;
  const showEmpty = !isLoading && !error && allRecipes.length === 0;
  const showNoResults =
    !isLoading && !error && allRecipes.length > 0 && filteredRecipes.length === 0;
  const showGrid = !error && filteredRecipes.length > 0;

  return (
    <section
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <HSScriptNote color={hsTokens.water} size={22}>
          your brewing —
        </HSScriptNote>
        <h1
          style={{
            margin: "6px 0 0",
            fontFamily: hsTokens.display,
            fontSize: "clamp(44px, 6vw, 80px)",
            letterSpacing: "-0.035em",
            lineHeight: 0.95,
          }}
        >
          Browse recipes.
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: hsTokens.body,
            fontSize: 14,
            color: hsTokens.muted,
            maxWidth: 540,
          }}
        >
          Search the community, fork what looks good, and compare side-by-side.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, style, brewer, hops, or tags…"
          aria-label="Search recipes"
          style={{ ...controlInputStyle, flex: "1 1 280px", minWidth: 220 }}
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: hsTokens.muted,
            }}
          >
            Style
          </span>
          <select
            value={styleFilter}
            onChange={(e) => setStyleFilter(e.target.value)}
            style={controlInputStyle}
          >
            <option value="">All</option>
            {availableStyles.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: hsTokens.muted,
            }}
          >
            Sort
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            style={controlInputStyle}
          >
            <option value="newest">Newest</option>
            <option value="top-rated">Top rated</option>
            <option value="popular">Most forked</option>
          </select>
        </label>
        <HSButton
          variant={compareMode ? "solid" : "ghost"}
          color={hsTokens.water}
          size="sm"
          onClick={() => {
            const next = !compareMode;
            setCompareMode(next);
            if (!next) setSelectedIds(new Set());
          }}
        >
          Compare
        </HSButton>
      </div>

      {error ? (
        <HSCard shadow={2} accent={hsTokens.roast} padding={24}>
          <div
            style={{
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.ink,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
          <HSButton variant="ghost" size="sm" onClick={fetchRecipes}>
            Retry
          </HSButton>
        </HSCard>
      ) : null}

      {showSkeleton ? (
        <div
          className="hs-browse-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 20,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <HSCard key={i} shadow={2} padding={0} style={{ overflow: "hidden" }}>
              <div style={{ height: 14, background: hsTokens.cream2 }} />
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <div
                  style={{
                    height: 22,
                    width: "70%",
                    background: hsTokens.cream2,
                    borderRadius: 4,
                    animation: "hs-pulse 1.4s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    height: 14,
                    width: "45%",
                    background: hsTokens.cream2,
                    borderRadius: 4,
                    animation: "hs-pulse 1.4s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    marginTop: 8,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                  }}
                >
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div
                      key={j}
                      style={{
                        height: 44,
                        background: hsTokens.cream2,
                        borderRadius: 6,
                        animation: "hs-pulse 1.4s ease-in-out infinite",
                      }}
                    />
                  ))}
                </div>
              </div>
            </HSCard>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <HSCard shadow={2} padding={32} style={{ textAlign: "center" }}>
          <HSScriptNote color={hsTokens.water} size={20}>
            empty shelf —
          </HSScriptNote>
          <div
            style={{
              marginTop: 8,
              fontFamily: hsTokens.display,
              fontSize: 28,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            No public recipes yet
          </div>
          <p
            style={{
              marginTop: 8,
              fontFamily: hsTokens.body,
              fontSize: 14,
              color: hsTokens.muted,
            }}
          >
            Be the first to share a recipe with the community.
          </p>
        </HSCard>
      ) : null}

      {showNoResults ? (
        <HSCard shadow={2} padding={32} style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 24,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            No matches for &ldquo;{searchQuery}&rdquo;
          </div>
          <p
            style={{
              marginTop: 8,
              fontFamily: hsTokens.body,
              fontSize: 13,
              color: hsTokens.muted,
            }}
          >
            Try a different search term, or clear the filters.
          </p>
          <div style={{ marginTop: 16 }}>
            <HSButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStyleFilter("");
              }}
            >
              Clear search
            </HSButton>
          </div>
        </HSCard>
      ) : null}

      {showGrid ? (
        <div
          className="hs-preview-shell hs-browse-shell"
          data-preview-open={previewSelectedId && canPreview ? "true" : "false"}
        >
          <div
            className="hs-browse-grid"
            data-preview-open={previewSelectedId && canPreview ? "true" : "false"}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 20,
              minWidth: 0,
              flex: 1,
            }}
          >
            {filteredRecipes.map((recipe, idx) => (
              <motion.div
                key={recipe.id}
                layout
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 260,
                        damping: 30,
                        mass: 0.8,
                      }
                }
                style={{ minWidth: 0 }}
              >
                <HSBrowseCard
                  recipe={recipe}
                  isNavigating={navigatingId === recipe.id}
                  onNavigate={() => setNavigatingId(recipe.id)}
                  compareMode={compareMode}
                  isSelected={selectedIds.has(recipe.id)}
                  onToggleSelect={toggleSelect}
                  tilt={TILT_CYCLE[idx % TILT_CYCLE.length]}
                  previewMode={canPreview && !compareMode}
                  isPreviewSelected={previewSelectedId === recipe.id}
                  anyPreviewSelected={!!previewSelectedId}
                  onPreviewSelect={handlePreviewSelect}
                />
              </motion.div>
            ))}
          </div>
          <HSPreviewColumn
            open={!!previewSelectedId && canPreview}
            full={preview.full}
            loading={preview.loading}
            error={preview.error}
            cardPath={preview.selection?.openHref ?? ""}
            previewWidth={previewWidth}
            onClose={preview.handleClose}
            onRetry={preview.handleRetry}
          />
        </div>
      ) : null}

      {compareMode && selectedIds.size >= 1 ? (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
        >
          <HSCard shadow={4} padding="14px 22px" bg={hsTokens.paper}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                  color: hsTokens.ink,
                }}
              >
                {selectedIds.size} recipe{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <HSButton variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear
              </HSButton>
              <HSButton
                variant="solid"
                color={hsTokens.water}
                size="sm"
                disabled={selectedIds.size < 2}
                onClick={handleCompare}
              >
                {selectedIds.size < 2
                  ? `Compare (${2 - selectedIds.size} more)`
                  : "Compare"}
              </HSButton>
            </div>
          </HSCard>
        </div>
      ) : null}

      <style>{`
        .hs-browse-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .hs-browse-grid[data-preview-open="true"] {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        @media (max-width: 1024px) {
          .hs-browse-grid,
          .hs-browse-grid[data-preview-open="true"] { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .hs-browse-grid,
          .hs-browse-grid[data-preview-open="true"] { grid-template-columns: 1fr !important; }
        }
        @keyframes hs-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .hs-preview-shell[data-preview-open="true"] .hs-browse-card-title {
          font-size: 18px !important;
        }
      `}</style>
    </section>
  );
}
