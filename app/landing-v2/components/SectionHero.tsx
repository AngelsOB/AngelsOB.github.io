"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSButton from "@/modules/hopskip/components/HSButton";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import HeroBuilderCard from "./HeroBuilderCard";
import { COPY } from "../data";
import { useAuthStore } from "@/modules/auth/authStore";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { mapRecipeToMock } from "../lib/mapRecipeToMock";

const SMOOTH = [0.22, 1, 0.36, 1] as const;

interface Props {
  recipeCount: number;
}

export default function SectionHero({ recipeCount }: Props) {
  const user = useAuthStore((s) => s.user);
  const recipes = useRecipeStore((s) => s.recipes);
  const recipesLoaded = useRecipeStore((s) => s.recipesLoaded);
  const loadRecipes = useRecipeStore((s) => s.loadRecipes);

  useEffect(() => {
    if (user && !recipesLoaded) loadRecipes();
  }, [user, recipesLoaded, loadRecipes]);

  const isSignedInWithRecipes = !!user && recipesLoaded && recipes.length > 0;

  return (
    <section
      style={{
        background: hsTokens.cream,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <SectionBlobs />
      {isSignedInWithRecipes ? (
        <SignedInHero />
      ) : (
        <SignedOutHero recipeCount={recipeCount} />
      )}
    </section>
  );
}

// ─────────────────────────── Signed-out hero ───────────────────────────

function SignedOutHero({ recipeCount }: { recipeCount: number }) {
  return (
    <div
      className="hs-v2-hero"
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding:
          "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) clamp(48px, 6vw, 84px)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
        alignItems: "start",
        gap: 48,
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* Left column — pitch */}
      <div style={{ minWidth: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SMOOTH }}
        >
          <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
            {COPY.hero.kicker}
          </HSScriptNote>
        </motion.div>

        <h1
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(44px, 6.5vw, 100px)",
            letterSpacing: "-0.04em",
            lineHeight: 0.92,
            margin: "12px 0 0",
            color: hsTokens.ink,
            maxWidth: 700,
          }}
        >
          <Word delay={0.15}>A</Word>
          <br />
          <SimplerHighlight delay={0.25} />
          <br />
          <Word delay={0.35} color={hsTokens.roast}>
            place
          </Word>{" "}
          <Word delay={0.43} color={hsTokens.roast}>
            to
          </Word>{" "}
          <Word delay={0.51} color={hsTokens.roast}>
            brew.
          </Word>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: SMOOTH }}
          style={{
            fontFamily: hsTokens.body,
            fontSize: 17,
            lineHeight: 1.55,
            color: hsTokens.muted,
            maxWidth: 480,
            marginTop: 22,
          }}
        >
          {COPY.hero.subhead}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.95, ease: SMOOTH }}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 14,
            marginTop: 28,
            alignItems: "center",
          }}
        >
          <HSButton
            href={COPY.hero.primaryHref}
            variant="ink"
            color={hsTokens.roast}
            size="lg"
            arrow
          >
            {COPY.hero.primaryCta}
          </HSButton>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2, ease: SMOOTH }}
          style={{
            marginTop: 20,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          <StatPill
            color={hsTokens.roast}
            value={recipeCount.toLocaleString()}
            label="recipes in the library"
          />
          <StatPill
            color={hsTokens.water}
            value="20+"
            label="live calculations"
          />
          <StatPill
            color={hsTokens.hops}
            value="0"
            label="spreadsheets needed"
          />
        </motion.div>
      </div>

      {/* Right column — builder card */}
      <div style={{ position: "relative", minWidth: 0 }}>
        <HeroBuilderCard />
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .hs-v2-hero {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────── Signed-in hero ───────────────────────────

function SignedInHero() {
  const recipes = useRecipeStore((s) => s.recipes);

  // Most recent five, sorted by updatedAt desc.
  const recent = useMemo(() => {
    return [...recipes]
      .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
      .slice(0, 5);
  }, [recipes]);

  const [selectedId, setSelectedId] = useState<string>(
    recent[0]?.id ?? recipes[0]?.id ?? ""
  );

  const selected =
    recent.find((r) => r.id === selectedId) ?? recent[0] ?? recipes[0];

  const mockData = useMemo(
    () => (selected ? mapRecipeToMock(selected) : undefined),
    [selected]
  );

  if (!selected) return null;

  return (
    <div
      className="hs-v2-hero"
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding:
          "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) clamp(48px, 6vw, 84px)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
        alignItems: "start",
        gap: 36,
        position: "relative",
        zIndex: 2,
      }}
    >
      {/* Left column — library list */}
      <div style={{ minWidth: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: SMOOTH }}
        >
          <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
            most recent —
          </HSScriptNote>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: SMOOTH }}
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(40px, 5vw, 64px)",
            letterSpacing: "-0.035em",
            lineHeight: 1.0,
            margin: "10px 0 24px",
            color: hsTokens.ink,
          }}
        >
          Pick up where{" "}
          <span
            style={{
              background: hsTokens.malt,
              padding: "0 10px",
              display: "inline-block",
              transform: "rotate(-1deg)",
              boxShadow: "3px 3px 0 var(--hs-ink)",
            }}
          >
            you left off.
          </span>
        </motion.h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {recent.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.2 + i * 0.06,
                ease: SMOOTH,
              }}
            >
              <RecipeListCard
                recipe={r}
                active={r.id === (selected?.id ?? "")}
                openHref={`/recipes/${r.id}`}
                onSelect={() => setSelectedId(r.id)}
              />
            </motion.div>
          ))}
        </div>

        {recipes.length > recent.length ? (
          <motion.a
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.55,
              ease: SMOOTH,
            }}
            href="/recipes"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 14,
              padding: "8px 14px",
              fontFamily: hsTokens.body,
              fontSize: 12,
              fontWeight: 600,
              color: hsTokens.ink,
              background: hsTokens.paper,
              border: `1.5px solid ${hsTokens.ink}`,
              borderRadius: 999,
              textDecoration: "none",
              boxShadow: "2px 2px 0 var(--hs-ink)",
            }}
          >
            Browse all {recipes.length} →
          </motion.a>
        ) : null}
      </div>

      {/* Right column — reactive builder mock */}
      <div style={{ position: "relative", minWidth: 0 }}>
        <HeroBuilderCard
          data={mockData}
          openHref={`/recipes/${selected.id}`}
          autoRotate={false}
        />
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .hs-v2-hero {
            grid-template-columns: 1fr !important;
            gap: 36px !important;
          }
        }
      `}</style>
    </div>
  );
}

function RecipeListCard({
  recipe,
  active,
  openHref,
  onSelect,
}: {
  recipe: ReturnType<typeof useRecipeStore.getState>["recipes"][number];
  active: boolean;
  openHref: string;
  onSelect: () => void;
}) {
  const router = useRouter();
  const calc = useMemo(
    () => recipeCalculationService.calculate(recipe),
    [recipe]
  );
  const srmColor = srmToRgb(Math.max(1, calc.srm));

  // Already-selected card behaves like a link to /recipes/{id}; non-selected
  // cards just become the new selection (and feed the right-side mock).
  const handleClick = () => {
    if (active) router.push(openHref);
    else onSelect();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        active ? `Open ${recipe.name || "recipe"} in the builder` : `Select ${recipe.name || "recipe"}`
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px 10px 10px",
        background: active ? hsTokens.paper : hsTokens.cream,
        border: `2px solid ${active ? hsTokens.ink : `color-mix(in oklch, ${hsTokens.ink} 22%, transparent)`}`,
        borderRadius: 12,
        boxShadow: active ? "4px 4px 0 var(--hs-ink)" : "2px 2px 0 color-mix(in oklch, var(--hs-ink) 20%, transparent)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "background 0.15s ease, box-shadow 0.15s ease",
        fontFamily: hsTokens.body,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 36,
          height: 36,
          background: srmColor,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 8,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: hsTokens.display,
            fontSize: 17,
            letterSpacing: "-0.025em",
            color: hsTokens.ink,
            lineHeight: 1.1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {recipe.name || "Untitled recipe"}
        </div>
        <div
          style={{
            fontSize: 11,
            color: hsTokens.muted,
            marginTop: 3,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {recipe.style || "Custom style"} · {calc.abv.toFixed(1)}% · {Math.round(calc.ibu)} IBU
        </div>
      </div>
      {active ? (
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            background: hsTokens.hops,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            fontFamily: hsTokens.body,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hsTokens.cream,
            boxShadow: "2px 2px 0 var(--hs-ink)",
          }}
        >
          Open →
        </span>
      ) : (
        <span
          aria-hidden
          style={{
            color: hsTokens.muted,
            fontSize: 14,
          }}
        >
          →
        </span>
      )}
    </button>
  );
}

// ─────────────────────────── shared bits ───────────────────────────

function StatPill({
  color,
  value,
  label,
}: {
  color: string;
  value: string;
  label: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 10px",
        background: hsTokens.paper,
        border: `1.5px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        fontFamily: hsTokens.body,
        fontSize: 12,
        color: hsTokens.muted,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          background: color,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 14,
          color: hsTokens.ink,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span style={{ color: hsTokens.muted }}>{label}</span>
    </span>
  );
}

