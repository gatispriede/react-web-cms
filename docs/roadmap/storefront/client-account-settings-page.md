---
name: client-account-settings-page
description: Customer-side account settings surface (separate from admin) at `/account/settings` with typical settings (profile, password, addresses, payment methods, notification preferences, privacy / data rights, language) PLUS support for two customer account types — `client` (individual / B2C) and `company` (business / B2B with company name, VAT ID, billing-vs-shipping address split, optional multi-user). The settings page itself is a composable system page (extends checkout-as-composable-page pattern), so operators can add custom sections — branding, support contact, promo offers, GDPR consent management — around the locked settings forms. Pairs with auth-split-client-admin (separate auth stack), W8f notification preferences, W8b GDPR, W8g multi-currency VAT-regime, W6c signup.
---

# Client account settings page — separate from admin, dual account type

## Goal

Today customer-facing settings are scattered across multiple stub pages: `/account/notifications` (W8f), `/account/privacy` (W8b GDPR data rights), `/account/addresses` (W6c addresses CRUD), `/account/profile` (W6c basic profile). Operators have no unified settings surface, and the schema doesn't distinguish between an individual customer and a business / B2B customer.

This item ships **two paired deliverables**:

1. **Unified `/account/settings` settings page** — a single page that aggregates every customer-side setting under tab navigation (Profile, Security, Addresses, Payment methods, Notifications, Privacy, Language). Operator-composable around the locked settings forms (extends the checkout-as-composable-page system-page pattern). Cleanly separated from admin (`/admin/settings`) — different routes, different auth stack (auth-split-client-admin), different theme styling.

2. **`IUser.customerType: 'client' | 'company'` discriminator** — the customer record can declare it represents an individual (`client` — first/last name, single address, personal VAT) OR a business (`company` — registered name + legal entity type + company VAT ID + billing address ≠ shipping address + optional multi-user roster). Each type has its own settings sub-form. Signup (W6c) gains a type picker (defaults to `client` per research — less friction). Checkout (product-module-and-checkout-customization `fields.{company,vatId}`) honors the type to auto-fill business fields.

The customer settings system is **mirror-symmetric** with the admin settings system but lives at completely separate routes, with separate auth, separate theming, and separate i18n. The two never share a settings UI surface even when an operator-user also has a customer account on the same site (a legitimate dual-role scenario — operator buying from their own storefront for testing).

## Why now

- **Customer settings are landed but scattered.** W6c shipped signup + profile + addresses. W8f shipped notifications. W8b shipped privacy / data rights. Each lives at its own URL with its own page chrome. Users don't have a single "manage my account" surface. Industry baseline (Shopify, Stripe, GitHub, Notion) is one settings dashboard with tabs.
- **B2B is a real market.** The W7b cars-vertical surfaced `IOrder.businessBuyer: boolean` + `customerVatId`. The Multi-currency W8g VAT regime resolver assumes B2B/B2C is a per-order decision. But there's no **customer-level** business mode — every B2B customer manually enters their VAT every checkout. A `company`-typed customer should have VAT + billing address persisted to their profile so checkout pre-fills.
- **Mirror-symmetric to admin settings is the right model.** Admin settings at `/admin/settings` already exist for operators (theme, language, dark-mode, role, MFA-readiness, etc.). Customer settings at `/account/settings` mirror that surface for shoppers, but with a different audience, different cookie scope (auth-split-client-admin), and different visual chrome (storefront theme, not admin chrome).
- **Operators want to brand the settings page.** The settings page is a high-trust surface — customers landing on `/account/settings` are managing their relationship with the brand. Operators want to compose around the locked forms: add a "Get help" support widget, surface their loyalty program enrollment, promote referrals (W6c attribution hook), display recent orders preview. The composable-system-page pattern (checkout-as-composable-page) is the right precedent.
- **Pairs with auth-split-client-admin in the active queue.** That item splits the auth backend; this item builds the corresponding customer-facing settings UI on top of the customer auth stack.

## Design

### `/account/settings` as a system page

Reuses the system-page framework from checkout-as-composable-page:

- `IPage.source = 'system-page'`
- `systemPageKey: 'account-settings'`
- Has **N locked required sections** — each settings sub-form is locked
- Operator can add composable sections around them — branding hero, support contact, promo offers, related products (Product mode=related), referral CTA

Default layout:

1. **AccountSettingsHero** *(locked, optional)* — "Settings for {name}" header + breadcrumb
2. **AccountSettingsNav** *(locked, required)* — tab navigation (Profile / Security / Addresses / Payment / Notifications / Privacy / Language)
3. **AccountSettingsForm** *(locked, required, dispatches by tab)* — renders the active tab's form
4. **AccountSettingsSupport** (optional, operator-added) — "Need help? Contact support"
5. RelatedProducts (optional, operator-added) — `Product mode=related` based on order history

