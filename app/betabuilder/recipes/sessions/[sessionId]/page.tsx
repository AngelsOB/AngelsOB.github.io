import type { Metadata } from "next";
// Classic mirror: the /betabuilder/* route deliberately renders the quarantined classic
// BrewSessionPage as the side-by-side reference per HOPSKIP_MIGRATION_PRD.md.
// eslint-disable-next-line no-restricted-imports
import BrewSessionPage from "@/modules/beta-builder/presentation/components/BrewSessionPage";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SessionPage() {
  return <BrewSessionPage />;
}
