/** Round a number to a fixed number of decimal places. */
export function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
