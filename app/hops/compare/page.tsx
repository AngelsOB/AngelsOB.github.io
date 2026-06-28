import type { Metadata } from "next";

import HopCompareClient from "@/modules/ingredients/hops/HopCompareClient";

export const metadata: Metadata = {
  title: "Compare Hops — Side-by-Side Flavor, Alpha Acid & Oil",
  description:
    "Compare any two or three hops side by side: overlay their flavor profiles on one radar, line up alpha and beta acid, oil, and origin, and see which to reach for.",
  alternates: { canonical: "/hops/compare" },
  // An interactive utility, not a content page — keep it out of the index
  // (and out of the sitemap) so it doesn't read as thin/duplicate.
  robots: { index: false, follow: true },
  openGraph: {
    title: "Compare Hops | Brewing.It",
    description:
      "Overlay two or three hops on one flavor radar and line up their alpha acid, oil, and origin.",
    url: "/hops/compare",
    siteName: "Brewing.It",
  },
  twitter: {
    card: "summary",
    title: "Compare Hops | Brewing.It",
    description:
      "Overlay two or three hops on one flavor radar and line up their stats.",
  },
};

export default function HopComparePage() {
  return <HopCompareClient />;
}
