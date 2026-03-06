import type { Metadata } from "next";
import BetaBuilderPage from "../../../src/modules/beta-builder/presentation/components/BetaBuilderPage";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RecipePage() {
  return <BetaBuilderPage />;
}
