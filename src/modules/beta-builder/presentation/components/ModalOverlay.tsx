'use client';

/**
 * Modal Overlay Component
 *
 * Reusable modal overlay with:
 * - Backdrop blur effect
 * - Semi-transparent background
 * - Click-outside-to-close
 * - ESC key to close
 * - Prevents body scroll when open
 * - Focus trapping for keyboard accessibility
 * - ARIA attributes for screen readers
 */

import { useEffect, useRef, useCallback, useId } from "react";

interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  closeOnBackdropClick?: boolean;
  /** Optional ID for aria-labelledby - if not provided, uses auto-generated ID */
  labelledById?: string;
  /** Optional ID for aria-describedby */
  describedById?: string;
}

/** Get all focusable elements within a container */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

export default function ModalOverlay({
  isOpen,
  onClose,
  children,
  size = "lg",
  closeOnBackdropClick = true,
  labelledById,
  describedById,
}: ModalOverlayProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const generatedId = useId();
  const dialogLabelId = labelledById ?? `modal-label-${generatedId}`;

  // Handle ESC key and focus trapping
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }

    // Focus trap: Tab and Shift+Tab
    if (e.key === "Tab" && modalRef.current) {
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }, [onClose]);

  // Set up keyboard listeners when modal opens
  useEffect(() => {
    if (!isOpen) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  // Focus management: move focus into modal on open, restore on close
  useEffect(() => {
    if (isOpen) {
      // Store currently focused element to restore later
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus [autofocus] element if present, otherwise first focusable element
      requestAnimationFrame(() => {
        if (modalRef.current) {
          const autoFocusEl = modalRef.current.querySelector<HTMLElement>('[data-autofocus]');
          if (autoFocusEl) {
            autoFocusEl.focus();
          } else {
            const focusable = getFocusableElements(modalRef.current);
            if (focusable.length > 0) {
              focusable[0].focus();
            } else {
              modalRef.current.focus();
            }
          }
        }
      });
    } else {
      // Restore focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
  };

  const handleBackdropClick = () => {
    if (closeOnBackdropClick) {
      onClose();
    }
  };

  return (
    // Backdrop: keyboard handling (ESC) is managed via useEffect keydown listener
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      onClick={handleBackdropClick}
    >
      {/* stopPropagation prevents backdrop click from closing when clicking inside dialog */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogLabelId}
        aria-describedby={describedById}
        tabIndex={-1}
        className={`brew-modal ${sizeClasses[size]} w-full max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Export the generated dialog label ID pattern for consumers to use */
export { type ModalOverlayProps };
