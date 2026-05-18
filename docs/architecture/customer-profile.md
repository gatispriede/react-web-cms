# Customer profile schema (Phase 1.E)

> Companion to `docs/roadmap/storefront/client-account-settings-page.md`.

## Why a discriminator + embedded company sub-record

The customer population splits cleanly into two audiences with
different required fields:

- **`client`** (individual / B2C) — first/last name, optional DOB,
  one or more shipping addresses, optionally saved payment methods.
- **`company`** (business / B2B) — registered legal name, entity
  type, registration number, VAT id (validated via VIES), billing
  address separate from shipping, optional contact person.

Rather than carry every union field on the top-level `IUser`, the
discriminator (`customerType: 'client' | 'company'`) selects which
sub-record applies. `client`-only fields (`dateOfBirth`) sit on
`IUser` directly because they're already opt-in shaped; `company`
data is a single nested `ICompanyProfile` sub-record so the audit
diff for "company info changed" is one field.

Implicit `'client'` for legacy rows — no migration needed.

## VIES integration

`CustomerProfileService.verifyCompanyVat()` wraps the W8g
`ViesService` and caches the verdict on `company.viesVerified*`. Soft
fail (`null` result) when the upstream is unreachable; the
storefront surfaces a "pending verification" badge per the operator
runbook. Cache TTL is 24h — re-verify at checkout when stale.

## Payment methods

`IPaymentMethodRef` stores Stripe-tokenized refs only. The full PAN
+ CVV never crosses our wire; we hand off raw collection to the
provider's Elements / hosted page and persist only the opaque
`tokenizedId` + display surrogates (`last4`, expiry). The
default-method picker flips `isDefault: true` on exactly one row at
a time (service-side reconciliation in `setDefaultPaymentMethod()`).

## Address book

Shipping addresses live on `IUser.shippingAddresses[]` (already
present from W6c). Company billing address lives on
`company.billingAddress` — distinct from shipping so the registered
office can differ from the warehouse. The W8g VAT regime resolver
reads both: VAT is computed off the billing address; shipping
applies for delivery routing.

## Multi-user expansion path

Today: one `IUser` per company; `company` is an embedded
sub-record. The expansion path is:

1. Introduce an `ICompanyAccount` entity (separate collection).
2. Migrate `IUser.company` data into the new collection (one row
   per company).
3. `IUser` gains `companyAccountId?: string` and the embedded
   sub-record becomes a stale-data legacy field cleared by a one-time
   sweep.
4. Multiple `IUser` rows linking to one `ICompanyAccount` get
   per-user roles (`buyer` / `approver` / `admin`).

The current schema deliberately leaves room for step 3 — no field
collisions, no breaking renames.

## File map

- `shared/types/IUser.ts` — discriminator + back-references
- `shared/types/ICompanyProfile.ts` — company sub-record
- `shared/types/IPaymentMethodRef.ts` — payment-method ref
- `services/features/Customer/CustomerProfileService.ts` — CRUD +
  validation + VIES wrap
- `services/features/Customer/CustomerSettingsPage.ts` — system-page
  registration
- `services/features/Customer/customerFlags.ts` — `commerce.*` flags
- `services/features/Mcp/tools/accountSettings.ts` — MCP surface
- `ui/client/components/AccountSettings/*` — storefront forms
- `ui/client/pages/account/settings.tsx` — page renderer
- `ui/admin/features/CustomerAccountSettings/*` — operator pane
