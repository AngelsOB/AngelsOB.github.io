import type { Metadata } from "next";
import Link from "next/link";
import { learnNav } from "@/modules/learn/docsConfig";

export const metadata: Metadata = {
  title: "Learn Brewing Science",
  description:
    "Explore the science behind every calculation in Brewing.It: IBU, gravity, mash pH, enzyme kinetics, hop flavor, and more. Formulas explained with real sources.",
  alternates: { canonical: "/learn" },
  openGraph: {
    title: "Learn Brewing Science | Brewing.It Learn",
    description:
      "Explore the science behind every calculation in Brewing.It: IBU, gravity, mash pH, enzyme kinetics, hop flavor, and more. Formulas explained with real sources.",
  },
  twitter: {
    card: "summary",
    title: "Learn Brewing Science | Brewing.It Learn",
    description:
      "Explore the science behind every calculation in Brewing.It: IBU, gravity, mash pH, enzyme kinetics, hop flavor, and more. Formulas explained with real sources.",
  },
};

export default function LearnIndexPage() {
  return (
    <div className="brew-animate-in">
      {/* Hero */}
      <header className="mb-12">
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight"
          style={{
            fontFamily: "'Bitter', serif",
            color: "var(--fg-strong)",
          }}
        >
          Brewing Science
        </h1>
        <p
          className="mt-3 text-lg brew-animate-in brew-stagger-1"
          style={{
            fontFamily: "'Shadows Into Light', cursive",
            color: "var(--fg-muted)",
          }}
        >
          The research behind the numbers.
        </p>
        <div
          className="mt-5 h-px w-24 brew-animate-in brew-stagger-2"
          style={{
            background:
              "linear-gradient(90deg, var(--coral-400), transparent)",
          }}
        />
      </header>

      {/* Sections */}
      {learnNav.map((section, sectionIdx) => (
        <section key={section.title} className={sectionIdx > 0 ? "mt-12" : ""}>
          <h2
            className="text-xs font-bold uppercase tracking-widest mb-5"
            style={{
              fontFamily: "'Bitter', serif",
              color: "var(--fg-muted)",
              letterSpacing: "0.14em",
            }}
          >
            {section.title}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.links.map((link, linkIdx) => (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "group block rounded-2xl p-5 transition-all duration-200",
                  "hover:-translate-y-1 hover:shadow-lg",
                  "brew-animate-in",
                  `brew-stagger-${Math.min(linkIdx + sectionIdx * 3 + 3, 10)}`,
                ].join(" ")}
                style={{
                  background:
                    "color-mix(in oklch, var(--card) 85%, transparent)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "var(--shadow-card)",
                  border:
                    "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
                }}
              >
                <span
                  className="text-sm font-bold group-hover:text-[var(--coral-500)] transition-colors duration-150"
                  style={{
                    fontFamily: "'Bitter', serif",
                    color: "var(--fg-strong)",
                  }}
                >
                  {link.label}
                </span>
                <span
                  className="block mt-2 text-xs leading-relaxed"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {link.description}
                </span>

                {/* Arrow indicator */}
                <span
                  className="inline-block mt-3 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ color: "var(--coral-500)" }}
                >
                  Read more →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
