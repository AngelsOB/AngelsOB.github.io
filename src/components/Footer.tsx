import Link from "next/link";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="relative mt-12">
      {/* Decorative divider — accent-tinted gradient line */}
      <div
        className="mx-auto h-px max-w-5xl"
        style={{
          background: `linear-gradient(
            90deg,
            transparent 0%,
            color-mix(in oklch, var(--coral-400) 35%, transparent) 20%,
            color-mix(in oklch, var(--coral-400) 50%, transparent) 50%,
            color-mix(in oklch, var(--coral-400) 35%, transparent) 80%,
            transparent 100%
          )`,
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
          {/* Left — branding */}
          <div className="text-center sm:text-left">
            <Logo size="sm" />
            <p
              className="mt-1.5 text-xs leading-relaxed"
              style={{
                color: "var(--fg-muted)",
                letterSpacing: "0.04em",
              }}
            >
              The only tab you need on brew day.
            </p>
          </div>

          {/* Right — nav links */}
          <nav aria-label="Footer navigation" className="flex items-center gap-5">
            <Link
              href="/recipes"
              className="text-xs font-medium transition-colors duration-150"
              style={{ color: "var(--fg-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--coral-500)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
            >
              Recipes
            </Link>
            <span
              className="h-3 w-px"
              style={{
                background: "color-mix(in oklch, var(--fg-muted) 30%, transparent)",
              }}
            />
            <Link
              href="/calculators"
              className="text-xs font-medium transition-colors duration-150"
              style={{ color: "var(--fg-muted)" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--coral-500)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
            >
              Calculators
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
