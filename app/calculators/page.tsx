import type { Metadata } from "next";

import CalculatorsClient from "./CalculatorsClient";
import { breadcrumbJsonLd } from "@/utils/seo";

export const metadata: Metadata = {
  title: "Brewing Calculators - ABV, IBU, Carbonation & More",
  description:
    "Free homebrewing calculators: ABV, IBU, boil-off, dilution, carbonation, hydrometer temperature correction, and strike water temperature. No signup needed.",
  alternates: { canonical: "/calculators" },
  openGraph: {
    title: "Brewing Calculators | Brewing.It",
    description:
      "Free homebrewing calculators: ABV, IBU, boil-off, dilution, carbonation, hydrometer correction, and strike temperature.",
    url: "/calculators",
    siteName: "Brewing.It",
  },
  twitter: {
    card: "summary",
    title: "Brewing Calculators | Brewing.It",
    description:
      "Free homebrewing calculators: ABV, IBU, boil-off, dilution, carbonation, hydrometer correction, and strike temperature.",
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com";

// Each calculator also has a standalone page under /learn with the formula
// explained — those are the canonical landing pages for calculator queries.
const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Brewing Calculators",
  itemListElement: [
    { name: "ABV Calculator", path: "/learn/abv-calculator" },
    { name: "IBU Calculator", path: "/learn/ibu" },
    { name: "Boil-Off Calculator", path: "/learn/boil-off-calculator" },
    { name: "Dilution Calculator", path: "/learn/dilution-calculator" },
    { name: "Carbonation Calculator", path: "/learn/carbonation-calculator" },
    {
      name: "Hydrometer Temperature Correction Calculator",
      path: "/learn/hydrometer-calculator",
    },
    {
      name: "Strike Water Temperature Calculator",
      path: "/learn/strike-temp-calculator",
    },
  ].map((item, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: item.name,
    url: `${BASE_URL}${item.path}`,
  })),
};

const jsonLd = [
  itemListJsonLd,
  breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Calculators", path: "/calculators" },
  ]),
];

export default function CalculatorsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CalculatorsClient />
    </>
  );
}
