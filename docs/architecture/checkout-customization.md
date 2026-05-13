# Architecture — Checkout customization (Phase 1.B-c)

Builds on Phase 1.D (`checkout-as-composable-page`) which registered
4 multi-step pages. 1.B-c adds a single-step default + payment-provider
adapters + per-customer-type field config + a `ShippingMethods`
collection.

## Layers

```
┌── client storefront /checkout ──────────────────────────────────┐
│  flow=single-step → SingleStepCheckout                          │
│  flow=multi-step  → redirect /checkout/address (Phase 1.D pages)│
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼ SSR reads commerce.checkout.* flags
┌── ShippingMethodService  ─── paymentRegistry ───────────────────┐
│  Mongo `ShippingMethods`     adapters: stripe / bank / COD      │
│  CRUD + audit + version      enabled = flag AND env             │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │
        MCP: checkout.config.* + checkout.shipping.* + checkout.providers.list
```

## Flag surface

All under `commerce.checkout.*`, `public-readable` so SSR can read them
without a roundtrip:

| Flag | Default | Notes |
|---|---|---|
| `flow` | `'single-step'` | dispatch shape |
| `requireAccount` | `false` | guests permitted by default |
| `fields` | per operator decision | `{client,company}` × `{phone,company,vatId,shippingNotes}` |
| `orderSummaryTemplate` | `'detailed'` | summary renderer hint |
| `postPurchaseRedirect` | `'magic-link-signup'` | confirmation target |
| `providers.stripe` | `true` | env-gated on `STRIPE_SECRET_KEY` |
| `providers.bankTransfer` | `true` | pure offline |
| `providers.cashOnDelivery` | `true` | pure offline |
| `providers.paypal` | `false` | defined, not wired |
| `providers.klarna` | `false` | defined, not wired |

## Payment adapters

Common port `IPaymentAdapter`:
```ts
{id, displayName, isEnabled({flagEnabled}), processPayment(input)}
```

Adapter outcomes feed `orderStatusAfter`:
- Stripe → `'paid'` or `'declined'`
- BankTransfer → `'pending-payment'`
- CashOnDelivery → `'pending-delivery'`

The single-step page renders the registry-derived list. Live Stripe
auth/capture continues to flow through the existing W8g primitives
(`authorizeOrderPayment` + `finalizeOrder`) — the adapter exists for
parity with offline providers.

## Shipping methods

`IShippingMethod` discriminator: `flat-rate | weight-based |
free-threshold | pickup`. The service stamps audit fields on every
write and bumps `version` for optimistic concurrency. Boot seeds one
"Standard delivery" row at flat-rate 0 EUR if collection is empty.

## System pages

Added: `checkout` (single-step). The 4 multi-step pages (`cart`,
`checkout-address`, `checkout-shipping`, `checkout-payment`) plus the
confirmation / order-by-token / account pages stay registered.
SystemPage bootstrap is operator-edit-preserving — flipping `flow`
doesn't destroy operator-composed trust modules between locked
sections.

## File map

- `services/features/Commerce/commerceFlags.ts` (extended)
- `services/features/Checkout/CheckoutSystemPages.ts` (+ `checkout` key)
- `services/features/Checkout/CheckoutFeatureLoader.ts` (wires service)
- `services/features/Checkout/ShippingMethodService.ts` (new)
- `services/features/Checkout/paymentAdapters/*.ts` (new)
- `services/features/Mcp/tools/checkout.ts` (new)
- `ui/admin/features/Checkout/Checkout{CustomizationPanel,CustomizationViewModel,CustomizationAdminUILoader}.{tsx,ts}` (new)
- `ui/client/pages/checkout/index.tsx` (refactored: flag-aware)
- `shared/types/IShippingMethod.ts` (new)
