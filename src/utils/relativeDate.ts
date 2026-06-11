/**
 * Human date for recipe cards: "today", "yesterday", "5 days ago",
 * "3 weeks ago", then "Jun 7" (with the year once it isn't this year).
 * Raw ISO dates read like a database dump next to the handwritten notes.
 */
export function humanizeDate(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round(
    (startOfDay(now) - startOfDay(date)) / 86_400_000
  );
  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  if (dayDiff < 30) {
    const weeks = Math.round(dayDiff / 7);
    return weeks === 1 ? "last week" : `${weeks} weeks ago`;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}
