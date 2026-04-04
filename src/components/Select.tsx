import { forwardRef, type SelectHTMLAttributes } from "react";

/**
 * Select variants for consistent styling across the app.
 * - default: Standard form select with theme-aware border
 * - flush: Minimal select without visible border
 * - filled: Filled background style for emphasis
 */
export type SelectVariant = "default" | "flush" | "filled";

export type SelectSize = "sm" | "md" | "lg";

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Visual variant */
  variant?: SelectVariant;
  /** Size preset */
  size?: SelectSize;
  /** Error state - shows red border */
  error?: boolean;
  /** Full width select */
  fullWidth?: boolean;
}

const baseClasses =
  "rounded-md border outline-none transition-colors duration-150 text-[var(--fg-strong)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer appearance-none bg-no-repeat";

// Custom chevron arrow using CSS
const chevronClasses =
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-[right_0.5rem_center]";

const variantClasses: Record<SelectVariant, string> = {
  default:
    "border-[rgb(var(--border))] bg-[var(--surface)] focus:ring-2 focus:ring-[var(--coral-600)] focus:border-[var(--coral-600)]",
  flush:
    "border-transparent bg-transparent focus:border-[var(--coral-600)] focus:ring-0",
  filled:
    "border-transparent bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)] focus:ring-2 focus:ring-[var(--coral-600)] focus:bg-[color-mix(in_oklch,var(--fg-strong)_12%,transparent)]",
};

const sizeClasses: Record<SelectSize, string> = {
  sm: "px-2 py-1.5 pr-8 text-sm",
  md: "px-3 py-2 pr-9 text-sm",
  lg: "px-4 py-2.5 pr-10 text-base",
};

const errorClasses =
  "border-red-500 focus:ring-red-500 focus:border-red-500 dark:border-red-400 dark:focus:ring-red-400 dark:focus:border-red-400";

/**
 * Shared Select component that standardizes select styling across the app.
 *
 * @example
 * // Basic select
 * <Select>
 *   <option value="">Choose...</option>
 *   <option value="1">Option 1</option>
 * </Select>
 *
 * // Error state
 * <Select error>
 *   <option value="">Required</option>
 * </Select>
 *
 * // Different sizes
 * <Select size="sm">...</Select>
 * <Select size="lg">...</Select>
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      variant = "default",
      size = "md",
      error = false,
      fullWidth = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    // Build class string
    const classes = [
      baseClasses,
      chevronClasses,
      variantClasses[variant],
      sizeClasses[size],
      error && errorClasses,
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <select ref={ref} className={classes} {...props}>
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

export default Select;
