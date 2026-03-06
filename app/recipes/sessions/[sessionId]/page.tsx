import type { Metadata } from "next";
import BrewSessionPage from "../../../../src/modules/beta-builder/presentation/components/BrewSessionPage";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SessionPage() {
  return <BrewSessionPage />;
}
