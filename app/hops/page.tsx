import type { Metadata } from "next";

import { hsTokens } from "@/modules/builder/tokens";
import HopIndexClient from "@/modules/ingredients/hops/HopIndexClient";
import {
  HOP_SECTION,
  hopRows,
  hopGroups,
  hopFlavorFilter,
  indexableHopItems,
} from "@/modules/ingredients/hops/hopKind";
import { ingredientIndexJsonLd } from "@/modules/ingredients/jsonLd";

export const metadata: Metadata = {
  title: "Hop Database — Flavor, Alpha Acid & Substitutes for Every Hop",
  description:
    "Look up any hop: alpha acid, flavor profile, oil chemistry, origin, and the closest substitutes. A searchable reference for 222 brewing hops. No signup.",
  alternates: { canonical: "/hops" },
  openGraph: {
    title: "Hop Database | Brewing.It",
    description:
      "Search 222 hops by name, origin, and flavor — alpha acid, oil chemistry, and the closest substitutes for each.",
    url: "/hops",
    siteName: "Brewing.It",
  },
  twitter: {
    card: "summary",
    title: "Hop Database | Brewing.It",
    description:
      "Search 222 hops by name, origin, and flavor, with the closest substitutes for each.",
  },
};

/**
 * The /hops lookup index. Rows + groups are built on the server from the hop
 * dataset and the client component handles search + filtering. The full card
 * grid renders server-side (every hop link is in the static HTML — the
 * crawlable hub), and the search/filter state hydrates over it.
 */
export default function HopsIndexPage() {
  const rows = hopRows();
  const groups = hopGroups();
  const jsonLd = ingredientIndexJsonLd({
    sectionLabel: "Hops",
    sectionPath: "/hops",
    items: indexableHopItems(),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HopIndexClient
        basePath={HOP_SECTION.basePath}
        label={HOP_SECTION.label}
        rows={rows}
        groups={groups}
        subFilter={hopFlavorFilter()}
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
          A reference for {rows.length} hop varieties. Each hop lists its alpha
          and beta acid, total oil, cohumulone, a nine-axis flavor profile,
          origin, and the closest substitutes — drawn from grower data and our
          flavor model. Use it to look up a hop&apos;s stats or find what to
          brew with when your variety is out of stock, without opening the
          recipe builder.
        </p>
      </section>
    </>
  );
}
