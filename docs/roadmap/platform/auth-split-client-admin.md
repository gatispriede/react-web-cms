---
name: auth-split-client-admin
description: Split authentication into two cleanly-separated stacks — admin auth (operator, always-on) and customer auth (storefront, system-settings-gated). When the operator enables client-side login from system settings, additional UI elements (account header dropdown, account links in footer, login CTA in nav, signup banner, "my account" empty states) get added to the storefront automatically. No customer-auth surface area exists in the public site until the flag is on.
---

# Auth split — client vs admin + system-settings-gated storefront login surface

## Goal

Today auth is a single NextAuth pipeline with credentials + Google OAuth + the new `customer-magic` provider (W6c). Admin (operator) auth and customer (shopper) auth share session storage, login pages, and middleware logic. This item separates them:

- **Admin auth** — always-on; routes under `/admin/*`; only operators reach the admin shell. Provider list: credentials + Google OAuth + (optional) Facebook/Apple/SSO. Session shape carries `UserRole` + `canPublishProduction`.
- **Customer auth** — system-settings-gated; routes under `/account/*`; only renders for shoppers. Provider list: magic-link (default, W6c) + credentials (optional) + Google/Facebook/Apple OAuth (optional, per-provider toggles). Session shape carries `IUser.kind === 'customer'` + `customerVatId` + `businessBuyer` + per-tenant notification prefs.

Both stacks ship as **separable NextAuth instances** with disjoint cookie names, disjoint provider configs, disjoint session callbacks, and disjoint middleware. A single user CAN have both an admin and a customer record (different `IUser.kind`); the two sessions are independent.

Additionally, when the operator flips `siteFlags.clientLoginEnabled = true`, the storefront automatically grows a set of login-surface UI elements — account dropdown in header, account links in footer, login CTA, signup banner, "my orders" link, magic-link request form on order-by-token page. When the flag is off, **zero** customer-auth surface area is visible to the public site (no `/account/*` routes, no header dropdown, no banner) — the storefront looks like a no-auth site.

## Why now

- **Conceptual confusion is leaking into bugs.** W6c shipped `customer-magic` as a provider on the SAME NextAuth instance the admin shell uses. The session cookie is shared between admin and customer sessions. A customer signing in via magic link writes the same `next-auth.session-token` cookie that an admin sign-in uses. If both happen on the same browser, the most-recent session wins. This isn't hypothetical — operators developing locally have already hit it.
- **Operator wants the option to ship a no-customer-auth site.** Some customers run pure brochure / portfolio / single-tenant agency sites and don't want a login surface at all. Today the `/account/*` pages 404 only because the operator didn't link them — but they're publicly reachable and discoverable. A no-auth site should have **no** auth code paths visible to crawlers.
- **Different threat models.** Admin auth needs strong session controls (short TTL, IP pinning option, audit on every privileged op). Customer auth needs friction-minimal session (magic-link, long TTL, cross-device pre-fetch mitigation). Shared NextAuth config can't optimize for both.
- **Provider-list divergence.** Admin should never have magic-link (passwords + 2FA only). Customer should never have credentials by default (W6c spec). Sharing the provider list forces an awkward compromise.
- **Cookie scoping.** Admin cookies should be `Path=/admin` so storefront pages don't transmit them on every request. Customer cookies should be `Path=/account` for the same reason. Shared NextAuth instance defaults to `Path=/`.

## Design

### Two NextAuth instances

```
ui/client/pages/api/auth/[...nextauth].ts       — CUSTOMER auth
ui/client/pages/api/admin/auth/[...nextauth].ts — ADMIN auth (new path)
```

Each instance:

- **Disjoint provider list** (admin: credentials + Google + optional SSO; customer: magic-link + Google + Facebook + Apple, all toggleable per-tenant via `siteFlags`)
- **Disjoint cookie name** — admin: `cms.admin-session`, customer: `cms.customer-session`
- **Disjoint cookie path** — admin: `Path=/admin`, customer: `Path=/account` + `Path=/checkout` + `Path=/orders` (any path that needs the customer session)
- **Disjoint session callback** — admin enriches with `UserRole` + `canPublishProduction`; customer enriches with `kind` + `customerVatId` + `businessBuyer` + notification-prefs hash
- **Disjoint sign-in pages** — admin: `/admin/signin`, customer: `/account/signin`
- **Disjoint middleware** — `middleware.ts` already exists; gate `/admin/*` on admin session presence, gate `/account/*` (when flag on) on customer session presence

Shared infrastructure (still single source of truth):

