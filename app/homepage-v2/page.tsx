import type { Metadata } from "next";
import HomepageV2 from "@/modules/home/v2/HomepageV2";

// Test route for the restructured homepage (experiment hero -> horizontal plan
// explainers -> mash 3-col with the curve-vs-standard graph -> vertical rest).
// Kept out of the index while we iterate.
export const metadata: Metadata = {
  title: "Homepage V2 (test)",
  robots: { index: false, follow: false },
};

export default function HomepageV2Page() {
  return <HomepageV2 />;
}
