"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

import { LazyMotion, domMax, m } from "framer-motion";

import { hsTokens } from "../../tokens";
import { springEnter, springTilt, springTrack } from "../../motion";
import type {
  HopFlavorProfile,
  HopPreset,
} from "@/modules/recipe/models/Presets";
import { HOP_FLAVOR_KEYS } from "@/modules/recipe/models/Presets";

import {
  findSimilarHops,
  formatAlphaBetaRatio,
  formatAlphaRange,
  formatBetaRange,
  formatCohumulone,
  hasHopDetails,
} from "./hopDetails";
import type { SimilarHop } from "./hopDetails";
import { getCountryFlag } from "@/utils/flags";

// Width tuned around the existing flavor radar (170px) — leaves room
// for axis labels and a wrap-friendly chip area below.
const PANEL_WIDTH = 280;

const DEFAULT_SHOW_DELAY_MS = 850;

// Once the first hover has fired, subsequent triggers within this many
// ms of cursor-leave show the panel INSTANTLY (no re-dwell). This is
// the "warmup" — sliding the cursor down a list of rows feels live
// after the first row has been read. If the cursor stays away for the
// full cooldown, warmup resets and the next hover dwells again.
const WARMUP_COOLDOWN_MS = 500;

// Brief delay before tearing the panel down on leave — lets the next
// adjacent row's mouseEnter cancel the dismiss and seamlessly switch
// the panel's contents instead of flickering off/on. Short enough that
// parking on whitespace inside the modal still feels responsive.
const HIDE_DELAY_MS = 60;

const PANEL_HEIGHT_ESTIMATE = 320;
const CONNECTOR_HEIGHT = 12;

type Placement = "above" | "below" | "cursor-right";

type AnchorState = {
  rect: DOMRect;
  preset: HopPreset;
  // Opaque caller token (the builder passes the hovered row's id) echoed
  // back to `onSelect` when a chip is clicked, so the consumer knows which
  // row to swap. Undefined for passive surfaces (the picker modal).
  context?: string;
};

export type UseHopHoverPreviewOptions = {
  /**
   * Milliseconds the cursor must dwell inside the trigger before the
   * panel appears. Set to 0 for an instant pop (picker modal); the
   * builder rows use the default 300ms so a quick stepper-click doesn't
   * pop the panel.
   */
  showDelay?: number;
  /**
   * Where the panel sits relative to the trigger.
   *  • `'anchored'` (default) — pops above the trigger (or below if no
   *    room above), with a connector line down to the trigger. Right
   *    for builder rows: the hovered row stays visible.
   *  • `'cursor-right'` — follows the cursor with a horizontal offset
   *    to its right (flips to the left near the viewport edge). Right
   *    for modal pickers: doesn't obscure rows above the cursor.
   */
  placement?: "anchored" | "cursor-right";
  /**
   * When provided (anchored placement only), the panel becomes
   * interactive: the cursor can travel onto it without dismissing it,
   * and each "Similar hops" chip turns into a button that calls this
   * with the chosen preset plus the `context` passed to
   * `getTriggerProps`. The builder rows wire this to swap the hovered
   * hop in place. Omitted by the picker modal, which leaves the panel a
   * passive, cursor-following preview.
   */
  onSelect?: (chosen: HopPreset, context: string) => void;
};

/**
 * Element-anchored hover preview for a hop. The same anchored-above +
 * cursor-spring-follow + dwell-on-show pattern as the yeast hover hook
 * (`useYeastHoverPreview`), adapted for hop presets so the picker and
 * the builder rows share one tooltip surface.
 */