- `IUser` collection — same Mongo collection, `kind` discriminator splits admin (`'admin' | 'editor' | 'viewer'`) from customer (`'customer'`)
- `CustomerAuthService` (already exists) — used by customer auth
- `AdminAuthService` (new — extract from current single NextAuth callbacks) — used by admin auth
- `secretBox.ts` for per-site OAuth secret encryption (W6c shipped this)

### `siteFlags.clientLoginEnabled` — the master switch

New field on `ISiteFlags`:

```ts
interface ISiteFlags {
    // ...
    clientLoginEnabled?: boolean;       // default false
    clientLoginProviders?: {
        magicLink?: boolean;            // default true (W6c default)
        credentials?: boolean;          // default false
        google?: boolean;               // default false
        facebook?: boolean;             // default false
        apple?: boolean;                // default false
    };
}
```

When `clientLoginEnabled === false`:

1. **Routes return 404** — Next.js middleware short-circuits `/account/*`, `/checkout/*` auth-gated paths, and `POST /api/auth/*` (customer subset) to a 404. Page files still exist on disk (they re-enable instantly when the flag flips on) but middleware blocks them.
2. **No header / footer / nav surface** — `<CustomerAccountDropdown>`, `<AccountLinks>`, `<LoginCta>`, `<SignupBanner>` all early-return `null` when the flag is off.
3. **No links in sitemap** — sitemap contributors (W8h) read the flag; account routes don't get contributed.
4. **No login bots reach the site** — robots.txt (W8h) adds `Disallow: /account/` when the flag is off (defense in depth).
5. **Order-by-token still works** — guest orders + receipt emails + the existing `orderToken`-gated `/orders/[token]` page remain available; they don't require auth.

When `clientLoginEnabled === true`:

1. **Routes serve 200** — `/account/{signup,signin,verify,reset,magic-link,index,orders,notifications,inbox,privacy}` all reachable
2. **Header gains `<CustomerAccountDropdown>`** — when unauthed: "Sign in" link; when authed: user's name + dropdown (My orders, My account, Sign out)
3. **Footer gains `<AccountLinks>`** — "Sign in / Create account" link in the auth column
4. **Checkout adds the "Sign in for faster checkout" prompt** above guest-checkout form
5. **Order receipt emails include the "Track your order in your account" upgrade-prompt section** (already shipped by W6a as a slot, just toggled visible)
6. **Sitemap + robots.txt unblock `/account/*`**

### Provider sub-toggles

Each customer provider has its own sub-flag. Operator can enable client login but only allow magic-link (recommended starting point per W6c research) and turn on Google later if they want OAuth speed.

Admin pane: new "Customer login" section under Site Settings. Predefined `<Switch>` per provider. Master toggle clearly labelled "**Allow customers to create accounts and sign in**". Tooltip: "When off, your site behaves like a brochure site with no login surface area. Guest checkout still works."

### Migration of W6c

W6c shipped customer auth on the shared NextAuth instance. This item:

1. Moves the `customer-magic` provider out of `[...nextauth].ts` into the new customer-instance config
2. Renames `IUser.kind === 'customer'` records' existing sessions during a one-time migration (or just expires them — magic-link makes re-auth trivial)
3. Updates `CustomerAuthService.issueMagicLinkToken` to mint tokens scoped to the customer NextAuth instance
4. Updates the customer pages (`/account/magic-link`, `/account/verify`) to POST to `/api/auth/*` (customer-scoped) — already correct path
5. Updates the admin pages to POST to `/api/admin/auth/*`

### MCP coverage

New tools:

- `auth.config.get` — reads `siteFlags.clientLoginEnabled` + `clientLoginProviders`
- `auth.config.set` — flips `clientLoginEnabled` or any sub-provider; revalidates affected routes via `site.revalidate` MCP. Audit-logged.
- `auth.providers.list` — enumerates enabled providers for both stacks (admin + customer)
- `auth.session.invalidate` — invalidates all sessions for one user (admin or customer) by `userId`. Already exists conceptually via `auth.resetLockouts` — extend to cover session invalidation cleanly.

### Storefront UI components (new)

Under `ui/client/components/Auth/` (new folder):

- `<CustomerAccountDropdown>` — renders in `<SiteHeader>` when flag is on. Two states: unauthed (sign-in link) + authed (avatar + dropdown menu with My orders, My account, Notification preferences, Privacy, Sign out)
- `<AccountLinks>` — renders in `<SiteFooter>` auth column when flag is on
- `<LoginCta>` — small "Have an account? Sign in" component for use in checkout + signup-driven pages
- `<SignupBanner>` — top-of-page promotional banner ("Create an account to track orders + get exclusive offers"). Operator-dismissable + sticky-dismissed via cookie
- `<MagicLinkRequestForm>` — already exists from W5.5b modules catalogue (currently lives in `/account/magic-link.tsx`); extract as a reusable component for embedding in order-by-token page

