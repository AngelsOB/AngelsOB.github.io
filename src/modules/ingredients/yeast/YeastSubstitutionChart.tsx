"use client";

import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import { YEAST_PRESETS } from "@/modules/recipe/data/yeastPresets";
import { getYeastLabFavicon } from "@/modules/recipe/utils/yeastLabIcons";
import { useYeastHoverPreview } from "@/modules/builder/components/builder/yeastHoverPreview";

import { yeastChartSections, type YeastEquivMember } from "./yeastKind";

// Computed once — deterministic, and renders in the server HTML (this is a client
// component, but Next SSRs it, so every strain link is crawlable).
const SECTIONS = yeastChartSections();
const PRESET_BY_NAME = new Map(YEAST_PRESETS.map((y) => [y.name, y]));

/** The lab mark on a chip/title: the lab's favicon, or its accent dot when a lab
 *  has no icon asset (e.g. Mangrove Jack's). */
function LabMark({ category, accent }: { category: string; accent: string }) {
  const fav = getYeastLabFavicon(category);
  return fav ? (
    <img src={fav} alt="" width={14} height={14} className="subchart-fav" />
  ) : (
    <span aria-hidden className="subchart-dot" style={{ background: accent }} />
  );
}

/**
 * The substitution chart body. Strain-anchored: each row shows the same strain at
 * other labs (solid pills) and its closest substitutes (tinted pills). Hovering a
 * strain or chip dwells the shared yeast preview card (same one the index uses).
 */
