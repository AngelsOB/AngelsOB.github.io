"use client";

import { motion } from "framer-motion";
import { hsTokens } from "@/modules/hopskip/tokens";
import { Highlight } from "../types";
import { HopFlavorRadar } from "./HopFlavorRadar";

// Hops section content. Contains the hop bill table and the HopVisualizer
// sub-bone (the flavor radar — the marquee piece that explodes out when
// stage 4 highlights it).

interface Props {
  highlight: Highlight;
}

const HOPS = [
  { name: "Citra", amount: "0.5oz", use: "boil 60", purpose: "Aroma" },
  { name: "Mosaic", amount: "1.5oz", use: "boil 60", purpose: "Aroma" },
  { name: "Citra", amount: "1.0oz", use: "whirlpool", purpose: "Aroma" },
];

export function HopsContent({ highlight }: Props) {
  const isFocus = highlight === "hops";

  return (
    <div
      style={{
        padding: "18px 20px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <h3
          style={{
            fontFamily: hsTokens.display,
            fontSize: 26,
            letterSpacing: "-0.03em",
            color: hsTokens.ink,
            margin: 0,
            lineHeight: 1,
          }}
        >
          Hops.
        </h3>
        <span
          style={{
            fontFamily: hsTokens.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          The hop bill · {HOPS.length} hops · 52 IBU
        </span>
      </div>

      {/* Hop bill table */}
      <div
        style={{
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 10,
          boxShadow: "2px 2px 0 var(--hs-ink)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 1fr 60px 60px",
            gap: 8,
            padding: "8px 12px",
            background: `color-mix(in oklch, ${hsTokens.hops} 7%, ${hsTokens.cream})`,
            borderBottom: `2px solid ${hsTokens.ink}`,
            fontFamily: hsTokens.body,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: hsTokens.muted,
          }}
        >
          <div>Flavor</div>
          <div>Hop</div>
          <div>Use</div>
          <div style={{ textAlign: "right" }}>Weight</div>
          <div style={{ textAlign: "right" }}>IBU</div>
        </div>
        {HOPS.map((hop, i) => (
          <div
            key={`${hop.name}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "44px 1fr 1fr 60px 60px",
              gap: 8,
              padding: "10px 12px",
              alignItems: "center",
              borderTop:
                i > 0
                  ? `1px solid color-mix(in oklch, ${hsTokens.ink} 12%, transparent)`
                  : "none",
              background:
                i % 2 === 1
                  ? `color-mix(in oklch, ${hsTokens.ink} 2%, transparent)`
                  : "transparent",
            }}
          >
            <HopFlavorRadar size={36} variant="mini" hopName={hop.name} />
            <div>
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 12,
                  fontWeight: 700,
                  color: hsTokens.ink,
                }}
              >
                {hop.name}
              </div>
              <div
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 9,
                  color: hsTokens.muted,
                  marginTop: 1,
                }}
              >
                {hop.purpose} · 13.2% AA
              </div>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  background: hsTokens.hops,
                  borderRadius: 999,
                }}
              />
              <span
                style={{
                  fontFamily: hsTokens.body,
                  fontSize: 11,
                  color: hsTokens.ink,
                }}
              >
                {hop.use}
              </span>
            </div>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.ink,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {hop.amount}
            </div>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {[14, 28, 10][i] ?? "—"}
            </div>
          </div>
        ))}
      </div>

      {/* HopVisualizer SUB-BONE — the marquee piece. When highlight=hops,
          this lifts forward + scales up. When not, it sits at its
          natural position above the hop bill table (acts as a "blend
          preview"). */}
      <motion.div
        data-bone="hop-visualizer"
        animate={{
          y: isFocus ? -160 : 0,
          x: isFocus ? 80 : 0,
          scale: isFocus ? 1.7 : 1,
          opacity: 1,
        }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          position: "absolute",
          top: 60,
          right: 24,
          transformOrigin: "center center",
          zIndex: isFocus ? 30 : 1,
          filter: isFocus
            ? "drop-shadow(0 20px 30px rgba(0,0,0,0.2))"
            : "none",
        }}
      >
        <div
          style={{
            background: hsTokens.cream,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 12,
            boxShadow: "3px 3px 0 var(--hs-ink)",
            padding: 8,
          }}
        >
          <HopFlavorRadar size={90} variant="full" />
        </div>
      </motion.div>
    </div>
  );
}
