import HSFormulaCallout from "@/modules/builder/components/HSFormulaCallout";

export default function BoilOffContent() {
  return (
    <>
      <p className="text-base leading-relaxed">
        During the boil, water evaporates but sugar stays. That concentrates
        your wort — gravity goes up as volume goes down. The calculator above
        tells you how much volume you&apos;ll end up with, or how long to boil
        to hit your target gravity.
      </p>

      <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4">
        How We Calculate It
      </h2>
      <HSFormulaCallout
        title="Post-Boil Volume"
        expression={"V_{post} = \\frac{V_{pre} \\times G_{pre}}{G_{target}}"}
        description="Same conservation principle as dilution, in reverse. Water leaves, sugar stays, gravity concentrates."
      />
      <p className="text-sm leading-relaxed">
        If you know your boil-off rate (liters per hour), you can also calculate
        the boil time needed to reach your target. Typical boil-off rates are
        3–5 L/hr depending on your kettle and burner. Need to go the other way
        and bring gravity down?{" "}
        <a
          href="/calculators/dilution"
          className="text-[var(--coral-500)] hover:underline font-medium"
        >
          Add water with the dilution calculator
        </a>
        .
      </p>
    </>
  );
}
