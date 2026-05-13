# Auth stack split — operator runbook

**Phase 1.A — `auth-split-client-admin`.** Splits the previously
shared NextAuth pipeline into two independent instances and adds an
operator-controlled gate for the storefront customer-login surface.

## What changed

- **Admin auth** now lives at `/api/admin/auth/*` with cookie
  `cms.admin-session` (`Path=/admin`).
- **Customer auth** stays at `/api/auth/*` with cookie
  `cms.customer-session`. Provider list narrowed to magic-link primary
  + optional credentials/Google/Facebook/Apple.
- **Master switch** — `siteFlags.auth.clientLoginEnabled` (default
  `false`). When off:
  - `/account/*` is rewritten to `/404` by edge middleware.
  - Header / footer / banner / login-CTA components self-suppress.
  - Sitemap omits account routes (already implicit — no contributors
    registered).
  - `robots.txt` continues to `Disallow: /account/` regardless.
- **Per-provider sub-toggles** — `auth.providerMagicLink` (default
  `true`), `auth.providerCredentials`, `auth.providerGoogle`,
  `auth.providerFacebook`, `auth.providerApple` (all default `false`).

## How to enable customer login

1. Open `/admin/system/auth` (Customer login pane).
2. Flip **"Allow customers to create accounts and sign in"** on.
3. Pick at least one provider sub-toggle. Magic-link is the
   recommended starting point — no extra env vars needed.
4. For Google / Facebook / Apple, set the matching env vars first
   (`AUTH_CUSTOMER_GOOGLE_ID`, `AUTH_FACEBOOK_ID`, `AUTH_APPLE_ID`,
   and their `_SECRET` siblings). The admin pane surfaces an
   `env: missing` badge when the env vars aren't set; the toggle
   stays disabled until they are.
5. Publish (the change takes effect within ~30s — the edge
   middleware caches the flag for one TTL window).

## How to disable customer login

Flip the master toggle off. The next page load on `/account/*`
returns 404 within ~30s. Active sessions are not force-revoked, but
operators can run `auth.session.invalidate` MCP per user, or wait for
the token to expire naturally.

## CLI / MCP equivalents

```
# Read current state + env-readiness
$ mcp call auth.config.get

# Flip the master switch
$ mcp call auth.config.set path=auth.clientLoginEnabled value=true

# Enable just magic-link
$ mcp call auth.config.set path=auth.providerMagicLink value=true

# Invalidate one user's sessions across both stacks
$ mcp call auth.session.invalidate userId=<IUser.id>

# Enumerate enabled providers for both stacks
$ mcp call auth.providers.list
```

## Migration from the pre-split build

Existing customer-magic sessions issued under the legacy shared
`next-auth.session-token` cookie do **not** survive the split — the
cookie name is different (`cms.customer-session`). Customers need to
re-sign-in. Magic-link makes this cheap: clicking "Sign in" emails a
new token in seconds.

Existing admin sessions also need re-sign-in for the same reason; the
operator(s) running the deploy should expect to log back in once.

## Cookie scoping rationale

- `cms.admin-session` is scoped to `Path=/admin` so storefront pages
  never transmit it. Customer sessions cannot read it (different
  cookie name + different path).
- `cms.customer-session` uses `Path=/` so the cookie is available on
  `/account`, `/checkout`, and `/orders` from the same handshake.
  Admin endpoints do not consult the customer cookie.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `/account/signin` returns 404 with the flag toggled on | Middleware flag cache stale (≤ 30s) | Wait one TTL window, or `mcp call site.revalidate` |
| Admin session looks signed-in on storefront | Should be impossible — admin cookie is `Path=/admin` | Hard-refresh; clear `cms.admin-session` |
| Customer can't sign in after a Google switch | Per-provider sub-toggle off, OR env vars not set | Toggle `auth.providerGoogle` on + verify env-readiness badge |

## Related docs

- `docs/architecture/auth-stacks.md` — design + sequence diagrams.
- `docs/roadmap/platform/auth-split-client-admin.md` — original spec.
- `docs/runbooks/admin-segregation-phase3.md` — pre-Phase-1.A admin
  URL migration.
