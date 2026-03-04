import type { Metadata } from "next";
import Calculators from "../../src/views/Calculators";

export const metadata: Metadata = {
  title: "Brewing Calculators",
  description:
    "Free brewing calculators for ABV, boil-off volume, dilution, and more. Brew-day math without the spreadsheet.",
};

export default function CalculatorsPage() {
  return <Calculators />;
}
