"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

import { LazyMotion, domMax, m } from "framer-motion";

import { hsTokens, hsAlpha } from "../../tokens";
import { springEnter, springTilt, springTrack } from "../../motion";
import type { YeastPreset } from "@/modules/recipe/models/Presets";
import { getYeastLabFavicon } from "@/modules/recipe/utils/yeastLabIcons";

import {
  findStrainPeers,
  formatAttenuationRange,
  formatFlocculation,
  formatForm,
  formatStrainType,
  formatTempRange,
  hasYeastDetails,
  resolveSubstitutes,
} from "./yeastDetails";

// Panel width. Wide enough to fit two-ish substitute chips per line for
// most strain names; long names wrap to the next line via `flex-wrap`.
const PANEL_WIDTH = 320;

// Hover-intent dwell default. Overridable via the hook's `showDelay`
// option — the modal sets 0 (instant) so a picker sweep is responsive;
// the builder card uses the default so brushing the cursor over an
// input doesn't fire the preview.
const DEFAULT_SHOW_DELAY_MS = 850;

// Once the first hover has fired, subsequent triggers within this
// many ms of cursor-leave show the panel INSTANTLY (no re-dwell). The
// "warmup" makes sliding through a list feel live after the first row
// has been read. If the cursor stays away for the full cooldown,
// warmup resets and the next hover dwells again.
const WARMUP_COOLDOWN_MS = 500;

// Brief delay before tearing the panel down on leave — lets the next
// adjacent row's mouseEnter cancel the dismiss and seamlessly switch
// the panel's contents instead of flickering off/on.
const HIDE_DELAY_MS = 60;

// Conservative panel-height estimate used to decide whether there's
// room above the trigger. Real height varies with content, but a fixed
// estimate avoids flipping mid-animation as content lays out.
const PANEL_HEIGHT_ESTIMATE = 320;

// Connector line geometry — drops from the panel's bottom (or top if
// flipped below) to the trigger's edge so the user can see what the
// preview is pointing at.
const CONNECTOR_HEIGHT = 12;

type Placement = "above" | "below" | "cursor-right";

type AnchorState = {
  rect: DOMRect;
  preset: YeastPreset;
  // Opaque caller token (the builder passes the hovered card's strain id)
  // echoed back to `onSelect` when a chip is clicked, so the consumer
  // knows which strain to swap. Undefined for the passive picker preview.
  context?: string;
};

export type UseYeastHoverPreviewOptions = {
  /**
   * Milliseconds the cursor must dwell inside the trigger before the
   * panel appears. Set to 0 for an instant pop (the picker modal does
   * this — the brewer is scanning rows quickly and shouldn't have to
   * pause). Default 300 (matches the FermentableSection BillStack).
   */
  showDelay?: number;
  /**
   * Where the panel sits relative to the trigger.
   *  • `'anchored'` (default) — pops above the trigger (or below if no
   *    room above), with a connector line down to the trigger. Right
   *    for builder cards: the hovered card stays visible.
   *  • `'cursor-right'` — follows the cursor with a horizontal offset
   *    to its right (flips left near the viewport edge). Right for
   *    modal pickers: doesn't obscure rows above the cursor.
   */
  placement?: "anchored" | "cursor-right";
  /**
   * When provided (anchored placement only), the panel becomes
   * interactive: the cursor can travel onto it without dismissing it,
   * and each "Same strain"/"Substitutes" chip that resolves to a library
   * preset turns into a button that calls this with the chosen preset
   * plus the `context` passed to `getTriggerProps`. The builder cards
   * wire this to swap the hovered strain in place. Omitted by the picker
   * modal, which leaves the panel a passive, cursor-following preview.
   */
  onSelect?: (chosen: YeastPreset, context: string) => void;
};

/**
 * Element-anchored hover preview for a yeast strain. The panel pops up
 * above (or below, if no room above) the triggering element and
 * reads the dwell timer from `options.showDelay`. Anchored to the
 * trigger's bounding rect rather than the cursor — so it never blocks
 * inputs underneath and stays put while the cursor is inside.
 *
 * Returns:
 *  • `portal`: the panel + connector, rendered at document.body. The
 *    consumer must include `{portal}` in its JSX for the panel to
 *    actually mount.
 *  • `getTriggerProps(preset)`: handlers to spread onto any element
 *    that should trigger the preview on hover. No-op for presets with
 *    no enrichment (e.g. custom strains the user has saved themselves).
 *  • `clear()`: imperative reset for cases where the trigger element
 *    is being covered by something else (e.g. a modal opens over the
 *    hovered surface — mouseleave doesn't fire on its own).
 */
