"use client";

import { motion } from "framer-motion";
import { hsTokens } from "@/modules/hopskip/tokens";
import type { CSSProperties, ReactNode } from "react";

type TailSide = "left" | "right" | "center";

interface Props {
  children: ReactNode;
  color?: string;
  textColor?: string;
  /** Style override for absolute positioning */
  style?: CSSProperties;
  /** Which side of the bubble underside the tail attaches to */
  tail?: TailSide;
  /** Animation delay in seconds */
  delay?: number;
  /** Use Caveat handwritten script (default true) */
  script?: boolean;
  /** Font size in px */
  fontSize?: number;
}

export default function AnnotationBubble({
  children,
  color = hsTokens.water,
  textColor = "#ffffff",
  style,
  tail = "center",
  delay = 0,
  script = true,
  fontSize,
}: Props) {
  const tailOffset =
    tail === "center"
      ? { left: "50%", transform: "translateX(-50%)" as const }
      : tail === "left"
      ? { left: 16 }
      : { right: 16 };

  const defaultFontSize = script ? 22 : 14;

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 1, scaleY: 1 }}
      animate={{
        opacity: 1,
        scaleX: [1, 1.25, 0.75, 1.15, 0.95, 1.05, 1],
        scaleY: [1, 0.75, 1.25, 0.85, 1.05, 0.95, 1],
      }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
      style={{
        position: "absolute",
        zIndex: 20,
        background: color,
        padding: script ? "6px 18px 4px" : "8px 16px",
        borderRadius: 9999,
        fontFamily: script ? hsTokens.script : hsTokens.body,
        fontWeight: script ? 500 : 700,
        fontSize: fontSize ?? defaultFontSize,
        color: textColor,
        boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: -8,
          ...tailOffset,
          width: 0,
          height: 0,
          borderLeft: "8px solid transparent",
          borderRight: "8px solid transparent",
          borderTop: `10px solid ${color}`,
        }}
      />
    </motion.div>
  );
}
