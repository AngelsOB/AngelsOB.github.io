"use client";

import { motion } from "framer-motion";
import { hsTokens } from "@/modules/hopskip/tokens";
import { Highlight } from "../types";

// Water section content. Has THREE sub-bones that can independently
// explode out when stage 5 highlights it:
//   - SaltCellsBone (the row of mineral-addition cells)
//   - AutoCalcBone (the compound ink button)
//   - PhCalloutBone (the colored pH status card)
//
// In the default state, these all sit in their natural positions inside
// the section. When highlight=water, each lifts forward at a slightly
// different vector so the eye reads them as separate, related pieces.

interface Props {
  highlight: Highlight;
}

const SALTS = [
  { label: "CaSO₄", desc: "Gypsum", value: 5.2 },
  { label: "CaCl₂", desc: "Calcium Chloride", value: 1.8 },
  { label: "MgSO₄", desc: "Epsom", value: 0.4 },
  { label: "NaCl", desc: "Salt", value: 0.3 },
];

export function WaterContent({ highlight }: Props) {
  const isFocus = highlight === "water";

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
          Water.
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
          Target · Hoppy Pale
        </span>
      </div>

      {/* Source → Target row + AUTO-CALC sub-bone */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Pill
          label="SOURCE"
          value="RO"
          color={hsTokens.cream}
          textColor={hsTokens.ink}
          dot={hsTokens.water}
        />
        <span style={{ color: hsTokens.muted, fontSize: 14 }}>→</span>
        <Pill
          label="TARGET"
          value="BJCP · Hoppy Pale ▾"
          color={hsTokens.water}
          textColor={hsTokens.cream}
          dot={hsTokens.cream}
        />

        {/* AUTO-CALC SUB-BONE */}
        <motion.div
          data-bone="auto-calc"
          animate={{
            y: isFocus ? -100 : 0,
            x: isFocus ? 50 : 0,
            scale: isFocus ? 1.4 : 1,
          }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
          style={{
            marginLeft: "auto",
            zIndex: isFocus ? 30 : 1,
            filter: isFocus
              ? "drop-shadow(0 12px 24px rgba(0,0,0,0.2))"
              : "none",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 14px 8px 10px",
              background: hsTokens.ink,
              border: `2px solid ${hsTokens.ink}`,
              borderRadius: 999,
              boxShadow: "2px 2px 0 var(--hs-ink)",
              fontFamily: hsTokens.body,
              fontSize: 11,
              fontWeight: 800,
              color: hsTokens.cream,
              letterSpacing: "0.06em",
              gap: 8,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                border: `1.5px solid ${hsTokens.cream}`,
                background: `color-mix(in oklch, ${hsTokens.cream} 20%, transparent)`,
                borderRadius: 2,
                display: "inline-block",
              }}
            />
            <span>NaHCO₃</span>
            <span
              style={{
                width: 1,
                height: 12,
                background: `color-mix(in oklch, ${hsTokens.cream} 35%, transparent)`,
              }}
            />
            <span>Auto-Calc</span>
          </div>
        </motion.div>
      </div>

      {/* SALT CELLS SUB-BONE */}
      <motion.div
        data-bone="salt-cells"
        animate={{
          y: isFocus ? -50 : 0,
          x: isFocus ? -30 : 0,
          scale: isFocus ? 1.2 : 1,
        }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          zIndex: isFocus ? 25 : 1,
          transformOrigin: "left center",
          filter: isFocus
            ? "drop-shadow(0 14px 24px rgba(0,0,0,0.18))"
            : "none",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          {SALTS.map((salt) => (
            <SaltCell key={salt.label} {...salt} />
          ))}
        </div>
      </motion.div>

      {/* PH CALLOUT SUB-BONE */}
      <motion.div
        data-bone="ph-callout"
        animate={{
          y: isFocus ? -10 : 0,
          x: isFocus ? 100 : 0,
          scale: isFocus ? 1.25 : 1,
        }}
        transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          zIndex: isFocus ? 20 : 1,
          transformOrigin: "left center",
          filter: isFocus
            ? "drop-shadow(0 12px 22px rgba(0,0,0,0.16))"
            : "none",
        }}
      >
        <div
          style={{
            background: `color-mix(in oklch, ${hsTokens.hops} 18%, ${hsTokens.cream})`,
            border: `2px solid ${hsTokens.ink}`,
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: hsTokens.body,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: hsTokens.muted,
              }}
            >
              Mash pH
            </div>
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 26,
                letterSpacing: "-0.03em",
                color: hsTokens.hops,
                lineHeight: 1,
                marginTop: 2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              5.4
            </div>
          </div>
          <div
            style={{
              fontFamily: hsTokens.body,
              fontSize: 11,
              color: hsTokens.muted,
            }}
          >
            ideal · within 5.2–5.6 range
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Pill({
  label,
  value,
  color,
  textColor,
  dot,
}: {
  label: string;
  value: string;
  color: string;
  textColor: string;
  dot: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px 8px 10px",
        background: color,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 999,
        boxShadow: "2px 2px 0 var(--hs-ink)",
        fontFamily: hsTokens.body,
        fontSize: 11,
        color: textColor,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          background: dot,
          borderRadius: 999,
        }}
      />
      <span
        style={{
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          fontSize: 9,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: hsTokens.display,
          fontSize: 12,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </span>
  );
}

function SaltCell({ label, desc, value }: typeof SALTS[number]) {
  return (
    <div
      style={{
        background: hsTokens.paper,
        border: `2px solid ${hsTokens.ink}`,
        borderRadius: 10,
        padding: "8px 10px",
        position: "relative",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 8,
          right: 8,
          height: 3,
          background: hsTokens.water,
          borderRadius: "0 0 2px 2px",
        }}
      />
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 9,
          fontWeight: 800,
          color: hsTokens.ink,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: hsTokens.body,
          fontSize: 8,
          color: hsTokens.muted,
          marginTop: 1,
        }}
      >
        {desc}
      </div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            width: 16,
            height: 16,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: hsTokens.ink,
            fontWeight: 700,
            background: hsTokens.cream,
          }}
        >
          −
        </span>
        <span
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: hsTokens.mono,
            fontSize: 12,
            color: hsTokens.ink,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value.toFixed(1)}
        </span>
        <span
          style={{
            width: 16,
            height: 16,
            border: `1.5px solid ${hsTokens.ink}`,
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            color: hsTokens.ink,
            fontWeight: 700,
            background: hsTokens.cream,
          }}
        >
          +
        </span>
      </div>
    </div>
  );
}
