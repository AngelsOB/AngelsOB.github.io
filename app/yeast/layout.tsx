import type { ReactNode } from "react";

import IngredientShell from "@/modules/ingredients/IngredientShell";
import { YEAST_SECTION } from "@/modules/ingredients/yeast/yeastKind";

/**
 * Shared surface for /yeast. The big masthead shows on the index only; each page
 * lays out its own body + sticky accordion sidebar. (See IngredientShell.)
 */
export default function YeastLayout({ children }: { children: ReactNode }) {
  return <IngredientShell section={YEAST_SECTION}>{children}</IngredientShell>;
}
