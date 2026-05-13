# Auth stacks — design doc

**Status:** Live (auth-split-client-admin Phase 1.A, 2026-05).

## Two NextAuth instances

```
                   ┌─────────────────────────────┐
                   │       Browser cookies       │
                   │                             │
                   │  cms.admin-session          │ Path=/admin
                   │  cms.customer-session       │ Path=/
                   └─────────────────────────────┘
                            │             │
                ┌───────────┘             └────────────┐
                ▼                                      ▼
    /api/admin/auth/[...nextauth].ts        /api/auth/[...nextauth].ts
    │ providers:                             │ providers:
    │  - admin-credentials                   │  - customer-magic   (default ON)
    │  - admin-google (env-gated)            │  - customer-credentials (off by default)
    │ cookie path: /admin                    │  - customer-google / facebook / apple
    │ session.user.kind = 'admin'            │ session.user.kind = 'customer'
    │ + role, canPublishProduction           │ + customerType, notificationPrefsHash
    └──────────────────────────────────────────────────────────────┘
                │                                      │
                ▼                                      ▼
                                getServerSession(req, res, options)
                                in `services/features/Auth/authz.ts`
                                  → `resolveSessionFromReq()`
                                  → admin tried first, customer second
```

Both instances share the `Users` Mongo collection (single source of
truth — one row per human, `kind` discriminator splits admin from
customer). Provider authorize() bodies validate the kind so a
customer doc can't authenticate against the admin endpoint and vice
versa.

## Session-shape isolation

The JWT callback in each instance strips fields from the other kind:

- Admin JWT carries `id`, `email`, `name`, `kind: 'admin'`, `role`,
  `canPublishProduction`, `mustChangePassword`, `preferredAdminLocale`.
  Customer-only fields are explicitly `undefined`.
- Customer JWT carries `id`, `email`, `name`, `kind: 'customer'`,
  `customerType`, `notificationPrefsHash`. Admin-only fields are
  explicitly `undefined`.

This is defence in depth — the providers can't leak across kinds
through the standard path, and even if a malformed JWT shows up the
session callback strips it again.

## Cookie scoping

| Cookie | Path | Lifetime |
|---|---|---|
| `cms.admin-session` | `/admin` | 4h idle / 8h absolute (default) |
| `cms.customer-session` | `/` | 30-day rolling (default) |

Both cookies set `httpOnly`, `sameSite=lax`, `secure` in production.

## Master switch

`siteFlags.auth.clientLoginEnabled` (default `false`) — registered
via `defineFlag()` in `services/features/Auth/authFlags.ts`.

The edge middleware (`ui/client/middleware.ts`) consults the flag
via `/api/site/auth-flags` and caches the answer for 30s per worker.
When `false`, any request to `/account/*` is rewritten to `/404`.

## Per-provider sub-toggles

Six flags total — one master + five providers. Magic-link defaults
on (it's the W6c recommendation); every other provider defaults off
so the operator must explicitly enable each one. Each provider also
needs its env credentials (Google ID/secret, Facebook ID/secret,
Apple ID/secret) — the admin UI surfaces an `env: missing` badge and
disables the toggle until the env vars are set.

## Storefront UI gating

Components in `ui/client/components/Auth/` early-return `null` when
`clientLoginEnabled === false`. The flag is read client-side via the
`useAuthFlags()` hook (fetches `/api/site/auth-flags`, caches per-tab
in `sessionStorage`).

| Component | Mount point | Renders when off |
|---|---|---|
| `<CustomerAccountDropdown/>` | site header (right side of nav) | `null` |
| `<AccountLinks/>` | site footer | `null` |
| `<LoginCta/>` | checkout (above guest form) | `null` |
| `<SignupBanner/>` | `_app.tsx` (top of every page) | `null` |
| `<MagicLinkRequestForm/>` | embedded in `/account/signin`, etc | (page itself blocked by middleware) |

## MCP surface

| Tool | Scope | Idempotent |
|---|---|---|
| `auth.config.get` | `read:site` | n/a |
| `auth.config.set` | `write:site` | yes |
| `auth.providers.list` | `read:site` | n/a |
| `auth.session.invalidate` | `write:users` | no (bumps an epoch) |

## Session invalidation

`auth.session.invalidate` bumps a per-user `sessionEpoch` field on
the `Users` doc. The JWT callback stamps the issuing epoch into the
token at sign-in; the session callback rejects any token whose epoch
is below the current value. The next request after the bump forces a
re-sign-in.

Future work: write the JWT-side epoch comparison into the admin
session callback (currently the field is bumped but not yet read on
read-side — TODO). Customer sessions get the same behaviour when the
read-side check lands.

## Open follow-ups

- Two-factor on admin (TOTP / WebAuthn) — separate jump.
- Per-tenant SSO (SAML / Okta / Azure AD) — separate jump.
- Same email, both kinds — `(email, tenantId, kind)` triple primary
  key. Out of scope of Phase 1.A.

## See also

- `docs/runbooks/auth-stack-split.md` — operator runbook.
- `docs/roadmap/platform/auth-split-client-admin.md` — original spec.
- `docs/features/ecommerce/customer-auth.md` — W6c customer auth.
