---
name: gdpr-privacy-consent
description: GDPR + EU EAA compliance pre-public-deploy — consent banner, DNT honour, data export / delete-my-account, PII redaction on ingested upstream data (ss.com seller phone / name), cookie classification + opt-out, data-retention policies.
research: see _meta/research-findings-2026-05-12.md §2 (attribution capture) for the standing deferral note; this item closes it.
---

# GDPR + EU EAA compliance — pre-public-deploy

> **Status (2026-05-14): consent / cookie / DNT-GPC slice SHIPPED.** The
> cookie consent banner (categorised opt-in), DNT + GPC signal honour, cookie
> classification registry, analytics/marketing capture gating, and a
> client-visible data-retention summary are live. The data-rights APIs
> (`data-export` / `delete`) + `/account/settings?tab=privacy` surface shipped
> separately. Still **flagged-for-operator**: server-side Mongo TTL indexes,
> `Users.privacy.consent` cross-device mirror, PII redaction middleware on
> ss.com upstream data, `/privacy` + `/privacy/cookies` + `/privacy/preferences`
> + `/terms` standalone pages, the `privacy_*` MCP tools, operator legal-copy
> editor, and the `cookie-coverage.mjs` CI script. See `shipped.md`.

## Goal

Bring the platform from **local POC scope** to **public-internet ready** on the privacy / consent / data-rights axis. Closes the standing deferral in [project_local_poc_scope](../../C:/Users/User/.claude/projects/D--Work-redis-node-js-cloud/memory/project_local_poc_scope.md).

Scope:

1. **Cookie consent banner** with categorised opt-in (strictly-necessary / functional / analytics / marketing) — TCF 2.2 compatible if/when ad-tech integrations land; minimal-mode for now.
2. **Do Not Track (DNT) honour** + Global Privacy Control (GPC) signal recognition.
3. **Data export ("download my data")** — customer one-click JSON export of every record keyed to their `userId` + `email`.
4. **Delete-my-account** flow — customer-initiated; cascades through `Users` + `Orders` (guest by email match) + `SavedSearches` + `Wishlist` + `Attribution` + `Audit` (anonymised, not deleted — audit trail integrity).
5. **PII redaction on upstream data** — ss.com seller phone / name written to `IProduct.attributes` get redacted post-ingest behind a consent gate (operator can flip per-listing or globally).
6. **Cookie classification + per-cookie disclosure** — every cookie the platform sets is registered + visible in a per-site privacy page.
7. **Data-retention policies** — Mongo TTLs on attribution sessions (90d), magic-link tokens (15min), email log (180d, no body content), anonymous-checkout receipts (7y for tax law, then trash).
8. **Privacy policy + ToS templates** — per-site editable, theme-styled, served at `/privacy` + `/terms`.

## Why now

- **EU EAA legally required from 2025** for any public-facing service with EU users.
- **GDPR** binding since 2018; risk increases sharply when you start collecting customer accounts + attribution data (both shipping in Wave 6).
- The platform's first real production site (Latvia → EU jurisdiction) makes this non-optional.
- Cheaper to bake in alongside the storefront program than retrofit.

## Design

### Cookie consent banner

`ui/client/features/PrivacyBanner/` (new). Component shape:

- **Banner** appears on first visit; hidden once consent recorded
- **Choice surface:** Strictly-necessary (always on, no toggle) / Functional (default on) / Analytics (default off in EU, on elsewhere) / Marketing (default off everywhere)
- **Two CTAs:** "Accept all" + "Manage preferences" — never a single-button dark-pattern accept
- **Preference center** at `/privacy/preferences` — full per-cookie list with descriptions + per-category opt-in toggle + revoke-all

Consent recorded in:
- `localStorage` keyed `cms.privacy.consent.v1` (the user-facing source)
- Mirror to `Users.privacy.consent` if customer is authed (cross-device sync)
- TCF 2.2 string format if/when ad-tech lands (placeholder for now)

Re-prompt cadence: 13 months (GDPR consent expiry). Or whenever the cookie list changes materially.

### DNT + GPC

```ts
// ui/client/lib/privacy/signals.ts
export function isDoNotTrackOn(): boolean {
    return navigator.doNotTrack === '1'
        || (window as any).doNotTrack === '1'
        || (navigator as any).msDoNotTrack === '1';
}

export function isGpcOn(): boolean {
    return (navigator as any).globalPrivacyControl === true;
}

export function defaultConsentForJurisdiction(jurisdiction: 'EU' | 'US' | 'OTHER'): ConsentState {
    if (isDoNotTrackOn() || isGpcOn()) return MIN_CONSENT;
    if (jurisdiction === 'EU') return EU_DEFAULT_CONSENT; // analytics off, marketing off
    return US_DEFAULT_CONSENT;
}
```

