import Link from "next/link";
import Logo from "./Logo";

const footerSections = [
  {
    title: "Brew",
    links: [
      { href: "/recipes/new", label: "Recipe Builder" },
      { href: "/browse", label: "Browse Recipes" },
      { href: "/calculators", label: "Calculators" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/learn/ibu", label: "IBU & Bitterness" },
      { href: "/learn/gravity", label: "Gravity & ABV" },
      { href: "/learn/mash-ph", label: "Mash pH" },
      { href: "/learn", label: "All Topics" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/recipes", label: "My Recipes" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/credits", label: "Credits" },
    ],
  },
] as const;

export default function Footer() {
  return (
    <footer data-physics="footer" className="relative mt-12">
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
        <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">
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

          {/* Right — link columns */}
          <nav
            aria-label="Footer navigation"
            className="flex gap-12 sm:gap-16"
          >
            {footerSections.map((section) => (
              <div key={section.title}>
                <h4
                  className="text-[11px] font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {section.title}
                </h4>
                <ul className="space-y-2">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-xs font-medium transition-colors duration-150"
                        style={{ color: "var(--fg-muted)" }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "var(--coral-500)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "var(--fg-muted)")
                        }
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
