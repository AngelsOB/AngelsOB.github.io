import Link from 'next/link';

export default function RecipeNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h1 className="text-4xl font-bold text-[var(--fg-strong)] mb-4">Recipe Not Found</h1>
      <p className="text-[var(--fg-muted)] mb-6">
        This recipe may have been unpublished or the link is incorrect.
      </p>
      <Link
        href="/"
        className="btn-outline"
      >
        Go Home
      </Link>
    </div>
  );
}
