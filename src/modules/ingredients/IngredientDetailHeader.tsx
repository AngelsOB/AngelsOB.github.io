import Link from "next/link";

import { hsTokens, hsAlpha } from "@/modules/builder/tokens";

/**
 * Shared detail-page header: a breadcrumb (Home › Hops › {title} — the section
 * crumb is the one-click way back), the templated H1, and the one-line lede.
 * Pairs with the BreadcrumbList JSON-LD. Body sections render below it per kind.
 */
export default function IngredientDetailHeader({
  crumbs,
  title,
  lede,
}: {
  /** Ancestor crumbs (e.g. Home, Hops) — the current page is added from `title`. */
  crumbs: { name: string; href: string }[];
  title: string;
  lede?: string;
}) {
  return (
    <header style={{ marginBottom: 22 }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
        <ol
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 7,
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
          }}
        >
          {crumbs.map((c) => (
            <li
              key={c.href}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <Link
                href={c.href}
                style={{ color: hsTokens.muted, textDecoration: "none" }}
              >
                {c.name}
              </Link>
              <span aria-hidden style={{ color: hsAlpha(hsTokens.ink, 33) }}>
                ›
              </span>
            </li>
          ))}
          <li aria-current="page" style={{ color: hsTokens.ink }}>
            {title}
          </li>
        </ol>
      </nav>

      <h1
        style={{
          fontFamily: hsTokens.display,
          fontSize: "clamp(30px, 5vw, 44px)",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: hsTokens.ink,
          margin: "8px 0 0",
        }}
      >
        {title}
      </h1>
      {lede ? (
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 16,
            lineHeight: 1.5,
            color: hsTokens.muted,
            maxWidth: 560,
            marginTop: 12,
          }}
        >
          {lede}
        </p>
      ) : null}
    </header>
  );
}
