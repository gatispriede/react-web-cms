# UI Smoke Checklist

Manual operator pass. Each row is a single check — tick `[x]` once verified.
Run before any prod release; failure on any row blocks the deploy.

Group order matches the admin sidebar. Public-side checks at the bottom.

---

## Build (admin sidebar → Build)

- [ ] `/admin/build` — sider lists pages, click a page → modules render in centre pane.
- [ ] Click "Add page" → dialog opens with name + parent + slug fields. Save → row appears in sider within 2 s.
- [ ] Click an existing page → click "Add section/module" → ModulePicker dialog opens, all module thumbnails render.
- [ ] Edit a module → editor Drawer opens on right; Save closes Drawer + display refreshes.
- [ ] Delete a page (Popconfirm) → row leaves sider; check it lands in Trash.
- [ ] Reorder modules via drag handle → order persists after F5.

## Client config (admin sidebar → Client config)

- [ ] `/admin/client-config/themes` — every theme card renders preview swatch + Activate button. Activate one → card shows "active" badge.
- [ ] `/admin/client-config/themes` (with `?aui=simple`) — only Activate button per card; no New/Edit/Duplicate/Delete.
- [ ] `/admin/client-config/footer` — edit copyright text → Save → public footer updates.
- [ ] `/admin/client-config/logo` — upload logo → preview updates → public site shows new logo.
- [ ] `/admin/client-config/languages` — add a locale → translations list grows by N keys.

## Content

- [ ] `/admin/content/posts` — list renders. Click "New post" → Drawer with title/slug/body/cover/tags/draft. Save publishes.
- [ ] `/admin/content/posts/new?aui=simple` — only title + cover + body fields. Save → post appears on `/blog` immediately.
- [ ] `/admin/content/products` — list renders. Click "New product" → Drawer with name/price/stock/image. Save → row appears.
- [ ] `/admin/content/inventory` — sync table renders; sync button works (stock counts refresh).
- [ ] `/admin/content/orders` — list renders. Click an order → Drawer shows lines + total + status history.
- [ ] `/admin/content/inquiries` — submitted inquiry rows render; click row → detail panel.

## SEO

- [ ] `/admin/seo/site` — site-wide meta editor saves; verify `<head>` of `/` reflects.
- [ ] `/admin/seo/post/<id>` — per-post meta override saves.

## Release

- [ ] `/admin/release/publish` — staging→prod publish button → confirmation toast → public site reflects.
- [ ] `/admin/release/trash` — trash groups list. Restore → page reappears in Build sider.
- [ ] `/admin/release/bundle` — export → download triggers; import a bundle → pages appear.
- [ ] `/admin/release/audit` — log rows render with actor, action, timestamp.

## System

- [ ] `/admin/system/info` — Diagnostics: Build identity, Route registry, Feature manifest, Storage health, Trash overview, Idempotency snapshot, Authorization snapshot all render. Refresh button reloads without errors.
- [ ] `/admin/system/users` — users list, invite flow, role change.
- [ ] `/admin/system/grants` — grants matrix; toggle a permission → audit log row appears.
- [ ] `/admin/system/mcp` — token list; rotate token → new token shown once.
- [ ] `/admin/system/agent` — agent prompt → response streams; created pages appear in Build.

## Themes (visual smoke per theme)

For each theme, activate it from `/admin/client-config/themes` then visit `/`:

- [ ] **Industrial** — chrome scopes correctly, no broken layout, hero readable.
- [ ] **Studio** — typography contrast OK, buttons styled.
- [ ] **Paper** — light tones, no contrast failures (a11y AA).
- [ ] **High contrast** — borders visible, focus rings clear.

## Modes

- [ ] Dark mode toggle (top bar) — chrome flips; storefront keeps light unless theme is dark-aware.
- [ ] Simplified mode (`?aui=simple` on Posts/Themes) — power-user knobs hidden; basic flows still work.
- [ ] Mobile viewport (375 × 812) — sider collapses to drawer; hamburger expands.
- [ ] Drawer expand/collapse — clicks outside close the drawer; ESC closes.

## Auth

- [ ] `/auth/signin` — wrong password → toast/error; correct password → land on `/admin/...`.
- [ ] Sign out from top bar → redirected to `/`; revisiting an admin URL bounces to `/auth/signin`.
- [ ] Onboarding wizard (first-run) — runs through steps, lands on a populated Build sider.

## Public routes

- [ ] `/` — home renders, no console errors, no hydration mismatches.
- [ ] `/blog` — list renders, post links resolve.
- [ ] `/blog/<slug>` — post renders with correct title, cover, body.
- [ ] `/lv/<page>` — sub-page resolves.
- [ ] `/lv/<a>/<b>/<c>` — depth-3 sub-page resolves.
- [ ] `/products` — storefront list renders.
- [ ] `/products/<slug>` — detail with title/price/add-to-cart.
- [ ] `/cart` — empty state + with-item state render.
- [ ] `/checkout/address` → `/checkout/shipping` → `/checkout/payment` → `/checkout/confirmation/<id>` — full chain works.
- [ ] `/sitemap.xml` — content-type `application/xml`, contains `<url>` rows for known pages.
- [ ] `/api/info` — JSON response with `gitSha`, `build`, `features`, `routes` keys.

---

Total checklist rows: **57** across **8 areas** (Build, Client config, Content, SEO, Release, System, Themes/Modes/Auth, Public).
