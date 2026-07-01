/**
 * The only fs-touching piece of the steering engine — mirrors offline/corpus.mjs's
 * isolation of raw-corpus I/O. Everything else in `steering/` is pure and takes
 * an already-loaded `CloudRecord[]`.
 */
import { readFileSync } from "node:fs";
import type { CloudRecord } from "./featureSpace";

export const DEFAULT_CLOUD_PATH = "src/modules/corpus-lab/offline/out/cloud.ndjson";

export function loadCloud(path: string = DEFAULT_CLOUD_PATH): CloudRecord[] {
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as CloudRecord);
}
