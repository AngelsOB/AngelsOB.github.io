"use client";

import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import type { Recipe } from "@/modules/recipe/models/Recipe";
import { hsTokens, hsAlpha } from "@/modules/builder/tokens";
import HSEyebrow from "@/modules/builder/components/HSEyebrow";
import HSScriptNote from "@/modules/builder/components/HSScriptNote";
import { BuilderMock, type TabKey } from "@/modules/home/mock/BuilderMock";
import { mapRecipeToBuilderMock } from "@/modules/home/lib/mapRecipeToBuilderMock";

gsap.registerPlugin(useGSAP);

/**
 * The steered recipe rendered live in the real builder mock — the same mock the
 * homepage uses, static (no tour beats). The mock's hops/water/brew-sheet tabs
 * are "scene-level" layers positioned by GSAP, so we replicate the SignedInHero
 * placement effect that seats them at their rest "home" (otherwise those tabs
 * render off-screen). Kept here rather than importing SignedInHero's internal
 * effect so the working homepage stays untouched.
 */
export default function RecipePreview({ recipe }: { recipe: Recipe | null }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("fermentables");
  const data = useMemo(() => (recipe ? mapRecipeToBuilderMock(recipe) : undefined), [recipe]);

  useGSAP(
    () => {
      const scene = rootRef.current?.querySelector(".tour-scene") as HTMLElement | null;
      if (!scene) return;
      const q = (sel: string) => rootRef.current?.querySelector(sel) as HTMLElement | null;
      const radar = q('[data-tour="radar"]');
      const slot = q('[data-tour="radar-slot"]');
      const bodyEl = q('[data-tour="mock-body"]');
      const bsEl = q('[data-tour="brewsheet"]');
      const waterEl = q('[data-tour="water"]');
      const waterSlot = q('[data-tour="water-slot"]');
      const offsetWithin = (el: HTMLElement, anc: HTMLElement) => {
        let x = 0;
        let y = 0;
        let node: HTMLElement | null = el;
        while (node && node !== anc) {
          x += node.offsetLeft;
          y += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
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
          const bsBox = bsEl.querySelector('[data-tour="bs-box"]') as HTMLElement | null;
          if (bsBox) {
            bsBox.style.width = `${bodyEl.offsetWidth}px`;
            gsap.set(bsBox, { height: bodyEl.offsetHeight });
          }
          gsap.set(bsEl, { x: bo.x, y: bo.y, scale: 1 });
          const nub = bsEl.querySelector('[data-tour="bs-nub"]') as HTMLElement | null;
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

  if (!data) {
    return (
      <div
        style={{
          border: `2px dashed ${hsAlpha(hsTokens.ink, 28)}`,
          borderRadius: 18,
          background: hsAlpha(hsTokens.paper, 55),
          minHeight: 540,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 32,
          gap: 6,
        }}
      >
        <HSScriptNote color={hsTokens.yeast} size={26} rotate={-4}>
          your brew, live —
        </HSScriptNote>
        <HSEyebrow style={{ fontSize: 11, color: hsTokens.muted }}>
          steer the wheels, then calculate
        </HSEyebrow>
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 0, paddingTop: 16 }}>
      <BuilderMock activeTab={activeTab} onSelectTab={setActiveTab} data={data} />
    </div>
  );
}
