# Products

The **Products** pane (`/admin/ecommerce/products`) is part of the optional e-commerce feature pack. It's gated behind the `FEATURE_ECOMMERCE` plug-and-play toggle — off by default until you populate inventory and a checkout flow.

## Fields

- **SKU** — unique identifier.
- **Title**, **Description** — display copy.
- **Price** — minor units (cents); currency from Site flags.
- **Images** — ordered array of `api/` paths.
- **Tags**, **Category** — for filtering.
- **Inventory** — managed in the **Inventory** pane (separate; products reference inventory by SKU).
- **Status** — `draft`, `active`, `archived`.

## Public surface

- `/products` — listing.
- `/products/<slug>` — detail page with cart-add.
- `/cart` — line items + totals.
- `/checkout` — multi-step state machine (address → shipping → payment → confirm).

## Wiring

Until the e-commerce real-flow specs land (see `docs/ROADMAP.md` → Queued), the public e-commerce routes render empty states. Inventory and orders panes are functional; checkout is a stub.

The MCP surface exposes `products.upsert`, `inventory.adjust`, `orders.list` once the feature is enabled.
