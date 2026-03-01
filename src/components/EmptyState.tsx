interface EmptyStateProps {
  message: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  message,
  hint,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="brew-animate-in flex flex-col items-center gap-3 py-6">
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="group flex flex-col items-center gap-2 transition-all duration-200"
        >
          {/* Accent-ringed plus icon */}
          <span
            className="flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 group-hover:scale-110"
            style={{
              background:
                'color-mix(in oklch, var(--brew-accent-400) 12%, transparent)',
              boxShadow:
                'inset 0 0 0 1.5px color-mix(in oklch, var(--brew-accent-400) 30%, transparent)',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="transition-transform duration-200 group-hover:rotate-90"
              style={{ color: 'var(--brew-accent-500)' }}
            >
              <path
                d="M9 3v12M3 9h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <span
            className="text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--brew-accent-500)' }}
          >
            {actionLabel}
          </span>
        </button>
      ) : (
        /* No-action variant: just a message (e.g. MashSchedule) */
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full opacity-40"
          style={{
            background:
              'color-mix(in oklch, var(--brew-accent-400) 10%, transparent)',
            boxShadow:
              'inset 0 0 0 1.5px color-mix(in oklch, var(--brew-accent-400) 20%, transparent)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            style={{ color: 'var(--brew-accent-400)' }}
          >
            <circle cx="9" cy="9" r="1" fill="currentColor" />
            <circle cx="5" cy="9" r="1" fill="currentColor" />
            <circle cx="13" cy="9" r="1" fill="currentColor" />
          </svg>
        </div>
      )}

      <p className="text-muted text-xs text-center max-w-[280px]">
        {message}
        {hint && (
          <span className="opacity-60">
            {". "}{hint}
          </span>
        )}
      </p>
    </div>
  );
}
