'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";

import { hsTokens } from "../tokens";
import HSScriptNote from "./HSScriptNote";
import { useUnsavedChangesStore } from "@/modules/recipe/stores/unsavedChangesStore";

const COLS: { label: string; links: { href: string; text: string }[] }[] = [
  {
    label: "Brew",
    links: [
      { href: "/recipes", text: "Recipes" },
      { href: "/calculators", text: "Calculators" },
      { href: "/recipes/new", text: "Start a recipe" },
    ],
  },
  {
    label: "Learn",
    links: [
      { href: "/learn", text: "Brewing science" },
      { href: "/learn/ibu", text: "IBU" },
      { href: "/learn/gravity", text: "Gravity" },
    ],
  },
  {
    label: "About",
    links: [
      { href: "/privacy", text: "Privacy" },
      { href: "/terms", text: "Terms" },
      { href: "/credits", text: "Credits" },
    ],
  },
];

export default function HSFooter() {
  const router = useRouter();
  // Footer link click handler that routes through the unsaved-changes guard
  // when the recipe editor is mounted with dirty edits.
  const handleFooterClick = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    const { isActive, guardNavigation } = useUnsavedChangesStore.getState();
    if (isActive) {
      e.preventDefault();
      guardNavigation(() => router.push(href));
    }
  };

  return (
    <footer
      aria-label="Footer navigation"
      style={{
        background: hsTokens.ink,
        color: hsTokens.cream,
        borderTop: `2px solid ${hsTokens.ink}`,
        marginTop: 96,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "56px 24px 40px",
          display: "grid",
          gap: 40,
        }}
        className="hs-footer-grid"
      >
        <div>
          <svg width="100" height="40" viewBox="0 0 100 40" aria-hidden style={{ display: "block" }}>
            <circle cx="14" cy="20" r="13" fill={hsTokens.roast} stroke={hsTokens.cream} strokeWidth={1.6} />
            <rect x="20" y="7" width="26" height="26" rx="5" fill={hsTokens.malt} stroke={hsTokens.cream} strokeWidth={1.6} />
            <polygon
              points="48,32 64,8 80,32"
              fill={hsTokens.water}
              stroke={hsTokens.cream}
              strokeWidth={1.6}
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ marginTop: 18 }}>
            <HSScriptNote color={hsTokens.malt} size={26}>
              made with malt &amp; love.
            </HSScriptNote>
          </div>
          <p
            style={{
              marginTop: 18,
              fontFamily: hsTokens.body,
              fontSize: 13,
              lineHeight: 1.5,
              color: hsTokens.muted,
              maxWidth: 280,
            }}
          >
            Recipes, calculators, and a builder that understands your system. Built by a brewer
            who just kept forgetting things.
          </p>
        </div>

        {COLS.map((col) => (
          <div key={col.label}>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: hsTokens.muted,
                marginBottom: 14,
              }}
            >
              {col.label}
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={handleFooterClick(l.href)}
                    style={{
                      color: hsTokens.cream,
                      textDecoration: "none",
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                    }}
                  >
                    {l.text}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "20px 24px",
          borderTop: `1px solid color-mix(in oklch, ${hsTokens.cream} 18%, transparent)`,
          fontSize: 11,
          color: hsTokens.muted,
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <span>© {new Date().getFullYear()} Brewing.It · Hop &amp; Skip preview</span>
      </div>

      <style>{`
        /* Base columns live HERE (not inline) so the responsive overrides below
           actually win — an inline grid-template-columns outranks these media
           queries and the 260px first column then overflows narrow screens. */
        .hs-footer-grid {
          grid-template-columns: minmax(260px, 1fr) repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 900px) {
          .hs-footer-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .hs-footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </footer>
  );
}