GPC has legal force in California and certain EU jurisdictions; honouring it preemptively is the safer default.

### Data export

`/account/privacy/export` — customer clicks → background job collects all records keyed to `userId + email + orderToken history`:

- `Users` doc (own)
- `Orders` where `customerId === self || guestEmail === self.email`
- `SavedSearches` where `customerId === self`
- `Wishlist` items where `customerId === self`
- `Attribution` events tied to userId or anonymised session id
- `EmailLog` entries by recipient hash
- `Inquiries` by email match

Output: signed download URL, 7-day expiry, single use. Email notification with download link.

Backend: `CustomerPrivacyService.exportData(userId)` returns a JSON manifest. Reuses the existing Bundle export framework's compression + signed-URL machinery.

### Delete-my-account

`/account/settings/privacy → Delete account` — destructive button at bottom, password / magic-link re-confirm, 7-day cool-off email ("you have 7 days to undo"), then cascade:

- `Users` doc — hard delete OR anonymise (operator choice; default anonymise so audit trail stays referentially intact)
- `Orders` — keep records but anonymise (`customerId = null`, `guestEmail = 'deleted@deleted'`, `shippingAddress` cleared)
- `SavedSearches`, `Wishlist`, `Attribution` events — hard delete
- `EmailLog` — already only stores recipient hash, no body; recipient hash hashed again with a per-user salt that's destroyed
- `Inquiries` — anonymise (`fromEmail = 'deleted@deleted'`)
- `Audit` — anonymise the actor field; never hard-delete (audit integrity)

Backend: `CustomerPrivacyService.requestDelete(userId, confirmationToken)` writes a `deletion_pending` flag + schedules the cascade in 7 days via existing scheduled-task infra. Customer can `cancelDelete` within the window.

Operator-side equivalent at `/admin/customers/[id]/delete` for support-mediated deletion (requires `permissions.tier === 'Full'` on Customers scope).

### PII redaction on ss.com data

ss.com listings carry seller phone + name in plaintext. Two consent gates:

1. **Site-wide flag** `siteFlags.ssComPiiHandling: 'show' | 'redact-until-reservation' | 'never-show'`. Default for public-internet deploy: `'redact-until-reservation'`.
2. **Per-listing override** in the admin product editor.

When `redact-until-reservation`:
- Public listing page shows "Contact via our messaging" CTA (no phone, no name)
- After deposit reservation is paid, customer's `/account/orders/<id>` page reveals the seller contact
- Seller is notified once their listing has a paying reserver

Implementation: a `redactPii(attributes)` middleware on the product display query that strips `seller_phone` / `seller_name` / `seller_email` keys based on site flag + viewer auth state.

### Cookie classification

`shared/types/ICookieRegistry.ts`:

```ts
type CookieCategory = 'strictly-necessary' | 'functional' | 'analytics' | 'marketing';

interface ICookieEntry {
    name: string;
    setBy: string;            // 'platform' | '<integration>'
    category: CookieCategory;
    description: string;
    expiry: string;           // 'session' | '1y' | '13m' | etc.
    domain?: string;
    httpOnly: boolean;
}

export const COOKIE_REGISTRY: ICookieEntry[] = [
    {name: 'next-auth.session-token', setBy: 'platform', category: 'strictly-necessary', description: 'Authenticated session', expiry: '30d', httpOnly: true},
    {name: 'attr_session_id', setBy: 'platform', category: 'analytics', description: 'Marketing attribution', expiry: '90d', httpOnly: false},
    {name: 'cms.privacy.consent.v1', setBy: 'platform', category: 'strictly-necessary', description: 'Stores your cookie preferences', expiry: '13m', httpOnly: false},
    // …per cookie set anywhere in the codebase
];
```

`/privacy/cookies` page renders this registry as a table. CI script scans the codebase for `Set-Cookie` headers + `document.cookie` writes and fails if any cookie isn't registered.

### Data-retention TTLs

Mongo TTL indexes ensure short-lived data evaporates:

| Collection | TTL | Notes |
|---|---|---|
| `AttributionSessions` | 90 days | Anonymous attribution evaporates if no signup |
| `MagicLinkTokens` | 15 min | Auth tokens |
| `EmailLog` | 180 days | Audit trail; recipient hash only |
| `Orders.trash` | 7 years | Tax-law retention; then hard purge |
| `Users.trash` (post-delete) | 7 days | Cool-off window, then hard delete |

