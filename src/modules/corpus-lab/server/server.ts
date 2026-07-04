/**
 * Standalone steering server — runs on hardware we control (the always-on
 * desktop), never on a cloud provider. The scraped corpus stays on this
 * machine; the app's /api/steering route proxies queries here over a
 * Tailscale Funnel URL and only computed steering results ever leave.
 *
 * Zero runtime dependencies (node:http) so `npm run corpus-server:build`
 * produces a single self-contained .mjs — the desktop needs Node 22, that
 * file, and cloud.ndjson. Full setup: docs/corpus-lab-serving.md.
 *
 * Env:
 *   STEERING_KEY  required — shared secret; the proxy sends it as x-steering-key
 *   CLOUD_PATH    path to cloud.ndjson (defaults to the repo-relative dev path)
 *   PORT          default 8787
 *   HOST          default 127.0.0.1 — Funnel connects locally; keep it that way
 */
/* eslint-disable no-console -- standalone process: stdout is the log stream the service manager captures */
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadCloud } from "../steering/loadCloud";
import { RecipeSteeringService, type SteeringQuery } from "../steering/RecipeSteeringService";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "127.0.0.1";
const KEY = process.env.STEERING_KEY;
const MAX_BODY_BYTES = 64 * 1024;

if (!KEY) {
  console.error("STEERING_KEY is required (the Vercel proxy must send the same value)");
  process.exit(1);
}
const keyDigest = createHash("sha256").update(KEY).digest();

const bootStart = Date.now();
const cloud = loadCloud(process.env.CLOUD_PATH || undefined);
const service = new RecipeSteeringService(cloud);
const bootMs = Date.now() - bootStart;
console.log(`corpus-server: ${cloud.length} records loaded in ${bootMs}ms`);

function keyMatches(header: string | string[] | undefined): boolean {
  if (typeof header !== "string" || header.length === 0) return false;
  return timingSafeEqual(createHash("sha256").update(header).digest(), keyDigest);
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        resolve(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  const path = (req.url ?? "/").split("?")[0];
  let status = 500;
  try {
    if (req.method === "GET" && path === "/healthz") {
      status = 200;
      sendJson(res, status, {
        ok: true,
        records: cloud.length,
        bootMs,
        uptimeS: Math.round(process.uptime()),
      });
      return;
    }
    if (req.method !== "POST" || path !== "/steer") {
      status = 404;
      sendJson(res, status, { error: "Not found" });
      return;
    }
    if (!keyMatches(req.headers["x-steering-key"])) {
      status = 401;
      sendJson(res, status, { error: "Unauthorized" });
      return;
    }
    const raw = await readBody(req);
    if (raw === null) {
      status = 413;
      sendJson(res, status, { error: "Body too large" });
      return;
    }
    let query: SteeringQuery | null = null;
    try {
      query = JSON.parse(raw) as SteeringQuery;
    } catch {
      query = null;
    }
    if (!query?.style || typeof query.style !== "string" || !query.style.trim()) {
      status = 400;
      sendJson(res, status, { error: "A style is required" });
      return;
    }
    const result = service.steer(query);
    status = 200;
    sendJson(res, status, result);
  } catch (err) {
    console.error("steer failed", err);
    status = 500;
    sendJson(res, status, { error: err instanceof Error ? err.message : "Unknown error" });
  } finally {
    console.log(`${req.method} ${path} ${status} ${Date.now() - started}ms`);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`corpus-server: listening on http://${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`corpus-server: ${signal}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
