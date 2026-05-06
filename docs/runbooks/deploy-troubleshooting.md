# Deploy troubleshooting — known failure modes

Last updated: 2026-05-06

A field guide for the most common ways `ci.yml`'s deploy job goes
sideways. Each entry: symptom in the GHA log, what's actually happening
on the droplet, fix.

Companion to:
- [`automatic-deployment.md`](./automatic-deployment.md) — initial wiring.
- [`seamless-deployment.md`](./seamless-deployment.md) — blue/green path.
- [`mcp-http-deploy.md`](./mcp-http-deploy.md) — MCP service.

---

## 1. SSH session disconnects mid-build → `Process exited with status 1`

**Symptom (GHA log):**

```
out: ==> Rebuilding and restarting app (legacy stop-the-world; brief 502 window)
err:  Image node-app Building
…long docker build output…
err:  Image node-app Built
err:  Container front Recreate
err:  Container front Recreated
err:  Container front Starting
err:  Container front Started
2026/05/06 16:51:29 Process exited with status 1
```

The script aborts immediately after `Container front Started`. No
`==> Waiting for app to report healthy` line appears.

**Root cause:** the `appleboy/ssh-action` SSH session sat idle from
the TCP socket's perspective during a long `docker build` step (single
layer cache restore, single `next build` SSG pass) and got dropped by
an intermediate firewall / NAT / Cloudflare-style middlebox. Docker's
output streams are buffered, so even though the build is actively doing
work the SSH channel can go silent for 60+ seconds at a stretch. When
the connection drops, the action reports `exit 1`.

**On the droplet, the deploy actually succeeded** — `docker compose up`
completed, the new container is running, the script just never got to
verify health.

**Fix (in repo, already applied):**

`ci.yml`'s deploy script starts a background heartbeat that prints a
timestamp every 20s. The constant byte trickle keeps the SSH channel
warm:

```bash
( while sleep 20; do echo "    [heartbeat $(date +%H:%M:%S)]"; done ) &
HEARTBEAT_PID=$!
trap 'kill $HEARTBEAT_PID 2>/dev/null || true' EXIT
```

You'll see `[heartbeat 16:51:29]` lines interleaved with build output.
That's normal.

**If the heartbeat alone isn't enough**, add SSH-level keepalive to the
appleboy step:

```yaml
- uses: appleboy/ssh-action@v1.0.3
  with:
    …
    use_insecure_cipher: false
    # ServerAliveInterval / Counts via env on the underlying ssh client.
    # appleboy v1 doesn't expose them directly; the heartbeat above is
    # equivalent in effect and works on every connection topology.
```

---

## 2. Mongo healthcheck stuck "unhealthy" but Mongo works fine

**Symptom (`docker compose ps`):**

```
mongodb   mongo:7.0   Up 2 days (unhealthy)
```

…yet `app` and `server` connect fine and the site works.

**Root cause:** `infra/compose.yaml` mongodb healthcheck still uses the
legacy `mongo` shell:

```yaml
healthcheck:
  test: echo 'db.runCommand("ping").ok' | mongo mongodb://mongodb:27017/ --quiet
```

The `mongo` binary was removed in MongoDB 6.x; we run 7.0. The image
no longer ships it, so the healthcheck always fails.

**Impact:** cosmetic on the dashboard. `depends_on: { mongodb: condition: service_started }` only checks `started`, not `healthy`, so dependent services boot fine. **However**, any future change to `condition: service_healthy` would cause every dependent to refuse to start.

**Fix:** swap to `mongosh`:

```yaml
healthcheck:
  test: ["CMD-SHELL", "mongosh --quiet --eval \"db.runCommand({ping:1}).ok\" mongodb://mongodb:27017/ | grep -q 1"]
  interval: 30s
  timeout: 10s
  retries: 5
```

This is a separate change — keep it isolated from feature deploys so
it can be rolled back independently if a Mongo client edge case bites.

---

## 3. New container "Started" but stays `starting` for several minutes

**Symptom:** after `Container front Started`, `docker compose ps` shows
`Up X minutes (starting)` for many minutes.

