# Runbook — Checkout customization (Phase 1.B-c)

Operator-facing setup for the checkout customization surface shipped in
Phase 1.B-c. Pairs with `docs/architecture/checkout-customization.md`.

## Admin pane

`/admin/client-config/checkout` — five cards:

1. **Flow** — `single-step` (default) or `multi-step`.
2. **Payment providers** — Stripe (env-gated on `STRIPE_SECRET_KEY`),
   BankTransfer, CashOnDelivery. PayPal + Klarna are defined as flags
   but not wired yet.
3. **Per-customer-type fields** — 8 selects (phone / company / vatId /
   shippingNotes × client / company), each `required` / `optional` /
   `hidden`. Defaults match operator decision:
   - client: phone optional, company/vatId hidden.
   - company: phone + company required, vatId optional.
4. **Summary + post-purchase** — `compact` vs `detailed` order summary;
   `magic-link-signup` (default) | `order-confirmation` |
   `custom-thank-you` redirect.
5. **Shipping methods** — CRUD + drag-active toggle.

## MCP surface

| Tool | Scope | Notes |
|---|---|---|
| `checkout.config.get` | read:site | Enumerates every `commerce.checkout.*` flag |
| `checkout.config.set` | write:site | Path must start with `commerce.checkout.` |
| `checkout.shipping.list` | read:site | Active + inactive |
| `checkout.shipping.create` | write:site | Audit-stamped |
| `checkout.shipping.update` | write:site | Optimistic version bump |
| `checkout.shipping.delete` | write:site | Hard delete |
| `checkout.shipping.reorder` | write:site | Pass ordered id list |
| `checkout.providers.list` | read:site | Debug "why isn't Stripe showing" |

## Switching flow

```
mcp checkout.config.set --path commerce.checkout.flow --value single-step
mcp site.publish
```

The single-step page lives at `/checkout`; multi-step routes through
`/checkout/{address,shipping,payment}` (kept as fallback). Switching
flow is hot — no rebuild required — but `site.publish` refreshes any
static caches.

## Enabling Stripe

1. Set `STRIPE_SECRET_KEY` in the runtime env.
2. Confirm `commerce.checkout.providers.stripe === true` (default on).
3. Restart the service. The provider list at `/checkout` will include
   the card option.

If Stripe still doesn't appear: `mcp checkout.providers.list` shows
`{enabled:false}` when env is missing — the flag alone isn't enough.

## Seeded shipping method

On first boot the `ShippingMethods` collection is empty; the loader
seeds one row: **Standard delivery — flat-rate 0 EUR**. Operators can
delete it after creating their own; the seed never re-runs against a
non-empty collection.

## Field config quick reference

```
client:  phone=optional company=hidden vatId=hidden shippingNotes=optional
company: phone=required company=required vatId=optional shippingNotes=optional
```

To force VAT id required for company customers:

```
mcp checkout.config.set --path commerce.checkout.fields \
  --value '{"client":{...},"company":{"phone":"required","company":"required","vatId":"required","shippingNotes":"optional"}}'
```
