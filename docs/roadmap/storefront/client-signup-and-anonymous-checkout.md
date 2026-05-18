---
name: client-signup-and-anonymous-checkout
description: Delayed account creation as the only checkout default. Magic-link primary + password optional + Google OAuth equal-prominence. Mixpanel-shaped first-touch + last-touch attribution. Cross-device pre-fetch mitigation for magic-link.
research: see research-findings-2026-05-12.md §2 Auth + checkout UX
---

# Public signup + marketing attribution + anonymous checkout

## Status — SHIPPED 2026-05-14 (W6c)

Verification + gap-close pass. All three spec-flagged gaps were already closed by prior work; this pass confirmed each end-to-end.

| Item | Disposition | Notes |
|---|---|---|
| Magic-link cross-device pre-fetch mitigation | **shipped** | `account/verify.tsx` renders a click-to-confirm page on GET and only redeems via an explicit `signIn('customer-magic')` POST — email-client pre-fetchers can't burn the token. `CustomerAuthService.issueMagicLinkToken/redeemMagicLinkToken`: 15-min TTL, single-use via atomic `findOneAndUpdate({consumedAt:null,expiresAt:{$gt:now}})`, sha256-hashed at rest, per-email 5/hour + per-IP 10/min rate limits, generic no-enumeration response. **Deviation from spec letter:** token hash is stored in a Mongo `CustomerMagicTokens` collection (TTL index `expireAfterSeconds:0` + unique `tokenHash` index) rather than Redis. Functionally equivalent — hashed at rest, auto-swept, single-use — and avoids a second datastore dependency on the auth path. Treated as gap-closed. |
| Delayed account creation as the only checkout default | **shipped** | `/checkout` flows straight into the form — no "sign in or guest" choice screen exists (grep-confirmed). Email is captured in the step-1 contact block. `createDraftOrder` writes the guest path (`guestEmail` + `orderToken`, `customerId` implicit-null). The receipt page (`/checkout/confirmation/[id]`) renders the `MagicLinkAccountUpgrade` module as a **locked** default section of the `checkout-confirmation` system page — the one-click "save these details" account-upgrade card. |
| first-touch / last-touch UTM attribution | **shipped** | `IUser.firstTouchUtm` (immutable — only set when absent) + `IUser.lastTouchUtm` (always overwritten) in `shared/types/IUser.ts`. `MarketingAttributionService.attachToUser` does the anonymous→identified merge; `marketingCapture.ts` (`captureMarketingHit` + `attachMarketingSessionToUser`) drives client capture. Wired into both the password-signup path and the magic-link verify path (`account/verify.tsx` reads the fresh session userId and forwards `attr_session_id`). |

**Follow-up — 2026-05-16:** `/account/signin` themed-form polish. `MagicLinkRequestForm` was originally raw `<form>/<input>/<button>` (deliberately dep-free) which rendered unstyled when the storefront embedded it on `/account/signin`. Rebuilt on AntD `Form / Input / Button / Result`; signin page wrapped in `<ConfigProvider theme={staticTheme}>` so the embedded form picks up the storefront theme. See [shipped.md 2026-05-16 `/account/signin` styling](../shipped.md).

**Deferred / operator decisions (carried, not blocking this item):**
- `report()` per-key **order** counts are stubbed `0` pending `OrderService` stamping `sessionId` on guest orders (see `MarketingAttributionService.report` TODO). Operator/product decision on whether order-attribution joins on `sessionId` or on `guestEmail`.
- Redis-vs-Mongo magic-token store — see deviation note above. If an operator wants strict Redis-at-rest, it's a one-file swap in `CustomerAuthServiceLoader`.
- `marketingCapture.ts` consent-gating (GPC/DNT) is intentionally **out of scope** — owned by the Consent agent (`ui/client/features/Consent/*`). Per local-POC scope, deferred to pre-public-deploy.

The remaining body below is the original plan, kept for archaeology.

## Goal

