import type { Metadata } from "next";
import BetaBuilderPage from "../../../src/modules/beta-builder/presentation/components/BetaBuilderPage";

export const metadata: Metadata = {
  title: "New Recipe",
  description:
    "Create a new homebrewing recipe with real-time calculations for OG, FG, IBU, SRM, and ABV.",
  robots: { index: false, follow: false },
};

export default function NewRecipePage() {
  return <BetaBuilderPage />;
}
