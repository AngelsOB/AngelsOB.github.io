import HSFormulaCallout from "@/modules/builder/components/HSFormulaCallout";

export default function DilutionContent() {
  return (
    <>
      <p className="text-base leading-relaxed">
        Overshot your target gravity? The calculator above tells you exactly how
        much water to add to bring it back down. Enter your current volume and
        gravity, set your target, and it gives you the water volume needed.
      </p>

      <h2 id="how-we-calculate-it" className="text-xl font-bold mt-10 mb-4">
        How We Calculate It
      </h2>
      <HSFormulaCallout
        title="Gravity Points Conservation"
        expression={
          "V_{total} = \\frac{V_{current} \\times G_{current}}{G_{target}}"
        }
        description="Sugar doesn't disappear when you add water. The total gravity points stay constant. Water to add = total volume − current volume."
      />
      <p className="text-sm leading-relaxed">
        This is basic conservation of mass. The gravity points (sugar content)
        in your wort don&apos;t change when you add water — you&apos;re just
        spreading them across a larger volume. It&apos;s exact, not an
        approximation. If your gravity is too low instead,{" "}
        <a
          href="/calculators/boil-off"
          className="text-[var(--coral-500)] hover:underline font-medium"
        >
          boil it down
        </a>{" "}
        to concentrate it.
      </p>
    </>
  );
}
