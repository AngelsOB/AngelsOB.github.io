import { notFound } from "next/navigation";

import SteeringStudio from "@/modules/corpus-lab/ui/SteeringStudio";

export const metadata = {
  title: "Brew Studio (dev)",
  robots: { index: false, follow: false },
};

// Dev-only for now — the steering UI talks to app/api/lab/steering, which reads
// the gitignored local cloud.ndjson. This page is the eventual production home
// of the corpus-lab "median brew + flavour steering" feature; it 404s outside
// development until the engine has a real production data path.
export default function BrewStudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SteeringStudio />;
}
