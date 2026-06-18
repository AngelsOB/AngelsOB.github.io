import Link from "next/link";

import { hsTokens } from "@/modules/builder/tokens";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSCard from "@/modules/builder/components/HSCard";
import { learnNav } from "@/modules/learn/docsConfig";
import { resolveCalculatorLink } from "./calculatorsMeta";

interface ResolvedLink {
  href: string;
  label: string;
  description: string;
}

/** Resolve a related href against both the calculator registry and learnNav. */
function resolve(href: string): ResolvedLink | null {
  const calc = resolveCalculatorLink(href);
  if (calc) return calc;
  for (const section of learnNav) {
    for (const link of section.links) {
      if (link.href === href) return link;
    }
  }
  return null;
}

export default function RelatedLinks({
  related,
  heading = "Related",
  variant = "grid",
}: {
  related: string[];
  heading?: string;
  /** "grid" = descriptive cards (hub directory). "inline" = slim link row. */
  variant?: "grid" | "inline";
}) {
  const links = related
    .map(resolve)
    .filter((l): l is ResolvedLink => Boolean(l));
  if (!links.length) return null;

  if (variant === "inline") {
    return (
      <div
        style={{
          marginTop: 24,
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <HSEyebrow>{heading}</HSEyebrow>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            gap: "4px 8px",
            fontFamily: hsTokens.body,
            fontSize: 13,
          }}
        >
          {links.map((link, i) => (
            <span key={link.href} style={{ display: "inline-flex", gap: 8 }}>
              <Link
                href={link.href}
                style={{
                  color: hsTokens.ink,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
              {i < links.length - 1 ? (
                <span aria-hidden style={{ color: hsTokens.muted }}>
                  ·
                </span>
              ) : null}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 40 }}>
      <HSEyebrow>{heading}</HSEyebrow>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        }}
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{ textDecoration: "none", color: hsTokens.ink }}
          >
            <HSCard shadow={2} padding="14px 18px">
              <div
                style={{
                  fontFamily: hsTokens.display,
                  fontSize: 16,
                  letterSpacing: "-0.02em",
                  color: hsTokens.ink,
                  marginBottom: 4,
                }}
              >
                {link.label}
              </div>
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 12,
                  color: hsTokens.muted,
                  lineHeight: 1.5,
                }}
              >
                {link.description}
              </div>
            </HSCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
