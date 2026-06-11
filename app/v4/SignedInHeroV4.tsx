"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { hsTokens } from "@/modules/hopskip/tokens";
import HSScriptNote from "@/modules/hopskip/components/HSScriptNote";
import HSButton from "@/modules/hopskip/components/HSButton";
import { useRecipeStore } from "@/modules/recipe/stores/recipeStore";
import { recipeCalculationService } from "@/modules/recipe/services/RecipeCalculationService";
import type { Recipe } from "@/modules/recipe/models/Recipe";
import MyRecipeCard from "../recipes/MyRecipeCard";
import { V4Mock, type TabKey } from "./mock/V4Mock";
import { mapRecipeToV4Mock } from "./lib/mapRecipeToV4Mock";

const RECIPE_TILTS = [-0.4, 0.3, -0.5, 0.4, -0.3];

gsap.registerPlugin(useGSAP);

// Signed-in hero: the user's recent recipes (left) + the v4 mock showing the
// selected recipe (right). It's the SAME mock the tour uses, but static — no
// beats. We position the mock's scene-level layers (radar / water / brew sheet)
// at their rest "home" so every tab renders correctly without the tour's GSAP.
export default function SignedInHeroV4() {
  const router = useRouter();
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

  // Click-twice-to-open pattern: first click selects (drives the right-side
  // V4Mock), second click on the already-selected card navigates to the
  // builder. Mirrors the preview interaction on /recipes — same affordance.
  const handleCardClick = useCallback(
    (r: Recipe) => {
      if (selected?.id === r.id) {
        router.push(`/recipes/${r.id}`);
      } else {
        setSelectedId(r.id);
      }
    },
    [router, selected?.id],
  );

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
          <div
            className="v4-signedin-recipes-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              alignContent: "start",
              alignItems: "start",
            }}
          >
            {recent.map((r, idx) => (
              <MyRecipeCard
                key={r.id}
                recipe={r}
                calc={recipeCalculationService.calculate(r)}
                tilt={RECIPE_TILTS[idx % RECIPE_TILTS.length]}
                previewMode
                isPreviewSelected={r.id === (selected?.id ?? "")}
                anyPreviewSelected={!!selected}
                onPreviewSelect={handleCardClick}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 18,
              paddingRight: 10,
            }}
          >
            <a
              href="/recipes"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                fontFamily: hsTokens.body,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.02em",
                color: hsTokens.ink,
                background: hsTokens.paper,
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 999,
                textDecoration: "none",
                boxShadow: "3px 3px 0 var(--hs-ink)",
                whiteSpace: "nowrap",
              }}
            >
              View my recipes
              {recipes.length > recent.length ? (
                <span style={{ color: hsTokens.muted, fontWeight: 600 }}>
                  ({recipes.length})
                </span>
              ) : null}
              <span aria-hidden style={{ fontSize: 15 }}>→</span>
            </a>
          </div>
        </div>

        {/* Right — the v4 mock, static, showing the selected recipe */}
        <div style={{ position: "relative", minWidth: 0 }}>
          <V4Mock
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            data={data}
            openHref={`/recipes/${selected.id}`}
          />
        </div>
      </div>
      <style>{`
        @media (max-width: 1024px) {
          .v4-signedin-hero { grid-template-columns: 1fr !important; gap: 28px !important; }
        }
        @media (max-width: 640px) {
          .v4-signedin-recipes-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

