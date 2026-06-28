import type { Metadata } from "next";
import { notFound } from "next/navigation";

import YeastDetailBody from "@/modules/ingredients/yeast/YeastDetailBody";
import {
  getYeast,
  yeastSlugs,
  yeastMeta,
  yeastFaq,
  isYeastIndexable,
} from "@/modules/ingredients/yeast/yeastKind";
import { ingredientDetailJsonLd } from "@/modules/ingredients/jsonLd";

// Only the known yeast slugs are pre-rendered; any other slug 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return yeastSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const yeast = getYeast(slug);
  if (!yeast) return {};
  const meta = yeastMeta(yeast);
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    alternates: { canonical: `/yeast/${slug}` },
    // Thin strains (missing the core attenuation/temp/floc block) stay crawlable
    // but out of the index, so a uniformly-rich set protects the quality signal.
    ...(isYeastIndexable(yeast)
      ? {}
      : { robots: { index: false, follow: true } }),
    openGraph: {
      title: `${meta.title} | Brewing.It`,
      description: meta.description,
      url: `/yeast/${slug}`,
      siteName: "Brewing.It",
    },
    twitter: {
      card: "summary",
      title: `${meta.title} | Brewing.It`,
      description: meta.description,
    },
  };
}

export default async function YeastDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const yeast = getYeast(slug);
  if (!yeast) notFound();

  const jsonLd = ingredientDetailJsonLd({
    name: yeast.name,
    termLabel: `${yeast.name} yeast`,
    description: yeastMeta(yeast).description,
    path: `/yeast/${slug}`,
    sectionLabel: "Yeast",
    sectionPath: "/yeast",
    faq: yeastFaq(yeast),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <YeastDetailBody yeast={yeast} />
    </>
  );
}
