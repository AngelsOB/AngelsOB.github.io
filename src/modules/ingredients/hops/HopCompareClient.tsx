"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { hsTokens, hsAlpha } from "@/modules/builder/tokens";
import HSButton from "@/modules/builder/components/HSButton";
import HopFlavorRadar from "@/components/HopFlavorRadar";
import HopPresetModal from "@/modules/builder/components/modals/HopPresetModal";
import type { HopPreset } from "@/modules/recipe/models/Presets";
import { HOP_PRESETS, groupHops } from "@/modules/recipe/data/hopPresets";
import {
  formatAlphaRange,
  formatBetaRange,
  formatAlphaBetaRatio,
  formatCohumulone,
  formatOilTotal,
} from "@/modules/builder/components/builder/hopDetails";
import { getCountryFlag } from "@/utils/flags";

import IngredientDetailHeader from "../IngredientDetailHeader";
import HopSidebar from "./HopSidebar";
import { getHop, hopSlug, hopCompareSummary, originName } from "./hopKind";

const MAX_SLOTS = 6;

const seriesColor = (i: number, total: number) =>
  `hsl(${Math.round((360 * i) / Math.max(total, 6))} 70% 50%)`;

const DEFAULT_SLUGS = (() => {
  const want = ["citra", "mosaic"].filter((s) => getHop(s));
  return want.length === 2 ? want : HOP_PRESETS.slice(0, 2).map((h) => hopSlug(h));
})();

const STAT_ROWS: { label: string; get: (h: HopPreset) => string | null }[] = [
  { label: "Alpha acid", get: formatAlphaRange },
  { label: "Beta acid", get: formatBetaRange },
  { label: "α : β", get: formatAlphaBetaRatio },
  { label: "Cohumulone", get: formatCohumulone },
  { label: "Total oil", get: formatOilTotal },
];

type ModalMode = { type: "add" } | { type: "swap"; index: number } | null;

