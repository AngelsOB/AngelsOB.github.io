"use client";

import { useEffect, useMemo, useState } from "react";

import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSCardLift from "@/modules/hopskip/components/HSCardLift";
import HSEyebrow from "@/modules/hopskip/components/HSEyebrow";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import HSButton from "@/modules/hopskip/components/HSButton";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import type { Recipe } from "@/modules/beta-builder/domain/models/Recipe";

type SortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "abv-desc" | "ibu-desc";

const SORT_LABELS: { key: SortKey; label: string }[] = [
  { key: "date-desc", label: "Most recent" },
  { key: "date-asc", label: "Oldest first" },
  { key: "name-asc", label: "Name A→Z" },
  { key: "name-desc", label: "Name Z→A" },
  { key: "abv-desc", label: "ABV high → low" },
  { key: "ibu-desc", label: "IBU high → low" },
];

export default function HopSkipRecipes() {
  const recipes = useRecipeStore((s) => s.recipes);
  const recipesLoaded = useRecipeStore((s) => s.recipesLoaded);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);
  const deleteRecipe = useRecipeStore((s) => s.deleteRecipe);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("date-desc");
  const [pendingDelete, setPendingDelete] = useState<Recipe | null>(null);

  useEffect(() => {
    if (!recipesLoaded) loadRecipes();
  }, [recipesLoaded, loadRecipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = recipes.filter((r) => {
      if (!q) return true;
      return (
        r.name?.toLowerCase().includes(q) ||
        r.style?.toLowerCase().includes(q) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
    const withCalc = list.map((r) => ({ r, calc: recipeCalculationService.calculate(r) }));
    withCalc.sort((a, b) => {
      switch (sort) {
        case "date-desc":
          return (b.r.updatedAt ?? "").localeCompare(a.r.updatedAt ?? "");
        case "date-asc":
          return (a.r.updatedAt ?? "").localeCompare(b.r.updatedAt ?? "");
        case "name-asc":
          return (a.r.name ?? "").localeCompare(b.r.name ?? "");
        case "name-desc":
          return (b.r.name ?? "").localeCompare(a.r.name ?? "");
        case "abv-desc":
          return (b.calc.abv ?? 0) - (a.calc.abv ?? 0);
        case "ibu-desc":
          return (b.calc.ibu ?? 0) - (a.calc.ibu ?? 0);
      }
    });
    return withCalc;
  }, [recipes, query, sort]);

  const tilts = [-0.4, 0.3, -0.2, 0.5, -0.6, 0.2];

  return (
    <main>
      {/* Title bar */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) 20px",
        }}
      >
        <HSScriptNote color={hsTokens.hops} size={24} rotate={-3}>
          your brewing —
        </HSScriptNote>
        <h1
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(40px, 6vw, 88px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.92,
            margin: "10px 0 0",
            color: hsTokens.ink,
          }}
        >
          <span
            style={{
              background: hsTokens.malt,
              padding: "0 0.18em",
              display: "inline-block",
              transform: "rotate(-1.5deg)",
              border: `2px solid ${hsTokens.ink}`,
              boxShadow: hsTokens.sh1,
            }}
          >
            Recipes
          </span>
        </h1>

        <div
          className="hs-recipes-actions"
          style={{
            marginTop: 28,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
          }}
        >
          <HSButton href="/recipes/new" variant="ink" color={hsTokens.hops} arrow>
            + New recipe
          </HSButton>
          <div
            style={{
              flex: 1,
              minWidth: 200,
              position: "relative",
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, style, or tag…"
              style={{
                width: "100%",
                padding: "10px 16px",
                background: hsTokens.paper,
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 999,
                fontFamily: hsTokens.body,
                fontSize: 14,
                color: hsTokens.ink,
                outline: "none",
              }}
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{
              padding: "10px 14px",
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 999,
              fontFamily: hsTokens.body,
              fontSize: 13,
              color: hsTokens.ink,
              cursor: "pointer",
            }}
          >
            {SORT_LABELS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <HSScriptNote color={hsTokens.muted} size={18} rotate={-3}>
            {recipes.length} saved
          </HSScriptNote>
        </div>
      </section>

      {/* Grid */}
      <section
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "20px clamp(20px, 4vw, 56px) clamp(48px, 8vw, 96px)",
        }}
      >
        {recipes.length === 0 ? (
          <HSCard shadow={3} padding="32px 28px" style={{ maxWidth: 560, margin: "32px auto", textAlign: "center" }}>
            <HSScriptNote color={hsTokens.yeast} size={22}>
              no recipes yet —
            </HSScriptNote>
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 30,
                letterSpacing: "-0.035em",
                margin: "10px 0 8px",
              }}
            >
              Start with a blank one.
            </div>
            <p style={{ fontSize: 14, color: hsTokens.muted, lineHeight: 1.5, margin: "0 0 18px" }}>
              Or bring in an existing BeerXML or JSON from the classic builder.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <HSButton href="/recipes/new" variant="ink" color={hsTokens.hops} arrow>
                Start a recipe
              </HSButton>
              <HSButton href="/recipes" variant="ghost">
                Open classic builder
              </HSButton>
            </div>
          </HSCard>
        ) : filtered.length === 0 ? (
          <HSCard shadow={2} padding="24px 24px" style={{ maxWidth: 460, margin: "32px auto", textAlign: "center" }}>
            <HSEyebrow>no matches</HSEyebrow>
            <div style={{ fontFamily: hsTokens.display, fontSize: 22, marginTop: 6 }}>
              Nothing matched &ldquo;{query}&rdquo;.
            </div>
            <p style={{ fontSize: 13, color: hsTokens.muted, marginTop: 8 }}>
              Try a shorter term, or clear the search.
            </p>
          </HSCard>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 22,
            }}
          >
            {filtered.map((entry, idx) => {
              const { r, calc } = entry;
              const tilt = tilts[idx % tilts.length];
              const srm = calc.srm ?? 0;
              return (
                <div key={r.id} style={{ position: "relative" }}>
                  <HSCardLift
                    href={`/recipes/${r.id}`}
                    ariaLabel={r.name || "Untitled recipe"}
                    ctaColor={hsTokens.hops}
                  >
                    <HSCard shadow={3} tilt={tilt} padding={0} style={{ overflow: "hidden" }}>
                      <div style={{ height: 18, background: srmToRgb(srm) }} aria-hidden />
                      <div style={{ padding: "18px 20px 20px" }}>
                        <div
                          style={{
                            fontFamily: hsTokens.display,
                            fontSize: 22,
                            letterSpacing: "-0.035em",
                            lineHeight: 1.05,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                          }}
                        >
                          {r.name || "Untitled recipe"}
                        </div>
                        <div
                          style={{
                            fontStyle: "italic",
                            fontSize: 13,
                            color: hsTokens.muted,
                            marginTop: 4,
                            minHeight: 18,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.style || "no style set"}
                        </div>

                        {(r.tags ?? []).length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                            {(r.tags ?? []).slice(0, 3).map((t) => (
                              <span
                                key={t}
                                style={{
                                  fontFamily: hsTokens.body,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  background: color_mix(hsTokens.hops, hsTokens.cream2, 0.25),
                                  color: hsTokens.ink,
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div
                          style={{
                            marginTop: 14,
                            display: "grid",
                            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                            gap: 8,
                          }}
                        >
                          {[
                            { label: "ABV", value: `${(calc.abv ?? 0).toFixed(1)}%`, accent: hsTokens.yeast },
                            { label: "IBU", value: `${Math.round(calc.ibu ?? 0)}`, accent: hsTokens.hops },
                            { label: "SRM", value: `${(calc.srm ?? 0).toFixed(0)}`, accent: hsTokens.roast },
                            { label: "OG", value: `${(calc.og ?? 0).toFixed(3)}`, accent: hsTokens.malt },
                          ].map((s) => (
                            <div
                              key={s.label}
                              style={{
                                background: hsTokens.cream2,
                                borderTop: `3px solid ${s.accent}`,
                                borderRadius: 6,
                                padding: "8px 6px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: "0.14em",
                                  textTransform: "uppercase",
                                  color: hsTokens.muted,
                                }}
                              >
                                {s.label}
                              </div>
                              <div
                                style={{
                                  fontFamily: hsTokens.display,
                                  fontSize: 15,
                                  letterSpacing: "-0.03em",
                                  marginTop: 2,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {s.value}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            marginTop: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 11,
                            color: hsTokens.muted,
                          }}
                        >
                          <span style={{ fontFamily: hsTokens.mono, fontVariantNumeric: "tabular-nums" }}>
                            {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    </HSCard>
                  </HSCardLift>

                  <button
                    type="button"
                    aria-label="Delete recipe"
                    onClick={(e) => {
                      e.preventDefault();
                      setPendingDelete(r);
                    }}
                    style={{
                      position: "absolute",
                      top: 10,
                      right: 10,
                      width: 28,
                      height: 28,
                      border: `1.5px solid ${hsTokens.ink}`,
                      background: hsTokens.paper,
                      borderRadius: 999,
                      cursor: "pointer",
                      color: hsTokens.ink,
                      fontFamily: hsTokens.body,
                      fontWeight: 700,
                      fontSize: 14,
                      lineHeight: 1,
                      padding: 0,
                      boxShadow: hsTokens.sh1,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete confirmation */}
      {pendingDelete ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(26, 22, 18, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setPendingDelete(null)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440 }}>
            <HSCard shadow={4} padding="22px 24px 24px" style={{ borderTop: `7px solid ${hsTokens.roast}` }}>
              <HSEyebrow color={hsTokens.roast}>Delete recipe</HSEyebrow>
              <div
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 24,
                  letterSpacing: "-0.035em",
                  margin: "6px 0 8px",
                }}
              >
                Delete &ldquo;{pendingDelete.name || "Untitled"}&rdquo;?
              </div>
              <p style={{ fontSize: 13, color: hsTokens.muted, lineHeight: 1.5, margin: "0 0 18px" }}>
                This removes the recipe and its version history. Saved sessions are kept.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <HSButton variant="ghost" onClick={() => setPendingDelete(null)}>
                  Cancel
                </HSButton>
                <HSButton
                  variant="solid"
                  color={hsTokens.roast}
                  onClick={() => {
                    deleteRecipe(pendingDelete.id);
                    setPendingDelete(null);
                  }}
                >
                  Delete
                </HSButton>
              </div>
            </HSCard>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function color_mix(a: string, b: string, t: number) {
  // simple helper to render a CSS color-mix(); not an actual mix — relies on CSS to compute
  return `color-mix(in oklch, ${a} ${Math.round(t * 100)}%, ${b})`;
}
