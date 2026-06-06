import type { Metadata } from "next";
import HopSkipBuilder from "@/modules/hopskip/components/HopSkipBuilder";

export const dynamic = "force-dynamic";

// Auth-gated recipe editor — keep out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HopSkipBuilder />;
}
