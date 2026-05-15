# F3 — namespace CMS URLs under `/v1/**` — CANCELLED 2026-05-03

> **Cancelled 2026-05-03.** Next.js Pages Router requires API routes at `pages/api/*` (file-system special case); moving them broke server/browser bundle isolation (Next treats relocated routes as React pages and bundles Mongo/Redis into the browser chunk). Without API freedom, the marginal benefit of moving `/admin/*` alone didn't justify the maintenance overhead — every internal callsite, redirect, OAuth callback, and runbook would still need rewriting for an asymmetric URL contract (admin under `/v1/`, API at root). The constraint analysis is recorded in [docs/PROJECT_ANALYSIS.md](../../PROJECT_ANALYSIS.md) under "Known framework constraints" so future readers don't re-derive it.
>
> **Outcome:** customer pages cannot use slugs `admin` or `api` (Pages Router file-system precedence). Migrating to App Router (`app/*/route.ts`) is the unlock if root-URL freedom ever becomes a hard customer requirement.

---

## Original goal (superseded by postmortem above)

Cancelled — see postmortem above.

## URL contract

Cancelled — see postmortem above. No URLs changed; everything stays at `/admin/*` and `/api/*`.

## Implementation

**Do not implement.** The F3 namespace move is not viable under Pages Router. If a future customer slug-collision incident forces the issue, the path forward is App Router migration, not another `/v1/` attempt.

## Acceptance

- ~~`/admin/build` returns 308 → `/v1/admin/build`~~ — cancelled.
- ~~`/api/health` returns 308 → `/v1/api/health`~~ — cancelled.
- ~~Customer slug `admin` resolves as the customer's page~~ — not achievable without App Router; documented as a known framework constraint.
- ~~Internal callsite sweep~~ — reverted.

## Risks / notes (historical)

The 2026-05-03 attempt landed the directory move and 308 redirects, then was reverted within a single working session when the bundle-isolation break surfaced. No production droplet ever ran the F3 build.
