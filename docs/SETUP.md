# First-time setup

End-to-end walkthrough for getting the CMS running locally and (optionally) registering its MCP server with an AI client (Claude Code / Cursor / Continue).

If something doesn't match what you see, the screenshots referenced below live at `https://funisimo.pro/screenshots/<file>.png` — the manifest is in [public/screenshots/README.md](../public/screenshots/README.md).

---

## 1. Prerequisites

- **Node.js 22+** (Next 16 requires it). `node --version`
- **Docker Desktop** or `docker` + `docker compose` plugin (used for local Mongo + Redis)
- **Git**

> Disk usage is modest until you install the Playwright browser (~150 MB) and run `npm install` (~600 MB of `node_modules`).

---

## 2. Linux (Ubuntu / Debian / Fedora / Arch)

```bash
# 1. Install Node 22 (Ubuntu/Debian via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install Docker (skip if you already have it)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out / log back in for the group to apply

# 3. Clone & install
git clone <repo-url> redis-node-js-cloud
cd redis-node-js-cloud
npm install --legacy-peer-deps    # antd v6 + @ant-design/compatible peer-deps need this flag

# 4. Start the local databases
docker compose -f infra/compose.dev.yaml up -d   # Mongo on :27017
docker run -d --name cms-redis -p 6379:6379 redis:7-alpine

# 5. Configure
cp .env.example .env.local
$EDITOR .env.local                # set NEXTAUTH_SECRET, ADMIN_DEFAULT_PASSWORD, MONGODB_URI

# 6. Run
sudo npm run dev                  # `sudo` only because port 80 is privileged on Linux;
                                  # alternatively edit package.json to use a higher port
```

Open `http://localhost/admin` and sign in as `admin@admin.com` with the password you set in `.env.local`.

> The `predev` hook runs `dev:db` automatically — the manual `docker compose up` in step 4 is just so you can see Mongo come up before launching the dev server. Skip step 4 if you trust the `predev` hook.

---

## 3. Windows

```powershell
# 1. Install Node 22 from nodejs.org or via winget
winget install OpenJS.NodeJS.LTS

# 2. Install Docker Desktop
winget install Docker.DockerDesktop
# (start Docker Desktop and wait for the green tray icon)

# 3. Clone & install (run in PowerShell or Git Bash)
git clone <repo-url> redis-node-js-cloud
cd redis-node-js-cloud
npm install --legacy-peer-deps

# 4. Local databases
docker compose -f infra/compose.dev.yaml up -d
docker run -d --name cms-redis -p 6379:6379 redis:7-alpine

# 5. Configure
copy .env.example .env.local
notepad .env.local

# 6. Run (port 80 needs an elevated terminal on Windows)
npm run dev
```

If you can't bind port 80, change the `dev` script in `package.json` to use `-p 3000` and visit `http://localhost:3000/admin` instead.

---

## 4. macOS

```bash
brew install node@22
brew install --cask docker
git clone <repo-url> redis-node-js-cloud
cd redis-node-js-cloud
npm install --legacy-peer-deps
docker compose -f infra/compose.dev.yaml up -d
docker run -d --name cms-redis -p 6379:6379 redis:7-alpine
cp .env.example .env.local
$EDITOR .env.local
sudo npm run dev          # port 80 needs sudo on macOS too
```

---

## 5. First-boot admin password

If you don't set `ADMIN_DEFAULT_PASSWORD` before the first run, the server seeds an admin with a generated password and writes it to `var/initial-admin-password.txt` (gitignored). Read the file once, sign in, change the password — the file then becomes a stale-artefact guard and the server refuses to re-seed silently.

If you ever lose that artefact AND the admin user is gone, set `ADMIN_PASSWORD_HASH` (a pre-computed bcrypt hash) or `ADMIN_DEFAULT_PASSWORD` in `.env.local` and restart.

---

## 6. Hello-world tour

