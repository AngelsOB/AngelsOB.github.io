import type { Metadata } from "next";
import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import YeastIndexClient from "@/modules/ingredients/yeast/YeastIndexClient";
import {
  YEAST_SECTION,
  yeastRows,
  yeastGroups,
  yeastTypeFilter,
  indexableYeastItems,
} from "@/modules/ingredients/yeast/yeastKind";
import { ingredientIndexJsonLd } from "@/modules/ingredients/jsonLd";
import { YEAST_PRESETS } from "@/modules/recipe/data/yeastPresets";

const COUNT = YEAST_PRESETS.length;

export const metadata: Metadata = {
  title: "Yeast Database — Attenuation, Temperature & Cross-Lab Equivalents",
  description: `Look up any brewing yeast strain: attenuation, fermentation temperature, flocculation, alcohol tolerance, suited styles, and which labs sell the same strain. A searchable reference for ${COUNT} ale, lager, and kveik strains. No signup.`,
  alternates: { canonical: "/yeast" },
  openGraph: {
    title: "Yeast Database | Brewing.It",
    description: `Search ${COUNT} yeast strains by name, lab, or style — attenuation, temperature, flocculation, and the cross-lab equivalent of each.`,
    url: "/yeast",
    siteName: "Brewing.It",
  },
  twitter: {
    card: "summary",
    title: "Yeast Database | Brewing.It",
    description: `Search ${COUNT} yeast strains — attenuation, temperature, and the cross-lab equivalent of each.`,
  },
};

/**
 * The /yeast lookup index. Rows + groups are built on the server from the yeast
 * dataset and the client component handles search + filtering. The full card
 * grid renders server-side (every strain link is in the static HTML — the
 * crawlable hub), and the search/filter state hydrates over it.
 */
export default function YeastIndexPage() {
  const rows = yeastRows();
  const groups = yeastGroups();
  const jsonLd = ingredientIndexJsonLd({
    sectionLabel: "Yeast",
    sectionPath: "/yeast",
    items: indexableYeastItems(),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Quick link to the cross-lab substitution chart, up top where a brewer
          looking to swap a strain will see it. */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <Link
          href="/yeast/substitution-chart"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontFamily: hsTokens.body,
            fontSize: 13,
            fontWeight: 600,
            color: hsTokens.ink,
            textDecoration: "none",
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            padding: "5px 14px",
            background: hsTokens.cream,
            boxShadow: hsTokens.sh1,
          }}
        >
          Yeast substitution chart <span aria-hidden>→</span>
        </Link>
      </div>

      <YeastIndexClient
        basePath={YEAST_SECTION.basePath}
        label={YEAST_SECTION.label}
        rows={rows}
        groups={groups}
        subFilter={yeastTypeFilter()}
        searchHint="name, lab, or style"
      />

      {/* Descriptive / SEO copy kept at the bottom, out of the way of the tool. */}
      <section
        style={{
          marginTop: 40,
          paddingTop: 22,
          borderTop: `1px solid ${hsTokens.ink}22`,
          maxWidth: 680,
          fontFamily: hsTokens.body,
          fontSize: 13.5,
          lineHeight: 1.6,
          color: hsTokens.muted,
        }}
      >
        <p style={{ margin: 0 }}>
          A reference for {rows.length} yeast strains across {groups.length}{" "}
          laboratories. Each strain lists its attenuation, fermentation
          temperature, flocculation, alcohol tolerance, suited styles, and — the
          part no other reference shows cleanly — which other labs sell the same
          strain. Use it to look up a strain&apos;s numbers or find its cross-lab
          equivalent and substitutes, without opening the recipe builder.
        </p>
      </section>
    </>
  );
}
