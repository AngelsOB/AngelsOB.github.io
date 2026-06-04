"use client";

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSCard from "@/modules/hopskip/components/HSCard";
import LandingSectionHeader from "./LandingSectionHeader";
import { learnNav } from "@/modules/learn/docsConfig";
import { COPY } from "../data";

const SMOOTH = [0.22, 1, 0.36, 1] as const;
const TILTS = [-0.4, 0.3, -0.2, 0.4];
const ACCENTS = [
  hsTokens.malt,
  hsTokens.hops,
  hsTokens.water,
  hsTokens.roast,
];

export default function SectionLearn() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const featured = [
    learnNav[0]?.links?.[0],
    ...(learnNav[1]?.links ?? []).filter((l) =>
      ["/learn/ibu", "/learn/water-chemistry", "/learn/gravity"].includes(
        l.href
      )
    ),
  ].filter(Boolean) as { href: string; label: string; description: string }[];

  if (featured.length === 0) return null;

  return (
    <section
      ref={ref}
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding:
          "clamp(40px, 6vw, 72px) clamp(20px, 4vw, 56px) clamp(40px, 6vw, 72px)",
      }}
    >
      <LandingSectionHeader
        index={3}
        eyebrow={COPY.learn.eyebrow}
        title={COPY.learn.title}
        alignEnd={
          <Link
            href={COPY.learn.endHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 999,
              fontFamily: hsTokens.body,
              fontWeight: 600,
              fontSize: 12,
              color: hsTokens.ink,
              textDecoration: "none",
            }}
          >
            {COPY.learn.endLink}
          </Link>
        }
      />

      <div
        className="home-learn-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        {featured.map((link, idx) => (
          <motion.div
            key={link.href}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={
              inView ? { opacity: 1, y: 0, scale: 1 } : {}
            }
            transition={{
              duration: 0.6,
              delay: 0.2 + idx * 0.1,
              ease: SMOOTH,
            }}
          >
            <Link
              href={link.href}
              style={{ textDecoration: "none", color: hsTokens.ink }}
            >
              <HSCard
                shadow={3}
                tilt={TILTS[idx % TILTS.length]}
                accent={ACCENTS[idx % ACCENTS.length]}
                padding="22px 22px 20px"
              >
                <div
                  style={{
                    fontFamily: hsTokens.body,
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                  }}
                >
                  Article
                </div>
                <h3
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 26,
                    letterSpacing: "-0.035em",
                    lineHeight: 1.05,
                    margin: "10px 0 10px",
                  }}
                >
                  {link.label}
                </h3>
                <p
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: hsTokens.muted,
                    margin: 0,
                  }}
                >
                  {link.description}
                </p>
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: hsTokens.script,
                    fontSize: 16,
                    color: ACCENTS[idx % ACCENTS.length],
                    transform: "rotate(-3deg)",
                    display: "inline-block",
                  }}
                >
                  read more →
                </div>
              </HSCard>
            </Link>
          </motion.div>
        ))}
      </div>
      <style>{`
        @media (max-width: 640px) {
          .home-learn-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
