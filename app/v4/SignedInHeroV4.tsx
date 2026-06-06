"use client";

import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import HSButton from "@/modules/hopskip/components/HSButton";
import { srmToRgb } from "@/modules/beta-builder/utils/srmColorUtils";
import { useRecipeStore } from "@/modules/beta-builder/presentation/stores/recipeStore";
import { recipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import type { Recipe } from "@/modules/beta-builder/domain/models/Recipe";
import { V4Mock, type TabKey } from "./mock/V4Mock";
import { mapRecipeToV4Mock } from "./lib/mapRecipeToV4Mock";

gsap.registerPlugin(useGSAP);

// Signed-in hero: the user's recent recipes (left) + the v4 mock showing the
// selected recipe (right). It's the SAME mock the tour uses, but static — no
// beats. We position the mock's scene-level layers (radar / water / brew sheet)
// at their rest "home" so every tab renders correctly without the tour's GSAP.
export default function SignedInHeroV4() {
  const recipes = useRecipeStore((s) => s.recipes);
  const rootRef = useRef<HTMLDivElement>(null);

  const recent = useMemo(
    () =>
      [...recipes]
        .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1))
        .slice(0, 5),
    [recipes],
  );
  const [selectedId, setSelectedId] = useState<string>(
    recent[0]?.id ?? recipes[0]?.id ?? "",
  );
  const selected =
    recent.find((r) => r.id === selectedId) ?? recent[0] ?? recipes[0];
  const data = useMemo(
    () => (selected ? mapRecipeToV4Mock(selected) : undefined),
    [selected],
  );
  const [activeTab, setActiveTab] = useState<TabKey>("fermentables");

  // Place the mock's scene-level layers at home (rest). No ScrollTriggers — this
  // is a static mock. Re-runs on recipe/tab change; also on resize + font settle.
  useGSAP(
    () => {
      const scene = rootRef.current?.querySelector(
        ".v4-scene",
      ) as HTMLElement | null;
      if (!scene) return;
      const q = (sel: string) =>
        rootRef.current?.querySelector(sel) as HTMLElement | null;
      const radar = q('[data-v4="radar"]');
      const slot = q('[data-v4="radar-slot"]');
      const bodyEl = q('[data-v4="mock-body"]');
      const bsEl = q('[data-v4="brewsheet"]');
      const waterEl = q('[data-v4="water"]');
      const waterSlot = q('[data-v4="water-slot"]');
      const offsetWithin = (el: HTMLElement, anc: HTMLElement) => {
        let x = 0;
        let y = 0;
        let n: HTMLElement | null = el;
        while (n && n !== anc) {
          x += n.offsetLeft;
          y += n.offsetTop;
          n = n.offsetParent as HTMLElement | null;
        }
        return { x, y };
      };
      const place = () => {
        if (radar && slot) {
          const o = offsetWithin(slot, scene);
          const rw = radar.offsetWidth || 112;
          gsap.set(radar, { x: o.x, y: o.y, scale: slot.offsetWidth / rw });
        }
        if (bsEl && bodyEl) {
          const bo = offsetWithin(bodyEl, scene);
          const bsBox = bsEl.querySelector(
            '[data-v4="bs-box"]',
          ) as HTMLElement | null;
          if (bsBox) {
            bsBox.style.width = `${bodyEl.offsetWidth}px`;
            gsap.set(bsBox, { height: bodyEl.offsetHeight });
          }
          gsap.set(bsEl, { x: bo.x, y: bo.y, scale: 1 });
          const nub = bsEl.querySelector(
            '[data-v4="bs-nub"]',
          ) as HTMLElement | null;
          if (nub) gsap.set(nub, { opacity: 0 });
        }
        if (waterEl && waterSlot) {
          const wo = offsetWithin(waterSlot, scene);
          waterEl.style.width = `${waterSlot.offsetWidth}px`;
          gsap.set(waterEl, { x: wo.x, y: wo.y, scale: 1 });
        }
      };
      place();
      const onResize = () => place();
      window.addEventListener("resize", onResize);
      if (typeof document !== "undefined" && "fonts" in document) {
        document.fonts.ready.then(place);
      }
      return () => window.removeEventListener("resize", onResize);
    },
    { scope: rootRef, dependencies: [data, activeTab] },
  );

  // Signed in but no recipes yet — a friendly empty hero instead of a blank gap.
  if (!selected || !data) {
    return (
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "clamp(48px, 7vw, 100px) clamp(20px, 4vw, 56px)",
          textAlign: "center",
        }}
      >
        <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
          welcome back —
        </HSScriptNote>
        <h1
          style={{
            fontFamily: hsTokens.display,
            fontSize: "clamp(34px, 4.5vw, 58px)",
            letterSpacing: "-0.035em",
            lineHeight: 1.02,
            color: hsTokens.ink,
            margin: "10px 0 22px",
          }}
        >
          Your library&apos;s empty. Let&apos;s fix that.
        </h1>
        <HSButton href="/recipes/new" variant="ink" color={hsTokens.roast} size="lg" arrow>
          Start a recipe
        </HSButton>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        className="v4-signedin-hero"
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding:
            "clamp(36px, 4.5vw, 64px) clamp(20px, 4vw, 56px) clamp(48px, 6vw, 84px)",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
          gap: 36,
          alignItems: "start",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Left — recent recipes */}
        <div style={{ minWidth: 0 }}>
          <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
            most recent —
          </HSScriptNote>
          <h1
            style={{
              fontFamily: hsTokens.display,
              fontSize: "clamp(36px, 4.5vw, 60px)",
              letterSpacing: "-0.035em",
              lineHeight: 1.0,
              margin: "10px 0 22px",
              color: hsTokens.ink,
            }}
          >
            Pick up where you left off.
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recent.map((r) => (
              <RecipeRow
                key={r.id}
                recipe={r}
                active={r.id === (selected?.id ?? "")}
                onSelect={() => setSelectedId(r.id)}
              />
            ))}
          </div>
          {recipes.length > recent.length ? (
            <a
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
            </a>
          ) : null}
        </div>

        {/* Right — the v4 mock, static, showing the selected recipe */}
        <div style={{ position: "relative", minWidth: 0 }}>
          <V4Mock activeTab={activeTab} onSelectTab={setActiveTab} data={data} />
        </div>
      </div>
      <style>{`
        @media (max-width: 1024px) {
          .v4-signedin-hero { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
      `}</style>
    </div>
  );
}

