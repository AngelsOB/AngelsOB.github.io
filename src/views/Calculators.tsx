import GrainGradient from "@/components/GrainGradient";
// eslint-disable-next-line no-restricted-imports -- classic /betabuilder/calculators is the quarantined reference; intentional import
import OLD_AbvCalculator from "../components/OLD_AbvCalculator";
// eslint-disable-next-line no-restricted-imports -- classic /betabuilder/calculators is the quarantined reference; intentional import
import OLD_BoilOffCalculator from "../components/OLD_BoilOffCalculator";
// eslint-disable-next-line no-restricted-imports -- classic /betabuilder/calculators is the quarantined reference; intentional import
import OLD_CarbonationCalculator from "../components/OLD_CarbonationCalculator";
// eslint-disable-next-line no-restricted-imports -- classic /betabuilder/calculators is the quarantined reference; intentional import
import OLD_DilutionCalculator from "../components/OLD_DilutionCalculator";
// eslint-disable-next-line no-restricted-imports -- classic /betabuilder/calculators is the quarantined reference; intentional import
import OLD_HydrometerCorrectionCalculator from "../components/OLD_HydrometerCorrectionCalculator";

export default function Calculators() {
  return (
    <div className="max-w-2xl mx-auto">
      {/* ── Hero header ── */}
      <div className="full-bleed relative overflow-hidden -mt-6 pt-8 pb-10 mb-2">
        {/* Grainy ambient glow — displacement shader */}
        <GrainGradient
          stops={[
            { pos: 0,    color: "color-mix(in oklch, var(--brew-accent-300) 18%, transparent)" },
            { pos: 0.55, color: "color-mix(in oklch, var(--brew-accent-200) 8%, transparent)" },
            { pos: 1,    color: "transparent" },
          ]}
          direction={150}
          displacement={0.6}
          grainOpacity={0.7}
          radius={12}
        />

        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6">
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
          <OLD_AbvCalculator />
        </div>
        <div className="brew-animate-in brew-stagger-6">
          <OLD_DilutionCalculator />
        </div>
        <div className="brew-animate-in brew-stagger-8">
          <OLD_BoilOffCalculator />
        </div>
        <div className="brew-animate-in brew-stagger-10">
          <OLD_CarbonationCalculator />
        </div>
        <div className="brew-animate-in brew-stagger-12">
          <OLD_HydrometerCorrectionCalculator />
        </div>
      </div>
    </div>
  );
}
