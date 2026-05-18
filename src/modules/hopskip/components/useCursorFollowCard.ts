"use client";

import { useRef } from "react";

interface Options {
  disabled?: boolean;
  rotationFactor?: number;
  restDelayMs?: number;
}

export function useCursorFollowCard(opts: Options = {}) {
  const { disabled = false, rotationFactor = 0.8, restDelayMs = 120 } = opts;
  const wrapperRef = useRef<HTMLElement | null>(null);
  const ctaRef = useRef<HTMLDivElement | null>(null);
  const lastClientXRef = useRef<number | null>(null);
  const restTimerRef = useRef<number | null>(null);

  const setWrapper = (el: HTMLElement | null) => {
    wrapperRef.current = el;
  };

  function applyTransform(x: number, y: number, rotation: number) {
    const cta = ctaRef.current;
    if (!cta) return;
    cta.style.transform = `translate(${x - 6}px, ${y - 4}px) translate(-50%, -100%) rotate(${rotation}deg)`;
  }

  function onMouseMove(e: React.MouseEvent<HTMLElement>) {
    if (disabled) return;
    const wrap = wrapperRef.current;
    const cta = ctaRef.current;
    if (!wrap || !cta) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const last = lastClientXRef.current;
    const dx = last !== null ? e.clientX - last : 0;
    lastClientXRef.current = e.clientX;
    const rotation = Math.max(-30, Math.min(30, -dx * rotationFactor));
    applyTransform(x, y, rotation);
    cta.style.opacity = "1";
    if (restTimerRef.current !== null) window.clearTimeout(restTimerRef.current);
    restTimerRef.current = window.setTimeout(() => {
      applyTransform(x, y, 0);
    }, restDelayMs);
  }

  function onMouseLeave() {
    if (ctaRef.current) ctaRef.current.style.opacity = "0";
    lastClientXRef.current = null;
    if (restTimerRef.current !== null) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = null;
    }
  }

  return { wrapperRef, setWrapper, ctaRef, onMouseMove, onMouseLeave };
}
