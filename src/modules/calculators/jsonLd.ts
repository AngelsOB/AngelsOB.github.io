import { breadcrumbJsonLd } from "@/utils/seo";
import type { CalculatorMeta } from "./calculatorsMeta";

/**
 * Builds the JSON-LD payload for a calculator page from its metadata:
 * FAQPage (answer-engine bait) + HowTo (the steps) + BreadcrumbList.
 * Returned as an array to inline in one <script type="application/ld+json"> tag.
 *
 * A SoftwareApplication node used to live here too, but it was removed: without
 * real ratings it earns no rich result, and structured-data validators flag it
 * as invalid for missing `aggregateRating`/`review` (we won't fabricate those).
 * FAQPage + HowTo are the structured data that actually surface for these pages.
 */
export function calculatorJsonLd(meta: CalculatorMeta) {
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: meta.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const howTo = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: meta.howTo.name,
    step: meta.howTo.steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calculators", path: "/calculators" },
    { name: meta.h1, path: `/calculators/${meta.slug}` },
  ]);

  return [faqPage, howTo, breadcrumb];
}