Audit log + Order records persist longer (regulatory); customer-identifying fields anonymised after delete-request settles.

### Privacy policy + ToS pages

`/privacy` + `/terms` — themed, editable. Default template provided per [storefront-receipt-emails](storefront-receipt-emails.md)-style approach: TypeScript template module with operator-overridable copy.

Operator pane at `/admin/system/legal` to edit per-site. Diff history kept (legal docs change → audit trail visible).

## Files to touch

- `services/features/Privacy/PrivacyService.ts` (new)
- `services/features/Privacy/PrivacyServiceLoader.ts` (new)
- `services/features/Privacy/cookieRegistry.ts` (new — single source of truth for every cookie)
- `services/features/Privacy/dataExport.ts` (new — composes per-user export)
- `services/features/Privacy/dataDelete.ts` (new — cascade delete + anonymisation)
- `services/features/Privacy/piiRedaction.ts` (new — middleware for upstream data)
- `services/features/Privacy/feature.manifest.ts` (new)
- `shared/types/ICookieRegistry.ts` (new)
- `shared/types/IUser.ts` — add `privacy: {consent, consentVersion, consentAt}` + `deletionPending?: {requestedAt, scheduledFor}`
- `ui/client/features/PrivacyBanner/PrivacyBanner.tsx` (new)
- `ui/client/features/PrivacyBanner/ConsentModal.tsx` (new)
- `ui/client/features/PrivacyBanner/PrivacyBannerViewModel.ts`
- `ui/client/pages/privacy/index.tsx` (new — privacy policy)
- `ui/client/pages/privacy/cookies.tsx` (new — cookie list)
- `ui/client/pages/privacy/preferences.tsx` (new — manage consent)
- `ui/client/pages/terms/index.tsx` (new)
- `ui/client/lib/privacy/signals.ts` (new) — DNT/GPC detection
- `ui/admin/features/Privacy/PrivacyAdminUILoader.ts` (new)
- `ui/admin/features/Privacy/Privacy.tsx` (new — operator pane for retention rules + per-customer view)
- `ui/admin/features/Privacy/LegalEditor.tsx` (new — edit /privacy + /terms content)
- `services/features/Mcp/tools/privacy.ts` (new — `privacy_exportUserData`, `privacy_deleteUser`, `privacy_setSiteFlag`, `privacy_listCookies`, `privacy_setRetention`)
- `tools/scripts/cookie-coverage.mjs` (new — CI script: every cookie set in the codebase must be registered)
- Tests: data export round-trip, delete cascade, PII redaction middleware, DNT honour, consent storage cross-device sync

## Starter code

PII redaction middleware:

```ts
// services/features/Privacy/piiRedaction.ts
import type {IProduct} from '@interfaces/IProduct';

const PII_KEYS = new Set(['seller_phone', 'seller_name', 'seller_email']);

export function redactProductPii(
    product: IProduct,
    viewer: {role: 'visitor' | 'customer' | 'operator'; ownsOrder?: boolean},
    siteFlag: 'show' | 'redact-until-reservation' | 'never-show',
): IProduct {
    if (siteFlag === 'show') return product;
    if (siteFlag === 'never-show' || viewer.role === 'visitor') {
        return {...product, attributes: stripKeys(product.attributes, PII_KEYS)};
    }
    if (siteFlag === 'redact-until-reservation' && viewer.role === 'customer' && !viewer.ownsOrder) {
        return {...product, attributes: stripKeys(product.attributes, PII_KEYS)};
    }
    return product;
}

function stripKeys(attrs: Record<string, string>, keys: Set<string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(attrs)) if (!keys.has(k)) out[k] = v;
    return out;
}
```

## Acceptance