Customer auth **partially exists** today — `IUser.kind = 'customer'` is wired, `CustomerAuthService.signUpCustomer / addCustomerFromGoogle` ship, `IOrder.guestEmail / orderToken` exist, Cart + Checkout are public features, NextAuth `CredentialsProvider` + `GoogleProvider` are configured. What's missing:

1. **Public `/account/*` UX** — pages on top of existing `CustomerAuthService` primitives.
2. **Magic-link auth** — net-new, not implemented anywhere today. NextAuth `EmailProvider` → existing `EmailService`. 10-15 min TTL, single-use, Redis-stored hash, **cross-device pre-fetch mitigation** (per the research finding — email clients on mobile pre-fetch links and burn tokens).
3. **Delayed account creation as the only checkout default** — research-binding decision. **No "sign in or guest" choice screen.** Buyer completes as guest; account upgrade is a one-click checkbox on the receipt page ("Save these details for next time — just set a password"). **Forced account creation = 26% of cart abandonment** (Baymard).
4. **Mixpanel-shaped attribution** — `firstTouchUtm` (immutable) + `lastTouchUtm` (overwritten) on user record + UTM as event property on every conversion event. Anonymous → identified merge on signup.

## Why now

- [ss.com cars integration](ss-com-cars-integration.md) hits a brick wall without one of these. A car buyer won't tolerate "create an account first." Anonymous checkout is the unblocker.
- Marketing wants to run campaigns the moment there's a public site to send traffic to. Attributable signup links need to ship with public signup; bolting attribution on later means we lose the data from launch-month campaigns.
- Existing User model + grants engine already handle the auth primitives; the missing piece is a **public-facing** role + the routes/UI to use it. Plumbing is mostly there.

## Architecture

### Reuse existing `IUser.kind = 'customer'` discriminator

**Already exists** — `shared/types/IUser.ts` carries `kind: 'admin' | 'customer'`. `role` ('viewer' | 'editor' | 'admin') is admin-side only. Customers are identified by `kind === 'customer'` + carry no `role`.

Don't invent a new "customer rank." Instead, ensure:
- Every public auth path writes `kind: 'customer'` on the user record (existing `CustomerAuthService.signUpCustomer` already does this — verify the OAuth path too)
- Authorization layer rejects `kind: 'customer'` users from any admin route (NextAuth admin form already rejects them at sign-in — verify the pattern is consistent across all admin-side guards)
- Customer-side authorization is presence + ownership only: read your own user record, update your own profile, read your own orders, place orders. No grants engine involvement.

### Routes

Public client gets new routes (registered via `<Feature>ClientUILoader.publicRoutes` — auto-gated through the existing `withFeatureGate` machinery):

- `/account/signup` — form (email + password OR magic link OR OAuth, depending on which methods are enabled per site flag)
- `/account/login`
- `/account/forgot`
- `/account/reset/[token]`
- `/account/verify/[token]` — email verification landing
- `/account` — profile + order history
- `/account/orders/[id]` — single order detail
- `/checkout` — accepts both authed + guest

Existing public-side gating works because every route runs through the same gate composition; the gate just permits everyone for these specific paths.

### Auth methods — feature-flagged per site