The form sub-renderer at step 3 dispatches:

- `?tab=profile` → `<ProfileSettingsForm>` — name, email, language preference; per `customerType` switches between individual (firstName + lastName) vs company (companyName + legalEntityType + registrationNumber)
- `?tab=security` → `<SecuritySettingsForm>` — password change (when credentials auth enabled per auth-split-client-admin), magic-link request log, active sessions list with revoke
- `?tab=addresses` → `<AddressesForm>` — CRUD address book; for `company` type, separate billing-address vs shipping-address sections
- `?tab=payment` → `<PaymentMethodsForm>` — saved cards (when Stripe enabled per W8g) + default-method picker
- `?tab=notifications` → reuse W8f `<NotificationPreferencesForm>` (already shipped)
- `?tab=privacy` → reuse W8b `<DataRightsForm>` (already shipped — export + delete)
- `?tab=language` → `<LanguageSettingsForm>` — preferred site language + email language

### `IUser.customerType` discriminator

```ts
interface IUser {
    // ...existing fields
    kind: 'admin' | 'editor' | 'viewer' | 'customer';
    customerType?: 'client' | 'company'; // present only when kind === 'customer'
    customer?: ICustomerProfile;
}

interface ICustomerProfile {
    // Common (both types)
    email: string;
    phone?: string;
    preferredLanguage: string;        // ISO code
    preferredCurrency?: string;       // W8g

    // Client-type only
    client?: {
        firstName: string;
        lastName: string;
        dateOfBirth?: string;         // optional, marketing-segmentation use
    };

    // Company-type only
    company?: {
        legalName: string;
        legalEntityType: 'sole-prop' | 'llc' | 'plc' | 'gmbh' | 'sa' | 'inc' | 'other';
        registrationNumber: string;
        vatId?: string;                // canonical EU VAT format; validated via W8g VIES
        viesVerified?: boolean;       // last VIES validation status; cached
        contactPerson?: { firstName: string; lastName: string; role?: string };
        billingAddress?: IAddress;    // can differ from shipping
        // Future: multi-user support — multiple `IUser` records linked to one company
        // companyAccountId?: string;
    };

    addresses: IAddress[];             // 0+ shipping addresses
    defaultShippingAddressId?: string;
    paymentMethods: IPaymentMethod[];  // 0+ saved cards (Stripe-tokenized; never raw card data)
    defaultPaymentMethodId?: string;
}
```

Predefined enums everywhere. `legalEntityType` is a constrained Select. `viesVerified` cached for 24h (W8g ViesService).

### Type switcher

`/account/settings?tab=profile` shows a type picker (Radio) at top: "I am an individual" vs "I am buying for a business". Defaults to `client` per W6c research (lower friction).

Switching types is allowed but flagged:

- `client → company` — operator-friendly transition; existing addresses kept; new company fields revealed
- `company → client` — confirmation modal ("This will hide your company information. Your business addresses will be archived. Continue?"); audit-logged

On signup (W6c), the type defaults to `client`; signup form gets an optional "I'm buying for a business" toggle that flips to `company` and reveals the company fields. Most signups stay `client` per research.

### Multi-user under one company (deferred)

For full B2B parity (Procurement scenarios where one company has 5 buyers, each with their own login but one shared billing account), we'd need:

- `ICompanyAccount` separate from `IUser` — represents the business entity
- N `IUser` rows can link to one `ICompanyAccount`
- Permissions per linked user (buyer / approver / admin)
- Shared address book, shared payment methods, shared billing

This is its own roadmap item. This jump ships **single-user per company** (one `IUser` per company, `IUser.company` embedded). Multi-user is flagged as a future expansion path; the schema allows it (`ICompanyAccount` can be added later without breaking single-user companies).

### Checkout integration

When a `company`-type customer reaches checkout:

- Address form pre-fills with `customer.company.billingAddress` (billing) and `customer.addresses[defaultShippingAddressId]` (shipping)
- VAT field pre-fills with `customer.company.vatId`; show `viesVerified` badge if cached recently
- W8g VAT regime resolver receives `businessBuyer: true` + `customerVatId` → handles reverse-charge correctly
- Receipt email (W6a) includes business-recipient block (company name + VAT ID + registration number)

When a `client`-type customer reaches checkout:

- Standard flow; no company fields revealed unless operator explicitly enables them via product-module-and-checkout-customization `checkout.fields.{company,vatId}: 'optional'`

### Auth-split-client-admin integration

