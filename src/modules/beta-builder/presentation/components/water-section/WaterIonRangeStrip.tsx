/**
 * WaterIonRangeStrip — Horizontal range strip for a single water ion.
 *
 * Same visual language as ArcGauge (BJCP style strips): recessed pill track,
 * colored range block, hand-drawn needle with floating handwritten value.
 *
 * The range block fills from 0 → current value (how much ion is in the water).
 * The needle marks the target — the goal line to reach.
 * The target needle is draggable to adjust the custom target value.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { WaterProfile } from "../../../domain/services/WaterChemistryService";

interface WaterIonRangeStripProps {
  ion: keyof WaterProfile;
  label: string;
  source: number;
  target: number | undefined;
  final: number;
  isCustomTarget?: boolean;
  onTargetDrag?: (ion: keyof WaterProfile, value: number) => void;
}

const ION_SEED_OFFSET: Record<keyof WaterProfile, number> = {
  Ca: 0, Mg: 1, Na: 2, Cl: 3, SO4: 4, HCO3: 5,
};

const SHRINK_DELAY = 1200;
const MAX_PPM = 500;

function seededRand(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Domain ceiling — scaled by the source→target delta so bars reflect
 * the granularity the brewer cares about. Headroom is proportional
 * to the delta, with a minimum so tiny deltas don't over-zoom.
 */
function idealDomain(source: number, target: number | undefined, finalValue: number): number {
  if (target === undefined) return Math.max(finalValue * 1.25, 50);
  const delta = Math.abs(target - source);
  const headroom = Math.max(delta * 0.5, target * 0.2, 10);
  return Math.max(target, finalValue, source) + headroom;
}

/**
 * Bar hue based on proximity to target.
 * Solid green within ±10%. Sharp transition to blue/red outside that zone.
 * Uses a power curve so color shifts quickly away from the green band.
 */
function barHue(finalValue: number, target: number | undefined): number | undefined {
  if (target === undefined || target === 0) return undefined;
  const ratio = finalValue / target;
  // Within ±10% of target → solid green
  if (ratio >= 0.9 && ratio <= 1.1) return 145;
  if (ratio < 0.9) {
    // 0.9→0.7 snaps quickly to blue, then holds
    const t = Math.pow(Math.min((0.9 - ratio) / 0.2, 1), 0.5);
    return 145 + 105 * t; // 145 → 250
  }
  // 1.1→1.3 snaps quickly to red, then holds
  const t = Math.pow(Math.min((ratio - 1.1) / 0.2, 1), 0.5);
  return 145 - 120 * t; // 145 → 25
}

function clampPpm(ppm: number): number {
  return Math.max(0, Math.min(MAX_PPM, Math.round(ppm)));
}

