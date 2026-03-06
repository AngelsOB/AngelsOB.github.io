import type { Metadata } from "next";
import RecipeListPage from "../../src/modules/beta-builder/presentation/components/RecipeListPage";

export const metadata: Metadata = {
  title: "Recipes",
  description:
    "Browse and manage your homebrewing recipes. Create, duplicate, and track brew sessions.",
  robots: { index: false, follow: false },
};

export default function RecipesPage() {
  return <RecipeListPage />;
}
