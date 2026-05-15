# System pages — checkout family

Phase 1.D (checkout-as-composable-page) registers 8 system pages on
the `SystemPageRegistry` (introduced in Phase 0b, wired in Phase 1.C).
Each page is identified by a stable `systemKey`; Mongo rows carry
`source: 'system-page'` plus the key.

## The 8 pages

| systemKey               | slug                       | accessGate         | Locked sections (in order) |
|-------------------------|----------------------------|--------------------|----------------------------|
| `cart`                  | `/cart`                    | `open`             | Breadcrumb · CartLineItems · CartSummary · CartActions |
| `checkout-address`      | `/checkout/address`        | `open`             | CheckoutProgressBar · CheckoutAddressForm · CheckoutCartSummary |
| `checkout-shipping`     | `/checkout/shipping`       | `open`             | CheckoutProgressBar · CheckoutShippingMethod · CheckoutCartSummary |
| `checkout-payment`      | `/checkout/payment`        | `open`             | CheckoutProgressBar · CheckoutPaymentForm · PlaceOrderButton · CheckoutCartSummary |
| `checkout-confirmation` | `/checkout/confirmation`   | `open`             | OrderSummary · MagicLinkAccountUpgrade |
| `order-by-token`        | `/orders/[token]`          | `guest-token`      | OrderSummary · MagicLinkAccountUpgrade |
| `account-dashboard`     | `/account`                 | `customer-session` | AccountWelcome |
| `magic-link-verify`     | `/account/verify`          | `open`             | AccountWelcome |

## Locked-section semantics (recap)

`ISection.locked = true` plus `lockReason` (a literal or i18n key) makes
a section system-managed:

- **Storefront:** invisible — renders like any other section.
- **Admin:** delete control hidden; a `<LockedSectionAffordance>` shows
  the `lockReason` as a tooltip.
- **MCP `systemPages.update`:** the guard rejects with
  `{code: 'SECTION_LOCKED', missing: [...]}` if a required locked
  section type is absent from the incoming payload.
- **MCP `section.delete` / `NavigationService.removeSectionItem`:**
  rejects with `SECTION_LOCKED` (Phase 0a guard).

Operators can re-order around locked sections and insert composable
modules (TrustBadges, MoneyBackGuarantee, ShippingCalculator,
DownloadInvoiceButton, ReferAFriendCta, SocialShareButtons) between
them.

## Bootstrap lifecycle

The Pages feature `onBoot` calls `systemPageRegistry.bootstrapAll(svc)`:

1. Missing row → create with `source: 'system-page'`, `systemKey`, and
   the registry's `defaultSections()`.
2. Existing + operator-edited → patch metadata only (slug if still
   registry-default). Sections are **not** touched.
3. Existing + un-edited + empty sections → corrupt-recovery refresh.
4. Existing + un-edited + populated → skip.

## MCP coverage

- `systemPages.list` — read every definition + Mongo state.
- `systemPages.bootstrap.status` — last `bootstrapAll` summary.
- `systemPages.definition.get { systemKey }` — single definition +
  default-sections snapshot.
- `systemPages.update { systemKey, sections }` — write; locked-section
  guard enforced.
- `systemPages.reset { systemKey }` — restore defaults (composable
  operator-added sections discarded).
- `systemPages.preview { systemKey, fixtureData? }` — server-render
  snapshot; no writes.

## Dispatch + editors (Phase 1.D-c)

The 6 checkout-family routes refactored in Phase 1.D
(`/cart`, `/checkout/address|shipping|payment|confirmation/[id]`,
`/orders/[token]`) ship a thin SSR loader + a single render path —
`<SystemPageDispatch>` walks `snapshot.defaultSections` and renders
each item's `Display` via `CLIENT_ITEM_TYPES`. The shim lives at
`ui/client/lib/systemPage/SystemPageDispatch.tsx` and is the public
counterpart to the admin-aware `<SectionContent>` host (no edit
overlays, no drag handles — just a grid wrapper per section).

Every dispatched route exposes
`data-testid="system-page-dispatch"` + `data-system-key="<key>"` so
e2e specs can assert the system-page contract.

The 18 checkout modules (`CartLineItems` … `SocialShareButtons`)
now ship bespoke typed editors under
`ui/admin/modules/_CheckoutPageModules/editors.tsx` (Phase 1.D-c)
— replacing the Phase 1.D `PlaceholderJsonEditor` wrappers. Each
editor is a small typed form (AntD `Input`, `Input.TextArea`,
constrained `Select` per `feedback_predefined_selections.md`) over
the module's content blob, persisted via the standard
`setContent(JSON.stringify(next))` channel. The exported names match
1:1 with the Phase 1.D wrappers so `adminItemTypeEditors.ts` did not
need updating.

## Cross-links

- `docs/architecture/system-pages.md` — registry pattern (Phase 0b).
- `docs/runbooks/checkout-page-composition.md` — operator how-to.
- `docs/roadmap/storefront/checkout-as-composable-page.md` — spec.