- `/account/settings` lives entirely on the customer auth stack (`cms.customer-session` cookie, `Path=/account`)
- Admin operators visiting `/account/settings` are NOT auto-treated as customers — they see a normal customer signin page
- Customer signed-in users visiting `/admin/settings` get redirected to `/account/settings` (clear separation of concerns)
- Audit-log differentiates by which auth stack served the session

### Theming + chrome

- Settings page uses the storefront's active first-class theme (W5)
- Admin theme + dark-mode preferences (existing) NOT applied
- Per-theme `auth.scss` slot (from auth-split-client-admin) extended to cover account settings styling
- Customer can pick light/dark theme preference via `?tab=language` (renamed `Appearance` if dark-mode picker added) — currently scoped to language only

### Sitemap + SEO

- `/account/settings` and all sub-tabs are `noindex,nofollow` (W8h indexability gate)
- Excluded from sitemap (system-page exclusion from checkout-as-composable-page)

### Operator pane

New `ui/admin/features/CustomerAccountSettings/CustomerAccountSettingsPanel.tsx`:

- Toggle: "Enable customer account settings page" (mostly defaults to on when `clientLoginEnabled` is on per auth-split-client-admin)
- Per-tab toggles: hide specific tabs an operator doesn't want exposed (e.g., hide "Payment methods" if checkout isn't enabled)
- Default `customerType` at signup: `'client'` (recommended) | `'company'` | `'ask'` (force user to pick at signup)
- Composable-section management: same UX as checkout system pages (lock-icon + reset-to-default)

### MCP coverage

New tools (match F8-bulk-introspection shape):

- `accountSettings.get { userId }` — read a customer's settings (admin-only)
- `accountSettings.update { userId, fields[] }` — update customer settings (audit-logged; respects per-field validation)
- `customer.type.set { userId, type }` — flip individual ↔ company; rejects when type-specific required fields missing
- `customer.list { filterByType?: 'client' | 'company' }` — list customers by type (extends existing `user.list` introspection flag)
- `customer.company.viesRefresh { userId }` — re-run VIES check for a company customer (W8g hook)

### Storefront UI components (new)

Under `ui/client/components/AccountSettings/`:

- `<AccountSettingsLayout>` — page shell with tab nav + content area
- `<AccountSettingsNav>` — tab buttons with active-state indicator
- `<ProfileSettingsForm>` — dispatches between client + company sub-forms
- `<ProfileClientForm>` — first/last name + DOB
- `<ProfileCompanyForm>` — legal entity fields + VAT (with VIES verify button) + contact person
- `<SecuritySettingsForm>` — password + magic-link history + sessions
- `<AddressesForm>` — CRUD address book; for company type, billing/shipping toggle
- `<PaymentMethodsForm>` — Stripe-tokenized saved cards (default picker + delete)
- `<LanguageSettingsForm>` — language preference Select + email-language Select

Reuse from W8b/W8f:
- `<NotificationPreferencesForm>` (W8f shipped)
- `<DataRightsForm>` (W8b shipped) — export + delete

Each component has testids on every interactive surface (testid-CI gate).

## Files to touch

### New files

- `shared/types/ICustomerProfile.ts` — full profile shape
- `shared/types/IAddress.ts` (if not already standardized) — canonical address
- `shared/types/IPaymentMethod.ts` (if not already standardized) — tokenized payment-method ref
- `services/features/Customer/CustomerProfileService.ts` — CRUD + validation per type
- `services/features/Customer/ViesIntegration.ts` — wraps W8g `ViesService` for company VAT verify
- `services/features/Mcp/tools/accountSettings.ts`
- `ui/client/pages/account/settings.tsx` (loads `account-settings` system page; renders tab-active form)
- `ui/client/components/AccountSettings/` (all components above)
- `ui/admin/features/CustomerAccountSettings/CustomerAccountSettingsPanel.tsx` + ViewModel + AdminUILoader
- `tests/e2e/account/settings-tabs.spec.ts` — happy path: each tab loads, form save persists, type-switch confirmation modal works
- `tests/e2e/account/company-type-checkout.spec.ts` — switch to company type, checkout pre-fills VAT + billing address, W8g reverse-charge applies
- `docs/runbooks/customer-account-types.md` — operator runbook on per-tenant default type + per-tab toggles

### Modified files

- `shared/types/IUser.ts` — add `customerType` + `customer: ICustomerProfile` (when `kind === 'customer'`)
- `services/features/CustomerAuth/CustomerAuthService.ts` — `signup()` accepts optional `type` param; defaults to `'client'`
- `ui/client/pages/account/signup.tsx` — add type toggle at signup (optional, defaults to client)
- `ui/client/pages/checkout/address.tsx` (or system page when checkout-as-composable-page lands) — pre-fill from customer profile per type
- `services/features/Mcp/tools/index.ts` — register `ACCOUNT_SETTINGS_TOOLS`
- `services/features/Pages/SystemPageRegistry.ts` — add `account-settings` system page definition (depends on checkout-as-composable-page)
- `ui/admin/lib/loaders/adminUILoaderRegistry.ts` — register `CustomerAccountSettingsPanel`
- `services/themes/{editorial,agency,commerce}/auth.scss` — extend to cover settings page styling
- `ui/admin/i18n/{en,lv}.json` — copy for admin pane
- `ui/client/i18n/{en,lv}.json` (if exists; else inline) — settings labels, type names, validation messages