export function useYeastHoverPreview(
  library: YeastPreset[],
  options: UseYeastHoverPreviewOptions = {}
) {
  const placementMode = options.placement ?? "anchored";

  const [anchor, setAnchor] = useState<AnchorState | null>(null);
  // Cursor X (viewport coords) — the panel translates horizontally to
  // follow this via a tight spring, so the connector "points at" the
  // current cursor position. Same trick the FermentableSection BillStack
  // tooltip uses.
  const [cursorX, setCursorX] = useState<number>(0);
  // Cursor Y — only used in `cursor-right` placement (panel follows
  // both axes). Anchored mode locks Y to the trigger rect.
  const [cursorY, setCursorY] = useState<number>(0);
  // Velocity-driven tilt on the card — moving right tilts the card left
  // (so it "trails" the motion), and vice versa. Settles to 0 once the
  // cursor stops. Same gesture as BillStack.
  const [tilt, setTilt] = useState<number>(0);
  const showTimerRef = useRef<number | null>(null);
  // Brief post-leave delay before clearing the panel. Survives quick
  // adjacent-row transitions via cancel-on-enter.
  const hideTimerRef = useRef<number | null>(null);
  // Longer post-leave timer that resets warmup if the cursor doesn't
  // come back to ANY trigger before it fires.
  const cooldownTimerRef = useRef<number | null>(null);
  // Whether the next mouseEnter should show INSTANTLY (post-first-hover)
  // or run the dwell again. Ref because changes shouldn't trigger
  // renders — only the anchor does.
  const warmedUpRef = useRef(false);
  // Last clientX we saw, used to compute dx on the next mousemove. Refs
  // (not state) so updates don't trigger renders on every move.
  const lastClientXRef = useRef<number | null>(null);
  // Timer that returns tilt to 0 once the cursor stops — otherwise the
  // card would freeze at its last tilted angle.
  const tiltRestTimerRef = useRef<number | null>(null);

  // Keep delay in a ref so trigger-handler closures always read the
  // latest value without needing to be re-created on prop change.
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

  // Imperatively show the panel. Rect is captured by the caller from
  // the mouse event — we do NOT call getBoundingClientRect() in any
  // deferred callback (e.currentTarget can be null/stale across React
  // boundaries by the time a setTimeout fires).
  const showNow = useCallback(
    (rect: DOMRect, preset: YeastPreset, context?: string) => {
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

  // Update cursor + derive tilt from velocity. Called from mouseEnter
  // (to capture initial X) and every mouseMove inside the trigger.
  const updateCursor = useCallback((clientX: number, clientY: number) => {
    setCursorY(clientY);
    setCursorX(clientX);
    const last = lastClientXRef.current;
    const dx = last !== null ? clientX - last : 0;
    lastClientXRef.current = clientX;
    // Negative sign → card tilts AWAY from cursor direction (moving
    // right → tilts left, trails the cursor). Clamp ±10° so the swing
    // reads as a playful sway, not chaos.
    const rotation = Math.max(-10, Math.min(10, -dx * 0.35));
    setTilt(rotation);
    if (tiltRestTimerRef.current !== null) {
      window.clearTimeout(tiltRestTimerRef.current);
    }
    // After 120ms of no movement the card settles upright. Matches the
    // BillStack rest timing.
    tiltRestTimerRef.current = window.setTimeout(() => setTilt(0), 120);
  }, []);

  const getTriggerProps = useCallback(
    (preset: YeastPreset | null | undefined, context?: string) => {
      if (!preset || !hasYeastDetails(preset)) return {} as const;
      return {
        onMouseEnter: (e: React.MouseEvent) => {
          const rect = (
            e.currentTarget as HTMLElement
          ).getBoundingClientRect();
          // Snap cursor to the entry point so the panel pops in AT
          // the cursor (not sliding in from origin on first show).
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
          // Cancel a pending show — the user left before the dwell
          // completed.
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
          // from one trigger to the next.
          if (hideTimerRef.current !== null) {
            window.clearTimeout(hideTimerRef.current);
          }
          hideTimerRef.current = window.setTimeout(() => {
            setAnchor(null);
            hideTimerRef.current = null;
          }, HIDE_DELAY_MS);
          // Longer warmup-cooldown — if the cursor doesn't come back
          // to ANY trigger within this window (e.g. left the modal
          // entirely), the next hover should dwell again.
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

  // Cleanup on unmount — dangling timers would set state on a stale
  // component.
  useEffect(() => () => cancelTimers(), [cancelTimers]);

  // Decide above vs. below at show time based on available space. Sticky
  // for the lifetime of one hover (i.e. recomputed when a new preset is
  // hovered) so the panel doesn't flip mid-animation.
  const placement: Placement = useMemo(() => {
    if (!anchor) return "above";
    if (placementMode === "cursor-right") return "cursor-right";
    const spaceAbove = anchor.rect.top;
    return spaceAbove >= PANEL_HEIGHT_ESTIMATE + CONNECTOR_HEIGHT + 12
      ? "above"
      : "below";
  }, [anchor, placementMode]);

  // Interactive only in anchored placement (builder cards) — the
  // cursor-following picker preview can't be hovered onto, so it stays
  // a passive panel even if a stray onSelect were ever passed.
  const interactive =
    Boolean(options.onSelect) && placementMode === "anchored";

  // Chip click → swap. Echoes the anchored card's context back to the
  // consumer, then tears the panel down (the card's content just changed
  // underneath it).
  const handleSelect = useCallback(
    (chosen: YeastPreset) => {
      if (anchor?.context != null) options.onSelect?.(chosen, anchor.context);
      clear();
    },
    [anchor, options, clear]
  );

  // The portal renders to `document.body`, which is outside the
  // builder's LazyMotion wrapper — so we mount our own here, otherwise
  // the `m.div` children inside PreviewFrame have no animation features
  // (strict mode would leave them stuck at their `initial` values, i.e.
  // opacity: 0 + scale: 0.88, and the panel appears as a grey/empty
  // box). Match the rest of the builder's setup: domMax + strict.
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

/**
 * Outer motion wrapper springs horizontally with the cursor; inner
 * static div handles the vertical flip + horizontal centering; card +
 * connector animate the entrance + tilt. Same pattern as the grain
 * BillStack tooltip — cursorX drives a `springTrack`, tilt drives a
 * `springTilt` on the card's rotation.
 *
 * Why the wrapper isn't `m.div` with `transform: translate(-50%)`:
 * framer-motion takes over the transform CSS property when ANY of
 * x/y/scale/rotate is animated, stripping any inline `transform`. So
 * positioning + centering live on the static inner div, animation on
 * the motion siblings.
 */
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
  preset: YeastPreset;
  library: YeastPreset[];
  rect: DOMRect;
  placement: Placement;
  cursorX: number;
  cursorY: number;
  tilt: number;
  interactive?: boolean;
  onPanelEnter?: () => void;
  onPanelLeave?: () => void;
  onSelect?: (chosen: YeastPreset) => void;
}) {
  // Cursor-right mode (modal pickers) — panel hovers to the side of
  // the cursor with no connector. Doesn't obscure the rows above/below
  // the cursor while the brewer is scanning.
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
            // Vertically center on the cursor. Horizontal is already
            // handled by the motion x value above (no translateX).
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
              // Pivot rotation around the cursor side so the swing
              // reads as the panel hanging off the cursor.
              transformOrigin: willClipRight ? "right center" : "left center",
            }}
          >
            <YeastPreviewBody preset={preset} library={library} />
          </m.div>
        </div>
      </m.div>
    );
  }

  // Anchored mode (default — builder cards). Panel sits above the
  // trigger rect with a connector line down to it.
  const above = placement === "above";
  const anchorY = above ? rect.top : rect.bottom;

  return (
    <m.div
      className="hs-theme"
      // Spring toward cursorX horizontally so the panel slides along
      // with the cursor while it's inside the trigger. left:0 means the
      // motion x value directly maps to viewport X — the static child
      // centers itself on this point via translateX(-50%).
      initial={{ x: cursorX }}
      animate={{ x: cursorX }}
      transition={{ x: springTrack }}
      style={{
        position: "fixed",
        top: anchorY,
        left: 0,
        pointerEvents: "none",
        zIndex: 1000,
        // `.hs-theme` is here ONLY to cascade --hs-paper / --hs-ink /
        // etc. into the card below — its default `background: cream`
        // and base typography must NOT paint here, otherwise the
        // wrapper's layout box (which extends DOWN from anchorY to fit
        // its content, since the visual translate doesn't affect
        // layout) shows up as a huge cream rectangle below the card.
        background: "transparent",
        // Zero out the rest of the .hs-theme baseline that would
        // affect the wrapper's visible footprint or layout sizing.
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
          // Center on the motion x point, flip up if above. Static
          // transform here composes with the parent's motion-driven
          // translate cleanly.
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
          transition={{
            ...springEnter,
            // Tilt uses springTilt — tighter than the entrance spring
            // so frequent cursor-velocity updates don't rock chaotically.
            rotate: springTilt,
          }}
          style={{
            width: "100%",
            background: "var(--hs-paper, #f8f3dc)",
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 10,
            // sh1 (2px offset) instead of sh3 — the hard 4px-down ink
            // shadow used to paint a grey strip below the panel that
            // overlapped with the connector area.
            boxShadow: hsTokens.sh1,
            padding: 12,
            // Pivot the entrance scale + tilt from the connector side
            // so the line-meeting-point stays visually fixed.
            transformOrigin: above ? "bottom center" : "top center",
          }}
        >
          <YeastPreviewBody
            preset={preset}
            library={library}
            onSelect={onSelect}
          />
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

/**
 * The inner content of the hover preview — lab/name header, the stat
 * grid, and the same-strain/substitutes chip rows. Exported separately
 * so consumers can drop it into a non-cursor-follow surface if needed.
 */
export function YeastPreviewBody({
  preset,
  library,
  onSelect,
}: {
  preset: YeastPreset;
  library: YeastPreset[];
  /** When set, chips that resolve to a library preset become swap buttons. */
  onSelect?: (chosen: YeastPreset) => void;
}) {
  const favicon = getYeastLabFavicon(preset.category);
  const typeLabel = formatStrainType(preset.type);
  const formLabel = formatForm(preset.form);
  const tempRange = formatTempRange(preset.tempMinC, preset.tempMaxC);
  const flocLabel = formatFlocculation(preset.flocculation);
  const attenRange = formatAttenuationRange(
    preset.attenuationMin,
    preset.attenuationMax,
    preset.attenuationPercent
  );
  const abvLabel =
    preset.alcoholTolerance != null
      ? `${Math.round(preset.alcoholTolerance)}% max`
      : null;

  const peers = useMemo(
    () => findStrainPeers(preset, library),
    [preset, library]
  );
  const subs = useMemo(
    () => resolveSubstitutes(preset, library),
    [preset, library]
  );

  const typeAndForm = [typeLabel, formLabel].filter(Boolean).join(" · ");

  const rows: Array<[string, string]> = [];
  if (typeAndForm) rows.push(["Type", typeAndForm]);
  if (tempRange) rows.push(["Temp", tempRange]);
  if (flocLabel) rows.push(["Floc", flocLabel]);
  if (attenRange) rows.push(["Atten", attenRange]);
  if (abvLabel) rows.push(["ABV", abvLabel]);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: `1px solid ${hsAlpha(hsTokens.ink, 13)}`,
        }}
      >
        <PreviewLabBadge laboratory={preset.category} favicon={favicon} />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: hsTokens.body,
              fontWeight: 700,
              fontSize: 13,
              color: hsTokens.ink,
              lineHeight: 1.15,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {preset.name}
          </div>
          {preset.category ? (
            <div
              style={{
                fontFamily: hsTokens.script,
                fontSize: 13,
                color: hsTokens.muted,
                lineHeight: 1.1,
                marginTop: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {preset.category}
            </div>
          ) : null}
        </div>
      </div>

      {rows.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: 12,
            rowGap: 4,
          }}
        >
          {rows.map(([label, value]) => (
            <PreviewStatRow key={label} label={label} value={value} />
          ))}
        </div>
      ) : null}

      {peers.length > 0 ? (
        <PreviewRefChips
          label="Same strain"
          items={peers.map((p) => ({ name: p.name, preset: p }))}
          accent={hsTokens.yeast}
          onSelect={onSelect}
        />
      ) : null}
      {subs.length > 0 ? (
        <PreviewRefChips
          label="Substitutes"
          items={subs.map((s) => ({ name: s.name, preset: s.preset }))}
          accent={hsTokens.muted}
          onSelect={onSelect}
        />
      ) : null}
    </>
  );
}

function PreviewStatRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span
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
          fontSize: 12,
          color: hsTokens.ink,
          letterSpacing: "0.01em",
          lineHeight: 1.4,
        }}
      >
        {value}
      </span>
    </>
  );
}

