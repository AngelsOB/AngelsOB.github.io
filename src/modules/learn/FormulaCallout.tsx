import MathBlock from "./MathBlock";
import GrainGradient from "@/components/GrainGradient";

interface FormulaCalloutProps {
  /** Label shown above the formula (e.g., "Tinseth Utilization") */
  title: string;
  /** LaTeX expression */
  expression: string;
  /** Optional plain-language description below the formula */
  description?: string;
}

/**
 * A styled callout card for displaying a formula with context.
 * Recessed card with paper-like texture — "equation on aged paper."
 */
export default function FormulaCallout({
  title,
  expression,
  description,
}: FormulaCalloutProps) {
  return (
    <figure
      className="my-8 rounded-2xl p-6 relative overflow-hidden"
      style={{
        boxShadow: `
          var(--shadow-inset),
          inset 0 0 0 1px color-mix(in oklch, var(--fg-strong) 8%, transparent)
        `,
      }}
    >
      <GrainGradient
        stops={[
          { pos: 0, color: "color-mix(in oklch, var(--surface) 92%, var(--coral-100))" },
          { pos: 1, color: "var(--surface)" },
        ]}
        direction={145}
        displacement={0.4}
        grainOpacity={0.5}
        radius={8}
      />
      <figcaption
        className="relative z-10 text-xs font-semibold uppercase tracking-wider mb-3"
        style={{
          color: "var(--fg-muted)",
          fontFamily: "'Bitter', serif",
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </figcaption>

      <div className="relative z-10">
        <MathBlock expression={expression} />
      </div>

      {description && (
        <p
          className="relative z-10 mt-3 text-sm leading-relaxed"
          style={{ color: "var(--fg-muted)" }}
        >
          {description}
        </p>
      )}
    </figure>
  );
}