export default function YeastSubstitutionChart() {
  const { portal, getTriggerProps } = useYeastHoverPreview(YEAST_PRESETS, {
    placement: "cursor-right",
    showDelay: 320,
  });

  const renderChip = (m: YeastEquivMember, kind: "exact" | "sub") => {
    const preset = m.slug ? PRESET_BY_NAME.get(m.name) : undefined;
    const isSub = kind === "sub";
    const cls = isSub ? "subchart-chip subchart-chip--sub" : "subchart-chip";
    // Both pills carry the lab's colour; substitutes are fainter (and lose the
    // drop shadow via the --sub class) so same-strain swaps read as the stronger.
    const tint = {
      background: `color-mix(in oklab, ${m.accent} ${isSub ? 8 : 16}%, transparent)`,
      borderColor: `color-mix(in oklab, ${m.accent} ${isSub ? 36 : 58}%, transparent)`,
    };
    // aria-label (not title) so screen readers still get the full name + lab, but
    // no native browser tooltip fights the dwell preview card.
    const label = `${m.name}${m.category ? ` — ${m.category}` : ""}`;
    const inner = (
      <>
        <LabMark category={m.category} accent={m.accent} />
        {m.token}
      </>
    );
    if (!m.slug) {
      return (
        <span key={m.name} className={cls} style={tint} aria-label={label}>
          {inner}
        </span>
      );
    }
    return (
      <Link
        key={m.name}
        href={`/yeast/${m.slug}`}
        className={cls}
        style={tint}
        aria-label={label}
        {...(preset ? getTriggerProps(preset) : {})}
      >
        {inner}
      </Link>
    );
  };

  return (
    <>
      <div className="subchart-legend">
        <span
          className="subchart-chip subchart-chip--demo"
          style={{
            background: `color-mix(in oklab, ${hsTokens.yeast} 16%, transparent)`,
            borderColor: `color-mix(in oklab, ${hsTokens.yeast} 58%, transparent)`,
          }}
        >
          same strain, other lab
        </span>
        <span
          className="subchart-chip subchart-chip--sub subchart-chip--demo"
          style={{
            background: `color-mix(in oklab, ${hsTokens.yeast} 8%, transparent)`,
            borderColor: `color-mix(in oklab, ${hsTokens.yeast} 36%, transparent)`,
          }}
        >
          substitute
        </span>
      </div>

      {SECTIONS.map((section) => (
        <section key={section.type} style={{ marginBottom: 26 }}>
          <h2 className="subchart-h2">
            {section.label}
            <span className="subchart-h2-count">{section.rows.length}</span>
          </h2>
          <div className="subchart-rows">
            {section.rows.map((row) => {
              const preset = PRESET_BY_NAME.get(row.name);
              return (
                <div key={row.name} className="subchart-row">
                  <Link
                    href={`/yeast/${row.slug}`}
                    className="subchart-title"
                    {...(preset ? getTriggerProps(preset) : {})}
                  >
                    <LabMark category={row.category} accent={row.accent} />
                    <span className="subchart-title-name">{row.name}</span>
                  </Link>
                  <div className="subchart-content">
                    {row.exact.length ? (
                      <div className="subchart-line">
                        <span className="subchart-kind">same strain</span>
                        <div className="subchart-chips">
                          {row.exact.map((m) => renderChip(m, "exact"))}
                        </div>
                      </div>
                    ) : null}
                    {row.substitutes.length ? (
                      <div className="subchart-line">
                        <span className="subchart-kind">substitutes</span>
                        <div className="subchart-chips">
                          {row.substitutes.map((m) => renderChip(m, "sub"))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {portal}

      <style>{`
        .subchart-legend {
          display: flex; flex-wrap: wrap; gap: 10px; margin: 2px 0 18px;
        }
        .subchart-chip--demo { cursor: default; }
        .subchart-h2 {
          font-family: ${hsTokens.display};
          font-size: 20px; letter-spacing: -0.03em; line-height: 1.1;
          color: ${hsTokens.ink}; margin: 8px 0 4px;
          display: flex; align-items: baseline; gap: 9px;
        }
        .subchart-h2-count {
          font-family: ${hsTokens.body}; font-size: 12px; font-weight: 600;
          color: ${hsTokens.muted};
        }
        .subchart-rows { display: flex; flex-direction: column; }
        .subchart-row {
          display: grid;
          grid-template-columns: minmax(160px, 240px) 1fr;
          gap: 16px; align-items: baseline;
          padding: 10px 0;
          border-top: 1px solid color-mix(in oklab, ${hsTokens.ink} 12%, transparent);
        }
        .subchart-title {
          display: inline-flex; align-items: center; gap: 7px;
          font-family: ${hsTokens.body}; font-weight: 700; font-size: 13.5px;
          color: ${hsTokens.ink}; text-decoration: none; min-width: 0;
        }
        .subchart-title:hover .subchart-title-name { text-decoration: underline; }
        .subchart-content { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .subchart-line { display: flex; align-items: baseline; gap: 9px; }
        .subchart-kind {
          flex-shrink: 0; width: 76px; text-align: right;
          font-family: ${hsTokens.body}; font-weight: 700; font-size: 8.5px;
          letter-spacing: 0.1em; text-transform: uppercase; color: ${hsTokens.muted};
          padding-top: 4px;
        }
        .subchart-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .subchart-chip {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: ${hsTokens.mono}; font-size: 12px; font-weight: 600;
          color: ${hsTokens.ink}; background: ${hsTokens.paper};
          border: 1.5px solid ${hsTokens.ink}; border-radius: 999px;
          padding: 3px 10px 3px 8px; text-decoration: none;
          box-shadow: ${hsTokens.sh1};
          transition: transform 130ms ease, box-shadow 130ms ease;
        }
        .subchart-chip:hover { transform: translateY(-1px); box-shadow: ${hsTokens.sh2}; }
        /* Substitute pills: tinted with the lab's colour (set inline), no shadow. */
        .subchart-chip--sub { box-shadow: none; }
        .subchart-chip--sub:hover { transform: translateY(-1px); }
        .subchart-fav {
          width: 14px; height: 14px; object-fit: contain; flex-shrink: 0; border-radius: 3px;
        }
        .subchart-dot {
          width: 9px; height: 9px; border-radius: 999px;
          border: 1px solid ${hsTokens.ink}; flex-shrink: 0;
        }
        @media (max-width: 560px) {
          .subchart-row { grid-template-columns: 1fr; gap: 7px; }
          .subchart-kind { width: auto; text-align: left; }
        }
      `}</style>
    </>
  );
}
