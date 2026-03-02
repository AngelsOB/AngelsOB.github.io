import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * Input variants for consistent styling across the app.
 * - default: Standard form input with theme-aware border
 * - flush: Minimal input without visible border (for inline editing)
 * - filled: Filled background style for emphasis
 */
export type InputVariant = "default" | "flush" | "filled";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visual variant */
  variant?: InputVariant;
  /** Size preset */
  size?: InputSize;
  /** Icon or element to show before input */
  leftIcon?: ReactNode;
  /** Icon or element to show after input (e.g., unit suffix) */
  rightIcon?: ReactNode;
  /** Error state - shows red border */
  error?: boolean;
  /** Full width input */
  fullWidth?: boolean;
}

const baseClasses =
  "rounded-md border outline-none transition-colors duration-150 text-[var(--fg-strong)] placeholder:text-[var(--fg-muted)] disabled:opacity-50 disabled:cursor-not-allowed";

const variantClasses: Record<InputVariant, string> = {
  default:
    "border-[rgb(var(--border))] bg-[rgb(var(--surface))] focus-glow",
  flush:
    "border-transparent bg-transparent focus:border-[var(--coral-600)] focus:ring-0",
  filled:
    "border-transparent bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)] focus-glow focus:bg-[color-mix(in_oklch,var(--fg-strong)_12%,transparent)]",
};

const sizeClasses: Record<InputSize, string> = {
  sm: "px-2 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base",
};

// Extra padding for icons
const leftIconPadding: Record<InputSize, string> = {
  sm: "pl-7",
  md: "pl-9",
  lg: "pl-11",
};

const rightIconPadding: Record<InputSize, string> = {
  sm: "pr-7",
  md: "pr-9",
  lg: "pr-11",
};

const errorClasses =
  "border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-400 dark:focus:ring-red-400 dark:focus:border-red-400";

/**
 * Shared Input component that standardizes input styling across the app.
 *
 * @example
 * // Basic input
 * <Input placeholder="Enter name" />
 *
 * // With left icon
 * <Input leftIcon={<SearchIcon />} placeholder="Search..." />
 *
 * // With right icon (suffix)
 * <Input type="number" rightIcon={<span className="text-xs">kg</span>} />
 *
 * // Error state
 * <Input error placeholder="Required field" />
 *
 * // Different sizes
 * <Input size="sm" placeholder="Small" />
 * <Input size="lg" placeholder="Large" />
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      variant = "default",
      size = "md",
      leftIcon,
      rightIcon,
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
      leftIcon && leftIconPadding[size],
      rightIcon && rightIconPadding[size],
      error && errorClasses,
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // No wrapper needed if no icons
    if (!leftIcon && !rightIcon) {
      return <input ref={ref} className={classes} {...props} />;
    }

    // Wrapper for icon positioning
    return (
      <div className={`relative ${fullWidth ? "w-full" : "inline-block"}`}>
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-[var(--fg-muted)]">
            {leftIcon}
          </span>
        )}
        <input ref={ref} className={classes} {...props} />
        {rightIcon && (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-[var(--fg-muted)]">
            {rightIcon}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
