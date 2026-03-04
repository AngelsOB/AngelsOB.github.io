import type { Metadata } from "next";
import BrowseRecipesPage from "../../src/modules/sharing/BrowseRecipesPage";

export const metadata: Metadata = {
  title: "Browse Recipes",
  description:
    "Discover homebrewing recipes shared by the community. Find inspiration for your next brew.",
};

export default function BrowsePage() {
  return <BrowseRecipesPage />;
}
