# Client analytics — lightweight first-party tracking

Status: **v1 shipped 2026-05-02.** Backend (`AnalyticsService` + Loader, ingest + canned summary, Mongo collection with TTL + dedupe + dashboard indexes), client `track()` + `trackPageview()` API, auto-pageview hook + `AnalyticsHost` mounted in `_app.tsx`, GraphQL surface (`trackEvent` anon-open, `analyticsSummary` admin-only), `Sec-GPC` / DNT honoured, batched flush every 5s/25 events, page-unload `keepalive` flush. **Admin dashboard** at `/admin/release/analytics` — range selector (24h/7d/30d), top pages + top events tables. **MCP tool** `site.analyticsSummary` (scope `read:analytics`) for AI-driven traffic checks. **Remaining**: country-code lookup (GeoLite at deploy time).
Last updated: 2026-05-02

## Why

Operators need to know what's happening on their site — which pages are read, which products are clicked, where customers drop off in checkout — without shipping Google Analytics or Segment and the privacy / cookie-consent / page-weight cost that comes with them. The CMS already owns the database, the auth, and the GraphQL surface; adding our own slim event sink is cheaper than integrating a third-party.

**Explicit non-goal**: this is NOT another full analytics platform. No funnels, no cohorts, no retention curves, no replays. Just a straightforward event log + a couple of canned aggregations the operator actually reads.

## Scope

### In

- **Client-side event capture** for both anonymous and logged-in users:
  - Page views (path, referrer, viewport, user-agent class).
  - Standard interactions: cart add, cart remove, product detail open, checkout step transitions, blog post open, navigation clicks, form submissions.
  - Custom events from a small `track(eventName, props)` API any feature can call.
- **Anonymous identity**: a first-party cookie / localStorage `anonId` (UUID, regenerated on clear) so a session's events thread together without any cross-site tracking.
- **Logged-in linking**: when a user authenticates, subsequent events stamp `userId` alongside `anonId` so admin dashboards can stitch the two — but earlier anon events are NOT retroactively reassigned (privacy default).
- **Server-side ingest**: one GraphQL mutation `mongo.trackEvent(events: [JSON!]!)`, batched (client buffers + flushes every ~5s or 25 events). One Mongo collection `Analytics` with a TTL index.
- **Admin dashboard**: a single `/admin/analytics` page with the canned queries — top pages last 7d, top products last 7d, checkout funnel (4 numbers), conversion rate. No drill-down.
- **MCP tool**: `site.analytics.summary` returns the same canned aggregates as JSON for AI-driven recommendations ("traffic dropped 30% on /products this week — investigate").

### Out

- Cross-site tracking, third-party fingerprinting, IP-derived geolocation beyond country.
- Replays, heatmaps, session recordings.
- A/B test infra (separate roadmap item if it ever lands).
- Custom dashboards, query builder, retention / cohort analysis.
- External integrations (no GA / Segment / Mixpanel forwarder).

## Sketch

### Event shape

```ts
interface AnalyticsEvent {
  id: string;            // UUID generated client-side
  ts: number;            // client epoch ms
  serverTs?: number;     // stamped at ingest
  anonId: string;        // first-party UUID
  userId?: string;       // if logged in
  sessionId: string;     // resets on tab visibility-hidden > 30min
  path: string;          // window.location.pathname
  referrer?: string;
  type: 'pageview' | 'interaction' | 'custom';
  name: string;          // 'cart.add', 'checkout.step', etc.
  props?: Record<string, string | number | boolean>;  // small key/value
  ua?: {device: 'mobile' | 'tablet' | 'desktop'; browser?: string};
  viewport?: {w: number; h: number};
  locale?: string;
}
```

Strict allowlist on `props` — string/number/boolean only, max 16 keys, max 256 chars per value. Prevents the collection from ballooning and rules out PII drift through abused custom events.

### Identity

- **`anonId`** — first-party cookie `a_id` (HttpOnly false so the client can read it; Lax SameSite). UUID v4. Created on first event if missing. Cleared on browser data clear; we never re-create.
- **`sessionId`** — sessionStorage UUID. Resets after 30 min of `document.hidden`. NOT a server-issued session token.
- **`userId`** — added from the existing customer or admin session when present. Server-side, on ingest, validated against the calling session — clients never spoof it.

### Privacy posture

- First-party only. No third-party scripts, no third-party cookies.
- IP captured in the request log but NOT written to the analytics row; ingest derives a 2-letter country code (server-side IP → country lookup) and discards the IP.
- Customer email / name NEVER on an event. `userId` is the only user-identifying field; correlation lives in admin via the existing Users collection.
- Honour `Sec-GPC` (Global Privacy Control) and `navigator.doNotTrack` — when set, ingest is a no-op (events captured client-side but not sent). Banner/cookie consent is OUT of scope on day 1 (first-party functional cookies don't need consent in most jurisdictions); add a cookie-consent gate in v2 if regulatory feedback requires it.
- TTL: `Analytics` collection has a 90-day TTL index. Operator can lower via env (`ANALYTICS_RETENTION_DAYS`).

### Storage

- One collection `Analytics`, indexed on `{anonId, ts}`, `{userId, ts}` (sparse), `{type, name, ts}`, `{path, ts}`, plus the TTL.
- Daily rollup job (boot-scheduled, idempotent) writes a `AnalyticsDaily` collection with `{day, top: [...]}` summaries so dashboard queries don't touch raw events for the common case.

### GraphQL surface

```
extend type MutationMongo {
  trackEvent(events: [JSON!]!): String!  # public, rate-limited per anonId
}
extend type QueryMongo {
  analyticsSummary(range: String!): String!  # admin only
}
```

Rate limit: 60 events / 60 seconds / `anonId`. Excess silently dropped server-side (client unaware → no retry storm).

### Loader integration

Ships as `services/features/Analytics/AnalyticsServiceLoader.ts` extending the new `ServiceLoader` (Class Loader L1) — concrete proof case for the second L2 migration after Products. Public ingest route is gated by `withFeatureGate('analytics')`; defaults to ON for new installs but flippable through `/admin/system/features`.

`AnalyticsClientUILoader` exports the small `track()` API + auto-pageview hook. `AnalyticsAdminUILoader` declares the `/admin/analytics` admin pane.

## Decisions (2026-05-02)

1. **Pre-login event stitching — NO.** Privacy default. A login event records the user→anon link going forward; earlier anon events stay anon. Reopen if operator demand for pre-login attribution is real.
2. **Country-code lookup — bundled GeoLite.** No per-event API latency; ~70MB at deploy time is acceptable. License: GeoLite2 free tier; refresh via deploy pipeline.
3. **Funnel definition — hard-coded.** Canonical e-commerce funnel: `/products` → `/products/[slug]` → `/cart` → `/checkout` → confirmation. No query builder in v1. Custom funnels are a v2 conversation.
4. **MCP — canned only.** `site.analytics.summary` returns the same canned aggregates as the dashboard; no arbitrary aggregation surface. Keeps the AI-callable surface auditable + stable.
5. **Sampling — always-on for v1.** No sampling at ingest. Becomes a knob if Mongo cost grows; the TTL index limits steady-state collection size regardless.
