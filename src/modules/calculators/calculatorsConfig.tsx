import type { ComponentType } from "react";

import { CALCULATORS_META, type CalculatorMeta } from "./calculatorsMeta";

import AbvCalculator from "@/modules/builder/components/calculators/AbvCalculator";
import IbuCalculator from "@/modules/builder/components/calculators/IbuCalculator";
import BoilOffCalculator from "@/modules/builder/components/calculators/BoilOffCalculator";
import DilutionCalculator from "@/modules/builder/components/calculators/DilutionCalculator";
import CarbonationCalculator from "@/modules/builder/components/calculators/CarbonationCalculator";
import HydrometerCorrectionCalculator from "@/modules/builder/components/calculators/HydrometerCorrectionCalculator";
import StrikeTempCalculator from "@/modules/builder/components/calculators/StrikeTempCalculator";

import AbvContent from "./content/AbvContent";
import IbuContent from "./content/IbuContent";
import BoilOffContent from "./content/BoilOffContent";
import DilutionContent from "./content/DilutionContent";
import CarbonationContent from "./content/CarbonationContent";
import HydrometerContent from "./content/HydrometerContent";
import StrikeTempContent from "./content/StrikeTempContent";

// ─────────────────────────────────────────────────────────────────────────
// Full calculator registry: metadata (calculatorsMeta) merged with the live
// calculator component and the article body. Imported by the routes and the
// featured-column shell — NOT by the client sidebar/sitemap (those use the
// pure-data calculatorsMeta to stay lightweight).
// ─────────────────────────────────────────────────────────────────────────

type CalculatorComponent = ComponentType<{ accent?: string }>;

export interface CalculatorEntry extends CalculatorMeta {
  Calculator: CalculatorComponent;
  Article: ComponentType;
}

const COMPONENTS: Record<
  string,
  { Calculator: CalculatorComponent; Article: ComponentType }
> = {
  abv: { Calculator: AbvCalculator, Article: AbvContent },
  ibu: { Calculator: IbuCalculator, Article: IbuContent },
  "boil-off": { Calculator: BoilOffCalculator, Article: BoilOffContent },
  dilution: { Calculator: DilutionCalculator, Article: DilutionContent },
  carbonation: { Calculator: CarbonationCalculator, Article: CarbonationContent },
  hydrometer: {
    Calculator: HydrometerCorrectionCalculator,
    Article: HydrometerContent,
  },
  "strike-temp": { Calculator: StrikeTempCalculator, Article: StrikeTempContent },
};

export const CALCULATORS: Record<string, CalculatorEntry> = Object.fromEntries(
  CALCULATORS_META.map((meta): [string, CalculatorEntry] => [
    meta.slug,
    { ...meta, ...COMPONENTS[meta.slug] },
  ])
);

export function getCalculator(slug: string): CalculatorEntry | null {
  return CALCULATORS[slug] ?? null;
}
