"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { hsTokens } from "../tokens";
import HSBrandMark from "./HSBrandMark";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/calculators", label: "Calculators" },
  { href: "/learn", label: "Learn" },
];

function classicHrefFor(pathname: string): string {
  if (pathname.startsWith("/recipes/new")) return "/betabuilder/recipes/new";
  const m = pathname.match(/^\/recipes\/([^/]+)$/);
  if (m) return `/betabuilder/recipes/${m[1]}`;
  if (pathname.startsWith("/recipes")) return "/betabuilder/recipes";
  if (pathname.startsWith("/calculators")) return "/betabuilder/calculators";
  if (pathname.startsWith("/learn")) return "/betabuilder/learn";
  if (pathname.startsWith("/browse")) return "/betabuilder/browse";
  if (pathname.startsWith("/r/")) return `/betabuilder${pathname}`;
  return "/betabuilder";
}

export default function HSHeader() {
  const pathname = usePathname() ?? "";
  const currentRecipe = useRecipeStore((s) => s.currentRecipe);

  const caption = useMemo(() => {
    if (pathname === "/") return undefined;
    if (pathname.startsWith("/recipes/new")) return "/ recipes / new";
    if (pathname.match(/^\/recipes\/[^/]+$/)) {
      const name = currentRecipe?.name?.trim();
      return `/ recipes${name ? ` / ${name.toLowerCase()}` : ""}`;
    }
    if (pathname.startsWith("/recipes")) return "/ recipes";
    if (pathname.startsWith("/calculators")) return "/ calculators";
    if (pathname.startsWith("/learn")) return "/ learn";
    if (pathname.startsWith("/browse")) return "/ browse";
    if (pathname.startsWith("/r/")) return "/ shared recipe";
    return undefined;
  }, [pathname, currentRecipe?.name]);

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "20px clamp(20px, 4vw, 56px)",
        borderBottom: `2px solid ${hsTokens.ink}`,
        gap: 16,
        flexWrap: "wrap",
        background: hsTokens.cream,
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
      className="hs-header"
    >
      <HSBrandMark caption={caption} />

      <nav
        className="hs-no-scrollbar"
        aria-label="Primary"
        style={{
          display: "flex",
          gap: 4,
          alignItems: "center",
          background: hsTokens.paper,
          padding: 6,
          borderRadius: 999,
          border: `2px solid ${hsTokens.ink}`,
          boxShadow: hsTokens.sh2,
        }}
      >
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: active ? hsTokens.ink : hsTokens.muted,
                background: active ? hsTokens.malt : "transparent",
                borderRadius: 999,
                border: active ? `2px solid ${hsTokens.ink}` : "2px solid transparent",
                textDecoration: "none",
                fontFamily: hsTokens.body,
              }}
            >
              {l.label}
            </Link>
          );
        })}
        <Link
          href={classicHrefFor(pathname)}
          title="Switch to classic site"
          style={{
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 700,
            background: hsTokens.ink,
            color: hsTokens.cream,
            borderRadius: 999,
            textDecoration: "none",
            fontFamily: hsTokens.body,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Classic <span aria-hidden>↺</span>
        </Link>
      </nav>
      <style>{`
        @media (max-width: 720px) {
          .hs-header {
            flex-direction: column;
            align-items: stretch;
            padding: 14px 20px;
          }
          .hs-header > nav {
            width: 100%;
            justify-content: flex-start;
            overflow-x: auto;
          }
        }
      `}</style>
    </header>
  );
}
