"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { learnNav } from "./docsConfig";

export default function LearnNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <nav aria-label="Learn navigation" className="space-y-6">
      {learnNav.map((section) => (
        <div key={section.title}>
          <h3
            className="text-[11px] font-bold uppercase tracking-widest mb-2.5 px-3"
            style={{
              color: "var(--fg-muted)",
              fontFamily: "'Bitter', serif",
              letterSpacing: "0.14em",
            }}
          >
            {section.title}
          </h3>
          <ul className="space-y-0.5">
            {section.links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "block px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-[color-mix(in_oklch,var(--coral-500)_12%,transparent)] text-[var(--coral-600)] shadow-sm"
                        : "text-[var(--fg-muted)] hover:text-[var(--fg-strong)] hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]",
                    ].join(" ")}
                    style={
                      isActive
                        ? {
                            borderLeft: "2px solid var(--coral-500)",
                          }
                        : { borderLeft: "2px solid transparent" }
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block w-56 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor:
            "color-mix(in oklch, var(--fg-strong) 15%, transparent) transparent",
        }}
      >
        <div
          className="rounded-2xl p-4 backdrop-blur-md"
          style={{
            background: "color-mix(in oklch, var(--card) 80%, transparent)",
            boxShadow: "var(--shadow-card)",
            border:
              "1px solid color-mix(in oklch, var(--fg-strong) 8%, transparent)",
          }}
        >
          {navContent}
        </div>
      </aside>

      {/* Mobile toggle */}
      <div className="lg:hidden fixed bottom-6 left-6 z-40">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 grain"
          style={{
            background:
              "linear-gradient(135deg, var(--coral-500), var(--coral-600))",
            color: "white",
            boxShadow: `
              0 4px 12px color-mix(in oklch, var(--coral-500) 40%, transparent),
              0 1px 3px rgba(0,0,0,0.12)
            `,
          }}
          aria-expanded={mobileOpen}
          aria-controls="learn-mobile-nav"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            {mobileOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            )}
          </svg>
          {mobileOpen ? "Close" : "Topics"}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Panel */}
          <div
            id="learn-mobile-nav"
            className="lg:hidden fixed bottom-20 left-4 right-4 z-40 max-h-[70vh] overflow-y-auto rounded-2xl p-5 brew-animate-in"
            style={{
              background: "var(--card)",
              boxShadow: "var(--shadow-elevated)",
              border:
                "1px solid color-mix(in oklch, var(--fg-strong) 10%, transparent)",
            }}
          >
            {navContent}
          </div>
        </>
      )}
    </>
  );
}
