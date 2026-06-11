"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    firstItemRef.current?.focus();
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
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

  const panelStyle: CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    [align === "right" ? "right" : "left"]: 0,
    minWidth: 188,
    background: hsTokens.paper,
    border: `2px solid ${hsTokens.ink}`,
    borderRadius: 8,
    boxShadow: hsTokens.sh2,
    zIndex: 30,
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
          setOpen((v) => !v);
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div role="menu" style={panelStyle}>
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
        </div>
      ) : null}
    </div>
  );
}
