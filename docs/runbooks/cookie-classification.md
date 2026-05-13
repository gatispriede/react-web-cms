# Cookie classification

Operator-facing inventory of every cookie the platform sets. Source of truth for the consent banner copy + per-cookie disclosure on `/privacy`.

Categories use the same enum the consent banner emits:

- `necessary` — required for the site to function; legally exempt from consent.
- `functional` — remembers user preferences (theme, currency, language).
- `analytics` — aggregate, anonymised usage stats (sampled).
- `marketing` — attribution + advertising effectiveness measurement.

## Cookie inventory

| Name | Category | Set by | Purpose | Retention | HttpOnly |
|---|---|---|---|---|---|
| `next-auth.session-token` | necessary | platform | Authenticated user session (admin + customer) | 30 days | yes |
| `next-auth.csrf-token` | necessary | platform | CSRF protection for next-auth flows | session | yes |
| `next-auth.callback-url` | necessary | platform | Post-signin redirect target | session | no |
| `cookie_consent` | necessary | platform | Stores the consent banner choice (mirror of `localStorage[cms.privacy.consent.v1]`) | ~13 months (395d) | no |
| `i18next` | functional | platform | Remembers UI language preference | 1 year | no |
| `attr_session_id` | marketing | platform | Marketing attribution session id (UTM + ref capture) | 90 days | no |
| `cart_id` | functional | platform | Anonymous cart correlation across SPA navigations | session | no |

## Local storage keys

(Mirrors of cookie state — same categories apply.)

| Key | Category | Purpose | Retention |
|---|---|---|---|
| `cms.privacy.consent.v1` | necessary | User's category-level consent record (source of truth) | until cleared |
| `cms.theme.preference` | functional | Theme override (dark/light) | until cleared |

## Default retention windows for personal-data collections

| Collection | TTL (days) | Override key |
|---|---|---|
| `AuditLog` | 395 (EU practice) | `SiteFlags.compliance.retentionDays.AuditLog` |
| `MarketingAttribution` | 395 | `SiteFlags.compliance.retentionDays.MarketingAttribution` |
| `Inquiries` | 395 | `SiteFlags.compliance.retentionDays.Inquiries` |
| `*.trash` collections | 1 (24h Mongo TTL) | env `TRASH_TTL_SECONDS` |
| `DeletionRequests` | 30 (grace window) | constant `DELETION_GRACE_DAYS` |

Defaults match the EU 13-month practice for analytics retention. The 24-hour trash TTL stays short because the legal grace window for `DeletionRequests` is tracked separately — the per-row data evaporates fast; the audit row stays visible to admin until the cron sweep flips it to `purged`.

## How to register a new cookie

1. Add a row above with name, category, purpose, retention, httpOnly flag.
2. If the cookie is anything other than `necessary`, gate its `Set-Cookie` site on `hasConsent('<category>')` from `@client/components/CookieConsent/consentStore`.
3. Bump `CONSENT_VERSION` if the cookie inventory changes materially — banner re-prompts.

## Signals honoured

- `navigator.doNotTrack === '1'` (legacy DNT) — banner suppressed, non-necessary categories default off.
- `navigator.globalPrivacyControl === true` (GPC) — same as above; legally binding in CA + several EU jurisdictions.

Detection lives in `ui/client/components/CookieConsent/consentStore.ts` (`isDoNotTrackOn`, `isGpcOn`).
