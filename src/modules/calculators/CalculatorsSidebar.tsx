"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LazyMotion, domMax, m, useReducedMotion } from "framer-motion";

import { hsTokens } from "@/modules/builder/tokens";
import HSCard from "@/modules/builder/components/HSCard";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import { springTrack } from "@/modules/builder/motion";
import {
  CALCULATOR_CATEGORIES,
  getCalculatorMeta,
} from "./calculatorsMeta";

const PREFIX = "/calculators/";

/**
 * The persistent right-hand catalog. Each calculator is a real <Link> (crawlable
 * + prefetched), and the active one is backed by a shared-layout pill that
 * slides between calcs on navigation (springTrack — the indicator/follow token).
 * Lives in the /calculators layout, so it never unmounts and the slide is smooth.
 */
export default function CalculatorsSidebar() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const activeSlug =
    pathname && pathname.startsWith(PREFIX)
      ? pathname.slice(PREFIX.length)
      : null;

  return (
    <LazyMotion features={domMax} strict>
      <aside style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {CALCULATOR_CATEGORIES.map((cat) => (
          <HSCard key={cat.label} shadow={2} padding="14px 16px 16px">
            <HSEyebrow>{cat.label}</HSEyebrow>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginTop: 10,
              }}
            >
              {cat.slugs.map((slug) => {
                const c = getCalculatorMeta(slug);
                if (!c) return null;
                const isActive = slug === activeSlug;
                return (
                  <Link
                    key={slug}
                    href={`/calculators/${slug}`}
                    aria-current={isActive ? "page" : undefined}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: `1.5px solid ${hsTokens.ink}`,
                      background: isActive ? "transparent" : hsTokens.paper,
                      color: hsTokens.ink,
                      textDecoration: "none",
                      fontFamily: hsTokens.body,
                      fontSize: 13,
                      textAlign: "left",
                    }}
                  >
                    {isActive ? (
                      <m.span
                        layoutId="calc-active"
                        transition={reduced ? { duration: 0 } : springTrack}
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 999,
                          background: c.accent,
                          zIndex: 0,
                        }}
                      />
                    ) : null}
                    <span
                      style={{
                        position: "relative",
                        zIndex: 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 0,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: c.accent,
                          border: `1px solid ${hsTokens.ink}`,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{c.label}</span>
                    </span>
                    <span
                      aria-hidden
                      style={{
                        position: "relative",
                        zIndex: 1,
                        color: isActive ? hsTokens.ink : hsTokens.muted,
                        fontSize: 16,
                      }}
                    >
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          </HSCard>
        ))}

        <HSCard shadow={1} padding="12px 14px" bg={hsTokens.cream2}>
          <HSEyebrow>Need the full picture?</HSEyebrow>
          <p
            style={{
              fontFamily: hsTokens.body,
              fontSize: 12,
              color: hsTokens.muted,
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Mash pH, yeast pitch rate, and starter sizing live in the{" "}
            <Link
              href="/recipes/new"
              style={{ color: hsTokens.ink, fontWeight: 600 }}
            >
              full recipe builder
            </Link>{" "}
            — they need your grain bill to work.
          </p>
        </HSCard>
      </aside>
    </LazyMotion>
  );
}
