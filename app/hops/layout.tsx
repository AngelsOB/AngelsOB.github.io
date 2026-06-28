import type { ReactNode } from "react";

import IngredientShell from "@/modules/ingredients/IngredientShell";
import { HOP_SECTION } from "@/modules/ingredients/hops/hopKind";

/**
 * Shared surface for /hops. The big masthead shows on the index only; each page
 * lays out its own body + sticky accordion sidebar. (See IngredientShell.)
 */
export default function HopsLayout({ children }: { children: ReactNode }) {
  return <IngredientShell section={HOP_SECTION}>{children}</IngredientShell>;
}
