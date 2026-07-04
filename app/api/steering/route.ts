import { NextRequest, NextResponse } from "next/server";

/**
 * Public steering endpoint — a thin proxy to the self-hosted corpus server
 * (src/modules/corpus-lab/server/, setup in docs/corpus-lab-serving.md).
 *
 * The corpus itself never touches this deployment: this route imports nothing
 * from corpus-lab and only relays computed steering results. The upstream URL
 * and shared key live in env vars (STEERING_UPSTREAM, STEERING_KEY), so moving
 * the corpus server from the home box to a VPS later is a config change here,
 * not a code change. When the upstream is unreachable this degrades to a 503 —
 * the steering feature naps, the rest of the site is unaffected.
 */

const OFFLINE = { error: "Steering is offline right now" };
const UPSTREAM_TIMEOUT_MS = 5000;

export async function POST(req: NextRequest) {
  const upstream = process.env.STEERING_UPSTREAM;
  const key = process.env.STEERING_KEY;
  if (!upstream || !key) {
    return NextResponse.json(OFFLINE, { status: 503 });
  }

  const query = (await req.json().catch(() => null)) as { style?: unknown } | null;
  if (!query || typeof query.style !== "string" || !query.style.trim()) {
    return NextResponse.json({ error: "A style is required" }, { status: 400 });
  }

  try {
    const res = await fetch(new URL("/steer", upstream), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-steering-key": key,
      },
      body: JSON.stringify(query),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (res.status === 400) {
      // Validation errors are safe to relay (e.g. unknown style).
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      return NextResponse.json(
        { error: payload?.error ?? "Invalid steering query" },
        { status: 400 },
      );
    }
    if (!res.ok) {
      // 401 here means the shared key is misconfigured — log it, don't leak it.
      console.error(`steering upstream returned ${res.status}`);
      return NextResponse.json(OFFLINE, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    // Timeout or network failure — the desktop is asleep, rebooting, or gone.
    console.error("steering upstream unreachable", err instanceof Error ? err.message : err);
    return NextResponse.json(OFFLINE, { status: 503 });
  }
}
