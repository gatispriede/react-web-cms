# System pages — registry pattern (Phase 0b)

Some pages are not operator-authored content but framework requirements:
the cart, checkout steps, order confirmation, customer-account settings,
magic-link verification. They need to exist on every install, with
sensible defaults, but they also need to stay editable — operators
should be able to rebrand the cart copy or add a "trust badges" section
to the checkout payment page without losing it on the next deploy.

The **`SystemPageRegistry`** (`services/features/Pages/SystemPageRegistry.ts`)
is the single source of truth for those pages.

## The model

`IPage` carries a Phase 0b discriminator field:

```ts
source?: 'manual' | 'product' | 'system-page';
systemKey?: string;   // when source === 'system-page'
productId?: string;   // when source === 'product'
```

- `'manual'` (or unset, for legacy rows) — operator-authored content. The
  default for everything that pre-dates this jump.
- `'product'` — leaf product pages emitted by the
  products-as-composable-page item. `productId` binds to the warehouse row.
- `'system-page'` — registered against `SystemPageRegistry`. `systemKey`
  is the registry lookup key.

## Registering a new system page

A feature that owns a system page registers it at module-load (typically
inside the ServiceLoader constructor or a sibling `register*.ts` file):

```ts
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';

systemPageRegistry.register({
    systemKey: 'checkout-payment',
    slug: 'checkout/payment',
    titleI18nKey: 'systemPages.checkoutPayment.title',
    accessGate: 'customer-session',
    seo: {indexable: false},
    defaultSections: () => [/* ISection[] */],
});
```

Then, in that feature's `onBoot(ctx)`, call:

```ts
await systemPageRegistry.bootstrapAll(this.services.systemPageBootstrap);
```

…where `systemPageBootstrap` is a thin adapter that implements
`ISystemPageBootstrapService` against `NavigationService`. The adapter
lives in the consuming feature so `SystemPageRegistry` itself stays
free of Mongo + Navigation cyclic dependencies.

## Operator-override preservation

`bootstrapAll()` is idempotent + edit-preserving:

| Existing row state                              | What `bootstrapAll` does                  |
|-------------------------------------------------|-------------------------------------------|
| Missing                                          | Insert with defaults from the registry.   |
| Present + un-edited + sections empty             | Backfill sections (corruption recovery).  |
| Present + un-edited + sections non-empty         | Skip — already in sync.                   |
| Present + operator-edited                        | Update metadata (slug if registry-default; SEO) only; sections preserved. |

The "operator-edited" heuristic: `editedAt > createdAt + 60s` AND the
current sections list diverges from the defaults' fingerprint. The 60-second
guard rules out the initial bootstrap audit stamp; the divergence check
rules out re-saves that happen to set the same content.

Slug renames are likewise operator-preserved — if the row's slug no
longer matches the registered default, the bootstrap leaves it alone.

## Depth-cap lift

Phase 0b also lifted the navigation depth cap from a hard `> 3` throw to
a soft warning at `> 8`. Real product taxonomies need 4–6 levels (cars →
make → model → trim → year), and system pages like `checkout/payment`
benefit from being nested under a `checkout` parent.

- Server: `services/features/Navigation/NavigationService.ts` —
  `SOFT_DEPTH_WARNING_AT = 8`. Crossing it emits a
  `{code: 'PAGE_DEPTH_DEEP'}` warning log; no throw.
- Admin: `ui/admin/features/Navigation/parentTree.ts` — `MAX_DEPTH = 8`
  (matching the server). Used to grey out "Add child" past the threshold.

Cycle prevention is unchanged — `setParent` still hard-rejects on cycles.

## When to raise the threshold

If your taxonomy genuinely exceeds 8 levels, edit the two constants in
lockstep. Past ~12 levels you'll want to virtualise the admin's parent
picker (linear render of a deep tree gets slow); that virtualisation is
out of scope for this jump.

## MCP coverage

Read tools land in `services/features/Mcp/tools/systemPages.ts`:

- `systemPages.list` — every definition + its current Mongo state.
- `systemPages.bootstrap.status` — last `bootstrapAll()` summary.
- `systemPages.definition.get { systemKey }` — one definition with its
  default-sections snapshot.

`page.list` also gained a `source?: 'manual' | 'product' | 'system-page'`
filter so AI agents can list-by-source.

Write tools (`systemPages.update`, `systemPages.reset`) land with the
first consumer that needs them — typically checkout-as-composable-page.