/**
 * Chip layout for "Same strain, other labs" + "Substitute with". Each
 * strain renders as a small pill that wraps freely; we render ALL of
 * them rather than capping so the brewer sees the full list at a
 * glance. Long names wrap their text inside the chip — the pill grows
 * to fit rather than truncating.
 */
function PreviewRefChips({
  label,
  items,
  accent,
  onSelect,
}: {
  label: string;
  items: Array<{ name: string; preset: YeastPreset | null }>;
  accent: string;
  /** When set, items with a resolved preset become swap buttons. */
  onSelect?: (chosen: YeastPreset) => void;
}) {
  // Only advertise "tap to swap" if at least one chip is actually
  // clickable (resolves to a library preset). Names with no preset still
  // render as plain text the brewer can look up elsewhere.
  const anyClickable = Boolean(onSelect) && items.some((i) => i.preset);
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
        {anyClickable ? `${label} — tap to swap` : label}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {items.map((item) => (
          <RefChip
            key={item.name}
            name={item.name}
            preset={item.preset}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

/** One strain pill. Plain text unless it resolves to a library preset
 *  AND the panel is interactive — then it's a swap button with a
 *  yeast-accent hover fill. */
function RefChip({
  name,
  preset,
  onSelect,
}: {
  name: string;
  preset: YeastPreset | null;
  onSelect?: (chosen: YeastPreset) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const clickable = Boolean(onSelect && preset);
  const base: CSSProperties = {
    // Cream (more saturated than cream-2) reads cleanly against the
    // panel's paper background — cream-2 was nearly the same tone and the
    // chips disappeared into the panel.
    background: clickable && hovered ? hsTokens.yeast : hsTokens.cream,
    border: `1px solid ${clickable && hovered ? hsTokens.yeast : hsAlpha(hsTokens.ink, 33)}`,
    borderRadius: 999,
    padding: "2px 9px",
    fontFamily: hsTokens.body,
    fontSize: 10,
    fontWeight: 600,
    color: clickable && hovered ? hsTokens.paper : hsTokens.ink,
    letterSpacing: "0.01em",
    lineHeight: 1.4,
    // Allow long strain names to wrap inside the chip so a single
    // bus-name like "OYL-016 Extra Special (formerly British Ale VIII)"
    // doesn't overflow the panel.
    whiteSpace: "normal",
    wordBreak: "break-word",
    maxWidth: "100%",
    transition: "background 120ms ease, color 120ms ease, border-color 120ms ease",
  };

  if (!clickable) return <span style={base}>{name}</span>;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(preset as YeastPreset)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Swap to ${name}`}
      style={{
        ...base,
        margin: 0,
        cursor: "pointer",
        textAlign: "left",
        appearance: "none",
        WebkitAppearance: "none",
      }}
    >
      {name}
    </button>
  );
}

function PreviewLabBadge({
  laboratory,
  favicon,
}: {
  laboratory?: string;
  favicon: string | null;
}) {
  const sharedStyle: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: hsTokens.cream,
    border: `1px solid ${hsAlpha(hsTokens.ink, 20)}`,
    flexShrink: 0,
  };
  if (favicon) {
    return (
      <img
        src={favicon}
        alt={laboratory || "Yeast lab"}
        width={28}
        height={28}
        style={{ ...sharedStyle, objectFit: "contain", padding: 3 }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...sharedStyle,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: hsTokens.body,
        fontSize: 12,
        fontWeight: 700,
        color: hsTokens.muted,
      }}
    >
      {laboratory?.charAt(0).toUpperCase() || "Y"}
    </span>
  );
}