## Acceptance

1. `IUser.customerType: 'client' | 'company'` discriminator landed; backward-compatible with existing customer records (default `client` for legacy data)
2. `/account/settings` loads as a system page with the default layout; 6 tabs render (Profile / Security / Addresses / Payment / Notifications / Privacy / Language)
3. Type switcher works both directions; `company → client` shows confirmation modal; transitions audit-logged
4. Company-type customer's checkout pre-fills VAT + billing address; W8g reverse-charge applies correctly; VIES badge shown
5. Signup gains optional "I'm buying for a business" toggle; default stays `'client'`
6. Operator pane lets operator hide specific tabs (e.g., Payment tab when checkout disabled per product-module-and-checkout-customization)
7. Operator can compose around locked sections same way as checkout pages (TrustBadges, support contact, related products)
8. Auth-split clean: `/account/settings` is customer-stack only; admin operators get customer-signin page; customer users redirected away from `/admin/settings`
9. MCP tools (`accountSettings.get/update`, `customer.type.set`, `customer.list { filterByType }`, `customer.company.viesRefresh`) all callable
10. SEO: noindex; sitemap excluded
11. 2 e2e specs green
12. Per-tenant default customer type configurable: `'client'` / `'company'` / `'ask'`
13. Runbook published: how operators configure account types + which tabs to expose

## Effort

**L · ~4-6 hours AI** (assumes checkout-as-composable-page and auth-split-client-admin have shipped):

- `IUser.customerType` schema + migration: ~30 min
- `account-settings` system page definition + first-boot migration: ~30 min
- 8 new components (settings layout + 7 forms): ~2-3 h
- Type switcher logic + confirmation modal + audit logging: ~30 min
- Signup type toggle: ~15 min
- Checkout pre-fill from company profile: ~30 min
- VIES re-verify button + cached badge: ~30 min
- Operator pane: ~45 min
- MCP tools (5): ~30 min
- 2 e2e specs: ~30 min
- i18n + runbook: ~30 min

If checkout-as-composable-page hasn't shipped yet, add ~1-2 h for the system-page registration scaffolding.

## Dependencies

**Hard (active queue, must land first):**

- auth-split-client-admin — separate customer auth stack
- checkout-as-composable-page — system-page framework with locked-section UX
- product-module-and-checkout-customization — `checkout.fields.{company, vatId}` config that this item integrates with

**Soft (already shipped):**

- W6c signup + magic-link — extends signup form with type toggle
- W6c addresses CRUD — `<AddressesForm>` reuses existing component
- W8b GDPR data rights — `<DataRightsForm>` already shipped
- W8f notification preferences — `<NotificationPreferencesForm>` already shipped
- W8g multi-currency + tax — `ViesService` + VAT regime resolver consumed by company-type customers
- W5 themes infrastructure — per-theme `auth.scss` slot extended to cover settings

## Open questions

1. **Multi-user under one company.** Out of scope for this jump (single-user companies only). Flagged for follow-up roadmap item if a B2B customer asks. Schema designed to allow future expansion via `ICompanyAccount`.
2. **Company VAT verification UX.** VIES is unreliable (frequent downtime). Recommended: show optimistic "Pending verification" badge when VIES is down; re-check daily. Don't block company signup on VAT verification.
3. **Tax-ID formats for non-EU companies.** EU VAT format is enforced; US EIN / Canadian BN / UK Companies House number are different. Recommended: ship EU-only this jump; non-EU tax-ID support is a follow-up if a customer asks. `customer.company.vatId` field shape is generic enough to accept any string; only EU format triggers VIES.
4. **Currency preference scope.** Today `preferredCurrency` is per-customer. Some operators may want per-order override (customer paid in EUR last time, paying in USD this time). Recommended: per-customer default with per-cart override (existing W8g `<CurrencySwitcher>` already supports this).

## Out of scope

- Multi-user under one company (separate jump)
- Tax-ID formats beyond EU VAT
- 2FA / MFA for customers (admin gets 2FA in a separate jump per auth-split-client-admin open questions)
- Customer impersonation by admin (operator-as-customer for debugging) — separate jump
- Customer-facing analytics dashboard ("Your spending this year")
- Loyalty / rewards point ledger