export default function HopCompareClient() {
  const [slugs, setSlugs] = useState<string[]>(DEFAULT_SLUGS);
  const [active, setActive] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);

  // Hydrate a shared `?hops=…` link on mount. URL is written only on user
  // actions (see `update`), never from an effect, so the read can't be clobbered.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("hops");
    if (!raw) return;
    const valid = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => getHop(s));
    if (valid.length >= 1) setSlugs(valid.slice(0, MAX_SLOTS));
  }, []);

  const update = (next: string[]) => {
    setSlugs(next);
    window.history.replaceState(null, "", `?hops=${next.join(",")}`);
  };

  const hops = useMemo(
    () => slugs.map((s) => getHop(s)).filter(Boolean) as HopPreset[],
    [slugs]
  );
  const presetsGrouped = useMemo(() => groupHops(HOP_PRESETS), []);

  const removeSlot = (i: number) =>
    update(slugs.filter((_, idx) => idx !== i));
  const toggleHop = (slug: string) => {
    if (slugs.includes(slug)) update(slugs.filter((s) => s !== slug));
    else if (slugs.length < MAX_SLOTS) update([...slugs, slug]);
  };
  const onModalSelect = (preset: HopPreset) => {
    const slug = hopSlug(preset);
    if (modal?.type === "swap")
      update(slugs.map((s, i) => (i === modal.index ? slug : s)));
    else if (!slugs.includes(slug) && slugs.length < MAX_SLOTS)
      update([...slugs, slug]);
    setModal(null);
  };

  const series = hops
    .filter((h) => h.flavor)
    .map((h) => ({ name: h.name, flavor: h.flavor! }));
  const verdict = hops.length === 2 ? hopCompareSummary(hops[0], hops[1]) : "";

  return (
    <article>
      <IngredientDetailHeader
        crumbs={[
          { name: "Home", href: "/" },
          { name: "Hops", href: "/hops" },
        ]}
        title="Compare hops"
        lede="Overlay up to six hops to see how their flavor, acids, and oil line up — and which to reach for."
      />

      {/* Slots — click a hop to swap it (builder modal); × to drop it. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        {slugs.map((slug, i) => {
          const hop = getHop(slug);
          if (!hop) return null;
          return (
            <div
              key={`${slug}-${i}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 7px 5px 10px",
                borderRadius: 999,
                border: `1.5px solid ${hsTokens.ink}`,
                background: hsTokens.paper,
                boxShadow: hsTokens.sh1,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 999,
                  background: seriesColor(i, slugs.length),
                  border: `1px solid ${hsTokens.ink}`,
                  flexShrink: 0,
                }}
              />
              <button
                type="button"
                onClick={() => setModal({ type: "swap", index: i })}
                title={`Swap ${hop.name}`}
                style={{
                  appearance: "none",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: hsTokens.body,
                  fontSize: 14,
                  fontWeight: 600,
                  color: hsTokens.ink,
                }}
              >
                {hop.name}
              </button>
              <button
                type="button"
                onClick={() => removeSlot(i)}
                aria-label={`Remove ${hop.name}`}
                style={{
                  appearance: "none",
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  border: `1px solid ${hsAlpha(hsTokens.ink, 33)}`,
                  background: hsTokens.cream,
                  color: hsTokens.ink,
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
        {slugs.length < MAX_SLOTS ? (
          <button
            type="button"
            onClick={() => setModal({ type: "add" })}
            style={{
              appearance: "none",
              fontFamily: hsTokens.body,
              fontSize: 13,
              fontWeight: 700,
              color: hsTokens.ink,
              background: hsTokens.cream2,
              border: `1.5px dashed ${hsTokens.ink}`,
              borderRadius: 999,
              padding: "8px 14px",
              cursor: "pointer",
            }}
          >
            + Add hop
          </button>
        ) : null}
      </div>

      <div className="ingredient-page-grid">
        <div style={{ minWidth: 0 }}>
          {hops.length === 0 ? (
            <p style={{ fontFamily: hsTokens.body, color: hsTokens.muted }}>
              Add hops to compare.
            </p>
          ) : (
            <>
              <div className="hop-compare-grid">
                {/* Overlaid radar + HS legend (hover a series to highlight it) */}
                <div
                  style={{
                    background: hsTokens.paper,
                    border: `2px solid ${hsTokens.ink}`,
                    borderRadius: 14,
                    boxShadow: hsTokens.sh2,
                    padding: "12px 10px",
                  }}
                >
                  {series.length ? (
                    <>
                      <HopFlavorRadar
                        series={series}
                        colorStrategy="index"
                        showLegend={false}
                        responsive
                        activeIndex={active}
                      />
                      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                      <div
                        onMouseLeave={() => setActive(null)}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "4px 8px",
                          justifyContent: "center",
                          marginTop: 8,
                          paddingTop: 10,
                          borderTop: `1px solid ${hsAlpha(hsTokens.ink, 13)}`,
                        }}
                      >
                        {series.map((s, i) => {
                          const dimmed = active !== null && active !== i;
                          return (
                            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
                            <span
                              key={s.name}
                              onMouseEnter={() => setActive(i)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "6px 8px",
                                borderRadius: 6,
                                fontFamily: hsTokens.body,
                                fontSize: 12,
                                color: hsTokens.ink,
                                opacity: dimmed ? 0.4 : 1,
                                transition: "opacity 180ms ease",
                                cursor: "default",
                              }}
                            >
                              <span
                                aria-hidden
                                style={{
                                  width: 14,
                                  height: 10,
                                  borderRadius: 3,
                                  background: seriesColor(i, series.length),
                                  border: `1.5px solid ${hsTokens.ink}`,
                                  flexShrink: 0,
                                }}
                              />
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
                            </span>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Side-by-side stats — scrolls horizontally with many hops */}
                <div
                  style={{
                    background: hsTokens.paper,
                    border: `2px solid ${hsTokens.ink}`,
                    borderRadius: 14,
                    boxShadow: hsTokens.sh2,
                    padding: "4px 6px",
                    overflowX: "auto",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `minmax(82px, auto) repeat(${hops.length}, minmax(76px, 1fr))`,
                      alignItems: "center",
                      minWidth: hops.length > 3 ? hops.length * 88 + 90 : undefined,
                    }}
                  >
                    <Cell head />
                    {hops.map((h, i) => (
                      <Cell head key={h.name} center>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            justifyContent: "center",
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 999,
                              background: seriesColor(i, hops.length),
                              border: `1px solid ${hsTokens.ink}`,
                            }}
                          />
                          {h.name}
                        </span>
                      </Cell>
                    ))}

                    {STAT_ROWS.map((row) => (
                      <RowGroup key={row.label} label={row.label}>
                        {hops.map((h) => (
                          <Cell center key={h.name} mono>
                            {row.get(h) ?? "—"}
                          </Cell>
                        ))}
                      </RowGroup>
                    ))}

                    <RowGroup label="Origin">
                      {hops.map((h) => (
                        <Cell center key={h.name}>
                          {h.originCode ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                justifyContent: "center",
                              }}
                            >
                              <span style={{ fontSize: 14 }}>
                                {getCountryFlag(h.originCode)}
                              </span>
                              <span style={{ fontSize: 12 }}>
                                {originName(h.originCode)}
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </Cell>
                      ))}
                    </RowGroup>
                  </div>
                </div>
              </div>

              {verdict ? (
                <p
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: hsTokens.ink,
                    margin: "22px 0 0",
                    maxWidth: 620,
                  }}
                >
                  {verdict}
                </p>
              ) : null}

              <div style={{ marginTop: 24 }}>
                <HSButton
                  href="/recipes/new"
                  variant="solid"
                  color={hsTokens.hops}
                  arrow
                >
                  Build a recipe
                </HSButton>
              </div>
            </>
          )}
        </div>

        <HopSidebar
          defaultCompare
          onPickCompare={toggleHop}
          selectedSlugs={slugs}
        />
      </div>

      <HopPresetModal
        isOpen={modal !== null}
        editing={modal?.type === "swap"}
        onClose={() => setModal(null)}
        onSelect={onModalSelect}
        onCreateCustom={() => setModal(null)}
        presetsGrouped={presetsGrouped}
        isLoading={false}
      />

      <style>{`
        .ingredient-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(230px, 0.42fr);
          gap: 28px;
          align-items: start;
        }
        .hop-compare-grid {
          display: grid;
          grid-template-columns: minmax(220px, 0.95fr) minmax(0, 1.05fr);
          gap: 18px;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .ingredient-page-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .hop-compare-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </article>
  );
}

function RowGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <Cell label>{label}</Cell>
      {children}
    </>
  );
}

function Cell({
  children,
  head,
  label,
  center,
  mono,
}: {
  children?: ReactNode;
  head?: boolean;
  label?: boolean;
  center?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        padding: "9px 10px",
        borderTop: head ? "none" : `1px solid ${hsAlpha(hsTokens.ink, 8)}`,
        textAlign: center ? "center" : "left",
        fontFamily: mono ? hsTokens.mono : hsTokens.body,
        fontSize: head ? 13 : label ? 10.5 : 13,
        fontWeight: head || label ? 700 : 500,
        letterSpacing: label ? "0.1em" : undefined,
        textTransform: label ? "uppercase" : undefined,
        color: label ? hsTokens.muted : hsTokens.ink,
      }}
    >
      {children}
    </div>
  );
}