export function useHopHoverPreview(
  library: HopPreset[],
  options: UseHopHoverPreviewOptions = {}
) {
  const placementMode = options.placement ?? "anchored";

  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  // Cursor X (viewport coords) — drives the spring-follow on the
  // outer wrapper so the panel slides with the cursor while it's
  // inside the trigger.
  const [cursorX, setCursorX] = useState<number>(0);
  // Cursor Y — only used in `cursor-right` placement so the panel
  // tracks the cursor vertically too. Anchored mode anchors Y to the
  // trigger rect's top/bottom and ignores this.
  const [cursorY, setCursorY] = useState<number>(0);
  // Velocity-driven tilt on the card — moving right tilts the card
  // left so it "trails" the cursor, then settles. Same gesture as the
  // FermentableSection BillStack tooltip.
  const [tilt, setTilt] = useState<number>(0);
  const showTimerRef = useRef<number | null>(null);
  // Brief post-leave delay before clearing the panel. Survives quick
  // adjacent-row transitions via cancel-on-enter.
  const hideTimerRef = useRef<number | null>(null);
  // Longer post-leave timer that resets the warmup if the cursor doesn't
  // come back to ANY trigger before it fires.
  const cooldownTimerRef = useRef<number | null>(null);
  // Whether the next mouseEnter should show INSTANTLY (post-first-hover)
  // or run the dwell again (cold start / after cooldown). Ref because
  // changes shouldn't trigger renders — only the anchor does.
  const warmedUpRef = useRef(false);
  const lastClientXRef = useRef<number | null>(null);
  const tiltRestTimerRef = useRef<number | null>(null);

  const showDelayRef = useRef(options.showDelay ?? DEFAULT_SHOW_DELAY_MS);
  showDelayRef.current = options.showDelay ?? DEFAULT_SHOW_DELAY_MS;

  const cancelTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (tiltRestTimerRef.current !== null) {
      window.clearTimeout(tiltRestTimerRef.current);
      tiltRestTimerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    cancelTimers();
    setAnchor(null);
    setTilt(0);
    lastClientXRef.current = null;
    // Reset warmup — next use of this hook starts fresh (e.g. modal
    // re-open should re-dwell on first hover).
    warmedUpRef.current = false;
  }, [cancelTimers]);

  const showNow = useCallback(
    (rect: DOMRect, preset: HopPreset, context?: string) => {
      setAnchor({ rect, preset, context });
    },
    []
  );

  // Panel-hover bridge (interactive mode). When the cursor leaves the
  // trigger and lands on the panel itself, `cancelHide` keeps it open;
  // leaving the panel re-arms the same dismiss + warmup-cooldown the
  // trigger's mouseLeave uses.
  const cancelHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setAnchor(null);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
    if (cooldownTimerRef.current !== null) {
      window.clearTimeout(cooldownTimerRef.current);
    }
    cooldownTimerRef.current = window.setTimeout(() => {
      warmedUpRef.current = false;
      cooldownTimerRef.current = null;
    }, WARMUP_COOLDOWN_MS);
  }, []);

  const updateCursor = useCallback((clientX: number, clientY: number) => {
    setCursorX(clientX);
    setCursorY(clientY);
    const last = lastClientXRef.current;
    const dx = last !== null ? clientX - last : 0;
    lastClientXRef.current = clientX;
    const rotation = Math.max(-10, Math.min(10, -dx * 0.35));
    setTilt(rotation);
    if (tiltRestTimerRef.current !== null) {
      window.clearTimeout(tiltRestTimerRef.current);
    }
    tiltRestTimerRef.current = window.setTimeout(() => setTilt(0), 120);
  }, []);

  const getTriggerProps = useCallback(
    (preset: HopPreset | null | undefined, context?: string) => {
      if (!preset || !hasHopDetails(preset)) return {} as const;
      return {
        onMouseEnter: (e: React.MouseEvent) => {
          const rect = (
            e.currentTarget as HTMLElement
          ).getBoundingClientRect();
          lastClientXRef.current = e.clientX;
          setCursorX(e.clientX);
          setCursorY(e.clientY);
          // Cancel the brief post-leave hide AND the warmup-cooldown —
          // the cursor is back on a trigger, panel + warmup persist.
          if (hideTimerRef.current !== null) {
            window.clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
          }
          if (cooldownTimerRef.current !== null) {
            window.clearTimeout(cooldownTimerRef.current);
            cooldownTimerRef.current = null;
          }
          // Cancel any pending show from a previous trigger — about to
          // run a new one (or showNow immediately) for THIS preset.
          if (showTimerRef.current !== null) {
            window.clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
          }
          const delay = showDelayRef.current;
          // Instant when warmed up OR when caller asked for no dwell.
          if (warmedUpRef.current || delay <= 0) {
            warmedUpRef.current = true;
            showNow(rect, preset, context);
            return;
          }
          // First (or post-cooldown) hover — dwell, then mark warm and
          // show. After this, subsequent triggers fall into the instant
          // branch above as long as the cooldown doesn't fire.
          showTimerRef.current = window.setTimeout(() => {
            warmedUpRef.current = true;
            showNow(rect, preset, context);
            showTimerRef.current = null;
          }, delay);
        },
        onMouseMove: (e: React.MouseEvent) => {
          updateCursor(e.clientX, e.clientY);
        },
        onMouseLeave: () => {
          if (showTimerRef.current !== null) {
            window.clearTimeout(showTimerRef.current);
            showTimerRef.current = null;
          }
          setTilt(0);
          lastClientXRef.current = null;
          if (tiltRestTimerRef.current !== null) {
            window.clearTimeout(tiltRestTimerRef.current);
            tiltRestTimerRef.current = null;
          }
          // Brief hide-delay — bridges adjacent-row transitions so the
          // panel switches contents seamlessly when the cursor moves
          // from one trigger to the next (the next mouseEnter cancels
          // this timer and immediately calls showNow).
          if (hideTimerRef.current !== null) {
            window.clearTimeout(hideTimerRef.current);
          }
          hideTimerRef.current = window.setTimeout(() => {
            setAnchor(null);
            hideTimerRef.current = null;
          }, HIDE_DELAY_MS);
          // Longer warmup-cooldown — if the cursor doesn't come back
          // to ANY trigger within this window (i.e. left the modal
          // entirely), the next hover should dwell again instead of
          // popping instantly. Reset by mouseEnter.
          if (cooldownTimerRef.current !== null) {
            window.clearTimeout(cooldownTimerRef.current);
          }
          cooldownTimerRef.current = window.setTimeout(() => {
            warmedUpRef.current = false;
            cooldownTimerRef.current = null;
          }, WARMUP_COOLDOWN_MS);
        },
      } as const;
    },
    [showNow, updateCursor]
  );

  useEffect(() => () => cancelTimers(), [cancelTimers]);

  const placement: Placement = useMemo(() => {
    if (!anchor) return "above";
    if (placementMode === "cursor-right") return "cursor-right";
    const spaceAbove = anchor.rect.top;
    return spaceAbove >= PANEL_HEIGHT_ESTIMATE + CONNECTOR_HEIGHT + 12
      ? "above"
      : "below";
  }, [anchor, placementMode]);

  // Interactive only in anchored placement (builder rows) — the
  // cursor-following picker preview can't be hovered onto, so it stays
  // a passive panel even if a stray onSelect were ever passed.
  const interactive =
    Boolean(options.onSelect) && placementMode === "anchored";

  // Chip click → swap. Echoes the anchored row's context back to the
  // consumer, then tears the panel down (the row's content just changed
  // underneath it).
  const handleSelect = useCallback(
    (chosen: HopPreset) => {
      if (anchor?.context != null) options.onSelect?.(chosen, anchor.context);
      clear();
    },
    [anchor, options, clear]
  );

  // Mount our own LazyMotion inside the portal — the portal target
  // (document.body) is outside the builder's wrapper, so motion
  // children would otherwise have no animation features. Match the
  // builder's setup: domMax + strict.
  const portal =
    typeof document !== "undefined"
      ? createPortal(
          anchor ? (
            <LazyMotion features={domMax} strict>
              <PreviewFrame
                key={anchor.preset.name}
                preset={anchor.preset}
                library={library}
                rect={anchor.rect}
                placement={placement}
                cursorX={cursorX}
                cursorY={cursorY}
                tilt={tilt}
                interactive={interactive}
                onPanelEnter={cancelHide}
                onPanelLeave={scheduleHide}
                onSelect={interactive ? handleSelect : undefined}
              />
            </LazyMotion>
          ) : null,
          document.body
        )
      : null;

  return { portal, getTriggerProps, clear };
}

