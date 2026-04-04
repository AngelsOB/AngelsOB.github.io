import Link from "next/link";
import type { ReactNode } from "react";
import { learnNav } from "./docsConfig";
import GrainGradient from "@/components/GrainGradient";

interface LearnArticleProps {
  /** Article title — rendered in display serif */
  title: string;
  /** Subtitle in handwritten font */
  subtitle?: string;
  /** Hrefs of related learn pages to cross-link at the bottom */
  relatedLearn?: string[];
  /** Article content */
  children: ReactNode;
  /** CTA text (defaults to "See this in the recipe builder") */
  ctaText?: string;
  /** CTA href (defaults to /recipes/new) */
  ctaHref?: string;
}

/** Resolve a learn href to its label and description from docsConfig */
function resolveLearnLink(href: string) {
  for (const section of learnNav) {
    for (const link of section.links) {
      if (link.href === href) return link;
    }
  }
  return null;
}

export default function LearnArticle({
  title,
  subtitle,
  relatedLearn,
  children,
  ctaText = "See this in the recipe builder",
  ctaHref = "/recipes/new",
}: LearnArticleProps) {
  const relatedLinks = relatedLearn
    ?.map(resolveLearnLink)
    .filter(Boolean) as NonNullable<ReturnType<typeof resolveLearnLink>>[];

  return (
    <article className="max-w-3xl brew-animate-in">
      {/* Hero heading */}
      <header className="mb-10">
        <h1
          className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight brew-animate-in"
          style={{
            fontFamily: "'Bitter', serif",
            color: "var(--fg-strong)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-3 text-lg brew-animate-in brew-stagger-1"
            style={{
              fontFamily: "'Shadows Into Light', cursive",
              color: "var(--fg-muted)",
              letterSpacing: "0.02em",
            }}
          >
            {subtitle}
          </p>
        )}
        <div
          className="mt-5 h-px w-24 brew-animate-in brew-stagger-2"
          style={{
            background:
              "linear-gradient(90deg, var(--coral-400), transparent)",
          }}
        />
      </header>

      {/* Article body — prose styling */}
      <div
        className="learn-prose space-y-5 brew-animate-in brew-stagger-3"
        style={{ color: "var(--fg-strong)" }}
      >
        {children}
      </div>

      {/* CTA */}
      <div className="mt-12 pt-8 border-t border-[color-mix(in_oklch,var(--fg-strong)_10%,transparent)]">
        <div
          className="rounded-2xl p-6 text-center relative overflow-hidden"
          style={{
            boxShadow: "var(--shadow-card)",
            border:
              "1px solid color-mix(in oklch, var(--coral-300) 30%, transparent)",
          }}
        >
          <GrainGradient
            stops={[
              { pos: 0, color: "var(--coral-100)" },
              { pos: 1, color: "var(--surface)" },
            ]}
            direction={135}
            displacement={0.5}
            grainOpacity={0.6}
            radius={10}
          />
          <p
            className="relative z-10 text-sm mb-4"
            style={{
              fontFamily: "'Shadows Into Light', cursive",
              color: "var(--fg-muted)",
              fontSize: "1.1rem",
            }}
          >
            See all the numbers come together in real time.
          </p>
          <Link href={ctaHref} className="btn-neon relative z-10 inline-block px-6 py-2.5">
            {ctaText}
          </Link>
        </div>
      </div>

      {/* Related articles */}
      {relatedLinks && relatedLinks.length > 0 && (
        <div className="mt-10">
          <h3
            className="text-xs font-bold uppercase tracking-widest mb-4"
            style={{
              fontFamily: "'Bitter', serif",
              color: "var(--fg-muted)",
              letterSpacing: "0.12em",
            }}
          >
            Related Topics
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group block rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5"
                style={{
                  background:
                    "color-mix(in oklch, var(--card) 80%, transparent)",
                  boxShadow: "var(--shadow-card)",
                  border:
                    "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
                }}
              >
                <span
                  className="text-sm font-semibold group-hover:text-[var(--coral-500)] transition-colors"
                  style={{ color: "var(--fg-strong)" }}
                >
                  {link.label}
                </span>
                <span
                  className="block mt-1 text-xs leading-relaxed"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {link.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
