'use client';

import { useRouter } from "next/navigation";

export default function RouteErrorPage({
  title = "Something went wrong",
  message = "An unexpected error occurred.",
}: {
  title?: string;
  message?: string;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-[rgb(var(--bg))] px-4 text-center text-[rgb(var(--text))]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
        <svg
          className="h-10 w-10 text-red-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-[var(--fg-strong)]">{title}</h1>
        <p className="mt-2 max-w-md text-[var(--fg-muted)]">{message}</p>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => router.back()}
          className="btn-outline"
        >
          Go back
        </button>
        <button
          onClick={() => router.push("/")}
          className="btn-neon"
        >
          Go home
        </button>
      </div>
    </div>
  );
}
