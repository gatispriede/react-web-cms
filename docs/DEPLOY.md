# Deploy — funisimo.pro on DigitalOcean

This guide covers a single-droplet deploy for the CMS (admin + standalone GraphQL + MongoDB + SSG-served Next.js). Suitable for a personal portfolio with low traffic. For higher traffic, split `mongodb` onto its own droplet or use DO Managed MongoDB.

---

## 1. Sizing — **local build, droplet serves only, rare prod edits**

Content is authored locally (dev admin on your laptop + local Mongo), built locally, then static artifacts are rsync'd to the droplet. The droplet runs **Caddy + `next start` + MongoDB + standalone-graphql**; Mongo and the admin/graphql route are only there for the occasional on-server edit.

**Recommended droplet: Basic 2 GB / 1 vCPU (~$12/mo).**

| Profile | Droplet | Rationale |
|---|---|---|
| **Default** | 2 GB ($12) | Comfortable for Mongo + rare admin sessions |
| Ultra-lean (no prod admin needed) | 1 GB ($6) | Drop Mongo + standalone-graphql on droplet; serve static only. Admin still ships in the bundle but won't function there |
| Build on droplet (fallback) | 2 GB + 2 GB swap | Only if no local build is available |

Steady-state memory (runtime, no builds): ~650 MB – 1 GB across Mongo + `next start` + standalone-graphql + Caddy + Ubuntu. `next build` peak (~1.5–2 GB) is **off-droplet**.

---

## 2. DNS (funisimo.pro)

Droplet IPs (and other sensitive values) live in [`secrets.md`](secrets.md), which is gitignored. Substitute `$DROPLET_IPV4` / `$DROPLET_IPV6` below with those values.

At the registrar:

```
A      funisimo.pro        $DROPLET_IPV4
A      www.funisimo.pro    $DROPLET_IPV4
AAAA   funisimo.pro        $DROPLET_IPV6
AAAA   www.funisimo.pro    $DROPLET_IPV6
```

TTL 300 s during setup, bump to 3600 once stable. Verify:

```bash
dig +short funisimo.pro A
dig +short funisimo.pro AAAA
```

Both must resolve before step 6 — Caddy + Let's Encrypt will refuse to issue certs otherwise.

---

## 3. Droplet bootstrap

Droplet already provisioned (Ubuntu 24.04 LTS, 2 GB Basic, SSH key pre-installed). IP is in [`secrets.md`](secrets.md).

```bash
ssh root@$DROPLET_IPV4

# Create a non-root user
adduser --disabled-password --gecos "" gatis
usermod -aG sudo gatis
cp -r ~/.ssh /home/gatis/
chown -R gatis:gatis /home/gatis/.ssh

# Basic hardening
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
sed -i 's/#PermitRootLogin.*/PermitRootLogin no/; s/#PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Swap
fallocate -l 2G /swapfile
chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.conf

exit
ssh gatis@$DROPLET_IPV4
```

### Install runtime dependencies

```bash
# Node 22 (LTS) via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3 python3-pip git

# Yarn
sudo npm i -g yarn pm2

# MongoDB 7
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# Caddy (TLS + reverse proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

### Harden MongoDB

```bash
# Enable auth
mongosh <<'EOF'
use admin
db.createUser({user: "admin", pwd: passwordPrompt(), roles: ["root"]})
EOF

sudo sed -i 's/^#security:/security:\n  authorization: enabled/' /etc/mongod.conf
sudo systemctl restart mongod

# Create an app-scoped user
mongosh -u admin -p <<'EOF'
use DB
db.createUser({user: "cms", pwd: passwordPrompt(), roles: [{role: "readWrite", db: "DB"}]})
EOF
```

Keep both passwords in a password manager.

---

## 4. Clone + configure

```bash
cd ~
git clone <your-repo-url> funisimo
cd funisimo

