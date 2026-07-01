"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";
import { fuzzyIncludes, fuzzyScore } from "@/utils/ingredientMatching";

import MiniRadar from "./MiniRadar";
import type {
  IngredientGroup,
  IngredientRow,
  IngredientSubFilter,
} from "./types";

/** Toggle a value in a Set, returning a new Set (immutable for React state). */
function toggled(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Graded sub-filter match (hops/flavor): every selected value must be present
 *  (≥ presentMin) and at least one prominent (≥ prominentMin). */
function gradedPasses(
  weights: Record<string, number> | undefined,
  selected: string[],
  g: { presentMin: number; prominentMin: number }
): boolean {
  if (!weights) return false;
  let prominent = false;
  for (const v of selected) {
    const val = weights[v] ?? 0;
    if (val < g.presentMin) return false; // a selected flavor is absent → out
    if (val >= g.prominentMin) prominent = true;
  }
  return prominent;
}

/** Graded rank score: prominence-first (count of selected at prominentMin+),
 *  then total selected intensity as a tiebreak. */
function gradedScore(
  weights: Record<string, number> | undefined,
  selected: string[],
  prominentMin: number
): number {
  if (!weights) return 0;
  let prominent = 0;
  let sum = 0;
  for (const v of selected) {
    const val = weights[v] ?? 0;
    if (val >= prominentMin) prominent += 1;
    sum += val;
  }
  return prominent * 1000 + sum;
}

// Card interaction CSS — rendered once at the component root (CardGrid is
// invoked per category group, so it must NOT live inside CardGrid). The HS
// button idiom: lift + grow + deepen the offset shadow on hover, press down on
// click. A longer dwell summons the builder-style hover panel (see HopIndexClient).
const CARD_STYLES = `
  .hop-card {
    position: relative;
    z-index: 1;
    display: block;
    height: 100%;
    text-decoration: none;
    color: var(--hs-ink);
    transition: transform 200ms cubic-bezier(0.34, 1.45, 0.6, 1);
    will-change: transform;
  }
  .hop-card:hover { transform: translateY(-4px) scale(1.035); z-index: 2; }
  .hop-card:active { transform: translateY(0) scale(0.99); transition-duration: 90ms; }
  .hop-card-body { transition: box-shadow 200ms ease; }
  .hop-card:hover .hop-card-body { box-shadow: 6px 6px 0 var(--hs-ink) !important; }
  .hop-card:active .hop-card-body { box-shadow: 2px 2px 0 var(--hs-ink) !important; }
  .hop-card-radar {
    width: 96px;
    height: 96px;
    margin-bottom: 6px;
    transition: transform 200ms cubic-bezier(0.34, 1.45, 0.6, 1);
  }
  .hop-card:hover .hop-card-radar { transform: scale(1.06); }
  .hop-card-foot {
    width: 100%;
    margin-top: auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 4px 6px;
  }
  .hop-card-chip {
    display: inline-flex;
    gap: 5px;
    align-items: baseline;
    background: var(--hs-cream);
    border: 1px solid color-mix(in oklab, var(--hs-ink) 22%, transparent);
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
  }
  /* Linked substitute chips inside the expanded morph card. */
  .hop-morph-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--hs-cream);
    border: 1px solid color-mix(in oklab, var(--hs-ink) 30%, transparent);
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--hs-ink);
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  }
  .hop-morph-chip:hover {
    background: #4a8a3d;
    border-color: var(--hs-ink);
    color: var(--hs-paper);
  }
  @media (prefers-reduced-motion: reduce) {
    .hop-card, .hop-card-radar, .hop-card-body { transition: none; }
    .hop-card:hover, .hop-card:hover .hop-card-radar { transform: none; }
  }
`;

/**
 * The lookup tool: a name search box + category filter chips over a responsive
 * card grid. Kind-agnostic — it only reads the flat IngredientRow data the
 * route builds, so hops and yeast share it verbatim. With no search and "All"
 * selected the cards group under category headers; any active filter flattens
 * them into one grid.
 */
export default function IngredientIndexClient({
  basePath,
  label,
  rows,
  groups,
  renderCard,
  toolbar,
  subFilter,
  searchHint = "name, origin, or flavor",
}: {
  basePath: string;
  /** Plural noun for the search placeholder ("Hops"). */
  label: string;
  rows: IngredientRow[];
  groups: IngredientGroup[];
  /**
   * Optional per-card renderer. When provided, the kind owns each card's full
   * markup + interactions (hops swap in the morph card); otherwise the built-in
   * static card is used. Keeps the index itself kind-agnostic.
   */
  renderCard?: (row: IngredientRow) => ReactNode;
  /** Optional control rendered to the right of the search box (e.g. Compare). */
  toolbar?: ReactNode;
  /**
   * Optional second filter dimension, rendered as its own chip row and ANDed
   * with the category filter + search (yeast: strain type; hops: flavor).
   * Matches a row when its `subGroups` include the option value.
   */
  subFilter?: IngredientSubFilter;
  /** What the search box matches, used in its placeholder ("name, lab, or style"). */
  searchHint?: string;
}) {
  const [query, setQuery] = useState("");
  // Multi-select: an empty set means "all" (no filter on that dimension).
  // Values within a dimension OR together; the two dimensions AND.
  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set());
  const [activeSubs, setActiveSubs] = useState<Set<string>>(new Set());

  // Apply a `?category=` deep link AFTER hydration rather than via
  // useSearchParams, which would push the whole grid behind a Suspense
  // fallback and strip the (crawlable) card links out of the static HTML.
  // SSR renders every hop; the sidebar's category links refine on arrival.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cats = (params.get("category") ?? "")
      .split(",")
      .filter((c) => groups.some((g) => g.slug === c));
    if (cats.length) setActiveGroups(new Set(cats));
    const types = (params.get("type") ?? "")
      .split(",")
      .filter((t) => subFilter?.options.some((o) => o.value === t));
    if (types.length) setActiveSubs(new Set(types));
  }, [groups, subFilter]);

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    const graded = subFilter?.graded;
    const sel = [...activeSubs];
    const result = rows.filter((r) => {
      if (activeGroups.size && !activeGroups.has(r.groupSlug)) return false;
      if (sel.length) {
        if (graded) {
          // Hops/flavor: every selected flavor present, at least one prominent.
          if (!gradedPasses(r.subWeights, sel, graded)) return false;
        } else if (!r.subGroups?.some((g) => activeSubs.has(g))) {
          // Plain cumulative OR (yeast type).
          return false;
        }
      }
      // Same fuzzy pipeline as the builder ingredient pickers. `keywords`
      // already folds in the name, so one haystack covers it all.
      if (q && !fuzzyIncludes(q, r.keywords)) return false;
      return true;
    });
    // A text query ranks by search relevance: a name hit outranks an
    // alias/keyword-only hit, so "us 05" leads with SafAle US-05 rather than the
    // Chico-family strains that merely list it as an equivalent. Precomputed so
    // the comparator doesn't re-score; stable sort keeps dataset order within a
    // tier. A text query takes precedence over graded ranking (it's the more
    // specific signal, and the grid is flat — not grouped — while searching).
    if (q) {
      const score = new Map(
        result.map((r) => [r, fuzzyScore(q, r.name, r.keywords)] as const)
      );
      result.sort((a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0));
    } else if (graded && sel.length > 1) {
      // Graded dimensions rank prominence-first so an all-flavors hop leads.
      result.sort(
        (a, b) =>
          gradedScore(b.subWeights, sel, graded.prominentMin) -
          gradedScore(a.subWeights, sel, graded.prominentMin)
      );
    }
    return result;
  }, [rows, activeGroups, activeSubs, q, subFilter]);

  const grouped = activeGroups.size === 0 && activeSubs.size === 0 && !q;

  return (
    <div>
      {/* Search + optional toolbar (e.g. the hop "Compare" toggle) */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${rows.length} ${label.toLowerCase()} by ${searchHint}…`}
          aria-label={`Search ${label.toLowerCase()}`}
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: hsTokens.body,
            fontSize: 15,
            color: hsTokens.ink,
            background: hsTokens.paper,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 999,
            padding: "11px 18px",
            boxShadow: hsTokens.sh1,
            outline: "none",
          }}
        />
        {toolbar}
      </div>

      {/* Category filter chips (yeast: lab) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          margin: subFilter ? "14px 0 10px" : "14px 0 22px",
        }}
      >
        <FilterChip
          label="All"
          count={rows.length}
          active={activeGroups.size === 0}
          accent={hsTokens.ink}
          onClick={() => setActiveGroups(new Set())}
        />
        {groups.map((g) => (
          <FilterChip
            key={g.slug}
            label={g.label}
            count={g.count}
            accent={g.accent}
            active={activeGroups.has(g.slug)}
            onClick={() => setActiveGroups((s) => toggled(s, g.slug))}
          />
        ))}
      </div>

      {/* Optional second filter dimension (yeast: strain type) */}
      {subFilter ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            margin: "0 0 22px",
          }}
        >
          <span
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              marginRight: 2,
            }}
          >
            {subFilter.label}
          </span>
          <FilterChip
            label="All"
            count={rows.length}
            active={activeSubs.size === 0}
            accent={hsTokens.ink}
            onClick={() => setActiveSubs(new Set())}
          />
          {subFilter.options.map((o) => (
            <FilterChip
              key={o.value}
              label={o.label}
              count={o.count}
              accent={o.accent ?? hsTokens.ink}
              active={activeSubs.has(o.value)}
              onClick={() => setActiveSubs((s) => toggled(s, o.value))}
            />
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 14,
            color: hsTokens.muted,
          }}
        >
          No {label.toLowerCase()} match “{query}”.
        </p>
      ) : grouped ? (
        groups.map((g) => {
          const items = filtered.filter((r) => r.groupSlug === g.slug);
          if (!items.length) return null;
          return (
            <section key={g.slug} style={{ marginBottom: 28 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: g.accent,
                    border: `1.5px solid ${hsTokens.ink}`,
                  }}
                />
                <h2
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 18,
                    letterSpacing: "-0.02em",
                    color: hsTokens.ink,
                    margin: 0,
                  }}
                >
                  {g.label}
                </h2>
                <span
                  style={{
                    fontFamily: hsTokens.mono,
                    fontSize: 12,
                    color: hsTokens.muted,
                  }}
                >
                  {items.length}
                </span>
              </div>
              <CardGrid
                rows={items}
                basePath={basePath}
                renderCard={renderCard}
              />
            </section>
          );
        })
      ) : (
        <CardGrid rows={filtered} basePath={basePath} renderCard={renderCard} />
      )}

      <style>{CARD_STYLES}</style>
    </div>
  );
}

function FilterChip({
  label,
  count,
  accent,
  active,
  onClick,
}: {
  label: string;
  count: number;
  accent: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "6px 13px",
        borderRadius: 999,
        border: `1.5px solid ${hsTokens.ink}`,
        background: active ? accent : hsTokens.paper,
        color: active ? hsTokens.paper : hsTokens.ink,
        fontFamily: hsTokens.body,
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: active ? hsTokens.sh1 : "none",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: accent,
          border: `1px solid ${active ? hsTokens.paper : hsTokens.ink}`,
        }}
      />
      {label}
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 10.5,
          opacity: 0.75,
        }}
      >
        {count}
      </span>
    </button>
  );
}

function CardGrid({
  rows,
  basePath,
  renderCard,
}: {
  rows: IngredientRow[];
  basePath: string;
  renderCard?: (row: IngredientRow) => ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        gridTemplateColumns: "repeat(auto-fill, minmax(208px, 1fr))",
      }}
    >
      {rows.map((r) => (
        // The cell holds the grid track; a morph card expands absolutely
        // inside it, so neighbours never reflow.
        <div key={r.slug} style={{ position: "relative" }}>
          {renderCard ? (
            renderCard(r)
          ) : (
            <DefaultCard row={r} basePath={basePath} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Static fallback card (used by kinds without a custom renderer). */
function DefaultCard({
  row: r,
  basePath,
}: {
  row: IngredientRow;
  basePath: string;
}) {
  return (
    <Link href={`/${basePath}/${r.slug}`} className="hop-card">
      <HSCard
        className="hop-card-body"
        shadow={2}
        padding="16px 14px 14px"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {r.chart ? (
          <div className="hop-card-radar">
            <MiniRadar values={r.chart} color={r.accent} />
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 6,
            maxWidth: "100%",
          }}
        >
          <span
            style={{
              fontFamily: hsTokens.display,
              fontSize: 16,
              letterSpacing: "-0.02em",
              color: hsTokens.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {r.name}
          </span>
          {r.badge ? (
            <span
              title={r.badgeLabel}
              style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}
            >
              {r.badge}
            </span>
          ) : null}
        </div>
        {r.stats.length ? (
          <div className="hop-card-foot">
            {r.stats.map((s) => (
              <span key={s.label} className="hop-card-chip">
                <span style={{ color: hsTokens.muted }}>{s.label}</span>
                <span style={{ color: hsTokens.ink, fontWeight: 600 }}>
                  {s.value}
                </span>
              </span>
            ))}
          </div>
        ) : null}
      </HSCard>
    </Link>
  );
}
