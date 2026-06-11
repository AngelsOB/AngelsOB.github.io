"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { Recipe } from "@/modules/recipe/models/Recipe";

import HSBrowsePreviewPanel from "./HSBrowsePreviewPanel";

interface Props {
  /** Whether to render the panel. When this flips false, AnimatePresence
   *  springs the column out (width 0, fade) before unmounting. */
  open: boolean;
  /** The loaded recipe (or null while initial fetch is pending). */
  full: Recipe | null;
  loading: boolean;
  error: string | null;
  /** Open-target href used by the BuilderMock's "Open recipe →" pill. Read once
   *  per render; stable across the selection lifetime. */
  cardPath: string;
  /** Animated target width in pixels. Comes from `usePreviewWidth()`. */
  previewWidth: number;
  onClose: () => void;
  onRetry?: () => void;
}

/** The slide-in right-side column that hosts the BuilderMock preview panel.
 *  Shared across /browse, /recipes, /recipes/all. The column itself animates
 *  width + marginLeft + opacity; the inner panel additionally translates +
 *  fades to give a secondary "lands after the column lands" beat. */
export default function HSPreviewColumn({
  open,
  full,
  loading,
  error,
  cardPath,
  previewWidth,
  onClose,
  onRetry,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="hs-preview-col"
          className="hs-preview-col"
          initial={
            prefersReducedMotion
              ? { width: previewWidth, marginLeft: 28, opacity: 1 }
              : { width: 0, marginLeft: 0, opacity: 0 }
          }
          animate={{
            width: previewWidth,
            marginLeft: 28,
            opacity: 1,
          }}
          exit={
            prefersReducedMotion
              ? { width: previewWidth, marginLeft: 28, opacity: 1 }
              : { width: 0, marginLeft: 0, opacity: 0 }
          }
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 30,
            mass: 0.9,
          }}
          style={{
            // clip-path (not overflow:hidden) so position:sticky on the
            // panel inside still finds the window as its scroll context.
            clipPath: "inset(0)",
            flexShrink: 0,
            alignSelf: "stretch",
          }}
        >
          {/* Inner: fixed-pixel width so panel content doesn't reflow during
              the outer's width animation. Full height so the sticky panel
              has the cards-grid height to stick within. */}
          <motion.div
            initial={
              prefersReducedMotion
                ? { x: 0, opacity: 1 }
                : { x: 24, opacity: 0 }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={
              prefersReducedMotion
                ? { x: 0, opacity: 1 }
                : { x: 24, opacity: 0 }
            }
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 26,
              delay: prefersReducedMotion ? 0 : 0.06,
            }}
            style={{ width: previewWidth, height: "100%" }}
          >
            <HSBrowsePreviewPanel
              full={full}
              loading={loading}
              error={error}
              cardPath={cardPath}
              onClose={onClose}
              onRetry={onRetry}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