A new site flag `authMethods` (multi-select):
- `magicLink` — **primary, NET-NEW.** NextAuth `EmailProvider` wired to existing `EmailService`. 10-15 min TTL, single-use, hashed at rest in Redis. Cross-device mitigation: token lands on a "Click to sign in" confirmation page (don't auto-consume). Coarse-fingerprint binding (IP /24 + device class + cookie set when link was requested). Resend cooldown 60s. Generic "if this email is registered, we sent a link" — no enumeration.
- `password` (email + password) — **already exists.** Bcrypt via `CustomerAuthService.signUpCustomer`. Optional, **not the default** per the research finding (Notion 2019: removing passwords dropped account takeover 89%).
- `oauthGoogle` — **already exists.** NextAuth `GoogleProvider` + `addCustomerFromGoogle()`. Reuses `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` env.
- `oauthApple` — NET-NEW. **Required equal-prominence on iOS** if any other social login is offered (App Store rules). Skip on Android / desktop unless operator wants it.
- `oauthFacebook` — NET-NEW. Off by default; only enable for site categories where Facebook is the dominant identity (events, communities).

**Default site flag value:** `['magicLink', 'oauthGoogle']` — the minimum that works. Password + Apple + Facebook are opt-in.

**OAuth button order** (per Google + Apple branding rules):
- iOS: Apple → Google → Facebook
- Web/Android: Google → Apple → Facebook
- Re-order by returning-user history when known (place last-used provider first).

**Account-linking on conflict** (binding pattern from research): if user signs up with Google, then later tries email/magic-link with the same address, **link automatically** after email-ownership proof (clicking the magic link is the proof). Don't create duplicates. Surface "You signed up with Google — continue with Google?" rather than failing silently.

OAuth client secret storage reuses `services/infra/secretBox.ts` — same shape as `EmailService` SMTP-password handling.

### Marketing attribution — Mixpanel-shape

Steal the Mixpanel model (research-validated as the right level of granularity vs GA4's session-scoped approach):

```ts
// shared/types/IUser.ts — extension
interface IUserAttribution {
    /** First touch — immutable after first set. Used for the user-profile-level "where did this customer come from" view. */
    firstTouchUtm?: {
        source?: string;
        medium?: string;
        campaign?: string;
        term?: string;
        content?: string;
        referrer?: string;          // raw HTTP Referer OR our named referrer slug
        landingPath?: string;
        capturedAt: string;
    };
    /** Last touch — overwritten on every new attributed visit. Used for the order-level "what brought them back for this order" view. */
    lastTouchUtm?: typeof firstTouchUtm;
}
```

Additionally, **UTM is written as event properties on every conversion event** (signup, order placed, reservation made) so multi-touch attribution can be reconstructed retroactively. Events go through the existing `AnalyticsService`.

#### Capture flow

1. Visitor lands with UTM params. A cookie `attr_session_id` (UUID, 90-day expiry) keys an in-memory + Mongo-backed `AttributionSessions` collection storing the latest UTM tuple.
2. On signup or login (anonymous → identified transition), `mergeAttributionToUser(attrSessionId, userId)` copies:
    - `firstTouchUtm` only if absent on user record (immutable after set)
    - `lastTouchUtm` always overwrites
    - Event log retroactively rewrites the anonymous events to the now-known userId
3. Every subsequent conversion event reads the active session's UTM, updates `lastTouchUtm`, writes UTM as event property.

#### `MarketingReferrer` table

NET-NEW. Operator-managed list of named referrers for clean reporting:

```ts
interface IMarketingReferrer {
    slug: string;            // 'influencer-X', 'newsletter-issue-42'
    name: string;            // human label for admin reports
    notes?: string;
    createdBy: string;
    createdAt: string;
}
```

Signup URL: `?ref=influencer-X` → captured as `referrer: 'influencer-X'`. If `ref` matches a known slug, joined to the name for reporting; if not, captured raw + flagged for operator triage.

#### Admin attribution pane

`/admin/marketing/attribution` (new):

- Signups by campaign (last 30 / 90 / all)
- First-order conversion rate per first-touch source
- Last-touch source breakdown for orders this period
- Top referrer slugs + their conversion
- Drill-down to per-user view (which user, when signed up, what first-touch, what they bought)

#### Standing scope decision

Attribution capture is **cookie-based** until signup, then persisted on the user record. (Local POC scope per [project_local_poc_scope](../../C:/Users/User/.claude/projects/D--Work-redis-node-js-cloud/memory/project_local_poc_scope.md) — consent banner / DNT not required; revisit before public-internet deploy.)

### Anonymous checkout — the only default checkout

**Research-binding decisions:**

1. **No "sign in or guest" choice screen.** Buyer flows straight into checkout. Account creation is a one-click checkbox on the receipt page ("Save these details for next time — just set a password"). Forced choice = 26% abandonment.
2. **Email captured at step 1 of checkout** (within the contact block, not isolated). Unlocks cart-abandonment recovery (Dropbox's classic 40%+ signup-from-abandonment lift).
3. **Field order:** name → email → address → payment. Single-column. Accordion-style progressive disclosure. "Same as shipping" pre-checked on billing. Auto-detect city/state from postcode where available.

`/checkout` **already exists** as a public feature and `IOrder` **already carries** `customerId? + guestEmail? + orderToken?`. The work:

- Default the flow to guest path
- Order writes with `customerId: null + guestEmail: <input> + orderToken: <uuid>` — guest-vs-customer is implicit
- Receipt email (`orderConfirmation` template — see [storefront-receipt-emails](storefront-receipt-emails.md)) carries:
  - Visual progress timeline (Ordered → Confirmed → Scheduling → Delivered) — research finding: **biggest anxiety reducer for high-AOV**
  - Order summary + dated next-step milestones
  - **One** focused CTA (View order)
  - "Save these details — just pick a password" upgrade card if guest

#### Guest order detail by token

`/orders/<token>` — presence-only auth, no account, no session. Bearer of the token sees just that one order. Rate-limited lookup (5 requests/min/IP), token is ≥128-bit random.

#### Guest → customer upgrade (one-click)

Two upgrade triggers (per research):

1. **From receipt email** — "Save my details" link → magic-link sent to the same email → click → land on `/account/finalize?orderToken=<x>` → password optional + first-touch UTM merged → customer record created with prior guest orders auto-attached by email match.
2. **Same email signs up later** — at signup, scan guest orders by email; attach to the new user record after email verification.

Both paths idempotent. Same email can only ever own one customer record.

Guest orders + customer orders share the same Mongo collection; the only difference is `customerId === null`. Refunds / fulfilment / audit work identically.

### Account dashboard — flat hierarchy

Baymard research finding: customers are **task-oriented and infrequent** — they don't learn your nav. Flat beats nested. Max 5-6 cards on dashboard home.

Layout (binding):

```
┌─────────────────────────────────────────────────┐
│  Welcome back, {firstName}                       │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │  Recent order — #1042 — Verifying        │    │
│  │  €200 deposit on 2018 Audi A4 — Reserved │    │
│  │  → View details                          │    │
│  └─────────────────────────────────────────┘    │
│                                                  │
│  ┌────────────┐ ┌────────────┐ ┌─────────────┐  │
│  │  Orders    │ │  Profile   │ │  Addresses  │  │
│  │  6         │ │  edit      │ │  2          │  │
│  └────────────┘ └────────────┘ └─────────────┘  │
│                                                  │
│  ┌────────────┐ ┌────────────┐ ┌─────────────┐  │
│  │  Wishlist  │ │  Searches  │ │  Settings   │  │
│  │  3         │ │  2 active  │ │             │  │
│  └────────────┘ └────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────┘
```

Settings sub-tree:

- Profile (name + email + phone + password change + magic-link toggle)
- Addresses (CRUD list)
- Payment methods (when Stripe Customer is wired)
- Notification preferences (email opt-in for receipts / alerts / marketing)
- Privacy
  - Download my data (JSON export, deferred to pre-public-deploy)
  - **Delete account** — bottom of settings, destructive styling, password re-entry to confirm. Findable but not prominent.

Routes:
- `/account` — dashboard home (6 cards)
- `/account/orders` — full order history with reorder buttons
- `/account/orders/[id]` — single order detail
- `/account/profile`, `/account/addresses`, `/account/payments`, `/account/searches`, `/account/wishlist`, `/account/settings`, `/account/settings/privacy`

### Upgrade path: guest → customer

Two upgrade triggers:
- **Same email signs up later** — at signup time, scan guest orders by email; if matches found, attach them to the new user record after email verification.
- **From receipt email** — one-click "save my details" link generates a customer account preloaded with the data already entered, sends a magic link to log in.

Both paths idempotent; same email can only ever own one customer record.

### Security notes (research-validated)

- **Magic-link tokens**: single-use, **10-15 min TTL** (research consensus), CSPRNG-generated, hashed at rest in Redis. Rate-limited per email (5/hour), invalidated on use. Coarse fingerprint binding (IP /24 + device class + cookie set when link was requested) — survives mobile/email-client switching better than strict IP.
- **Cross-device pre-fetch mitigation**: token lands on a "Click to sign in" confirmation page (don't auto-consume on GET). The first request only marks the token as "viewed"; consumption requires a POST from that page. Defeats email-client pre-fetchers burning tokens.
- **Resend cooldown 60s.** "Didn't get it?" link surfaces support email after 30s. Generic error: "If this email is registered, we sent a link" (no enumeration).
- **Password storage**: existing `CustomerAuthService` uses bcrypt; keep for now. **Future hardening:** migrate to argon2id with per-user salt + pepper from a dedicated `AUTH_PEPPER` env (rotation-independent of `SECRETBOX_KEY`). File as a follow-up.
- **Rate limiting**: signup, login, magic-link request, password reset — per-IP + per-email throttle. Reuse `auth_resetLockouts` MCP tool for ops escape hatch.
- **Email verification**: **NO** for guest checkout (the whole point is friction-free); **YES** for any customer-account-only feature (wishlist, saved searches, saved payment). Order placement allowed pre-verification.
- **OAuth callback URLs**: site-flag-derived per environment; never hardcoded.
- **Session cookies**: `httpOnly` + `secure` + `sameSite=lax`; rotated on privilege change. JWT (NextAuth default).
- **Account enumeration**: signup + reset form errors generic.
- **Order-token URLs**: ≥128 bits random; rate-limited (5/min/IP); presence-only auth.
- **Notion 2019 finding (informational):** removing passwords entirely dropped account takeover attempts **89%**. Magic-link primary, password optional is the security-aligned default.

### Loaders

- `AuthPublicServiceLoader` — services for signup / login / magic link / oauth / token issuance; SDL for `Mutation.signUp`, `Mutation.requestMagicLink`, `Query.me`, `Mutation.upgradeGuestToCustomer`
- `AuthPublicClientUILoader` — `publicRoutes` listed above + item types if any
- `AuthPublicAdminUILoader` — `/admin/marketing/attribution` + customer list pane + per-customer view (read-only; PII handling per GDPR)

### Theme integration

Every [first-class theme](first-class-themes.md) must style:
- Signup / login / magic-link request forms (designed in Stitch per theme)
- Account dashboard + order history
- Anonymous checkout flow (single-screen or stepped per theme)
- Email templates (receipt, magic link, verification, password reset) — theme-token-driven where the email client allows

Each theme owns its own auth/checkout frames in Stitch alongside the existing module frames.

## Files to touch

- `services/features/CustomerAuth/` (**already exists**) — extend with magic-link issue/redeem + attribution capture on signup. Don't create a parallel `AuthPublic` feature.
- `ui/client/pages/api/auth/authOptions.ts` (existing NextAuth config) — add `EmailProvider` (magic-link) wired to `EmailService`; add Facebook/Apple OAuth provider configs gated by `authMethods` site flag.
- `shared/types/IUser.ts` — extend with `attribution?: { utm?: {...}; referrer?: string; firstTouchAt?: Date; lastTouchAt?: Date }`. **Don't add `customerType`** — the existing `kind: 'admin' | 'customer'` discriminator already covers it.
- `shared/types/IOrder.ts` — **no schema change.** `customerId? + guestEmail? + orderToken?` already exist. Add the receipt-email template trigger to `OrderService` finalize path.
- `ui/client/features/CustomerAccount/` (new — pages + view models for `/account/*`) or extend the existing customer-side feature if one exists for the customer dashboard. Cover signup / login / verify / reset / magic-link / account / orders / order-by-token.
- `ui/client/features/Checkout/` (existing) — thread guest path through (most plumbing exists via `guestEmail` + `orderToken`); add the "save details" upgrade CTA on the post-checkout screen.
- `ui/admin/features/MarketingAttribution/` — attribution pane
- `ui/admin/features/Customers/` — customer list pane (separate from existing operator-Users pane)
- `services/features/Email/templates/` — receipt + magic link + verification + reset templates
- `services/features/Mcp/tools/marketing.ts` — `marketing_attribution_report`, `marketing_referrer_upsert`, `marketing_referrer_list`
- Per-theme: `ui/client/styles/Themes/<slug>/_auth.scss` + `_checkout.scss`
- Tests:
  - Service-level: signup, magic link issue + redeem, OAuth callback parsing, guest order placement, guest→customer upgrade, attribution capture
  - E2E: full public signup flow per theme; full anonymous checkout per theme; guest→customer upgrade via receipt
  - Dark-mode visual baselines for new public surfaces (pairs with [admin-dark-mode-audit](../admin/admin-dark-mode-audit.md) — the public-side equivalent)

## Acceptance

1. Public visitor can sign up + verify + log in via at least magic-link; password + OAuth opt-in via site flag.
2. Marketing-attribution links carry UTM + `ref` into the user record; admin pane shows campaign-level signup + first-order conversion.
3. Anonymous checkout completes without an account; buyer receives a magic-link receipt with order-token access.
4. Same email signing up later auto-claims their guest orders after verification.
5. One-click "save details" link from the receipt creates the customer account preloaded.
6. All auth endpoints rate-limited; tokens single-use + short-TTL; email enumeration protections in place.
7. Every first-class theme has Stitch-designed auth + checkout + account frames (desktop + mobile).
8. E2E: signup flow + anonymous-checkout flow + guest→customer upgrade are green against fixtures.

## Effort

**L — ~1-2 weeks.**

Rough split:
- AuthPublic service + customer role + magic-link primitives: ~2-3 days
- Public-side pages + view models (signup / login / account / verify / reset): ~2 days
- Anonymous checkout path: ~1-2 days (most of the work is in `Checkout` already; this just removes the auth requirement and threads `guestEmail` / `orderToken`)
- Marketing attribution capture + admin pane: ~1-2 days
- OAuth providers (each): ~half day per provider, if enabled
- Email templates: ~1 day
- Per-theme styling + Stitch frames: ~half day per theme (auth + checkout + account)
- E2E: ~1-2 days

## Dependencies + risks

- **Scope: local POC only.** GDPR (data export, delete-my-account, cookie-consent banner, DNT) is **out of scope** for this item. File as a pre-public-deploy blocker when the time comes; not relevant while everything runs on the dev machine.
- **[ss.com cars integration](ss-com-cars-integration.md)** is the primary consumer — coordinate so the deposit checkout flow accepts both paths from day 1.
- **[first-class themes](first-class-themes.md)** — auth/checkout surfaces are per-theme deliverables; co-design.
- **Email deliverability** — magic-link auth lives or dies by email delivery. The existing `mailConfig` Resend/SMTP work is the dependency; verify SPF/DKIM/DMARC are clean on the prod sites before shipping passwordless as the default.
- **Password recovery infrastructure** — only if password auth is enabled. If launch is magic-link only, defer.

## Open questions

1. **Default auth method** — magic-link only (recommended) or password + magic-link from day 1? Magic-link only is half the engineering and zero password-storage liability.
2. **Anonymous checkout email verification** — verify-then-pay or pay-then-receipt? Receipt path is friction-free but lets bad emails through. Recommended: pay-then-receipt, with bounce handling on the email service marking the order for operator follow-up.
3. **OAuth providers** — none / Google only / Google + Apple / full set? Each is per-site config; defer Apple/Facebook until a site asks.
4. **Customer self-service refund / cancel** — in scope for v1 or operator-mediated only? Probably operator-mediated for cars; self-service for low-AOV products.
5. **Loyalty / saved cars / wishlist** — out of scope for this item; file as a follow-up once signup ships.
6. **Two-factor** — out of scope for `customer` accounts; revisit when an operator asks.
