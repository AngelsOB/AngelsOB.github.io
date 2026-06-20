/**
 * Strip `undefined` values (at every nesting level) from a value before writing
 * it to Firestore, which rejects documents containing `undefined`.
 *
 * Implemented as a JSON round-trip — the long-standing pattern across the
 * Firestore repositories — centralised here so the constraint is documented in
 * one place.
 */
export function stripUndefined<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}
