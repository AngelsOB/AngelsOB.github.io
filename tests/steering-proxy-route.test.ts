/**
 * Unit tests for the public steering proxy (app/api/steering/route.ts) —
 * the Vercel-side half of the self-hosted corpus server split
 * (docs/corpus-lab-serving.md). Upstream is mocked; the standalone server
 * itself is exercised by its own boot + curl checks, not here.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/steering/route";

const UPSTREAM = "http://upstream.test";
const KEY = "shared-secret";

function steeringRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/steering", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/steering", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("STEERING_UPSTREAM", UPSTREAM);
    vi.stubEnv("STEERING_KEY", KEY);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  test("returns 503 when the upstream env vars are not configured", async () => {
    vi.stubEnv("STEERING_UPSTREAM", "");
    const res = await POST(steeringRequest({ style: "Saison" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Steering is offline right now" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects a query without a style before touching the upstream", async () => {
    const res = await POST(steeringRequest({ k: 20 }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("rejects a non-JSON body", async () => {
    const res = await POST(steeringRequest("not json"));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("forwards the query with the shared key and relays the result", async () => {
    const result = { recipe: { name: "Steered Saison" }, styleNorms: {} };
    fetchMock.mockResolvedValue(Response.json(result));

    const query = { style: "Saison", exploration: 0.4, variation: 7 };
    const res = await POST(steeringRequest(query));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(result);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${UPSTREAM}/steer`);
    expect((init.headers as Record<string, string>)["x-steering-key"]).toBe(KEY);
    expect(JSON.parse(init.body as string)).toEqual(query);
  });

  test("relays upstream validation errors as 400", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "A style is required" }), { status: 400 }),
    );
    const res = await POST(steeringRequest({ style: "Nonsense Style" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "A style is required" });
  });

  test("maps other upstream failures to 502 without leaking details", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const res = await POST(steeringRequest({ style: "Saison" }));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Steering is offline right now" });
  });

  test("degrades to 503 when the upstream is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));
    const res = await POST(steeringRequest({ style: "Saison" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Steering is offline right now" });
  });
});
