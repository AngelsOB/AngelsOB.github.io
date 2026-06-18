"use client";

import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import HSPreviewColumn from "@/modules/builder/components/public/HSPreviewColumn";
import { usePreviewState } from "@/modules/builder/components/public/usePreviewState";
import {
  useCanPreview,
  usePreviewWidth,
} from "@/modules/builder/components/public/usePreviewLayout";
import { loadFullPublicRecipe } from "@/modules/builder/components/public/loadFullPublicRecipe";
import type { BrowseRecipe } from "@/modules/builder/components/public/HSBrowseCard";

import MyRecentRecipes from "./MyRecentRecipes";
import HubRecipeCard, { HubRecipeCardGrid, HUB_CARD_TILTS } from "./HubRecipeCard";

interface CommunityPreview {
  id: string;
  name: string;
  subtitle?: string;
  style: string;
  ownerName: string;
  shareSlug: string;
  tags: string[];
  stats: { abv?: number; ibu?: number; og?: number; fg?: number; srm?: number };
}

interface Props {
  community: CommunityPreview[];
}

/** Client wrapper for /recipes/all. Owns the shared preview state so a click
 *  in either section (My Recent or Browse) opens the same sticky preview
 *  panel on the right. Page-level shell wraps both sections so the panel can
 *  follow scroll across the full content height. */
export default function RecipesHubClient({ community }: Props) {
  const canPreview = useCanPreview();
  const previewWidth = usePreviewWidth();
  const preview = usePreviewState({ canPreview });
  const previewSelectedId = preview.selection?.id;

  return (
    <div
      className="hs-preview-shell hs-hub-shell"
      data-preview-open={previewSelectedId && canPreview ? "true" : "false"}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <MyRecentRecipes
          previewSelectedId={previewSelectedId}
          anyPreviewSelected={!!previewSelectedId}
          previewMode={canPreview}
          onPreviewSelect={preview.handleSelect}
        />

        {/* Browse all (community section) */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: "clamp(28px, 3vw, 38px)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  color: hsTokens.ink,
                  margin: "6px 0 0",
                }}
              >
                Browse all
              </h2>
            </div>
            {community.length > 0 ? (
              <Link
                href="/browse"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: hsTokens.paper,
                  border: `1.5px solid ${hsTokens.ink}`,
                  borderRadius: 999,
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 12,
                  letterSpacing: "0.02em",
                  color: hsTokens.ink,
                  textDecoration: "none",
                }}
              >
                Browse everything
                <span aria-hidden style={{ fontSize: 14 }}>→</span>
              </Link>
            ) : null}
          </div>

          {community.length === 0 ? (
            <div
              style={{
                padding: "28px 28px",
                background: hsTokens.cream2,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 14,
                fontFamily: hsTokens.body,
                fontSize: 14,
                color: hsTokens.muted,
              }}
            >
              No public recipes yet — check back soon.
            </div>
          ) : (
            <HubRecipeCardGrid>
              {community.map((c, idx) => {
                // Adapt the page's slim CommunityPreview into the BrowseRecipe
                // shape that loadFullPublicRecipe expects (it just needs `id`,
                // `source`, `shareSlug` to choose seed-vs-Firestore).
                const browseRecipe: BrowseRecipe = {
                  id: c.id,
                  name: c.name,
                  subtitle: c.subtitle,
                  style: c.style,
                  ownerName: c.ownerName,
                  shareSlug: c.shareSlug,
                  stats: c.stats,
                  tags: c.tags,
                  hopNames: [],
                  publishedAt: "",
                  forkCount: 0,
                };
                const openHref = `/r/${c.shareSlug}`;
                return (
                  <HubRecipeCard
                    key={c.id}
                    href={openHref}
                    name={c.name}
                    subtitle={c.subtitle}
                    style={c.style}
                    ownerName={c.ownerName}
                    tags={c.tags}
                    tilt={HUB_CARD_TILTS[idx % HUB_CARD_TILTS.length]}
                    stats={c.stats}
                    previewMode={canPreview}
                    isPreviewSelected={previewSelectedId === c.id}
                    anyPreviewSelected={!!previewSelectedId}
                    onPreviewSelect={() =>
                      void preview.handleSelect({
                        id: c.id,
                        openHref,
                        loadFull: () => loadFullPublicRecipe(browseRecipe),
                      })
                    }
                  />
                );
              })}
            </HubRecipeCardGrid>
          )}
        </section>
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

      <style>{`
        .hs-hub-shell[data-preview-open="true"] .hs-hub-recipe-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .hs-hub-shell[data-preview-open="true"] .hs-browse-card-title {
          font-size: 18px !important;
        }
        /* Pack rows at the top so short grids don't space-evenly through
           the shell height (which stretches to match the preview column). */
        .hs-hub-shell .hs-hub-recipe-grid {
          align-content: start;
        }
      `}</style>
    </div>
  );
}
