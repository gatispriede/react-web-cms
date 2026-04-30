# Plug-and-play feature toggles

Status: Planned
Last updated: 2026-04-29

## What it is

A first-class feature-flag system that lets an operator enable or disable each feature module at runtime — products, cart, checkout, inventory, blog, MCP, customer auth, etc. — without code edits or redeploys. Disabled features hide their admin tabs, drop their public routes, refuse their GraphQL operations, and skip their service initialisation.

The current architecture lights every module up unconditionally because they were added incrementally. As the surface grows, operators want to ship a subset (e.g. "content-only CMS, no e-commerce" or "blog + products, no checkout").

## Goals

- One toggle per feature module, settable by an admin (and by an MCP tool).
- Disabling a feature removes its admin UI, its public pages, and its GraphQL surface — no half-states.
- Enabling a feature is reversible: data isn't deleted, just hidden.
- Defaults are safe: a fresh install enables CMS-core (content, themes, i18n, blog, auth) and disables e-commerce + MCP until the operator opts in.
- AI agents (via MCP) can read which features are on before suggesting work.

## Sketch

- New `FeatureFlags` doc in `SiteSettings` with one boolean per module: `products`, `cart`, `checkout`, `inventory`, `blog`, `mcp`, `customerAuth`, `e2e`, etc.
- `services/features/FeatureFlags/FeatureFlagsService.ts` — get / set / list. Reads cached on boot, invalidated on save.
- `MongoDBConnection` consults flags before constructing optional services. A disabled service either isn't constructed or returns a `FeatureDisabledError` from every method.
- GraphQL: `featureFlags` query returns the active map. `setFeatureFlag(name, enabled)` admin mutation. Operations on a disabled feature throw `AuthzError('feature disabled: <name>')`.
- Public Next.js routes: `getStaticProps` returns `notFound: true` when the owning feature is off, so `/products` 404s when products are disabled.
- Admin UI: `AdminSettings.tsx` filters its tab list against the active flags; a single "Features" tab gates the toggles (admin-only).

## Open questions

1. **Per-deployment vs per-tenant** — single-tenant repo today, but the flag map should be shaped so a future multi-tenant add-on doesn't require migrations.
2. **Dependency graph** — checkout depends on cart depends on products. Disabling cart while checkout is on is invalid. Define the graph and enforce on save.
3. **Data retention vs purge** — disabling Products hides the route, but the collection stays. Offer an explicit "purge data" action separate from the toggle.
4. **MCP tool gating** — an MCP token with `write:products` scope hitting a disabled feature should fail loudly. Use the same `FeatureDisabledError` shape.
5. **Migration of existing installs** — write a one-shot at boot that reads what data exists (`if Products collection has rows → flag stays on`) so existing users don't get features turned off underneath them.
