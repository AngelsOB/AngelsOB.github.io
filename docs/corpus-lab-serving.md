# Serving the corpus lab from home

How the steering engine goes live without the corpus ever leaving hardware we
control. The scraped Brewers Friend corpus (`cloud.ndjson`, and everything in
`raw/`) stays on the always-on desktop; the deployed app only ever relays
computed steering results. See the note at the top of the corpus entries in
`.gitignore` for the data posture.

```
browser ──► Vercel /api/steering ──► Tailscale Funnel URL ──► desktop :8787
            (thin proxy, no          (outbound-only tunnel,    corpus-server.mjs
             corpus-lab imports,      no port forwarding,      + cloud.ndjson
             5s timeout, 503         home IP never exposed)    loaded in memory
             when box is down)
```

Measured on the real cloud (148,775 records): ~4s boot, ~30ms per steer once a
style is warm (~300ms first hit per style). The desktop is never the
bottleneck; round-trip latency is dominated by the tunnel hop (~100–300ms).

## 1. What runs where

| Piece | Lives | Notes |
| --- | --- | --- |
| `src/modules/corpus-lab/server/server.ts` | this repo | zero-dep `node:http` server; `/healthz` + `/steer` |
| `corpus-server.mjs` (bundled) | desktop, `C:\corpus-server\` | `npm run corpus-server:build` → single self-contained file |
| `cloud.ndjson` | desktop, `C:\corpus-server\` | copied by hand, gitignored forever; regen per corpus-lab-build.md §8 |
| `app/api/steering/route.ts` | Vercel | public endpoint; proxies with `x-steering-key`, degrades to 503 |

Env contract (same `STEERING_KEY` value on both sides):

- Desktop: `STEERING_KEY` (required), `CLOUD_PATH` (required), `PORT` (default 8787), `HOST` (default 127.0.0.1 — leave it)
- Vercel: `STEERING_UPSTREAM` (origin only, no path — e.g. `https://<machine>.<tailnet>.ts.net`), `STEERING_KEY`

## 2. One-time desktop setup (Windows)

All `ssh <desktop>` commands below use the Tailscale machine name you already
ssh to from your phone. NSSM/service commands need an elevated shell — ssh
sessions for Administrator-group users are already elevated.

**a. Node 22+** (in PowerShell on the desktop, or over ssh):

```powershell
winget install OpenJS.NodeJS.LTS
node --version   # expect >= 22
```

**b. Copy the two files over** (from the Mac, repo root):

```bash
npm run corpus-server:build
ssh <user>@<desktop> "mkdir C:\corpus-server"
scp src/modules/corpus-lab/server/dist/corpus-server.mjs <user>@<desktop>:C:/corpus-server/
scp src/modules/corpus-lab/offline/out/cloud.ndjson     <user>@<desktop>:C:/corpus-server/
```

**c. Generate the shared key** (on the Mac; you'll paste it in two places —
the service env in step e and Vercel in §3):

```bash
openssl rand -hex 32
```

**d. Smoke test** (PowerShell on the desktop):

```powershell
$env:STEERING_KEY = "<key>"
$env:CLOUD_PATH   = "C:\corpus-server\cloud.ndjson"
node C:\corpus-server\corpus-server.mjs
# expect: "148775 records loaded in ~Xms" then "listening on http://127.0.0.1:8787"
# from another window:
curl.exe http://127.0.0.1:8787/healthz
# then Ctrl-C the server
```

**e. Install as a service with NSSM** (auto-start on boot, restart on crash,
runs without anyone logged in):

```powershell
winget install NSSM.NSSM     # or download from https://nssm.cc
nssm install CorpusSteering "C:\Program Files\nodejs\node.exe" "C:\corpus-server\corpus-server.mjs"
nssm set CorpusSteering AppDirectory C:\corpus-server
nssm set CorpusSteering AppEnvironmentExtra STEERING_KEY=<key> CLOUD_PATH=C:\corpus-server\cloud.ndjson
nssm set CorpusSteering AppStdout C:\corpus-server\server.log
nssm set CorpusSteering AppStderr C:\corpus-server\server.log
nssm set CorpusSteering AppRotateFiles 1
nssm set CorpusSteering AppRotateBytes 10485760
nssm start CorpusSteering
curl.exe http://127.0.0.1:8787/healthz
```

**f. Tailscale Funnel** (same Tailscale you already run; Funnel additionally
publishes this ONE port to the public internet through Tailscale's relays —
your phone-ssh tailnet setup is unchanged):

```powershell
tailscale funnel --bg 8787
tailscale funnel status    # shows the public https URL
```

First run may print an admin-console link to enable HTTPS certificates and the
`funnel` node attribute — follow it once. `--bg` persists the config across
reboots. Verify from the Mac (or anywhere off the tailnet):

```bash
curl https://<machine>.<tailnet>.ts.net/healthz
```

**g. Keep the box awake**: Settings → System → Power → never sleep when
plugged in (or `powercfg /change standby-timeout-ac 0`). Windows Update
reboots self-heal: the service, tailscaled, and the funnel config all
auto-start.

## 3. Vercel side

Project → Settings → Environment Variables (Production):

- `STEERING_UPSTREAM` = `https://<machine>.<tailnet>.ts.net`
- `STEERING_KEY` = the same key from §2c

Redeploy. The public contract is `POST /api/steering` with a `SteeringQuery`
JSON body (`style` required — see `RecipeSteeringService.ts`), returning a
`SteeringResult`. When the desktop is unreachable the route returns
`503 {"error":"Steering is offline right now"}` — UI should treat that as
"feature napping", never as a page error.

## 4. Monitoring

Free UptimeRobot monitor on `https://<funnel-url>/healthz`, 5-minute interval,
email alert. This is the "the desktop died / Windows rebooted into a stuck
state" alarm — there are no cold starts to keep warm, the process is always
hot.

## 5. Updating

Steering code changed (from the Mac):

```bash
npm run corpus-server:build
scp src/modules/corpus-lab/server/dist/corpus-server.mjs <user>@<desktop>:C:/corpus-server/
ssh <user>@<desktop> "nssm restart CorpusSteering"
```

Corpus regenerated: same, but scp `cloud.ndjson` then restart.

## 6. Local dev

The playground keeps using the in-process dev-only route
(`app/api/lab/steering`) — no extra process, unchanged workflow. To exercise
the real production path locally:

```bash
npm run corpus-server:build
STEERING_KEY=dev-key node src/modules/corpus-lab/server/dist/corpus-server.mjs
# in .env.local:  STEERING_UPSTREAM=http://127.0.0.1:8787  STEERING_KEY=dev-key
# restart next dev, then POST to /api/steering
```

Proxy behaviour is unit-tested in `tests/steering-proxy-route.test.ts`.

## 7. Security posture

- Server binds `127.0.0.1` only — nothing listens on the LAN; Funnel connects
  locally via tailscaled. No router port forwarding anywhere.
- `/steer` requires the shared `x-steering-key` (constant-time compare);
  `/healthz` is public and returns only ok/record-count/uptime.
- The box holds the corpus and nothing else — no Firebase credentials, no user
  data. Worst case is feature downtime, not a breach.
- Request bodies are capped at 64KB; malformed JSON is rejected.

## 8. Swapping hosts later

The browser only ever talks to `/api/steering`. Moving the corpus server to a
VPS (Oracle Always Free, Hetzner, whatever) is: run the same `.mjs` + data
there, point `STEERING_UPSTREAM` at the new URL, redeploy. No code changes.
