"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion";

import { hsTokens } from "@/modules/builder/tokens";

export interface SidebarCategory {
  label: string;
  accent: string;
  hops: { slug: string; name: string; accent: string }[];
}

// Snappy, near-spring-less expand. easeOut, fast.
const EXPAND = { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const };

/**
 * One shared catalog sidebar, used on every ingredient page. Always an accordion
 * of categories (starts fully collapsed); expand one to reach its items as rows
 * without navigating away. A "Compare" toggle flips the click behavior:
 *   • off (nav)     → each row links to its detail page
 *   • on  (compare) → each row calls `onPickCompare` (the page decides what that
 *                     means), or seeds the compare tool via `compareSeed`.
 * Sticky, so it follows the reader; the page positions it to start at the radar.
 */
export default function IngredientSidebar({
  basePath,
  categories,
  defaultCompare = false,
  onPickCompare,
  compareSeed,
  selectedSlugs = [],
  getRowHoverProps,
  hoverPortal,
}: {
  basePath: string;
  categories: SidebarCategory[];
  defaultCompare?: boolean;
  onPickCompare?: (slug: string) => void;
  compareSeed?: string;
  selectedSlugs?: string[];
  /** Per-row hover handlers (the dwell preview) — spread onto each row. */
  getRowHoverProps?: (slug: string) => Record<string, unknown>;
  /** The preview panel portal, rendered once. */
  hoverPortal?: ReactNode;
}) {
  const router = useRouter();
  const [compare, setCompare] = useState(defaultCompare);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const selected = new Set(selectedSlugs);

  const hasCompare = Boolean(onPickCompare || compareSeed);
  const pick = (slug: string) => {
    if (onPickCompare) onPickCompare(slug);
    else if (compareSeed)
      router.push(`/${basePath}/compare?hops=${compareSeed},${slug}`);
  };
  const toggleCat = (label: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <LazyMotion features={domAnimation}>
    <aside className="ingredient-catalog">
      {/* Toggle floats above the list so the category list — not a header —
          lines up with the radar. */}
      {hasCompare ? (
        <div className="ingredient-compare-toggle">
          <CompareToggle on={compare} onToggle={() => setCompare((v) => !v)} />
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {categories.map((cat) => {
          const isOpen = open.has(cat.label);
          return (
            <div
              key={cat.label}
              style={{
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 10,
                background: hsTokens.paper,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => toggleCat(cat.label)}
                aria-expanded={isOpen}
                style={{
                  appearance: "none",
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 12px",
                  background: isOpen ? hsTokens.cream2 : "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: hsTokens.body,
                  fontSize: 13,
                  color: hsTokens.ink,
                  textAlign: "left",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: cat.accent,
                    border: `1px solid ${hsTokens.ink}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                  {cat.label}
                </span>
                <span
                  style={{
                    fontFamily: hsTokens.mono,
                    fontSize: 11,
                    color: hsTokens.muted,
                  }}
                >
                  {cat.hops.length}
                </span>
                <svg
                  aria-hidden
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  style={{
                    flexShrink: 0,
                    transition: "transform 160ms ease",
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path
                    d="M2 3.5 L5 6.5 L8 3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              <AnimatePresence initial={false}>
                {isOpen ? (
                  <m.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={EXPAND}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        padding: "3px 6px 6px",
                        borderTop: `1px solid ${hsTokens.ink}1a`,
                      }}
                    >
                      {cat.hops.map((h) => {
                        const isSel = selected.has(h.slug);
                        const content = (
                          <>
                            <span
                              aria-hidden
                              style={{
                                width: 9,
                                height: 9,
                                borderRadius: 999,
                                background: h.accent,
                                border: `1px solid ${hsTokens.ink}`,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h.name}
                            </span>
                            {compare && hasCompare && isSel ? (
                              <span
                                aria-hidden
                                style={{ color: hsTokens.water, fontWeight: 800 }}
                              >
                                ✓
                              </span>
                            ) : null}
                          </>
                        );
                        const hover = getRowHoverProps?.(h.slug) ?? {};
                        return compare && hasCompare ? (
                          <button
                            key={h.slug}
                            type="button"
                            onClick={() => pick(h.slug)}
                            className="ingredient-hop-row"
                            style={rowStyle(isSel)}
                            {...hover}
                          >
                            {content}
                          </button>
                        ) : (
                          <Link
                            key={h.slug}
                            href={`/${basePath}/${h.slug}`}
                            className="ingredient-hop-row"
                            style={rowStyle(false)}
                            {...hover}
                          >
                            {content}
                          </Link>
                        );
                      })}
                    </div>
                  </m.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {hoverPortal}

      <style>{`
        /* Sticky + no internal scroll: it pins while short, and simply scrolls
           with the page once a big category is expanded — no clipped mask. */
        .ingredient-catalog {
          position: sticky;
          top: 104px;
          align-self: start;
        }
        .ingredient-compare-toggle {
          position: absolute;
          top: -34px;
          right: 0;
          z-index: 1;
        }
        .ingredient-hop-row { transition: background 120ms ease; }
        .ingredient-hop-row:hover { background: ${hsTokens.cream2} !important; }
        @media (max-width: 1024px) {
          .ingredient-catalog { position: static; }
          .ingredient-compare-toggle {
            position: static;
            display: flex;
            justify-content: flex-end;
            margin-bottom: 10px;
          }
        }
      `}</style>
    </aside>
    </LazyMotion>
  );
}

function rowStyle(selected: boolean) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "6px 10px 6px 22px",
    border: "none",
    borderRadius: 7,
    background: selected
      ? `color-mix(in oklab, ${hsTokens.water} 16%, transparent)`
      : "transparent",
    cursor: "pointer",
    textAlign: "left" as const,
    textDecoration: "none",
    fontFamily: hsTokens.body,
    fontSize: 12.5,
    fontWeight: 500,
    color: hsTokens.ink,
    appearance: "none" as const,
  };
}

function CompareToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title="Toggle compare: click hops to add them to a comparison"
      style={{
        appearance: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 11px 4px 8px",
        borderRadius: 999,
        border: `1.5px solid ${hsTokens.ink}`,
        background: on ? hsTokens.water : hsTokens.paper,
        color: on ? hsTokens.paper : hsTokens.muted,
        opacity: on ? 1 : 0.85,
        cursor: "pointer",
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        boxShadow: on ? "2px 2px 0 var(--hs-ink)" : "none",
        transition: "opacity 120ms ease, background 120ms ease, color 120ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          border: `1.5px solid ${on ? hsTokens.paper : hsTokens.muted}`,
          background: on ? hsTokens.paper : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {on ? (
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke={hsTokens.water}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>
      Compare
    </button>
  );
}
