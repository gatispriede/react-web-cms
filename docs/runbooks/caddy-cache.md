# Runbook — Caddy SWR cache (C9)

## What it is

Production deploys put Caddy's HTTP cache module in front of the Next
app for two response classes:

- **Public pages** — `/`, `/[lang]`, `/[lang]/[slug]` — TTL 60s,
  `stale-while-revalidate=600`.
- **Anonymous GraphQL reads** — `POST /api/graphql` without an
  Authorization header or NextAuth session cookie — TTL 30s, SWR 600s.

Authenticated requests (admin UI, MCP bearer tokens) always bypass the
cache because the origin emits `Cache-Control: no-store`.

## Cache key

`URL + X-Cms-Cache-Tag` header where the tag is
`<bootId>;<feature1>=<ver1>,<feature2>=<ver2>,…`.

- `bootId` is a UUID generated on every Node process start
  (`services/infra/bootId.ts`). Restart → new id → cache misses across
  the board.
- Each feature lists `cacheVersionKeys` on its `ServiceLoader`. A
  mutation routed through `runMutation()` bumps every listed key in
  Redis; the next public response stamps the new versions, evicting
  any prior cache entry tagged with older versions.

## Enabling

Set `PROD_CACHE=1` on the Node app container. Without it the app emits
`Cache-Control: no-store` so dev/CI can iterate without staleness.

## Debugging cache misses

```bash
# 1. Inspect the tag stamped on the response
curl -sI https://your-site/api/graphql -X POST | grep -i cms-cache-tag
# X-Cms-Cache-Tag: 5c5f…;posts=4,navigation=12

# 2. Compare bootId across two requests — same id == same process
curl -sI https://your-site/ | grep -i cms-cache-tag
curl -sI https://your-site/ | grep -i cms-cache-tag
```

If versions don't bump after an admin save:

- Check the feature's `ServiceLoader` declares `cacheVersionKeys`.
- Confirm the mutation runs through `runMutation('<featureId>', …)`.
- Inspect Redis: `redis-cli get cms:cv:<feature>` should advance.

## Force-bypass

The Caddy cache module respects `Cache-Control: no-cache` on the
request — admins debugging stale UI can hit the URL with that header
to skip the SWR layer. Browsers send it automatically on hard reload
(Ctrl+Shift+R / Cmd+Shift+R).

For server-side bypass during a deploy, set `PROD_CACHE=0` on the
Node container and roll — origin starts emitting `no-store` and the
SWR entries naturally age out.

## Stock Caddy fallback

The cache module is an `xcaddy` plugin (`caddy-cache-handler`); stock
Caddy builds don't ship it. If the production binary lacks the module
the SWR layer is a no-op — responses still flow with their
`Cache-Control` headers, so browser caches and any downstream CDN
still honour the policy. The origin pays a higher RPS but nothing
breaks.

## Related

- `services/infra/cacheVersion.ts` — version stamps (Redis-backed)
- `services/infra/cacheHeaders.ts` — header builder
- `services/infra/BatchLoader.ts` — DataLoader fold-in (C9 Phase 3)
- `services/infra/bootId.ts` — process-scoped UUID
