"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { hsTokens } from "../tokens";
import { learnNav } from "@/modules/learn/docsConfig";

export default function HSLearnNav() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Learn navigation"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 28,
        position: "sticky",
        top: 96,
        alignSelf: "start",
      }}
    >
      {learnNav.map((section) => (
        <div key={section.title}>
          <h3
            style={{
              fontFamily: hsTokens.body,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: hsTokens.muted,
              margin: "0 0 10px 12px",
            }}
          >
            {section.title}
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {section.links.map((link) => {
              const href = link.href;
              const isActive = pathname === href;
              return (
                <li key={link.href}>
                  <Link
                    href={href}
                    style={{
                      display: "block",
                      padding: "9px 12px",
                      borderRadius: 8,
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                      fontWeight: 600,
                      color: isActive ? hsTokens.ink : hsTokens.muted,
                      background: isActive ? `color-mix(in oklch, ${hsTokens.malt} 30%, transparent)` : "transparent",
                      textDecoration: "none",
                      borderLeft: isActive
                        ? `3px solid ${hsTokens.malt}`
                        : `3px solid transparent`,
                      transition: "background 120ms ease, color 120ms ease",
                    }}
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
}
