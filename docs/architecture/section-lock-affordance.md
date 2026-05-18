# Section lock affordance (Phase 0a)

Primitive that lets a section opt out of operator-driven structural removal.
Used by composable system pages where transactional / required content must
always render.

## When to apply

Set `section.locked = true` (and optionally `section.lockReason`) on sections
authored by system pages. Examples (consumers, shipping next):

- **checkout-as-composable-page** — payment + summary rows must render.
- **products-as-composable-page** — product gallery + buy box rows.
- **client-account-settings-page** — auth + profile rows.

Do NOT apply to operator-authored marketing content. Locking is reserved for
sections the runtime depends on for a working transactional flow.

## Server-side guard

`NavigationService.removeSectionItem(sectionId)` reads the existing section
before the `deleteOne`. If `locked === true`, it returns a serialised
`SECTION_LOCKED` error envelope:

```json
{
  "error": "SECTION_LOCKED",
  "code": "SECTION_LOCKED",
  "sectionId": "…",
  "message": "<lockReason> | section.locked.default"
}
```

All structural-delete paths funnel through this method — GraphQL
`removeSectionItem`, MCP `section.delete`, REST, and bundle-import cascade.
Content edits (`addUpdateSectionItem`) are *not* gated — locked sections
remain editable, only their structural removal is blocked.

## Admin UI affordance

`ui/admin/lib/LockedSectionAffordance.tsx` renders an antd `<Tooltip>` +
`<LockOutlined>` icon. `EditWrapper` mounts it inline in the action strip
whenever `locked` is true and suppresses the delete control (the
`Popconfirm` + danger button are gated off). Tooltip text resolves
`lockReason` as an i18n key if it starts with `section.locked.`, otherwise
as a literal.

i18n keys live in `ui/admin/i18n/{en,lv}.json`:

- `section.locked.default` — fallback shown when no `lockReason` is set.
- `section.locked.tooltip` — generic tooltip label.
- `section.cannot.delete.locked` — toast copy for the (rare) case a
  non-UI caller surfaces the server-side error to an operator.

## MCP coverage

The existing `section.update` MCP tool accepts `locked` + `lockReason` on
the section payload (no new tool needed). See
`services/features/Mcp/tools/pages.ts` for the schema.

## Consumers (cross-link)

Wired up by, and reused across:

- [`docs/roadmap/storefront/checkout-as-composable-page.md`](../roadmap/storefront/checkout-as-composable-page.md)
- [`docs/roadmap/storefront/products-as-composable-page.md`](../roadmap/storefront/products-as-composable-page.md)
- [`docs/roadmap/storefront/client-account-settings-page.md`](../roadmap/storefront/client-account-settings-page.md)

(Files land in the follow-up phases; this primitive ships first.)
