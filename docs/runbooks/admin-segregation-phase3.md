# Admin segregation — Phase 3 cleanup

Phase 1 (additive routes) and Phase 2 (six-area top bar + jump routes + redirects) shipped earlier. This runbook covers Phase 3: deleting the legacy `/admin/settings` shell + sibling legacy routes after one or two release cycles confirm no live traffic.

## Where the legacy URLs live now

`next.config.js#redirects` already 307s these to their new homes:

| Legacy URL | Redirects to |
|------------|--------------|
| `/admin/settings` | `/admin/build` |
| `/admin/languages` | `/admin/content/translations` |
| `/admin/modules-preview` | `/admin/build/modules-preview` |

The underlying page files (`ui/client/pages/admin/settings.tsx`, `languages.tsx`, `modules-preview.tsx`) are kept around as fallbacks in case the redirect is ever bypassed (manual route table edit, third-party DNS-level rewrite, etc.).

## What this runbook adds

`ui/client/middleware.ts` runs at the edge for the three legacy paths and posts a `level: warn`, `scope: legacy-route` row to `/api/log/error` before the redirect fires. That gives us a dashboard-visible signal of who's still landing on the old URLs.

## Watch period

**Watch for one full release cycle** (≥ 7 days, ideally one or two cycles).

Inspect via the admin **Errors** panel (`/admin/release/errors`) filtered by `scope: legacy-route`. Look at:
- Total hits per day — ideally zero or trending to zero.
- `extra.referrer` distribution — if hits come from `null` or external sites, those are bookmarks. If they come from your own UI, find and fix the broken link first.
- `extra.userAgent` — botspam vs real users.

## Deletion checklist (after the watch period)

When daily hits are 0 (or only botspam) for a full cycle:

1. Delete `ui/client/middleware.ts` (or trim the matcher / route list if other middleware lands later).
2. Delete `ui/client/pages/admin/settings.tsx`.
3. Delete `ui/client/pages/admin/languages.tsx`.
4. Delete `ui/client/pages/admin/modules-preview.tsx`.
5. Remove the three legacy redirects from `ui/client/next.config.js#redirects`.
6. Delete `ui/admin/shell/AdminSettings.tsx` if no other code references it (`grep -rln AdminSettings ui/`).
7. Update `docs/ROADMAP.md` to mark admin-segregation Phase 3 shipped.
8. Update `docs/features/platform/admin-segregation.md` if it carries the Phase 3 plan.

## Re-entry

If a real user reports landing on a 404 after deletion, the fastest re-entry is restoring the redirects (the new routes still work):

```js
{source: '/admin/settings', destination: '/admin/build', permanent: false},
{source: '/admin/languages', destination: '/admin/content/translations', permanent: false},
{source: '/admin/modules-preview', destination: '/admin/build/modules-preview', permanent: false},
```

The page files don't need to be restored — Next will serve a 404 only if the redirect doesn't fire, and the redirect always fires when the entry is in `next.config.js`.