export default function WaterIonRangeStrip({
  ion,
  label,
  source,
  target,
  final: finalValue,
  isCustomTarget,
  onTargetDrag,
}: WaterIonRangeStripProps) {
  // --- Debounced domain: grows instantly, shrinks after delay ---
  const ideal = idealDomain(source, target, finalValue);
  const [domMax, setDomMax] = useState(ideal);
  const shrinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDragging = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastClientX = useRef(0);
  const [dragTilt, setDragTilt] = useState(0);

  useEffect(() => {
    if (ideal > domMax) {
      if (shrinkTimer.current) { clearTimeout(shrinkTimer.current); shrinkTimer.current = null; }
      setDomMax(ideal);
    } else if (ideal < domMax) {
      // Don't shrink during drag
      if (isDragging.current) return;
      if (shrinkTimer.current) clearTimeout(shrinkTimer.current);
      shrinkTimer.current = setTimeout(() => {
        setDomMax(ideal);
        shrinkTimer.current = null;
      }, SHRINK_DELAY);
    }
    return () => { if (shrinkTimer.current) clearTimeout(shrinkTimer.current); };
  }, [ideal, domMax]);

  const pct = (v: number) => Math.max(0, Math.min(100, (v / Math.max(0.0001, domMax)) * 100));

  // --- Bar fills from 0 → current value ---
  const barWidth = pct(finalValue);
  const sourcePos = pct(source);

  // --- Needle at target (the goal line) ---
  const targetPos = target !== undefined ? pct(target) : 0;

  // --- Source exceeds target: bar should split into base water + additions ---
  const sourceExceedsTarget = target !== undefined && source > target;

  // --- In-range detection (20% tolerance of target, min 5 ppm) ---
  let inRange = true;
  if (target !== undefined) {
    const tolerance = Math.max(target * 0.2, 5);
    inRange = Math.abs(finalValue - target) <= tolerance;
  }

  // --- Overlap detection: current expands around target or source when close ---
  const crowdedByTarget = target !== undefined && Math.abs(barWidth - targetPos) < 5;
  const crowdedBySource = sourceExceedsTarget
    ? Math.abs(barWidth - sourcePos) < 5 && Math.abs(barWidth - sourcePos) >= 3
    : barWidth < 8;
  const crowded = crowdedByTarget || crowdedBySource;

  // --- Source > target: position source at its actual bar position ---
  const sourceCurrentClose = sourceExceedsTarget && Math.abs(sourcePos - barWidth) < 3;
  const sourceTargetCrowded = sourceExceedsTarget && !sourceCurrentClose && Math.abs(sourcePos - targetPos) < 8;

  // --- Dynamic bar color ---
  const hue = barHue(finalValue, target);

  // --- Hand-drawn jitter (stable per-ion, doesn't change with values) ---
  const seed = ION_SEED_OFFSET[ion] * 7919;
  const jitterRotate = seededRand(seed) * 6;
  const jitterX = seededRand(seed + 1) * 4;
  const jitterY = seededRand(seed + 2) * 2;
  const needleRotate = seededRand(seed + 3) * 8;
  const currentTickRotate = seededRand(seed + 4) * 8;

  // --- Drag handlers ---
  const draggable = !!onTargetDrag && target !== undefined;

  const ppmFromClientX = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return target ?? 0;
    const rect = track.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return clampPpm(fraction * domMax);
  }, [domMax, target]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!onTargetDrag || target === undefined) return;
    e.preventDefault();
    isDragging.current = true;
    lastClientX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    stripRef.current?.classList.add("is-dragging");
    setDragTilt(0);
    // Immediately update to where the user clicked
    const newPpm = ppmFromClientX(e.clientX);
    onTargetDrag(ion, newPpm);
  }, [onTargetDrag, target, ion, ppmFromClientX]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !onTargetDrag) return;
    // Calculate tilt from movement delta (clamped to ±20°)
    const dx = e.clientX - lastClientX.current;
    lastClientX.current = e.clientX;
    const tilt = Math.max(-20, Math.min(20, dx * 3));
    setDragTilt(tilt);
    const newPpm = ppmFromClientX(e.clientX);
    onTargetDrag(ion, newPpm);
  }, [onTargetDrag, ion, ppmFromClientX]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    stripRef.current?.classList.remove("is-dragging");
    setDragTilt(0);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!onTargetDrag || target === undefined) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onTargetDrag(ion, clampPpm(target + step));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onTargetDrag(ion, clampPpm(target - step));
    }
  }, [onTargetDrag, ion, target]);

  // --- Accessibility ---
  const ariaLabel = target !== undefined
    ? `${label}: ${Math.round(finalValue)} ppm, target ${Math.round(target)}, ${inRange ? "on target" : "off target"}`
    : `${label}: ${Math.round(finalValue)} ppm`;

  // During drag: use movement-based tilt instead of static jitter
  const effectiveNeedleRotate = isDragging.current ? dragTilt : needleRotate;

  return (
    <div className="style-strip" role="img" aria-label={ariaLabel} ref={stripRef}>
      <div className="style-strip-header">
        <span className="style-strip-label">{label}</span>
      </div>

      <div className="style-strip-track-wrap water-strip-track-wrap">
        {/* Source value — left edge normally, positioned when source > target */}
        {(!sourceExceedsTarget || !sourceCurrentClose) && (
          <span
            className={"water-strip-num water-strip-num-source"
              + (sourceExceedsTarget ? " is-positioned" : "")}
            style={sourceExceedsTarget ? { left: `${sourcePos}%` } : undefined}
          >
            {Math.round(source)}
          </span>
        )}

        {/* Target value above needle */}
        {target !== undefined && (
          <span
            className={"water-strip-num water-strip-num-target"
              + (isCustomTarget ? " water-strip-num-hand" : "")
              + (sourceTargetCrowded ? " is-src-tgt-crowded" : "")}
            style={{ left: `${targetPos}%` }}
          >
            {Math.round(target)}
          </span>
        )}

        {/* Current value — handwritten, above bar end */}
        <span
          className={"water-strip-num water-strip-num-current" + (!inRange ? " is-out" : "") + (crowded ? " is-crowded" : "")}
          style={{
            left: `${barWidth}%`,
            transform: `translateX(-50%) translateY(-8px) rotate(${jitterRotate}deg) translate(${jitterX}px, ${jitterY}px)`,
            ...(hue !== undefined && { color: `oklch(0.45 0.16 ${hue})` }),
          }}
        >
          {Math.round(finalValue)}
        </span>

        <div className="style-strip-track" ref={trackRef}>
          {/* Bar: 0 → current value */}
          {barWidth > 0 && !sourceExceedsTarget && (
            <div
              className="style-strip-range"
              style={{
                left: "0%",
                width: `${barWidth}%`,
                ...(hue !== undefined && {
                  background: `linear-gradient(to bottom, oklch(0.7 0.14 ${hue}), oklch(0.55 0.16 ${hue}))`,
                }),
              }}
            />
          )}

          {/* Split bar when source > target: muted base + colored additions */}
          {barWidth > 0 && sourceExceedsTarget && (
            <>
              {/* Base water segment (0 → source) — muted, can't be reduced */}
              <div
                className="style-strip-range water-strip-base-segment"
                style={{
                  left: "0%",
                  width: `${Math.min(sourcePos, barWidth)}%`,
                }}
              />
              {/* Additions segment (source → current) — colored by hue */}
              {barWidth > sourcePos && (
                <div
                  className="style-strip-range"
                  style={{
                    left: `${sourcePos}%`,
                    width: `${barWidth - sourcePos}%`,
                    ...(hue !== undefined && {
                      background: `linear-gradient(to bottom, oklch(0.7 0.14 ${hue}), oklch(0.55 0.16 ${hue}))`,
                    }),
                  }}
                />
              )}
            </>
          )}

          {/* Source tick at split point when source > target */}
          {sourceExceedsTarget && !sourceCurrentClose && (
            <div
              className="water-strip-source-tick"
              style={{ left: `${sourcePos}%` }}
            />
          )}

          {/* Tick at current value */}
          {barWidth > 0 && (
            <div
              className={"water-strip-current-tick" + (crowded ? " is-crowded" : "")}
              style={{
                left: `${barWidth}%`,
                transform: `translateY(-50%) rotate(${currentTickRotate}deg)`,
                background: hue !== undefined
                  ? `oklch(0.5 0.16 ${hue})`
                  : "var(--brew-accent-600)",
              }}
            />
          )}

          {/* Needle at target — draggable when onTargetDrag provided */}
          {target !== undefined && (
            <div
              className={
                "style-strip-needle water-strip-needle"
                + (!isCustomTarget ? " water-strip-needle-bjcp" : "")
                + (draggable ? " water-strip-needle-draggable" : "")
                + (sourceTargetCrowded ? " is-src-tgt-crowded" : "")
              }
              style={{
                left: `${targetPos}%`,
                transform: `translateY(-50%)${(isCustomTarget || isDragging.current) ? ` rotate(${effectiveNeedleRotate}deg)` : ""}`,
              }}
              onPointerDown={draggable ? handlePointerDown : undefined}
              onPointerMove={draggable ? handlePointerMove : undefined}
              onPointerUp={draggable ? handlePointerUp : undefined}
              onKeyDown={draggable ? handleKeyDown : undefined}
              role={draggable ? "slider" : undefined}
              aria-valuemin={draggable ? 0 : undefined}
              aria-valuemax={draggable ? MAX_PPM : undefined}
              aria-valuenow={draggable ? Math.round(target) : undefined}
              aria-label={draggable ? `${label} target` : undefined}
              tabIndex={draggable ? 0 : undefined}
            />
          )}
        </div>

        {/* Labels underneath the track */}
        <div className="water-strip-labels-below">
          {(!sourceExceedsTarget || !sourceCurrentClose) && (
            <span
              className={"water-strip-lbl water-strip-lbl-source"
                + (sourceExceedsTarget ? " is-positioned" : "")}
              style={sourceExceedsTarget ? { left: `${sourcePos}%` } : undefined}
            >
              Source
            </span>
          )}
          {target !== undefined && (
            <span
              className={"water-strip-lbl water-strip-lbl-target"
                + (isCustomTarget ? " water-strip-lbl-hand" : "")
                + (sourceTargetCrowded ? " is-src-tgt-crowded" : "")}
              style={{ left: `${targetPos}%` }}
            >
              Target
            </span>
          )}
          <span
            className={"water-strip-lbl water-strip-lbl-current" + (crowded ? " is-crowded" : "")}
            style={{
              left: `${barWidth}%`,
              ...(hue !== undefined && { color: `oklch(0.45 0.16 ${hue})` }),
            }}
          >
            Current
          </span>
        </div>
      </div>
    </div>
  );
}