function PreviewFrame({
  preset,
  library,
  rect,
  placement,
  cursorX,
  cursorY,
  tilt,
  interactive,
  onPanelEnter,
  onPanelLeave,
  onSelect,
}: {
  preset: HopPreset;
  library: HopPreset[];
  rect: DOMRect;
  placement: Placement;
  cursorX: number;
  cursorY: number;
  tilt: number;
  interactive?: boolean;
  onPanelEnter?: () => void;
  onPanelLeave?: () => void;
  onSelect?: (chosen: HopPreset) => void;
}) {
  // Cursor-right mode — panel hovers to the side of the cursor with
  // no connector. Used by the picker modal so the panel doesn't sit
  // on top of the rows above/below the cursor.
  if (placement === "cursor-right") {
    const OFFSET = 18;
    const willClipRight =
      typeof window !== "undefined" &&
      cursorX + OFFSET + PANEL_WIDTH > window.innerWidth - 12;
    const targetX = willClipRight ? cursorX - OFFSET - PANEL_WIDTH : cursorX + OFFSET;
    return (
      <m.div
        className="hs-theme"
        initial={{ x: targetX, y: cursorY }}
        animate={{ x: targetX, y: cursorY }}
        transition={{ x: springTrack, y: springTrack }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 1000,
          background: "transparent",
          color: "inherit",
          font: "inherit",
        }}
      >
        <div
          style={{
            // Vertically center the panel on the cursor; no horizontal
            // translate (motion x already places the panel's left edge
            // at `targetX`).
            transform: "translateY(-50%)",
            width: PANEL_WIDTH,
          }}
        >
          <m.div
            initial={{ opacity: 0, scale: 0.92, rotate: 0 }}
            animate={{ opacity: 1, scale: 1, rotate: tilt }}
            transition={{ ...springEnter, rotate: springTilt }}
            style={{
              width: "100%",
              background: "var(--hs-paper, #f8f3dc)",
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 10,
              boxShadow: hsTokens.sh1,
              padding: 12,
              // Pivot rotation around the cursor side (left when panel
              // is to the cursor's right, vice versa on flip) so the
              // swing reads as the panel "hanging off" the cursor.
              transformOrigin: willClipRight ? "right center" : "left center",
            }}
          >
            <HopPreviewBody preset={preset} library={library} />
          </m.div>
        </div>
      </m.div>
    );
  }

  // Anchored mode (default) — panel sits above the trigger rect with a
  // connector line. Used by the recipe builder so the hovered row
  // stays visible.
  const above = placement === "above";
  const anchorY = above ? rect.top : rect.bottom;

  return (
    <m.div
      className="hs-theme"
      initial={{ x: cursorX }}
      animate={{ x: cursorX }}
      transition={{ x: springTrack }}
      style={{
        position: "fixed",
        top: anchorY,
        left: 0,
        pointerEvents: "none",
        zIndex: 1000,
        background: "transparent",
        color: "inherit",
        font: "inherit",
      }}
    >
      {/* Hover-intent bridge only — the real interactive elements are the
          native button chips inside. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        // Interactive mode re-enables pointer events on the panel (the
        // wrapper above stays `none`) so the cursor can travel up the
        // connector strip onto the card without the trigger's mouseLeave
        // dismissing it. The full-width connector row doubles as the
        // hover bridge between trigger and card.
        onMouseEnter={interactive ? onPanelEnter : undefined}
        onMouseLeave={interactive ? onPanelLeave : undefined}
        style={{
          transform: above ? "translate(-50%, -100%)" : "translate(-50%, 0)",
          display: "flex",
          flexDirection: above ? "column" : "column-reverse",
          alignItems: "center",
          width: PANEL_WIDTH,
          pointerEvents: interactive ? "auto" : undefined,
        }}
      >
        <m.div
          initial={{ opacity: 0, scale: 0.88, y: above ? 6 : -6, rotate: 0 }}
          animate={{ opacity: 1, scale: 1, y: 0, rotate: tilt }}
          transition={{ ...springEnter, rotate: springTilt }}
          style={{
            width: "100%",
            background: "var(--hs-paper, #f8f3dc)",
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 10,
            boxShadow: hsTokens.sh1,
            padding: 12,
            transformOrigin: above ? "bottom center" : "top center",
          }}
        >
          <HopPreviewBody preset={preset} library={library} onSelect={onSelect} />
        </m.div>
        <m.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{
            scaleY: { ...springTilt, delay: 0.06 },
            opacity: { duration: 0.12, delay: 0.06 },
          }}
          style={{
            width: 2,
            height: CONNECTOR_HEIGHT,
            background: hsTokens.ink,
            transformOrigin: above ? "top" : "bottom",
          }}
        />
      </div>
    </m.div>
  );
}

// ─── Per-axis flavor colors (matches HopSection.HOP_FLAVOR_COLOR) ──

const FLAVOR_COLOR: Record<string, string> = {
  citrus: "#facc15",
  tropicalFruit: "#fb923c",
  stoneFruit: "#f97316",
  berry: "#a855f7",
  floral: "#f472b6",
  grassy: "#84cc16",
  herbal: "#22c55e",
  spice: "#ef4444",
  resinPine: "#16a34a",
};

function dominantAxis(flavor: HopFlavorProfile): string {
  let bestKey: string = HOP_FLAVOR_KEYS[0];
  let bestV = -1;
  for (const k of HOP_FLAVOR_KEYS) {
    const v = flavor[k] ?? 0;
    if (v > bestV) {
      bestV = v;
      bestKey = k;
    }
  }
  return bestKey;
}

/**
 * Inner content of the cursor-follow hop preview — name + flavor
 * radar + similar-hops chips. Exported so any future non-portal
 * surface can reuse it (e.g. a mobile drawer).
 */
export function HopPreviewBody({
  preset,
  library,
  onSelect,
}: {
  preset: HopPreset;
  library: HopPreset[];
  /** When set, the "Similar hops" chips become swap buttons. */
  onSelect?: (chosen: HopPreset) => void;
}) {
  // Hooks first — early-returning before useMemo would violate the
  // rules-of-hooks (call order must be stable across renders).
  const similar = useMemo(
    () => findSimilarHops(preset, library, 8),
    [preset, library]
  );

  if (!preset.flavor) return null;
  const dom = dominantAxis(preset.flavor);
  const accentColor = FLAVOR_COLOR[dom] ?? hsTokens.hops;

  // Origin sits above the stats grid as its own line — it's a single
  // value (country + flag), and dropping it inside the grid felt
  // out-of-character with the four acid numbers that share columns.
  const flag = preset.originCode ? getCountryFlag(preset.originCode) : null;

  // Acid stats grid — four numbers that together describe the
  // bittering character: alpha range (punch), beta range (aroma-stable
  // contributor), α:β ratio (aging behavior — 1:1 ratios common in
  // aroma varieties), cohumulone (smoothness — low = nobler bitterness).
  // Render in a 2×2 grid; cells render only when their data exists.
  const alphaRange = formatAlphaRange(preset);
  const betaRange = formatBetaRange(preset);
  const abRatio = formatAlphaBetaRatio(preset);
  const cohu = formatCohumulone(preset);
  const stats: Array<{ label: string; value: string; tooltip: string }> = [];
  if (alphaRange) {
    stats.push({
      label: "Alpha",
      value: alphaRange,
      tooltip:
        "Alpha acids — the main source of bitterness in beer. Longer boil times isomerize more, increasing IBU.",
    });
  }
  if (betaRange) {
    stats.push({
      label: "Beta",
      value: betaRange,
      tooltip:
        "Beta acids — contribute volatile aromatics and flavor. Don't add bitterness directly.",
    });
  }
  if (abRatio) {
    stats.push({
      label: "α : β",
      value: abRatio,
      tooltip:
        "Alpha-to-beta ratio — dictates how bitterness fades during aging. 1:1 ratios are common in aroma varieties.",
    });
  }
  if (cohu) {
    stats.push({
      label: "Cohu.",
      value: cohu,
      tooltip:
        "Cohumulone as % of alpha — low cohumulone gives a smoother bitterness; high cohumulone reads sharper in the final beer.",
    });
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 6,
          paddingBottom: 6,
          borderBottom: `1px solid ${hsTokens.ink}22`,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: accentColor,
            border: `1px solid ${hsTokens.ink}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 13,
            color: hsTokens.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {preset.name}
        </span>
        {preset.category ? (
          <span
            style={{
              marginLeft: "auto",
              fontFamily: hsTokens.script,
              fontSize: 12,
              color: hsTokens.muted,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {preset.category}
          </span>
        ) : null}
      </div>

      <PreviewMiniRadar flavor={preset.flavor} color={accentColor} />

      {flag || stats.length > 0 ? (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: `1px solid ${hsTokens.ink}22`,
          }}
        >
          {flag ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: stats.length > 0 ? 8 : 0,
                fontFamily: hsTokens.body,
                fontSize: 11,
                color: hsTokens.ink,
              }}
            >
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: hsTokens.muted,
                  flexShrink: 0,
                }}
              >
                Origin
              </span>
              <span style={{ fontSize: 14, lineHeight: 1 }}>{flag}</span>
              <span
                style={{
                  fontFamily: hsTokens.mono,
                  fontSize: 11,
                  color: hsTokens.ink,
                  letterSpacing: "0.02em",
                }}
              >
                {preset.originCode}
              </span>
            </div>
          ) : null}
          {stats.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto 1fr",
                columnGap: 10,
                rowGap: 3,
              }}
            >
              {stats.map((s) => (
                <PreviewStatRow
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  tooltip={s.tooltip}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {similar.length > 0 ? (
        <PreviewSimilarChips
          items={similar}
          accent={hsTokens.muted}
          onSelect={onSelect}
        />
      ) : null}
    </>
  );
}

/** One label/value pair in the 2-column stats grid. Two PreviewStatRows
 *  per visual row (the grid template repeats `auto 1fr` twice). The
 *  tooltip prop attaches a native title= for "what does this mean?" —
 *  hovering the panel is gated by pointer-events:none upstream, so the
 *  title surfaces via the cursor hovering the row that summoned the
 *  panel (a small UX compromise, but native title works there). */
function PreviewStatRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
}) {
  return (
    <>
      <span
        title={tooltip}
        style={{
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: hsTokens.muted,
          lineHeight: 1.4,
          alignSelf: "center",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.mono,
          fontSize: 11,
          color: hsTokens.ink,
          letterSpacing: "0.01em",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </>
  );
}

/** Single-flavor 9-axis polygon for the preview panel. Lifted from
 *  HopPresetModal's `PresetMiniRadar` — same SVG, same proportions. */
function PreviewMiniRadar({
  flavor,
  color,
}: {
  flavor: HopFlavorProfile;
  color: string;
}) {
  const size = 170;
  const max = 5;
  const pad = 26;
  const radius = size / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const axes = HOP_FLAVOR_KEYS.length;

  const pointAt = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = (value / max) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const labelAt = (i: number) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    const r = radius + 10;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  };
  const ringPoints = (mult: number) =>
    HOP_FLAVOR_KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const r = radius * mult;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(" ");

  const polyPoints = HOP_FLAVOR_KEYS.map((k, i) =>
    pointAt(i, flavor[k] ?? 0).join(",")
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", margin: "0 auto" }}
      aria-hidden
    >
      {[0.5, 1].map((m) => (
        <polygon
          key={m}
          points={ringPoints(m)}
          fill="none"
          stroke="var(--hs-ink)"
          strokeWidth={0.4}
          opacity={m === 1 ? 0.3 : 0.18}
        />
      ))}
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [x, y] = pointAt(i, max);
        return (
          <line
            key={k}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--hs-ink)"
            strokeWidth={0.25}
            opacity={0.2}
          />
        );
      })}
      <polygon
        points={polyPoints}
        fill={color}
        fillOpacity={0.32}
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {HOP_FLAVOR_KEYS.map((k, i) => {
        const [lx, ly] = labelAt(i);
        const labelText = k === "tropicalFruit" ? "tropical" : k === "resinPine" ? "pine" : k === "stoneFruit" ? "stone" : k;
        return (
          <text
            key={`label-${k}`}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 7,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fill: FLAVOR_COLOR[k] ?? hsTokens.muted,
            }}
          >
            {labelText}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * "Similar hops" chips. Each chip shows the hop name plus its alpha
 * acid percentage (small, mono, muted) so the brewer can see at a
 * glance whether the substitute is bittering-compatible without having
 * to hover each one. Cream pill + ink/55 border for legibility against
 * the panel's paper background.
 */
function PreviewSimilarChips({
  items,
  accent,
  onSelect,
}: {
  items: SimilarHop[];
  accent: string;
  /** When set, each chip is a button that swaps the hovered hop for it. */
  onSelect?: (chosen: HopPreset) => void;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <div
        style={{
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: accent,
          marginBottom: 5,
        }}
      >
        {onSelect ? "Similar hops — tap to swap" : "Similar hops"}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {items.map(({ hop }) => (
          <SimilarChip key={hop.name} hop={hop} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/** One "similar hop" pill. Static text by default; a swap button (with a
 *  hop-accent hover fill) when `onSelect` is provided by the interactive
 *  builder panel. */
function SimilarChip({
  hop,
  onSelect,
}: {
  hop: HopPreset;
  onSelect?: (chosen: HopPreset) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = Boolean(onSelect);
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "baseline",
    gap: 5,
    background: clickable && hovered ? hsTokens.hops : hsTokens.cream,
    border: `1px solid ${clickable && hovered ? hsTokens.hops : `${hsTokens.ink}55`}`,
    borderRadius: 999,
    padding: "2px 9px",
    fontFamily: hsTokens.body,
    fontSize: 10,
    fontWeight: 600,
    color: clickable && hovered ? hsTokens.paper : hsTokens.ink,
    letterSpacing: "0.01em",
    lineHeight: 1.4,
    whiteSpace: "normal",
    wordBreak: "break-word",
    maxWidth: "100%",
    transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
  };
  const body = (
    <>
      <span>{hop.name}</span>
      {typeof hop.alphaAcidPercent === "number" ? (
        <span
          style={{
            fontFamily: hsTokens.mono,
            fontSize: 9,
            color: clickable && hovered ? hsTokens.paper : hsTokens.muted,
            letterSpacing: "0.02em",
          }}
        >
          {hop.alphaAcidPercent.toFixed(1)}%
        </span>
      ) : null}
    </>
  );

  if (!clickable) return <span style={base}>{body}</span>;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(hop)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Swap to ${hop.name}`}
      style={{
        ...base,
        margin: 0,
        cursor: "pointer",
        textAlign: "left",
        appearance: "none",
        WebkitAppearance: "none",
      }}
    >
      {body}
    </button>
  );
}
