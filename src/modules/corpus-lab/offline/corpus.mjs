/**
 * Shared corpus streaming helpers for the recipe-corpus pipeline.
 * The raw file is a line-delimited JSON dict — each line is `"<n>": { ...recipe... },`.
 */
import fs from "node:fs";
import readline from "node:readline";

export const CORPUS_FILE = "src/modules/corpus-lab/raw/recipes_full.txt";

/** Pull the recipe object out of one `"<n>": { ... },` line (null if unparseable). */
export function parseLine(line) {
  let s = line.trim();
  if (!s) return null;
  if (s.startsWith("{")) s = s.slice(1); // first line's leading dict brace
  s = s.replace(/[,}]\s*$/, ""); // trailing comma, or the final dict brace
  s = s.replace(/^"\d+":\s*/, ""); // the `"<n>": ` key prefix
  if (!s.startsWith("{")) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Stream every parsed recipe through onRecord(rec). Returns {total, parsed}. */
export async function streamRecords(onRecord, file = CORPUS_FILE) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let total = 0;
  let parsed = 0;
  for await (const line of rl) {
    total++;
    const r = parseLine(line);
    if (r) {
      parsed++;
      onRecord(r);
    }
  }
  return { total, parsed };
}
