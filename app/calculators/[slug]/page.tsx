import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  calculatorSlugs,
  getCalculatorMeta,
} from "@/modules/calculators/calculatorsMeta";
import { calculatorJsonLd } from "@/modules/calculators/jsonLd";
import CalculatorFeature from "@/modules/calculators/CalculatorFeature";

// Only the seven known calculators; any other slug 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return calculatorSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getCalculatorMeta(slug);
  if (!meta) return {};
  return {
    title: meta.metaTitle,
    description: meta.metaDescription,
    keywords: meta.keywords,
    alternates: { canonical: `/calculators/${slug}` },
    openGraph: {
      title: `${meta.metaTitle} | Brewing.It`,
      description: meta.metaDescription,
      url: `/calculators/${slug}`,
      siteName: "Brewing.It",
    },
    twitter: {
      card: "summary",
      title: `${meta.metaTitle} | Brewing.It`,
      description: meta.metaDescription,
    },
  };
}

export default async function CalculatorSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const meta = getCalculatorMeta(slug);
  if (!meta) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(calculatorJsonLd(meta)),
        }}
      />
      <CalculatorFeature slug={slug} />
    </>
  );
}
