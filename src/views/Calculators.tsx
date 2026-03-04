import AbvCalculator from "../components/AbvCalculator";
import BoilOffCalculator from "../components/BoilOffCalculator";
import DilutionCalculator from "../components/DilutionCalculator";

export default function Calculators() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Hero header ── */}
      <div className="relative overflow-hidden -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-10 mb-2">
        {/* Ambient glow — mash-orange warmth */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 55% at 15% -5%, color-mix(in oklch, var(--brew-accent-300) 14%, transparent), transparent 65%),
              radial-gradient(ellipse 50% 50% at 85% 10%, color-mix(in oklch, var(--brew-accent-400) 10%, transparent), transparent 55%)
            `,
          }}
        />

        <div className="relative">
          <div className="brew-animate-in brew-stagger-1">
            <span
              className="inline-block text-[10px] font-bold uppercase mb-4"
              style={{
                letterSpacing: "0.2em",
                color: "var(--brew-accent-500)",
              }}
            >
              Brew-day math
            </span>
          </div>

          <h1
            className="text-3xl sm:text-4xl font-black leading-[0.95] brew-animate-in brew-stagger-2"
            style={{
              color: "var(--fg-strong)",
              letterSpacing: "-0.035em",
            }}
          >
            Calculators
          </h1>

          <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed max-w-md brew-animate-in brew-stagger-3">
            Quick gravity and volume math &mdash; no spreadsheet required.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="brew-animate-in brew-stagger-4">
          <AbvCalculator />
        </div>
        <div className="brew-animate-in brew-stagger-6">
          <DilutionCalculator />
        </div>
        <div className="brew-animate-in brew-stagger-8">
          <BoilOffCalculator />
        </div>
      </div>
    </div>
  );
}
