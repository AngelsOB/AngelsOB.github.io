import type { Metadata } from "next";
import { notFound } from "next/navigation";

import HopDetailBody from "@/modules/ingredients/hops/HopDetailBody";
import {
  getHop,
  hopSlugs,
  hopMeta,
  hopFaq,
  isHopIndexable,
} from "@/modules/ingredients/hops/hopKind";
import { ingredientDetailJsonLd } from "@/modules/ingredients/jsonLd";

// Only the known hop slugs are pre-rendered; any other slug 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return hopSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hop = getHop(slug);
  if (!hop) return {};
  const meta = hopMeta(hop);
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: `/hops/${slug}` },
    // Thin hops (no flavor / no alpha range) stay crawlable but out of the
    // index, so a uniformly-rich set protects the domain's quality signal.
    ...(isHopIndexable(hop)
      ? {}
      : { robots: { index: false, follow: true } }),
    openGraph: {
      title: `${meta.title} | Brewing.It`,
      description: meta.description,
      url: `/hops/${slug}`,
      siteName: "Brewing.It",
    },
    twitter: {
      card: "summary",
      title: `${meta.title} | Brewing.It`,
      description: meta.description,
    },
  };
}

export default async function HopDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hop = getHop(slug);
  if (!hop) notFound();

  const jsonLd = ingredientDetailJsonLd({
    name: hop.name,
    termLabel: `${hop.name} hops`,
    description: hopMeta(hop).description,
    path: `/hops/${slug}`,
    sectionLabel: "Hops",
    sectionPath: "/hops",
    faq: hopFaq(hop),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HopDetailBody hop={hop} />
    </>
  );
}
