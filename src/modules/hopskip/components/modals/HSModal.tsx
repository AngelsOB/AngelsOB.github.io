"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";

import { hsTokens } from "../../tokens";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  /** Accent stripe color (top border). Defaults to malt. */
  accent?: string;
  closeOnBackdropClick?: boolean;
  /** ID for the dialog's aria-labelledby. Auto-generated if absent. */
  labelledById?: string;
  describedById?: string;
}

const SIZE_MAX_WIDTH: Record<NonNullable<Props["size"]>, number> = {
  sm: 384,
  md: 480,
  lg: 560,
  xl: 720,
  "2xl": 880,
  "3xl": 1040,
};

let lastPointerX = 0;
let lastPointerY = 0;
if (typeof window !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
    },
    true
  );
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");
  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

export default function HSModal({
  isOpen,
  onClose,
  children,
  size = "lg",
  accent = hsTokens.malt,
  closeOnBackdropClick = true,
  labelledById,
  describedById,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const generatedId = useId();
  const dialogLabelId = labelledById ?? `hs-modal-label-${generatedId}`;
  const [originStyle, setOriginStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setOriginStyle({
      "--hs-modal-dx": `${lastPointerX - cx}px`,
      "--hs-modal-dy": `${lastPointerY - cy}px`,
    } as CSSProperties);
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = getFocusableElements(dialogRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      requestAnimationFrame(() => {
        if (!dialogRef.current) return;
        const auto = dialogRef.current.querySelector<HTMLElement>("[data-autofocus]");
        if (auto) {
          auto.focus();
          return;
        }
        const focusable = getFocusableElements(dialogRef.current);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          dialogRef.current.focus();
        }
      });
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const maxWidth = SIZE_MAX_WIDTH[size];

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) onClose();
  };

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="hs-theme"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "rgba(10, 8, 6, 0.45)",
        backdropFilter: "blur(2px)",
        animation: "hs-modal-backdrop-in 280ms cubic-bezier(0.32, 0.72, 0, 1) both",
      }}
      onClick={handleBackdropClick}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogLabelId}
        aria-describedby={describedById}
        tabIndex={-1}
        style={
          {
            position: "relative",
            background: hsTokens.paper,
            color: hsTokens.ink,
            border: `2px solid ${hsTokens.ink}`,
            borderTop: `7px solid ${accent}`,
            borderRadius: 14,
            boxShadow: hsTokens.sh4,
            width: "100%",
            maxWidth,
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "hs-modal-scale-in 320ms cubic-bezier(0.32, 0.72, 0, 1) both",
            ...originStyle,
          } as CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        <span id={dialogLabelId} hidden />
        {children}
      </div>
      <style>{`
        @keyframes hs-modal-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes hs-modal-scale-in {
          from {
            opacity: 0;
            transform: translate(var(--hs-modal-dx, 0px), var(--hs-modal-dy, 0px)) scale(0.85);
          }
          to {
            opacity: 1;
            transform: translate(0, 0) scale(1);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

interface HeaderProps {
  title: ReactNode;
  kicker?: ReactNode;
  onClose?: () => void;
  titleId?: string;
  rightSlot?: ReactNode;
}

export function HSModalHeader({ title, kicker, onClose, titleId, rightSlot }: HeaderProps) {
  return (
    <header
      style={{
        padding: "18px 22px 14px",
        borderBottom: `2px solid ${hsTokens.ink}`,
        background: hsTokens.cream,
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker ? (
          <div
            style={{
              fontFamily: hsTokens.script,
              fontSize: 18,
              color: hsTokens.water,
              lineHeight: 1,
              marginBottom: 6,
              transform: "rotate(-3deg)",
              transformOrigin: "left center",
              display: "inline-block",
            }}
          >
            {kicker}
          </div>
        ) : null}
        <h3
          id={titleId}
          style={{
            fontFamily: hsTokens.display,
            fontSize: 24,
            letterSpacing: "-0.025em",
            lineHeight: 1,
            color: hsTokens.ink,
            margin: 0,
          }}
        >
          {title}
        </h3>
      </div>
      {rightSlot}
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "transparent",
            border: `1.5px solid ${hsTokens.ink}`,
            color: hsTokens.ink,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: hsTokens.body,
            fontWeight: 700,
            fontSize: 18,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      ) : null}
    </header>
  );
}

interface BodyProps {
  children: ReactNode;
  padding?: number | string;
  style?: CSSProperties;
}

export function HSModalBody({ children, padding = 22, style }: BodyProps) {
  return (
    <div
      style={{
        flex: "1 1 auto",
        minHeight: 0,
        overflowY: "auto",
        padding,
        background: hsTokens.paper,
        color: hsTokens.ink,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface FooterProps {
  children: ReactNode;
  align?: "between" | "end" | "start";
}

export function HSModalFooter({ children, align = "between" }: FooterProps) {
  const justify =
    align === "between" ? "space-between" : align === "end" ? "flex-end" : "flex-start";
  return (
    <footer
      style={{
        padding: "14px 22px",
        borderTop: `2px solid ${hsTokens.ink}`,
        background: hsTokens.cream2,
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        gap: 12,
      }}
    >
      {children}
    </footer>
  );
}
