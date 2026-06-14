"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { hsTokens } from "../tokens";

export interface HSActionMenuItem {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  separator?: boolean;
  destructive?: boolean;
}

interface Props {
  trigger: ReactNode;
  items: HSActionMenuItem[];
  align?: "left" | "right";
  triggerStyle?: CSSProperties;
  triggerClassName?: string;
  triggerTitle?: string;
  triggerAriaLabel?: string;
}

export default function HSActionMenu({
  trigger,
  items,
  align = "right",
  triggerStyle,
  triggerClassName,
  triggerTitle,
  triggerAriaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  // Viewport-fixed position for the portaled panel, computed from the
  // trigger's rect at open time.
  const [panelPos, setPanelPos] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const GAP = 6;
    // Rough panel height; flip above the trigger when the viewport bottom
    // would clip the menu and there's more room above.
    const EST_HEIGHT = 300;
    const flipUp =
      window.innerHeight - rect.bottom < EST_HEIGHT && rect.top > EST_HEIGHT;
    setPanelPos({
      ...(flipUp
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
      ...(align === "right"
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    // The panel is fixed-positioned — close instead of drifting when the
    // page (or any ancestor) scrolls or the window resizes.
    function onReflow() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    firstItemRef.current?.focus();
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  const triggerMerged: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: hsTokens.paper,
    color: hsTokens.ink,
    border: `1.5px solid ${hsTokens.ink}`,
    borderRadius: 999,
    width: 28,
    height: 28,
    padding: 0,
    cursor: "pointer",
    boxShadow: hsTokens.sh1,
    ...triggerStyle,
  };

  // Portaled to the page-level .hs-theme wrapper and viewport-fixed —
  // escapes the stacking contexts that card grids create (motion/tilt
  // transforms), which otherwise paint sibling cards over the panel. The
  // theme wrapper (not <body>) keeps the scoped --hs-* CSS variables and
  // dark-mode rules resolving.
  const panelStyle: CSSProperties = {
    position: "fixed",
    ...panelPos,
    minWidth: 188,
    background: hsTokens.paper,
    border: `2px solid ${hsTokens.ink}`,
    borderRadius: 8,
    boxShadow: hsTokens.sh2,
    zIndex: 60,
    overflow: "hidden",
    fontFamily: hsTokens.body,
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        style={triggerMerged}
        title={triggerTitle}
        aria-label={triggerAriaLabel ?? triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) {
            setOpen(false);
          } else {
            openMenu();
          }
        }}
      >
        {trigger}
      </button>
      {open && panelPos ? createPortal(
        <div ref={panelRef} role="menu" style={panelStyle}>
          {items.map((item, idx) => {
            const isFirst = idx === 0;
            const itemStyle: CSSProperties = {
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              fontFamily: hsTokens.body,
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1.2,
              background: "transparent",
              color: item.destructive ? hsTokens.roast : hsTokens.ink,
              border: "none",
              borderTop: item.separator ? `1px solid ${hsTokens.cream2}` : undefined,
              cursor: item.disabled ? "not-allowed" : "pointer",
              opacity: item.disabled ? 0.5 : 1,
            };
            return (
              <button
                key={`${item.label}-${idx}`}
                ref={isFirst ? firstItemRef : undefined}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item.disabled) return;
                  item.onClick(e);
                  setOpen(false);
                }}
                onMouseEnter={(e) => {
                  if (item.disabled) return;
                  (e.currentTarget as HTMLButtonElement).style.background = hsTokens.cream2;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
                onFocus={(e) => {
                  if (item.disabled) return;
                  (e.currentTarget as HTMLButtonElement).style.background = hsTokens.cream2;
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
                style={itemStyle}
              >
                {item.label}
              </button>
            );
          })}
        </div>,
        rootRef.current?.closest(".hs-theme") ?? document.body,
      ) : null}
    </div>
  );
}