Each component reads `siteFlags.clientLoginEnabled` via the existing `siteFlags` SSR-injection path (`gqlFetch.ts` already threads `siteFlags` into `InitialPageData`). They early-return `null` when the flag is off so the bundle still ships but renders nothing.

### Per-theme styling

Each of the 8 first-class themes' header / footer / login screen needs to render the new components with the theme's accent + typography. Today the 3 placeholder themes (editorial / agency / commerce) have no login-specific styling. This item adds:

- `services/themes/<slug>/auth.scss` — per-theme overrides for login screens, account dashboard, signup banner. Default styles cascade from `theme.scss`; this file is the per-theme polish slot.

### Sign-in page experience

- Customer `/account/signin` — magic-link-first (primary CTA), password-second (under "More options"), OAuth providers third (icon row). Matches W6c spec.
- Admin `/admin/signin` — credentials-first (primary), OAuth providers second. No magic-link (operator threat model rejects passwordless for admin).
- Both pages support `?returnTo=` query param for post-login redirect.

### Session refresh + idle behavior

- Admin session: 4-hour idle timeout + 8-hour absolute max. Refresh on activity.
- Customer session: 30-day rolling. Refresh on activity. No idle timeout (magic-link auth makes re-auth cheap).
- Both: invalidate on password change (existing behavior) + invalidate on `auth.session.invalidate` MCP call.

## Files to touch

### New files

- `ui/client/pages/api/admin/auth/[...nextauth].ts` — admin NextAuth instance
- `services/features/Auth/AdminAuthService.ts` — extract admin-specific logic
- `ui/client/pages/admin/signin.tsx` — admin sign-in page (operator-targeted UX)
- `ui/client/components/Auth/CustomerAccountDropdown.tsx`
- `ui/client/components/Auth/AccountLinks.tsx`
- `ui/client/components/Auth/LoginCta.tsx`
- `ui/client/components/Auth/SignupBanner.tsx`
- `ui/client/components/Auth/MagicLinkRequestForm.tsx` (extracted from existing `/account/magic-link.tsx`)
- `services/themes/{editorial,agency,commerce}/auth.scss` — per-theme login styling slot (empty placeholders; design fill is per-theme jump)
- `services/features/Mcp/tools/auth.ts` — new MCP tools
- `docs/runbooks/auth-stack-split.md` — operator runbook covering the migration + how to enable / disable customer login

### Modified files

- `ui/client/pages/api/auth/[...nextauth].ts` — narrow to customer-only providers; rename cookie to `cms.customer-session`; set `Path=/account|/checkout|/orders`
- `ui/client/middleware.ts` — add `/account/*` 404 short-circuit when `clientLoginEnabled === false`; add `/admin/*` admin-session gate; cookie name changes propagated
- `services/features/Seo/SiteFlagsService.ts` — add `clientLoginEnabled` + `clientLoginProviders` to `ISiteFlags` with enum-clamping
- `ui/client/features/Header/SiteHeader.tsx` (or equivalent) — mount `<CustomerAccountDropdown>` conditionally
- `ui/client/features/Footer/SiteFooter.tsx` — mount `<AccountLinks>` conditionally
- `ui/client/pages/checkout/index.tsx` — mount `<LoginCta>` above guest form when flag on
- `ui/client/pages/_app.tsx` — mount `<SignupBanner>` conditionally (top of page, dismissable)
- `ui/client/lib/seo/SeoHead.tsx` — emit `noindex` on `/account/*` pages always
- `ui/client/pages/api/sitemap.xml.ts` — gate `/account/*` contributions on flag
- `ui/client/pages/robots.ts` — emit `Disallow: /account/` when flag is off
- `services/features/Mcp/tools/index.ts` — register `AUTH_TOOLS`
- `ui/admin/features/Site/CurrencySettings.tsx` (or new `LoginSettings.tsx`) — operator pane for the flag + sub-toggles
- `ui/admin/i18n/{en,lv}.json` — copy for the new admin pane + the storefront components
- `tests/e2e/auth/customer-login-disabled.spec.ts` (new) — flag-off → no `/account/*` reachable, no header dropdown, no footer links, no sitemap entries, no signup banner
- `tests/e2e/auth/customer-login-enabled.spec.ts` (new) — flag-on → header dropdown visible, sign-in flow works, footer links present, sitemap includes routes
- `tests/e2e/auth/admin-customer-isolation.spec.ts` (new) — sign in as customer, navigate to /admin, assert redirect to admin signin (not customer-authed admin shell)