function RecipeRow({
  recipe,
  active,
  onSelect,
}: {
  recipe: Recipe;
  active: boolean;
  onSelect: () => void;
}) {
  const calc = useMemo(
    () => recipeCalculationService.calculate(recipe),
    [recipe],
  );
  const srmColor = srmToRgb(Math.max(0.1, calc.srm));
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        background: active ? hsTokens.paper : hsTokens.cream2,
        border: `${active ? 2 : 1.5}px solid ${active ? hsTokens.ink : `color-mix(in oklch, ${hsTokens.ink} 22%, transparent)`}`,
        borderRadius: 12,
        boxShadow: active ? "3px 3px 0 var(--hs-ink)" : "none",
        cursor: "pointer",
        fontFamily: hsTokens.body,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 10,
          height: 38,
          background: srmColor,
          border: `1.5px solid ${hsTokens.ink}`,
          borderRadius: 4,
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontFamily: hsTokens.display,
            fontSize: 18,
            letterSpacing: "-0.03em",
            color: hsTokens.ink,
            lineHeight: 1.05,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {recipe.name || "Untitled recipe"}
        </span>
        {recipe.style ? (
          <span
            style={{
              display: "block",
              fontStyle: "italic",
              fontSize: 12,
              color: hsTokens.muted,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {recipe.style}
          </span>
        ) : null}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontFamily: hsTokens.mono,
          fontSize: 11,
          fontWeight: 700,
          color: hsTokens.muted,
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        {calc.abv.toFixed(1)}% · {Math.round(calc.ibu)} IBU
      </span>
    </button>
  );
}