**Root cause:** the `app` container runs `npm run start-docker`, which
chains `next build && next start`. The build step (SSG pass over ~46
pages) takes 5–10 minutes on the small DigitalOcean droplet. Until
`next start` is actually serving on port 80, the healthcheck (`wget
http://localhost:80/`) keeps failing.

**This is normal.** The `start_period: 90s` on the healthcheck delays
the first probe but doesn't extend the build budget. The CI's outer
wait loop polls for up to 18 minutes (216 × 5s).

**If you're debugging**, watch the build progress:

```bash
docker logs -f front
```

Look for `✓ Generating static pages using 1 worker (46/46) in <N>s`
followed by `✓ Ready on http://0.0.0.0:80`. After that line, the
healthcheck flips to `healthy`.

---

## 4. Caddy serves the maintenance page after a successful deploy

**Symptom:** during a deploy window, browsing the public URL shows:

```
Shipping a fresh version
We're swapping in an update. This page will refresh automatically in a few seconds.
```

**This is expected.** `infra/Caddyfile`'s `handle_errors` block falls
back to `/srv/maintenance/index.html` whenever upstream returns 502/
503/504. During the brief gap between `front` container recreate and
`next start` accepting connections, Caddy can't reach the upstream and
serves the fallback. The static page has `<meta http-equiv=refresh>`
so visitors who land on it bounce back to the real site as soon as
the new container answers.

**Persistent maintenance page after the deploy completes** indicates
the new container never went healthy. Check `docker logs front` for
build errors.

---

## 5. MCP HTTP transport — service exits cleanly

**Symptom:**

```
mcp   node-app   Exited (0) 13 minutes ago
```

**Root cause (expected):** `MCP_HTTP_ENABLED` is not set to `true` in
`/opt/cms/.env`. The mcp service entrypoint exits cleanly when
disabled — see `services/mcp/http.ts`.

**Fix:** if you want MCP enabled on this droplet, append to `.env`:

```bash
MCP_HTTP_ENABLED=true
MCP_ALLOWED_CIDR=<your-CIDR>     # optional but recommended
```

Then `docker compose -p cms -f infra/compose.yaml up -d mcp`.

**To leave MCP off** (current funisimo default), do nothing — the
deploy pipeline already skips the mcp rebuild via the
`grep -qE '^MCP_HTTP_ENABLED=true'` guard.

---

## 6. `Permission denied (publickey)` on first SSH from CI

**Symptom (GHA log):**

```
ssh: connect to host …: Permission denied (publickey)
```

**Root cause:** the `DEPLOY_SSH_KEY` GitHub secret is missing from the
droplet's `~/.ssh/authorized_keys`, OR the key in the secret isn't the
private half of the key on the droplet.

**Fix:** see `docs/runbooks/automatic-deployment.md` §1–2 for the
full setup. To quickly verify the key matches:

```bash
ssh-keygen -y -f /tmp/key < $DEPLOY_SSH_KEY > /tmp/key.pub
diff /tmp/key.pub <(ssh root@<droplet-ip> 'cat ~/.ssh/authorized_keys')
```

(Run locally with the secret value pasted into `/tmp/key`, then `rm`.)

---

## SSH onto the droplet for live triage

When the GHA log isn't enough:

```bash
ssh -i ~/.ssh/<your-deploy-key> root@<droplet-ip>
cd /opt/cms
docker compose -p cms -f infra/compose.yaml --env-file .env ps
docker logs front --tail 200
docker logs server --tail 100
docker logs mcp --tail 100
```

The droplet IPs are in the GHA secrets `DEPLOY_HOST_1` (funisimo) and
`DEPLOY_HOST_2` (skyclimber). Direct DNS works too: `ping funisimo.pro`
resolves to the droplet's public IP.

If you've never SSH'd from the laptop you're on, add your public key to
the droplet's `authorized_keys` first — go through the standard
DigitalOcean console flow (Access → Reset root password → log in via
console → `~/.ssh/authorized_keys`), don't reuse the GHA deploy key
for human SSH.
