"use client";

import { useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { hsTokens } from "@/modules/builder/tokens";
import type { Recipe } from "@/modules/recipe/models/Recipe";

import { V4Mock, type TabKey } from "@/modules/home/mock/V4Mock";
import { mapRecipeToV4Mock } from "@/modules/home/lib/mapRecipeToV4Mock";

gsap.registerPlugin(useGSAP);

interface Props {
  full: Recipe | null;
  loading: boolean;
  error: string | null;
  cardPath: string;
  onClose: () => void;
  onRetry?: () => void;
}

export default function HSBrowsePreviewPanel({
  full,
  loading,
  error,
  cardPath,
  onClose,
  onRetry,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("fermentables");

  const data = useMemo(
    () => (full ? mapRecipeToV4Mock(full) : undefined),
    [full],
  );

  // Place the V4Mock's scene-level layers at home (rest). Ported verbatim from
  // src/modules/home/SignedInHeroV4.tsx — without this, brewsheet / radar / water layers
  // render at (0,0) overlapping the body because they're absolute-positioned by
  // parent GSAP set() calls.
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
      let ro: ResizeObserver | null = null;
      if (rootRef.current && typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => place());
        ro.observe(rootRef.current);
      }
      if (typeof document !== "undefined" && "fonts" in document) {
        document.fonts.ready.then(place);
      }
      return () => {
        window.removeEventListener("resize", onResize);
        ro?.disconnect();
      };
    },
    { scope: rootRef, dependencies: [data, activeTab] },
  );

  return (
    <div
      ref={rootRef}
      className="hs-browse-preview-panel"
      role="region"
      aria-label="Recipe preview"
      style={{
        position: "sticky",
        top: 92,
        minWidth: 0,
        ["--v4-mock-design-w" as string]: "100%",
        ["--v4-mock-scale" as string]: "1",
        ["--v4-mock-body-h" as string]: "320px",
      }}
    >
      {error && !data ? (
        <PreviewErrorCard message={error} onRetry={onRetry} onClose={onClose} />
      ) : !data ? (
        <PreviewSkeleton onClose={onClose} />
      ) : (
        <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 180ms ease" }}>
          <V4Mock
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            data={data}
            openHref={cardPath}
            onClose={onClose}
          />
        </div>
      )}
    </div>
  );
}

function PreviewSkeleton({ onClose }: { onClose: () => void }) {
  const block = (
    h: number,
    w: string | number = "100%",
  ): React.CSSProperties => ({
    height: h,
    width: w,
    background: hsTokens.cream2,
    borderRadius: 6,
    animation: "hs-pulse 1.4s ease-in-out infinite",
  });
  return (
    <div
      style={{
        position: "relative",
        background: hsTokens.cream,
        border: `2px solid var(--hs-ink)`,
        borderRadius: 20,
        boxShadow: "6px 6px 0 var(--hs-ink)",
        padding: "18px 20px 20px",
      }}
      aria-busy="true"
      aria-label="Loading recipe preview"
    >
      <FloatingCloseButton onClose={onClose} />
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div style={block(22, "55%")} />
        <div style={{ flex: 1 }} />
        <div style={block(22, 60)} />
      </div>
      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 8,
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={block(42)} />
        ))}
      </div>
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              ...block(26, 70),
              borderRadius: 999,
            }}
          />
        ))}
      </div>
      <div style={{ marginTop: 18, ...block(220) }} />
    </div>
  );
}

function PreviewErrorCard({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        position: "relative",
        background: hsTokens.cream,
        border: `2px solid var(--hs-ink)`,
        borderRadius: 20,
        boxShadow: "6px 6px 0 var(--hs-ink)",
        padding: "24px 22px",
      }}
    >
      <FloatingCloseButton onClose={onClose} />
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.roast,
        }}
      >
        Couldn&apos;t load preview
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: hsTokens.body,
          fontSize: 14,
          color: hsTokens.ink,
        }}
      >
        {message}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 14,
            fontFamily: hsTokens.body,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            background: hsTokens.paper,
            color: hsTokens.ink,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 999,
            padding: "8px 16px",
            cursor: "pointer",
            boxShadow: "2px 2px 0 var(--hs-ink)",
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function FloatingCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close preview"
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        width: 34,
        height: 34,
        borderRadius: 999,
        border: `2px solid ${hsTokens.ink}`,
        background: hsTokens.paper,
        color: hsTokens.ink,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        zIndex: 5,
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
