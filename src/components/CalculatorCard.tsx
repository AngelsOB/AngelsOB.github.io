import type { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  compact?: boolean;
  subtitle?: string;
};

export default function CalculatorCard({
  title,
  children,
  right,
  compact,
  subtitle,
}: Props) {
  return (
    <section
      className={[
        "card-glass card-inner-ring neon-glow",
        compact ? "p-4" : "p-5 sm:p-6",
      ].join(" ")}
    >
      <header
        className={[
          "flex items-baseline justify-between",
          compact ? "mb-2" : "mb-4",
        ].join(" ")}
      >
        <div className="flex items-baseline gap-2">
          <h2
            className={[
              "font-semibold text-strong tracking-tight",
              compact ? "text-sm" : "text-base",
            ].join(" ")}
          >
            {title}
          </h2>
          {subtitle && (
            <span className="text-xs text-muted opacity-60">{subtitle}</span>
          )}
        </div>
        {right !== undefined ? (
          <div className="text-muted opacity-50">{right}</div>
        ) : null}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
