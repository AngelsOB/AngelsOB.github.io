import type { Metadata } from "next";

import RecipesListClient from "./RecipesListClient";

// Auth-gated personal recipe list — keep out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Page() {
  return <RecipesListClient />;
}
