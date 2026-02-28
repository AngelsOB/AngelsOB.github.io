import CalculatorCard from "../components/CalculatorCard";
import AbvCalculator from "../components/AbvCalculator";
import IbuCalculator from "../components/IbuCalculator";
import WaterSaltsCalc from "../components/WaterSaltsCalc";
import BoilOffCalculator from "../components/BoilOffCalculator";

export default function Calculators() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Calculators</h1>
        <p className="mt-1 text-muted text-sm">
          Quick brewing helpers. More coming soon.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div id="abv">
          <AbvCalculator />
        </div>
        <IbuCalculator />
        <WaterSaltsCalc />
        <BoilOffCalculator />
        <CalculatorCard title="SRM">
          <div className="text-sm text-muted">Coming next.</div>
        </CalculatorCard>
        <CalculatorCard title="Strike Water Temp">
          <div className="text-sm text-muted">Coming next.</div>
        </CalculatorCard>
        <CalculatorCard title="Priming Sugar">
          <div className="text-sm text-muted">Coming next.</div>
        </CalculatorCard>
      </div>
    </div>
  );
}