1. **Sign in** at `http://localhost/admin` → land on the admin dashboard.

   ![Admin dashboard](https://funisimo.pro/screenshots/admin-shell.png)

2. **Create a page** — `Navigation` → `Add page` → enter a slug like `hello`. The page appears in the public site nav.

   ![Add navigation page](https://funisimo.pro/screenshots/admin-navigation-add.png)

3. **Add a section** — open your new page → `Add section` → pick `PLAIN_TEXT`, type "Hello world".

   ![Section editor](https://funisimo.pro/screenshots/admin-section-editor.png)

4. **Visit the public page** — `http://localhost/lv/hello` (default locale is `lv`). The text renders.

   ![Public page render](https://funisimo.pro/screenshots/public-section-render.png)

5. **Switch theme** — `Settings → Themes` → pick a preset → `Set active`. Reload the public page; CSS tokens have changed.

   ![Theme picker](https://funisimo.pro/screenshots/admin-themes.png)

6. **Translate** — `Settings → Languages` → `Edit translations` → flip a key in the side-by-side editor. Save. Reload.

   ![Translation editor](https://funisimo.pro/screenshots/admin-translations.png)

---

## 7. E-commerce tour

1. **Add a product** — `Settings → Products` → `New product`. Fill title, price, currency, stock.

   ![Product editor](https://funisimo.pro/screenshots/admin-product-editor.png)

2. **Visit `/products`** — public listing renders with your product.

   ![Public product listing](https://funisimo.pro/screenshots/public-products-list.png)

3. **Add to cart** — open the product detail page → `Add to cart` → click the cart icon in the header.

   ![Cart drawer](https://funisimo.pro/screenshots/public-cart-drawer.png)

4. **Customer sign-up** — `/account/signup` → make a customer account. The guest cart merges into your customer cart on sign-in.

   ![Customer signup](https://funisimo.pro/screenshots/public-customer-signup.png)

5. **Checkout** — proceed through `/checkout/{address,shipping,payment,review}` → use the test card `4111 1111 1111 1111` to succeed, or `4000 0000 0000 0002` to see the decline path.

   ![Checkout payment step](https://funisimo.pro/screenshots/public-checkout-payment.png)

6. **See the order** — `Settings → Orders` (admin) or `/account/orders` (customer).

   ![Admin orders](https://funisimo.pro/screenshots/admin-orders.png)

---

## 8. Inventory / warehouse sync

The Inventory module is where you wire an external product source. Out of the box it ships with two adapters:

- **Mock** (default) — in-memory deterministic data; safe for dev.
- **Generic feed** — any HTTPS URL returning JSON / NDJSON / CSV / TSV. Configure URL, auth (bearer / apiKey / basic), pagination, and a field map.

`Settings → Inventory` → pick `generic-feed` → fill in the URL + field mapping → `Save`. Then either click `Sync delta` manually or wire the operator-side scheduler to call the `inventorySyncDelta` GraphQL mutation on a cron.

![Inventory adapter form](https://funisimo.pro/screenshots/admin-inventory-config.png)

Spec: [docs/features/ecommerce/inventory-warehouse.md](features/ecommerce/inventory-warehouse.md).

---

## 9. Wire up the local MCP server

The CMS bundles a stdio MCP server that gives AI clients typed tools for content, products, themes, inventory and audit log operations. The full spec is in [docs/features/tooling/mcp-server.md](features/tooling/mcp-server.md).

> **Running prod + local side-by-side?** See [runbooks/mcp-environments.md](runbooks/mcp-environments.md) for the naming gotcha (the local entry has historically been registered as `redis-cloud-mcp`, which mislabels it; the prod one is `funisimo-prod`).

### 9.1 Issue a token

`Settings → MCP` → `Issue token` → name it (e.g. `claude-code-laptop`) → pick scopes → `Issue`. The secret is shown **once** — copy it now.

![MCP issue token](https://funisimo.pro/screenshots/admin-mcp-issue-token.png)

### 9.2 Register with Claude Code

Open `~/.claude/mcp.json` (create it if it doesn't exist) and add:

```json
{
  "mcpServers": {
    "redis-node-js-cloud-cms": {
      "command": "npm",
      "args": ["run", "mcp:stdio"],
      "cwd": "/absolute/path/to/redis-node-js-cloud",
      "env": {
        "MCP_TOKEN": "mcpsk_paste-the-token-you-just-issued",
        "MONGODB_URI": "mongodb://localhost:27017/DB"
      }
    }
  }
}
```

A copy-paste template lives at [tools/mcp.example.json](../tools/mcp.example.json).

Restart Claude Code. The CMS tools (`page.list`, `product.create`, `theme.setActive`, …) appear in the tool picker.

### 9.3 Register with Cursor / Continue / other MCP clients

Same JSON shape — refer to your client's MCP-config docs for where it lives. The server speaks plain MCP stdio.

### 9.4 Quick verification

In Claude Code, ask: *"List the available pages on the CMS."* The agent should call `page.list` and return the navigation tree. Each call writes an audit entry tagged `actor: 'mcp:<token-name>'`, viewable at `Settings → Audit`.

![Audit log with MCP entries](https://funisimo.pro/screenshots/admin-audit-mcp.png)

---

## 10. Production deploy

[docs/DEPLOY.md](DEPLOY.md) covers the full DigitalOcean droplet flow. Short version:

```bash
# Local: build SSG against the running Mongo
npm run build

# Deploy the .next bundle + public assets to the droplet, PM2 reload
./Scripts/deploy.sh
```

`next build` produces real static HTML for every navigation page and blog post. ISR (`revalidate: 60`) regenerates individual pages in the background when admin edits land.

---

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `EADDRINUSE: 0.0.0.0:80` | Port 80 in use (Skype, Apache, IIS) or no privileges | Free the port, or change `-p 80` → `-p 3000` in the `dev` script |
| `MongoServerError: Authentication failed` | Mongo URI without creds against an authed Mongo | Set `MONGODB_URI=mongodb://user:pass@localhost:27017/DB` in `.env.local` |
| `npm install` fails on `@ant-design/compatible` peer-dep | antd v6 vs the compat shim | Use `npm install --legacy-peer-deps` (this is the project's documented pattern) |
| MCP tools don't show up in Claude Code | Wrong path / token in `mcp.json` | Run `npm run mcp:stdio` manually from the repo root with the same env — you should see `[mcp] stdio transport ready`. Then re-check your client config |
| Cart doesn't persist across reloads | Redis isn't running | `docker ps` — start it with `docker run -d -p 6379:6379 redis:7-alpine` |
| Tests pass but `npm run dev` 500s on every page | Browser bundle pulls in server-only modules | Known Turbopack stricter-resolution issue with the `MongoApi → mongoDBConnection` chain. Tracked in roadmap; build mode (`npm run build && npm start`) and standalone GraphQL are unaffected |

---

## 12. Where to go next

- [docs/PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) — runtime topology and data model
- [docs/features/](features/) — one spec per feature module
- [docs/ROADMAP.md](ROADMAP.md) — what's queued
- [tests/e2e/README.md](../tests/e2e/README.md) — running and writing Playwright specs
