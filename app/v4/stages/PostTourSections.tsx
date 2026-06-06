"use client";

import { useState } from "react";
import HSButton from "@/modules/hopskip/components/HSButton";
import HSCard from "@/modules/hopskip/components/HSCard";
import HSCardLift from "@/modules/hopskip/components/HSCardLift";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import { hsTokens } from "@/modules/hopskip/tokens";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import type { CommunityRecipeCard } from "../../_home/lib/communityCard";
import { CTA, STAGES } from "../data";

// Below-tour stages — full-width, no sticky mock. Reveals are wired in HomeV4
// via a single ScrollTrigger.batch on `[data-v4-reveal]` (play-once-on-enter).
// Order: Compare → Library + Community → What else → Learn → FAQ → Close.

function StageEyebrow({
  children,
  as = "h2",
}: {
  children: React.ReactNode;
  as?: "h2" | "h3";
}) {
  const Tag = as;
  return (
    <Tag
      style={{
        fontFamily: hsTokens.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: hsTokens.muted,
        margin: 0,
      }}
    >
      {children}
    </Tag>
  );
}

// ── Beat 6: Compare ──────────────────────────────────────────────────────
// Its own beat (pulled out of the old combined community section). Text only;
// the friends/accessibility line lands here.
export function StageCompare() {
  const s = STAGES.compare;
  return (
    <section
      data-v4-stage="compare"
      style={{
        position: "relative",
        zIndex: 2,
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div data-v4-reveal style={{ maxWidth: 720, margin: "0 auto" }}>
        <StageEyebrow>{s.h2}</StageEyebrow>
        <p
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(28px, 3.2vw, 40px)",
            letterSpacing: "-0.03em",
            lineHeight: 1.08,
            color: hsTokens.ink,
            margin: "10px 0 18px",
          }}
        >
          {s.lead}
        </p>
        {s.paragraphs.map((p, i) => (
          <p
            key={i}
            style={{
              fontFamily: hsTokens.body,
              fontSize: 17,
              lineHeight: 1.6,
              color:
                i === s.paragraphs.length - 1 ? hsTokens.ink : hsTokens.muted,
              margin: i === 0 ? 0 : "14px 0 0",
              maxWidth: 640,
            }}
          >
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

// ── Beat 7: Your library + community ──────────────────────────────────────
// The notebook framing + browse/fork, with up to 6 recent public recipes.
export function StageLibraryCommunity({
  recipes,
}: {
  recipes: CommunityRecipeCard[];
}) {
  const s = STAGES.library;
  return (
    <section
      data-v4-stage="library"
      style={{
        position: "relative",
        zIndex: 2,
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          data-v4-reveal
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 32,
            flexWrap: "wrap",
            marginBottom: 28,
          }}
        >
          <div style={{ maxWidth: 640, minWidth: 0 }}>
            <StageEyebrow>{s.h2}</StageEyebrow>
            <p
              style={{
                fontFamily: hsTokens.display,
                fontSize: "clamp(28px, 3.2vw, 40px)",
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
                color: hsTokens.ink,
                margin: "10px 0 12px",
              }}
            >
              {s.intro}
            </p>
            <p
              style={{
                fontFamily: hsTokens.body,
                fontSize: 17,
                lineHeight: 1.6,
                color: hsTokens.muted,
                margin: 0,
                maxWidth: 600,
              }}
            >
              {s.body}
            </p>
          </div>
          {recipes.length > 0 ? (
            <a
              href="/browse"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                boxShadow: hsTokens.sh2,
                fontFamily: hsTokens.body,
                fontSize: 13,
                fontWeight: 700,
                color: hsTokens.ink,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {s.browseLabel} →
            </a>
          ) : null}
        </div>

        {recipes.length > 0 ? (
          <div
            className="v4-community-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 20,
            }}
          >
            {recipes.slice(0, 6).map((recipe) => (
              <div key={recipe.shareSlug} data-v4-reveal>
                <CommunityCard recipe={recipe} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <style>{`
        @media (max-width: 1024px) {
          .v4-community-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .v4-community-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function CommunityCard({ recipe }: { recipe: CommunityRecipeCard }) {
  const srmColor = srmToRgb(recipe.stats.srm);
  return (
    <HSCardLift href={`/r/${recipe.shareSlug}`} ariaLabel={recipe.name}>
      <HSCard shadow={3} padding={0} style={{ overflow: "hidden" }}>
        <div style={{ height: 14, background: srmColor }} aria-hidden />
        <div style={{ padding: "16px 18px 18px" }}>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 22,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {recipe.name}
          </div>
          {recipe.style ? (
            <div
              style={{
                fontStyle: "italic",
                fontSize: 13,
                color: hsTokens.muted,
                marginTop: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {recipe.style}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              fontFamily: hsTokens.body,
              fontSize: 12,
              color: hsTokens.muted,
            }}
          >
            <span>by {recipe.ownerName}</span>
            {recipe.forkCount > 0 ? (
              <>
                <span aria-hidden style={{ opacity: 0.5 }}>
                  ·
                </span>
                <span
                  style={{
                    fontFamily: hsTokens.mono,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {recipe.forkCount}{" "}
                  {recipe.forkCount === 1 ? "fork" : "forks"}
                </span>
              </>
            ) : null}
          </div>
          {recipe.tags.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 10,
              }}
            >
              {recipe.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: `color-mix(in oklch, ${hsTokens.water} 22%, ${hsTokens.cream2})`,
                    color: hsTokens.ink,
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`,
                  }}
                >
                  {t}
                </span>
              ))}
              {recipe.tags.length > 3 ? (
                <span
                  style={{
                    fontFamily: hsTokens.body,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: hsTokens.cream2,
                    color: hsTokens.muted,
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  +{recipe.tags.length - 3}
                </span>
              ) : null}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {(
              [
                {
                  label: "ABV",
                  value: `${recipe.stats.abv.toFixed(1)}%`,
                  accent: hsTokens.yeast,
                },
                {
                  label: "IBU",
                  value: `${Math.round(recipe.stats.ibu)}`,
                  accent: hsTokens.hops,
                },
                {
                  label: "OG",
                  value: recipe.stats.og.toFixed(3),
                  accent: hsTokens.malt,
                },
                {
                  label: "FG",
                  value: recipe.stats.fg.toFixed(3),
                  accent: hsTokens.malt,
                },
              ] as const
            ).map((s) => (
              <div
                key={s.label}
                style={{
                  background: hsTokens.cream2,
                  borderTop: `3px solid ${s.accent}`,
                  borderRadius: 6,
                  padding: "8px 6px",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: hsTokens.muted,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontFamily: hsTokens.display,
                    fontSize: 14,
                    letterSpacing: "-0.03em",
                    marginTop: 2,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </HSCard>
    </HSCardLift>
  );
}

// ── What else (table stakes, framed) ──────────────────────────────────────
// One tight block: the spine beats carry the pitch, this just confirms the
// basics are present so they're never a reason to reach for another tool.
export function StageWhatElse() {
  const s = STAGES.whatElse;
  return (
    <section
      data-v4-stage="what-else"
      style={{
        position: "relative",
        zIndex: 2,
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div
        data-v4-reveal
        style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}
      >
        <StageEyebrow>{s.h2}</StageEyebrow>
        <p
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(26px, 3vw, 38px)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            color: hsTokens.ink,
            margin: "10px 0 16px",
          }}
        >
          {s.lead}
        </p>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 17,
            lineHeight: 1.6,
            color: hsTokens.muted,
            margin: "0 auto",
            maxWidth: 600,
          }}
        >
          {s.body}
        </p>
      </div>
    </section>
  );
}

export function StageLearn() {
  return (
    <section
      data-v4-stage="learn"
      style={{
        position: "relative",
        zIndex: 2,
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      {/* h2 is the eyebrow text per PRD section 10; the visible h3 is presentational. */}
      <h2
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {STAGES.learn.h2}
      </h2>
      <div
        data-v4-reveal
        style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}
      >
        <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
          {STAGES.learn.kicker}
        </HSScriptNote>
        <h3
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(32px, 4vw, 52px)",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: hsTokens.ink,
            margin: "12px 0 24px",
          }}
        >
          {STAGES.learn.title}
        </h3>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          {STAGES.learn.ctas.map((c) => (
            <a
              key={c.href}
              href={c.href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                boxShadow: hsTokens.sh2,
                fontFamily: hsTokens.body,
                fontSize: 14,
                fontWeight: 700,
                color: hsTokens.ink,
                textDecoration: "none",
              }}
            >
              {c.label} →
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StageFAQ() {
  return (
    <section
      data-v4-stage="faq"
      style={{
        position: "relative",
        zIndex: 2,
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div data-v4-reveal>
          <StageEyebrow>{STAGES.faq.h2}</StageEyebrow>
        </div>
        <div style={{ marginTop: 28 }}>
          {STAGES.faq.items.map((item) => (
            <div key={item.q} data-v4-reveal>
              <FAQItem q={item.q} a={item.a} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderTop: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 22%, transparent)`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          background: "transparent",
          border: 0,
          padding: "18px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          cursor: "pointer",
          fontFamily: hsTokens.body,
          fontSize: 16,
          fontWeight: 600,
          color: hsTokens.ink,
          textAlign: "left",
        }}
      >
        <span>{q}</span>
        <span
          aria-hidden
          style={{
            fontFamily: hsTokens.display,
            fontSize: 20,
            color: hsTokens.muted,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </button>
      {open ? (
        <p
          style={{
            margin: "0 0 18px",
            fontFamily: hsTokens.body,
            fontSize: 15,
            lineHeight: 1.6,
            color: hsTokens.muted,
            maxWidth: 640,
          }}
        >
          {a}
        </p>
      ) : null}
    </div>
  );
}

// ── Close (price + data ownership) ────────────────────────────────────────
export function StageClose() {
  const s = STAGES.close;
  return (
    <section
      data-v4-stage="close"
      style={{
        position: "relative",
        zIndex: 2,
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div
        data-v4-reveal
        style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}
      >
        <h2
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(36px, 4.5vw, 60px)",
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
            color: hsTokens.ink,
            margin: "0 0 18px",
          }}
        >
          {s.h2}
        </h2>
        <p
          style={{
            fontFamily: hsTokens.body,
            fontSize: 16,
            lineHeight: 1.6,
            color: hsTokens.muted,
            maxWidth: 600,
            margin: "0 auto 28px",
          }}
        >
          {s.body}
        </p>
        <HSButton
          href={CTA.close.href}
          variant="ink"
          color={hsTokens.roast}
          size="lg"
          arrow
        >
          {CTA.close.label}
        </HSButton>
        <p
          style={{
            marginTop: 22,
            fontFamily: hsTokens.body,
            fontSize: 13,
            color: hsTokens.muted,
            fontStyle: "italic",
          }}
        >
          {s.footer}
        </p>
      </div>
    </section>
  );
}
