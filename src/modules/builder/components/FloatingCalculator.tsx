"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";

import { hsTokens } from "../tokens";
import Glyph, { type GlyphKind } from "./Glyph";
import HSEyebrow from "./HSEyebrow";

import AbvCalculator from "./calculators/AbvCalculator";
import IbuCalculator from "./calculators/IbuCalculator";
import BoilOffCalculator from "./calculators/BoilOffCalculator";
import DilutionCalculator from "./calculators/DilutionCalculator";
import CarbonationCalculator from "./calculators/CarbonationCalculator";
import HydrometerCorrectionCalculator from "./calculators/HydrometerCorrectionCalculator";
import StrikeTempCalculator from "./calculators/StrikeTempCalculator";

export type FloatingCalcId =
  | "abv"
  | "ibu"
  | "boil-off"
  | "dilution"
  | "carbonation"
  | "hydrometer"
  | "strike-temp";

interface CalcMeta {
  title: string;
  eyebrow: string;
  accent: string;
  glyph: GlyphKind;
  /** Fixed width for this calculator's PIP — tuned to its content. The
   *  calculators use rigid grids that don't reflow, so each picks the
   *  smallest width its layout renders cleanly at. */
  width: number;
  Component: (props: { accent?: string }) => ReactNode;
}

export const FLOATING_CALC_META: Record<FloatingCalcId, CalcMeta> = {
  abv: {
    title: "Alcohol by volume",
    eyebrow: "ABV",
    accent: hsTokens.malt,
    glyph: "drop",
    width: 380,
    Component: AbvCalculator,
  },
  hydrometer: {
    title: "Hydrometer correction",
    eyebrow: "Hydrometer",
    accent: hsTokens.yeast,
    glyph: "drop",
    width: 440,
    Component: HydrometerCorrectionCalculator,
  },
  ibu: {
    title: "Bitterness (Tinseth)",
    eyebrow: "IBU",
    accent: hsTokens.hops,
    glyph: "hop",
    width: 600,
    Component: IbuCalculator,
  },
  "boil-off": {
    title: "Boil-off / target OG",
    eyebrow: "Boil-off",
    accent: hsTokens.roast,
    glyph: "flame",
    width: 500,
    Component: BoilOffCalculator,
  },
  dilution: {
    title: "Wort dilution",
    eyebrow: "Dilution",
    accent: hsTokens.water,
    glyph: "water",
    width: 480,
    Component: DilutionCalculator,
  },
  "strike-temp": {
    title: "Strike water temperature",
    eyebrow: "Strike temp",
    accent: hsTokens.roast,
    glyph: "flame",
    width: 480,
    Component: StrikeTempCalculator,
  },
  carbonation: {
    title: "Force carbonation",
    eyebrow: "Carbonation",
    accent: hsTokens.water,
    glyph: "water",
    width: 400,
    Component: CarbonationCalculator,
  },
};

const HEADER_HEIGHT_APPROX = 64;

export function widthFor(id: FloatingCalcId): number {
  return FLOATING_CALC_META[id].width;
}

interface Props {
  id: FloatingCalcId;
  position: { x: number; y: number };
  zIndex: number;
  onClose: () => void;
  onMove: (pos: { x: number; y: number }) => void;
  onFocus: () => void;
}

export default function FloatingCalculator({
  id,
  position,
  zIndex,
  onClose,
  onMove,
  onFocus,
}: Props) {
  const meta = FLOATING_CALC_META[id];
  const width = meta.width;
  const dragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Esc closes whichever PIP currently has focus inside it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (containerRef.current?.contains(document.activeElement)) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Drag ──────────────────────────────────────────────────────────────
  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-floating-close]")) return;
    onFocus();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      offsetX: e.clientX - position.x,
      offsetY: e.clientY - position.y,
    };
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    // Keep at least a sliver on screen so it can always be grabbed back.
    const minX = 16 - width + 80;
    const maxX = window.innerWidth - 80;
    const minY = 8;
    const maxY = window.innerHeight - HEADER_HEIGHT_APPROX;
    onMove({
      x: Math.max(minX, Math.min(maxX, e.clientX - drag.offsetX)),
      y: Math.max(minY, Math.min(maxY, e.clientY - drag.offsetY)),
    });
  };

  const onHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  };

  const Body = meta.Component;

  return createPortal(
    <div
      ref={containerRef}
      className="hs-theme"
      role="dialog"
      aria-label={meta.title}
      onPointerDown={onFocus}
      style={{
        position: "fixed",
        top: position.y,
        left: position.x,
        width,
        // Content drives height, with a cap so a tall PIP (e.g. IBU with many
        // hop additions) scrolls internally instead of spilling off-screen.
        maxHeight: "min(85vh, 760px)",
        display: "flex",
        flexDirection: "column",
        background: hsTokens.paper,
        color: hsTokens.ink,
        border: `2px solid ${hsTokens.ink}`,
        borderTop: `7px solid ${meta.accent}`,
        borderRadius: 14,
        boxShadow: hsTokens.sh4,
        zIndex,
        overflow: "hidden",
        animation: "hs-floating-calc-in 220ms cubic-bezier(0.32, 0.72, 0, 1) both",
      }}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px 10px 14px",
          borderBottom: `2px solid ${hsTokens.ink}`,
          background: hsTokens.cream2,
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 32,
            height: 32,
            background: meta.accent,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Glyph kind={meta.glyph} size={18} color={hsTokens.ink} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <HSEyebrow>{meta.eyebrow}</HSEyebrow>
          <div
            style={{
              fontFamily: hsTokens.display,
              fontSize: 17,
              letterSpacing: "-0.025em",
              color: hsTokens.ink,
              marginTop: 2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {meta.title}
          </div>
        </div>
        <button
          type="button"
          data-floating-close
          onClick={onClose}
          aria-label={`Close ${meta.title}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "transparent",
            border: `1.5px solid ${hsTokens.ink}`,
            color: hsTokens.ink,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 16,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          padding: 16,
          background: hsTokens.paper,
        }}
      >
        <Body accent={meta.accent} />
      </div>
      <style>{`
        @keyframes hs-floating-calc-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>,
    document.body
  );
}
