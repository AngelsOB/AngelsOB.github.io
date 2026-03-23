import MathBlock from "./MathBlock";

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
        background: `
          url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E") repeat,
          linear-gradient(
            145deg,
            color-mix(in oklch, var(--surface) 92%, var(--coral-100)),
            var(--surface)
          )
        `,
        boxShadow: `
          var(--shadow-inset),
          inset 0 0 0 1px color-mix(in oklch, var(--fg-strong) 8%, transparent)
        `,
      }}
    >
      <figcaption
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{
          color: "var(--fg-muted)",
          fontFamily: "'Bitter', serif",
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </figcaption>

      <MathBlock expression={expression} />

      {description && (
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--fg-muted)" }}
        >
          {description}
        </p>
      )}
    </figure>
  );
}