# Secrets live in .env.local (never committed)
cat > .env.local <<'EOF'
NODE_ENV=production
NEXTAUTH_URL=https://funisimo.pro
NEXTAUTH_SECRET=<generate via: openssl rand -base64 32>
MONGODB_URI=mongodb://cms:<cms-password>@localhost:27017/DB
# Optional Google OAuth (leave blank to disable)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
# SSG build target
BUILD_PORT=3000
GRAPHQL_ENDPOINT=http://localhost:3000/api/graphql
EOF
chmod 600 .env.local
```

> **Rotate before any `git push`**: the repo currently has `NEXTAUTH_SECRET` / Google keys committed under `src/frontend/.env` (see README note) and hardcoded Atlas credentials + admin password in `src/Server/mongoConfig.ts`. Treat these as leaked, regenerate, and move them to env vars before exposing the repo.

### Admin seeding — password precedence

On first `setupAdmin`, the server picks a password source in this order:

1. `ADMIN_PASSWORD_HASH` — pre-computed bcrypt hash. Used verbatim. No flag set, no artefact written.
2. `ADMIN_DEFAULT_PASSWORD` — plain-text. Hashed once, then the admin user is flagged `mustChangePassword: true` so the UI nags until it's rotated.
3. **Neither set → the server generates a 144-bit password, bcrypt-hashes it, and writes the plain value to `var/admin-initial-password.txt` (mode `0600`).** If the process is interactive (TTY), a one-shot banner also prints to stdout. The admin is flagged `mustChangePassword: true`.

The generated-password path is the preferred production flow: no plain-text env var sits in deploy config, and the artefact is read once then deleted by the operator after first login.

> **Never regenerate**: if `var/admin-initial-password.txt` exists but the admin user was deleted, boot fails with a clear message. Restore the user or remove the file manually — the server refuses to silently re-seed and invalidate credentials someone may still have.

Install + seed admin:

```bash
yarn --frozen-lockfile

# One-off seeding — starts graphql, hits /api/setup, kills it.
# If no ADMIN_* env is set, the generated password lands in
# var/admin-initial-password.txt on this box. Read it, log in, rotate it.
pm2 start "npm run standalone-graphql" --name gql-seed -- --production
sleep 5
curl -fsS http://localhost/api/setup
pm2 stop gql-seed && pm2 delete gql-seed

# If you used the generate-from-nothing path:
cat var/admin-initial-password.txt
# Log in with that, immediately set a new password in Site settings → Users,
# then delete the artefact:
rm var/admin-initial-password.txt
```

---

## 5. Run services on the droplet (no build)

The droplet hosts runtime only. Bring up MongoDB, standalone-graphql, and a stub `next start`:

```bash
# standalone-graphql on port 3000 — always up, used by admin + rare edits
pm2 start "npm run standalone-graphql-docker" --name gql

# next start serves the pre-rendered .next artifacts; will boot once they land
pm2 start "npm start" --name web

