/**
 * Generate a URL-friendly share slug from a recipe name.
 * Produces slugs like "west-coast-ipa-7f3k".
 */
export function generateShareSlug(name: string): string {
  const base = (name || "recipe")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const suffix = randomSuffix(4);
  return `${base || "recipe"}-${suffix}`;
}

function randomSuffix(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    result += chars[byte % chars.length];
  }
  return result;
}
