"use client";

import { useState, type ReactNode } from "react";
import { LazyMotion, domMax, m, useReducedMotion } from "framer-motion";

import { hsTokens } from "@/modules/builder/tokens";
import { tweenStandard } from "@/modules/builder/motion";

export interface AccordionItem {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Calculator disclosure rows. The supporting content (formula, FAQ) is always
 * rendered into the DOM — collapsed rows are height-clipped, not unmounted —
 * so it stays crawlable/AEO-indexable while keeping the page short by default.
 * Smooth height via framer (house `tweenStandard`); reduced motion cuts instantly.
 */
export default function CalcAccordion({ items }: { items: AccordionItem[] }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, !!i.defaultOpen]))
  );

  return (
    <LazyMotion features={domMax} strict>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        {items.map((item) => {
          const isOpen = !!open[item.id];
          return (
            <div
              key={item.id}
              style={{
                border: `2px solid ${hsTokens.ink}`,
                borderRadius: 14,
                background: hsTokens.paper,
                boxShadow: hsTokens.sh1,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((s) => ({ ...s, [item.id]: !s[item.id] }))
                }
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "13px 18px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: hsTokens.display,
                  fontSize: 16,
                  letterSpacing: "-0.02em",
                  color: hsTokens.ink,
                  textAlign: "left",
                }}
              >
                <span>{item.title}</span>
                <m.span
                  aria-hidden
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={reduced ? { duration: 0 } : tweenStandard}
                  style={{ fontSize: 18, lineHeight: 1, color: hsTokens.muted }}
                >
                  →
                </m.span>
              </button>
              <m.div
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                transition={reduced ? { duration: 0 } : tweenStandard}
                style={{ overflow: "hidden" }}
              >
                <div style={{ padding: "0 18px 16px" }}>{item.children}</div>
              </m.div>
            </div>
          );
        })}
      </div>
    </LazyMotion>
  );
}
