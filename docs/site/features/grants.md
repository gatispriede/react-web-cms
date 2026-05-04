# Grants (edit levels)

Beyond rank, the CMS supports **per-resource grants** — fine-grained permissions on individual pages, posts, or themes. Used when you want an editor to manage one campaign page without giving them the run of the site.

## How it composes

A mutation runs only if **all three** layers pass:

1. **Rank** — the minimum rank declared on the resolver.
2. **Functional role** — optional named role (e.g. `translator`, `publisher`).
3. **Resource grant** — for resolvers marked `resourceGated`, the user must hold a grant for the specific resource extracted from the args.

The composition lives in `services/features/Auth/authz.ts`. Per-request results are cached so repeated checks in one request are cheap.

## Granting

`/admin/system/users` → user → **Grants** tab. Pick a scope (`page`, `post`, `theme`) and a resource id; choose `view` / `edit` / `publish`. Save.

## Functional roles

Independent of grants; assign on the user record:

- **translator** — write into Translations regardless of page ownership.
- **publisher** — flip publish state on otherwise-restricted resources.
- **billing** — manage subscriptions / invoices (e-commerce).

## Inline-translation migration

When `siteFlags.inlineTranslationEdit` is on, every editor-rank user is auto-granted `translator` at boot. The migration is a one-shot; once it lands, the flag will be dropped (see roadmap).
