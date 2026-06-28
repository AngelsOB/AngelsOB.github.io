import { breadcrumbJsonLd } from "@/utils/seo";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com";

/**
 * JSON-LD for an ingredient DETAIL page: a `DefinedTerm` (the entity, in its
 * reference set), a `BreadcrumbList`, and — when the kind generates one — a
 * `FAQPage`. Kept generic so hops and yeast share the same builder; the kind
 * just supplies the strings. Returned as an array to inline in one script tag.
 */
export function ingredientDetailJsonLd(input: {
  /** Display name used in the breadcrumb + term ("Citra"). */
  name: string;
  /** Fuller term label ("Citra hops"). */
  termLabel: string;
  description: string;
  /** Site-relative path ("/hops/citra"). */
  path: string;
  /** Section label + path ("Hops", "/hops"). */
  sectionLabel: string;
  sectionPath: string;
  faq: { q: string; a: string }[];
}) {
  const url = `${BASE_URL}${input.path}`;

  const definedTerm = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: input.termLabel,
    description: input.description,
    url,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: `${input.sectionLabel} reference`,
      url: `${BASE_URL}${input.sectionPath}`,
    },
  };

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: input.sectionLabel, path: input.sectionPath },
    { name: input.name, path: input.path },
  ]);

  const out: object[] = [definedTerm, breadcrumb];

  if (input.faq.length) {
    out.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: input.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return out;
}

/**
 * JSON-LD for an ingredient INDEX page: an `ItemList` of the indexable items
 * plus a `BreadcrumbList`. Pass only the indexable subset (thin entries are
 * excluded from both the sitemap and this list).
 */
export function ingredientIndexJsonLd(input: {
  sectionLabel: string;
  sectionPath: string;
  items: { name: string; path: string }[];
}) {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${input.sectionLabel} reference`,
    numberOfItems: input.items.length,
    itemListElement: input.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      url: `${BASE_URL}${it.path}`,
    })),
  };

  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: input.sectionLabel, path: input.sectionPath },
  ]);

  return [itemList, breadcrumb];
}
