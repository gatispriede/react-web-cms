# Backlog

Parking lot for ideas deferred until a **concrete trigger** emerges. These are not committed work and not budgeted in any wave. Move an item from here to the active queue (`README.md`) only when there's a real driver — a customer ask, a recurring bug, an external dependency, etc.

Each entry: brief description + the trigger that would justify activation.

---

## F8-sdk — plugin SDK for third-party MCP tools

**Size:** L
**Trigger:** A concrete plugin author shows up — third-party integration, customer-built extension, planned "install community modules" product feature.

Surface `defineTool` + `compose` as a public API so plugins can register MCP tools without touching core. Today both are exported from `services/features/Mcp/tools/_shared.ts` but not advertised; the SDK work is documenting the contract, versioning it, and giving plugins a registration entrypoint.

**Why deferred:** F8-bulk-introspection (active Wave 2) extends ~22 tools — if the SDK ships first and then we extend tools, every plugin author has to rewrite against the new shapes. Plugin SDK without a plugin author is YAGNI; easy to revive when a real driver appears.

---

## C17 — field-level sample audit

**Size:** S
**Trigger:** A client surfaces a specific gap.

Per-`EItemType` sample coverage in `samples-audit.md`. Broad coverage already exists; opens when a real client gap is reported.

---

## Mobile-friendly admin — native wrapper

**Size:** L
**Trigger:** Web admin proves insufficient for a high-value mobile workflow.

Capacitor / React Native shell around the admin SPA. Web mobile (the active Wave 1 item) ships first; native is a separate project if the value emerges.

**Why deferred:** Native adds release-pipeline complexity (App Store / Play Store), and PWA install (`Add to Home Screen` standalone mode, shipped in Mobile-friendly admin Phase 3) covers ~80% of the "feels like an app" benefit at zero cost.

---

## mcp-rollout #8 — Mongo healthcheck modernisation

**Size:** XS
**Trigger:** Something starts gating on Mongo's healthy state.

`docker compose ps` shows `mongodb` as `Up X (unhealthy)` permanently because the healthcheck shells `mongo --eval` (the `mongo` binary was removed in MongoDB 6.x; image is `mongo:7.0`). One-line fix: switch to `mongosh`.

**Why deferred:** Per the cattle-not-pets stance — droplets are disposable, content reproducible from bundle export, and nothing currently gates on Mongo's health status. Cosmetic only.

---

## Per-page site-mode toggle

**Size:** M
**Trigger:** A site needs to mix scroll + multipage on the same domain.

F6 site-mode-toggle (active Wave 2) is intentionally global. Per-page would require routing-mode discovery on every link.

---

## How to promote an item to active

1. Cut its entry out of this file.
2. Paste into the appropriate active table in [`README.md`](README.md) (Content editor / MCP / Visual + observability / etc.) with a note about which trigger fired.
3. Re-slot in Suggested ordering by size.