## Acceptance

1. Admin NextAuth instance at `/api/admin/auth/*` issues `cms.admin-session` cookie with `Path=/admin`
2. Customer NextAuth instance at `/api/auth/*` issues `cms.customer-session` cookie with `Path=/account` + `/checkout` + `/orders`
3. Signing into admin doesn't grant customer session and vice versa (verified by e2e)
4. `siteFlags.clientLoginEnabled === false` (default) → `/account/*` returns 404 via middleware; no auth UI surface on storefront; sitemap omits routes; robots.txt disallows `/account/`
5. `siteFlags.clientLoginEnabled === true` → all `/account/*` routes serve; header dropdown + footer links render; sitemap includes routes
6. Per-provider sub-toggles work (e.g., flag on, only magic-link enabled → no password field on `/account/signin`, no OAuth buttons)
7. Admin signin page at `/admin/signin` uses credentials-first UX; customer signin page at `/account/signin` uses magic-link-first UX
8. MCP tools: `auth.config.get/set`, `auth.providers.list`, `auth.session.invalidate` all callable
9. Migration: existing W6c customer-magic tokens migrated or expired; no orphan sessions surfacing as bugs
10. 3 e2e specs (above) green
11. Operator runbook published with the migration steps + how to flip the flag

## Effort

**L · ~6-8 hours AI** + per-theme `auth.scss` fill (separate jump per theme).

Breakdown:
- Two NextAuth instances + cookie scoping + middleware split: ~1.5h
- `siteFlags.clientLoginEnabled` schema + admin pane + flag plumbing through SSR: ~1h
- 5 new storefront components + integration into header/footer/checkout: ~1.5h
- Admin signin page + customer signin page UX split: ~1h
- MCP tools + audit wiring: ~30min
- 3 e2e specs: ~1h
- Migration of W6c sessions + cookie-name flip + runbook: ~1h

## Dependencies

- W6c (signup + magic-link + attribution) — shipped this session. This item builds on top of it.
- W5 themes infrastructure — shipped. Per-theme `auth.scss` slot consumed.
- W8h SEO (sitemap contributors + robots.txt env-gating) — shipped. Account routes contributed conditionally.
- W8b GDPR — shipped. `/account/privacy` data-rights page rendered in dropdown only when flag on.

## Open questions

1. **Two-factor for admin?** Should admin signin offer TOTP / WebAuthn on top of credentials? Spec'd out of scope this jump (single follow-up item — "admin-2fa" — if operator wants it). Wave 8a accessibility audit will surface needs.
2. **Same email, both kinds?** A single email might legitimately have both an admin record and a customer record (operator's own account on their tenant + their personal customer account on a different tenant). Recommended: `IUser` keyed on `(email, tenantId, kind)` triple. Out of scope this jump; flagged for future tenancy work.
3. **Per-tenant admin SSO** (Okta / Azure AD)? Out of scope; SSO is its own roadmap item if a customer asks.

## Out of scope

- Two-factor auth on admin (see Open question 1 — separate jump)
- SSO (SAML / Okta / Azure AD) for admin (separate jump, customer-driven)
- Customer profile + address book editing UX polish (Wave 6c shipped basic; deeper UX is its own jump)
- Tenant-level admin user provisioning / off-boarding workflows (separate jump)
- Per-user notification override of the global `clientLoginEnabled` flag (intentionally not configurable — the flag is binary per site)

## Storefront UX details

### Header dropdown shape (when authed)

```
┌─────────────┐
│  Hi, Anna   │  ← user's display name (first name fallback to email-local)
├─────────────┤
│  My orders  │  ← /account/orders
│  My account │  ← /account
│  Notifications  ← /account/notifications
│  Privacy    │  ← /account/privacy
├─────────────┤
│  Sign out   │  ← POST /api/auth/signout
└─────────────┘
```

### Header dropdown shape (when unauthed, flag on)

Single button: "Sign in" → links to `/account/signin?returnTo=<current-path>`. No fly-out menu (avoid clutter on unauthed visits).

### Signup banner copy

> "Track your orders, save addresses, and get exclusive offers. [**Create account**] · [Sign in]"

Operator-editable. Dismissable via X button; dismissal persisted to `cookie_consent_banner_dismissed` cookie.

### Checkout LoginCta copy

Above guest-checkout form, only when flag on + user is unauthed:

> "**Have an account?** Sign in for faster checkout. [**Sign in**] · [Continue as guest ↓]"
