import { forwardRef, type TextareaHTMLAttributes } from "react";

/**
 * Textarea variants for consistent styling across the app.
 * - default: Standard form textarea with theme-aware border
 * - flush: Minimal textarea without visible border
 * - filled: Filled background style for emphasis
 */
export type TextareaVariant = "default" | "flush" | "filled";

export type TextareaSize = "sm" | "md" | "lg";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visual variant */
  variant?: TextareaVariant;
  /** Size preset (affects padding and text size) */
  size?: TextareaSize;
  /** Error state - shows red border */
  error?: boolean;
  /** Full width textarea */
  fullWidth?: boolean;
}

const baseClasses =
  "rounded-md border outline-none transition-colors duration-150 text-[var(--fg-strong)] placeholder:text-[var(--fg-muted)] disabled:opacity-50 disabled:cursor-not-allowed resize-y";

const variantClasses: Record<TextareaVariant, string> = {
  default:
    "border-[rgb(var(--border))] bg-[var(--surface)] focus:ring-2 focus:ring-[var(--coral-600)] focus:border-[var(--coral-600)]",
  flush:
    "border-transparent bg-transparent focus:border-[var(--coral-600)] focus:ring-0",
  filled:
    "border-transparent bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)] focus:ring-2 focus:ring-[var(--coral-600)] focus:bg-[color-mix(in_oklch,var(--fg-strong)_12%,transparent)]",
};

const sizeClasses: Record<TextareaSize, string> = {
  sm: "px-2 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base",
};

const errorClasses =
  "border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-400 dark:focus:ring-red-400 dark:focus:border-red-400";

/**
 * Shared Textarea component that standardizes textarea styling across the app.
 *
 * @example
 * // Basic textarea
 * <Textarea placeholder="Enter notes..." />
 *
 * // Error state
 * <Textarea error placeholder="Required field" />
 *
 * // Different sizes
 * <Textarea size="sm" rows={3} />
 * <Textarea size="lg" rows={6} />
 *
 * // Fixed height (no resize)
 * <Textarea className="resize-none" rows={4} />
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      variant = "default",
      size = "md",
      error = false,
      fullWidth = false,
      className = "",
      ...props
    },
    ref
  ) => {
    // Build class string
    const classes = [
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      error && errorClasses,
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return <textarea ref={ref} className={classes} {...props} />;
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