pm2 save
pm2 startup systemd   # follow the printed sudo line
```

`pm2` will restart `web` automatically once the `.next` directory is populated by a local deploy.

### Standalone GraphQL session guard

`src/Server/index.ts` bypasses the Next route's authz Proxy, so it must never
be reachable from the public internet. Defaults in place:

- Local dev binds `127.0.0.1:80`; `NODE_SERVER_PORT=true` switches to
  `0.0.0.0:3000` for Docker's internal network.
- Non-loopback requests are rejected at the express middleware layer.
- Override only if you know what you're doing:
  `STANDALONE_ALLOW_REMOTE=1 pm2 start "npm run standalone-graphql-docker" --name gql`

Caddy terminates TLS and proxies to `next start` (port 80). The standalone
server on `:3000` should stay firewalled to the droplet's private interface.

## 6. Local build + deploy (the actual publishing loop)

Content is authored against **your laptop's** admin + local Mongo, built locally, and rsync'd up. The on-droplet admin is just there for rare on-server edits.

### Deploy script

[`Scripts/deploy.sh`](Scripts/deploy.sh) automates the full loop:

```bash
# From the repo root on your laptop
./Scripts/deploy.sh
```

Under the hood it:

1. Starts `standalone-graphql` locally on port 3000 (if not already up).
2. Runs `BUILD_PORT=3000 npm run build` → static HTML baked from your laptop's Mongo.
3. Rsyncs `.next/`, `public/`, `package.json`, `yarn.lock`, `src/Server/schema.graphql` → droplet.
4. SSH's into the droplet and runs `yarn --frozen-lockfile && pm2 reload web`.
5. Stops the local standalone-graphql (unless you had it running already).

First-time variables the script reads from env:

```bash
export FUNISIMO_HOST=gatis@$DROPLET_IPV4
export FUNISIMO_REMOTE_PATH=/home/gatis/funisimo
./Scripts/deploy.sh
```

Put those in your shell profile or a `.envrc` (never committed).

### Editing content on the droplet (the rare path)

1. `https://funisimo.pro/admin` → sign in → edit → Publish.
2. On your laptop: `ssh -fNL 3001:localhost:3000 gatis@$DROPLET_IPV4` (forward the droplet's graphql).
3. `GRAPHQL_ENDPOINT=http://localhost:3001/api/graphql BUILD_PORT=3001 npm run build` — this builds against **prod Mongo** via the tunnel.
4. Rsync + reload as in the deploy script.
5. Kill the tunnel: `pkill -f 'ssh -fNL 3001'`.

### ISR fallback

Every SSG page has `revalidate: 60`. Even without a rebuild, edits done on the droplet admin will surface after at most 60 s because `next start` re-runs `getStaticProps` in the background. Full-site freshness still requires a local rebuild + deploy.

---

## 6. Caddy (TLS + reverse proxy)

```bash
sudo tee /etc/caddy/Caddyfile <<'EOF'
funisimo.pro, www.funisimo.pro {
    encode zstd gzip
    reverse_proxy localhost:80

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Long-cache static assets
    @static path /_next/static/*
    header @static Cache-Control "public, max-age=31536000, immutable"
}
EOF

sudo systemctl reload caddy
```

Caddy auto-issues Let's Encrypt certs on first request. Confirm:

```bash
curl -I https://funisimo.pro/lv
```

Should return `200` with a valid TLS handshake.

---

## 7. Smoke tests

```bash
# SSG paint is immediate (no client-side sections fetch)
curl -s https://funisimo.pro/lv | grep -E 'Gatis Priede|hero__headline|project-card' | head -5

# Blog route baked in
curl -s https://funisimo.pro/lv/blog | grep -E 'blog-card' | head

# Admin still dynamic
curl -I https://funisimo.pro/admin
```

---

## 8. Firewall

```bash
sudo ufw status            # allow 22, 80, 443 only
sudo netstat -tulpn | grep -E ':27017|:3000'   # must be 127.0.0.1-only
```

MongoDB by default binds `127.0.0.1` — verify it's not listening on `0.0.0.0`. Likewise `standalone-graphql-docker` binds `localhost:3000`.

---

## 9. Backups

```bash
# Daily mongodump via cron (runs at 04:00)
mkdir -p ~/backups
(crontab -l 2>/dev/null; echo "0 4 * * * mongodump --uri='mongodb://cms:<pwd>@localhost:27017/DB' --archive=/home/gatis/backups/DB-\$(date +\%F).archive && find /home/gatis/backups -mtime +30 -delete") | crontab -
```

Snapshot the whole droplet via the DO dashboard weekly — $1.20/mo for a 25 GB droplet snapshot. Keep 2 rolling snapshots.

For the CMS's own bundle: Settings → Bundle → Download → keep the JSON alongside your DB backups.

---

## 10. Operational rhythm

| Action | Command |
|---|---|
| Deploy code change | `git pull && yarn --frozen-lockfile && npm run build && pm2 reload web` |
| Restart admin/graphql after env change | `pm2 restart gql web` |
| View logs | `pm2 logs` |
| Update Mongo | `sudo apt update && sudo apt install mongodb-org` then `sudo systemctl restart mongod` |
| TLS cert status | `caddy validate --config /etc/caddy/Caddyfile` (Caddy auto-renews) |
| Droplet resize (add RAM) | DO dashboard → resize → reboot (<2 min downtime) |

---

## Known pre-launch debt (rotate / scrub before public)

1. **Secrets in git history** — `src/frontend/.env` was committed earlier. Run `git filter-repo` before pushing to a public remote; regenerate every secret.
2. **Hardcoded Atlas credentials + admin password** in [`src/Server/mongoConfig.ts`](src/Server/mongoConfig.ts). Move to env vars.
3. **Stale README** still references CRA template. Replace with a short project intro + link to this doc.
4. **`next-sitemap.config.cjs`** hardcodes `http://localhost` — fine for the droplet (same-host build) but needs `process.env.BUILD_PORT` support for any multi-host pipeline.
5. **Revalidate-on-publish** not yet wired — current flow requires `pm2 reload web` after Publish, or wait 60 s for ISR.

---

## Cost summary (first month)

| Item | Cost |
|---|---|
| Droplet (2 GB, 2 vCPU) | $12 |
| Weekly snapshot (25 GB) | $1.20 |
| Domain `funisimo.pro` | already owned |
| **Total** | **~$13 / month** |

Scale-up path if traffic warrants: DO Managed MongoDB + droplet upgrade to 4 GB + Spaces for image uploads.

---

## Multi-droplet setup (funisimo.pro + skyclimber.pro)

We run two independent droplets off the same repo:

| Droplet | Domain | Reserved IP | Purpose |
|---|---|---|---|
| 1 (`my-homepage`) | funisimo.pro | 139.59.205.140 | Personal CMS (me) |
| 2 (skyclimber) | skyclimber.pro | 138.68.115.204 | Client CMS |

Same code, same compose stack, same Caddy config — **only the `.env` differs
per droplet** (domain, NextAuth URL + secret, admin credentials). Each has
its own Mongo volume so content is fully isolated.

See [secrets.md](secrets.md) for IPs, admin creds, and DO Cloud Firewall rules.

### Current pipeline state

The GitHub Actions `deploy` job targets one droplet at a time via
`DEPLOY_HOST_*` / `DEPLOY_ENV_FILE_*` secrets. Switching target = flipping
which `_1` / `_2` secret the workflow references (one-line edit in
`.github/workflows/ci.yml`).

### End state (TODO — blocked on refactoring + zero-downtime story)

Once the core is stable, switch the deploy to fan out to **both droplets in
parallel** on every push to `master`. Sketch:

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - host_secret: DEPLOY_HOST_1
        env_secret: DEPLOY_ENV_FILE_1
      - host_secret: DEPLOY_HOST_2
        env_secret: DEPLOY_ENV_FILE_2
```

(Note: GitHub Actions doesn't allow `secrets.*` inside `matrix.include`
directly — it'll need an indirection via per-job `env` mapping or a
step-level lookup.)

### Zero-downtime requirement (blocker for the multi-target rollout)

Today's `docker compose up --build -d` rebuilds the `app` container on the
droplet itself, which means ~2–3 min where the site returns 502. That's
tolerable for funisimo.pro (personal) but unacceptable for a client site.

Paths to explore before enabling the dual-target deploy:

1. **Build in CI, push image to registry, pull on droplet.** Deploy becomes
   `docker compose pull && docker compose up -d` — swap is seconds. Needs
   a registry (GHCR is free for the repo) and a minor Dockerfile split so
   the `app` image is versioned by SHA.
2. **Blue/green inside compose.** Run two `app` instances behind Caddy;
   deploy replaces them one at a time with health checks. More moving
   parts but no registry dependency.
3. **Pre-built `.next/` rsync + `next start` reload** (the flow this doc
   originally described up in §6). Bypasses the Docker rebuild entirely
   but means the droplet needs a Node runtime outside containers.

Option 1 is the smallest diff from today's setup and is the default
recommendation when we get there.

### Content sync (separate from code deploy)

Each droplet has its own Mongo. The "update both droplets identically" goal
applies only to **code** — not content. Client content (skyclimber.pro)
lives solely on droplet 2; personal content on droplet 1. If content ever
needs mirroring, use `mongodump` → `mongorestore` or a scheduled bundle
export/import, not replication (the two sites aren't meant to share data).