/**
 * "simpler" word: the text reveals once and stays still. The malt-yellow
 * highlighter rectangle behind it gently floats so the page has a small
 * ambient motion without the headline itself moving.
 */
function SimplerHighlight({ delay }: { delay: number }) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        padding: "0 14px",
        transform: "rotate(-1.5deg)",
        isolation: "isolate",
      }}
    >
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scaleX: 0.6, scaleY: 0.7 }}
        animate={{
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
          y: [0, -2.5, 0, 2.5, 0],
          rotate: [0, 0.7, 0, -0.7, 0],
        }}
        transition={{
          opacity: { duration: 0.5, delay, ease: SMOOTH },
          scaleX: { duration: 0.5, delay, ease: SMOOTH },
          scaleY: { duration: 0.5, delay, ease: SMOOTH },
          y: {
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay + 1.2,
          },
          rotate: {
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: delay + 1.2,
          },
        }}
        style={{
          position: "absolute",
          inset: "0.04em 0",
          background: hsTokens.malt,
          boxShadow: "3px 3px 0 var(--hs-ink)",
          zIndex: -1,
          transformOrigin: "center",
        }}
      />
      <motion.span
        initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut", delay }}
        style={{
          display: "inline-block",
          position: "relative",
        }}
      >
        simpler
      </motion.span>
    </span>
  );
}

function Word({
  children,
  delay,
  color,
  style,
}: {
  children: React.ReactNode;
  delay: number;
  color?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut", delay }}
      style={{
        display: "inline-block",
        color,
        ...style,
      }}
    >
      {children}
    </motion.span>
  );
}

function SectionBlobs() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "5%",
          width: 320,
          height: 320,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.malt} 18%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "8%",
          width: 280,
          height: 280,
          background: `radial-gradient(circle, color-mix(in oklab, ${hsTokens.water} 14%, transparent) 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "30%",
          width: 600,
          height: 400,
          background: `radial-gradient(ellipse, color-mix(in oklab, ${hsTokens.hops} 10%, transparent) 0%, transparent 70%)`,
          filter: "blur(70px)",
        }}
      />
    </div>
  );
}
