"use client";

import { useState } from "react";
import { hsTokens } from "@/modules/hopskip/tokens";
import { STAGES } from "../data";
import StageEyebrow from "./StageEyebrow";

// Stage 11. Scaffold accordion (multiple-open, simple expand). Smooth height
// animation + schema.org/FAQPage JSON-LD land in task #7.
export default function StageFAQ() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 4vw, 56px)",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <StageEyebrow>{STAGES.faq.h2}</StageEyebrow>
        <div style={{ marginTop: 28 }}>
          {STAGES.faq.items.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderTop: `1.5px solid color-mix(in oklch, ${hsTokens.ink} 22%, transparent)`,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          background: "transparent",
          border: 0,
          padding: "18px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          cursor: "pointer",
          fontFamily: hsTokens.body,
          fontSize: 16,
          fontWeight: 600,
          color: hsTokens.ink,
          textAlign: "left",
        }}
      >
        <span>{q}</span>
        <span
          aria-hidden
          style={{
            fontFamily: hsTokens.display,
            fontSize: 20,
            color: hsTokens.muted,
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
          }}
        >
          ›
        </span>
      </button>
      {open ? (
        <p
          style={{
            margin: "0 0 18px",
            fontFamily: hsTokens.body,
            fontSize: 15,
            lineHeight: 1.6,
            color: hsTokens.muted,
            maxWidth: 640,
          }}
        >
          {a}
        </p>
      ) : null}
    </div>
  );
}
