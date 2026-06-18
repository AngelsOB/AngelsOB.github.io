import { breadcrumbJsonLd } from "@/utils/seo";
import type { CalculatorMeta } from "./calculatorsMeta";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com";

/**
 * Builds the JSON-LD payload for a calculator page from its metadata:
 * SoftwareApplication (the tool) + FAQPage (answer-engine bait) + HowTo
 * (the steps) + BreadcrumbList. Returned as an array to inline in one
 * <script type="application/ld+json"> tag.
 */
export function calculatorJsonLd(meta: CalculatorMeta) {
  const url = `${BASE_URL}/calculators/${meta.slug}`;

  const softwareApp = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: meta.appName,
    description: meta.appDescription,
    applicationCategory: "UtilityApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    url,
  };

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

  return [softwareApp, faqPage, howTo, breadcrumb];
}