1. **[SHIPPED]** First public visit shows consent banner with 4 categories + Accept All + Manage Preferences (never a dark-pattern single button) — `ui/client/features/Consent/ConsentBanner.tsx`
2. **[SHIPPED]** DNT or GPC signal flips analytics + marketing categories to off pre-emptively — `privacySignalActive()` in `ui/client/lib/consent.ts`; banner self-suppresses + writes `MIN_CONSENT`
3. **[SHIPPED separately]** `/account/privacy/export` triggers async export — data-export API pre-exists (`ui/client/pages/api/account/data-export.ts`)
4. **[SHIPPED separately]** `/account/settings/privacy → Delete` — delete API pre-exists (`ui/client/pages/api/account/delete.ts`)
5. **[FLAGGED]** ss.com seller phone + name redacted in public view — PII redaction middleware not yet built
6. **[FLAGGED]** `/privacy`, `/privacy/cookies`, `/privacy/preferences`, `/terms` standalone themed pages — not yet built (registry + retention data exist in `lib/consent.ts` ready to render)
7. **[FLAGGED]** CI script fails if a new cookie is set without registering it — `cookie-coverage.mjs` not yet built; `COOKIE_REGISTRY` is the manual source of truth
8. **[FLAGGED]** Mongo TTL indexes in place — server-side; `DATA_RETENTION_RULES` documents the intended TTLs client-side
9. **[FLAGGED]** MCP coverage: `privacy_*` tools — not yet built (consent state is client-local; no admin-authored surface yet)
10. **[FLAGGED]** Operator can edit legal copy + diff history audit-tracked — not yet built

### Shipped this slice — implementation notes

- `ui/client/lib/consent.ts` — canonical lib: `ConsentRecord` model, `COOKIE_REGISTRY` classification, `isDoNotTrackOn()` / `isGpcOn()` / `privacySignalActive()`, `readConsent` / `persistConsent` / `hasConsent`, `onConsentChange` change bus, `DATA_RETENTION_RULES`. Storage: `localStorage['cms.privacy.consent.v1']` + `cookie_consent` mirror cookie (13-month max-age).
- `ui/client/features/Consent/ConsentBanner.tsx` + `ConsentPreferences.tsx` — banner with categorised opt-in, "Accept all" / "Manage preferences" / "Reject all" + per-category toggles; `data-testid` on every button (`consent-banner-accept` / `-manage` / `-save` / `-reject`, `consent-preferences-toggle-{cat}`). Mounted globally in `ui/client/pages/_app.tsx`.
- `ui/client/lib/marketingCapture.ts` — `captureMarketingHit()` gated on `hasConsent('marketing')`; re-runs off the consent change bus if marketing consent is granted later.
- `ui/client/lib/analytics/track.ts` — `privacyOptOut()` now folds through `hasConsent('analytics')` (single gate; DNT/GPC included).
- Note: `ui/client/components/CookieConsent/` is the earlier partial — no longer globally mounted, still imported by `components/Account/DataRightsForm.tsx` + `app/providers.tsx`; shares the same storage keys so records are mutually readable. Consolidate when those call sites are touched.

## Effort

**XL · ~3-4 days AI** distributed as 4 sub-jumps if needed:

- Consent banner + DNT/GPC + cookie registry + `/privacy/*` pages: ~8h AI
- Data export pipeline + email delivery + signed URL: ~6h AI
- Delete-my-account cascade + cool-off + audit anonymisation: ~6h AI
- PII redaction middleware + operator pane: ~4h AI
- Retention TTL indexes + scheduled cleanup + tests: ~4h AI

## Dependencies

- [client-signup-and-anonymous-checkout](client-signup-and-anonymous-checkout.md) — customers exist; account routes exist; magic-link-confirm pattern available for delete-confirm
- [ss-com-cars-integration](ss-com-cars-integration.md) — PII redaction has a real consumer
- Existing Bundle export framework (compression + signed URL helpers)
- Existing scheduled-task infrastructure (cool-off cascade)
- Existing Audit feature (operator action tracking)

## Open questions

- **[OPERATOR DECISION]** Cool-off window — 7 days (recommended) or 30 days? Recommend: 7 days, matches Carvana's pre-order pattern.
- **[OPERATOR DECISION]** Hard-delete vs anonymise default — anonymise (recommended) preserves audit + analytics integrity; hard-delete is more user-friendly. Recommend: anonymise as the system default; operator-mediated hard-delete available on request via support.
- **[OPERATOR DECISION]** TCF 2.2 compatibility — implement now (stub) or defer until ad-tech integration lands? Recommend: defer; minimal-mode consent banner is enough today.

## Out of scope

- Right to portability via standardised data formats beyond JSON (DTSv2, GPDR-specific schemas) — JSON satisfies GDPR Article 20
- Data Subject Access Request (DSAR) intake portal beyond `/account/privacy/export` — operator handles edge cases via existing inquiry flow
- Cross-border data transfer impact assessments (Schrems II) — separate item if cloud-provider region changes
- HIPAA / SOC 2 / ISO 27001 — out of scope until a customer requires
- Children's privacy (COPPA / GDPR-K) — out of scope; site is not directed at children
