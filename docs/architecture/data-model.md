# Data model

UML at [`../../src/frontend/public/data-model.svg`](../../src/frontend/public/data-model.svg). Authoritative GraphQL types in [`../../src/Server/schema.graphql`](../../src/Server/schema.graphql). TypeScript-side mirrors live under [`../../src/Interfaces/`](../../src/Interfaces/).

## Mongo collections

| Collection | Purpose | Owned by |
|---|---|---|
| `Navigation` | One doc per page (`{type:'navigation', page, sections:[id], seo}`) — the site map | `NavigationService` |
| `Sections` | A chunk of a page (`{id, type, page, content:[Item], slots, overlay, overlayAnchor}`) | `NavigationService` |
| `Images` | Image metadata; binary lives at `src/frontend/public/images/` | `AssetService` |
| `Logos` | Single-doc collection (latest wins on read) holding `{id, type, content}` | `AssetService` |
| `Users` | `{id, name, email, password (bcrypt), role, avatar, canPublishProduction}` | `UserService` |
| `Languages` | `{label, symbol, default?, flag?, translations: JSON}` mirrored to disk JSON | `LanguageService` |
| `Themes` | Theme presets + custom themes (`{id, name, custom, tokens, version}`) | `ThemeService` |
| `Posts` | Blog posts (`{id, slug, title, body, excerpt, draft, publishedAt, version}`) | `PostService` |
| `PublishedSnapshots` | Frozen copy of Nav + Sections + Languages + Logos + Images + non-draft Posts | `PublishService` |
| `SiteSettings` | Single collection, key-keyed singleton docs — one row per setting type | multiple |

## `SiteSettings` keyed-singletons

`SiteSettings` is a junk drawer for "we need one row of this": stick a `key` field on the doc and use `findOne({key})` / upsert by key. Each setting has its own service for type safety.

| `key` | Service | What it stores |
|---|---|---|
| `activeThemeId` | `ThemeService` | The id of the currently-active `Themes` doc |
| `siteFlags` | `SiteFlagsService` | `{blogEnabled, layoutMode}` |
| `siteSeo` | `SiteSeoService` | Default SEO fallbacks (siteName, og:image, twitter handle, locale) |
| `footer` | `FooterService` | `{enabled, columns[], bottom}` — admin-configured + auto-merged |
| `translationMeta` | `TranslationMetaService` | Per-key `{description?, context?}` map for translators |

Adding a new singleton setting: pick a unique `key`, model after `SiteFlagsService` (get/save with upsert), wire into [`mongoDBConnection.ts`](../../src/Server/mongoDBConnection.ts), expose via the GraphQL schema.

## The audit triplet (every editable doc)

Every doc that the admin can mutate carries three optional fields layered by [`audit.ts`](../../src/Server/audit.ts) + [`conflict.ts`](../../src/Server/conflict.ts):

| Field | Set by | Read by |
|---|---|---|
| `editedBy` | `auditStamp(session?.email)` on every write | `AuditBadge` ("last edited by X") |
| `editedAt` | `auditStamp()` — ISO8601 timestamp | Same badge — "2m ago" relative time |
| `version` | `nextVersion(existingVersion)` — integer that monotonically increases per save | Optimistic-concurrency check on next save (see [`auth-roles.md`](auth-roles.md) and [`publishing.md`](publishing.md)) |

The `version` integer is **opt-in per write**: callers that pass `expectedVersion` to a save method get a `ConflictError` if the doc moved past them; callers that omit it apply the write unconditionally (legacy path during the rollout). New docs start at `version: 1`. See [`admin-systems.md`](admin-systems.md) and [`auth-roles.md`](auth-roles.md) for implementation details.

Snapshots and bundles add `publishedBy` / `rolledBackFrom` — see [`publishing.md`](publishing.md).

## Additional collections

Two more collections are maintained outside the main content graph:

| Collection | Purpose | Owned by |
|---|---|---|
| `AuditLog` | Append-only event log — `{id, at, actor, collection, docId, op, diff?, tag?}` | `AuditLogService` |
| `Presence` | Short-lived heartbeat docs — `{userId, docId, name, avatar, updatedAt}` with 45 s TTL | `/api/presence` route |

### `AuditLog` details

- **Indexes:** `at desc` (list page), `{collection, docId, at desc}` (per-doc history), `{actor.email, at desc}` (per-editor filter), TTL on `at`.
- **Diff payload** size-capped at 10 kB; oversized writes record `diff: null` rather than truncating.
- **Tags:** `publish` and `rollback` ops include `tag` for snapshot events.
- Every conflict-aware mutation takes an `auditTrace` callback; the emitter lives in `runMutation`.
- Paginated at 50/page in the admin Audit tab; reads gated at `admin` role.

### `Presence` details

- Editors post a heartbeat every 15 s to `/api/presence` (`{docId, userId}`).
- Server upserts by `{userId, docId}` and keeps a 45 s TTL index on `updatedAt`.
- UI polls every 15 s and renders stacked avatars of other editors on the same `docId` via `<PresenceHost>` mounted at `_app` level.
- No writes to Mongo beyond the heartbeat; Presence docs are purely transient.

## Section composition

Sections aren't just stacked rows. Three composition mechanisms, all editable inline:

- **Column slot merges** — a `type: 3` section (three 33% columns) can split into `slots: [2, 1]` (66/33), `[1, 2]` (33/66), etc. Validation: `sum(slots) === type` and `slots.length === content.length`.
- **Overlay + anchor** — any section can be flagged `overlay: true` with `overlayAnchor` ∈ `{top-left, top-right, bottom-left, bottom-right, center, fill}`. The section drops out of block flow and renders absolute-positioned inside the previous non-overlay ("host") section.
- **Reorder via native HTML5 DnD** — [`DraggableWrapper`](../../src/frontend/components/common/DraggableWrapper.tsx) renders an accent-bordered drop indicator at the target slot. `NavigationService.getSections` re-sorts the `$in`-fetched docs by the caller's id order so the new layout sticks through the next refetch.

Same `addUpdateSectionItem` mutation handles the lot, including the version check.

## Item shape

Each item inside a section carries:

- `type` — one of the 17 registered `EItemType` enums
- `style` — free-form string slot used by SCSS for variant styling (`.skill-pills.matrix`, `.timeline.editorial`, …)
- `content` — JSON blob, schema is per-type
- `action`, `actionType`, `actionContent`, `actionStyle` — optional interaction trigger that mounts a *different* item type as the click/hover target

Item types live in [`itemTypes/registry.ts`](../../src/frontend/components/itemTypes/registry.ts). Each registers a Display + Editor pair plus a `styleEnum` for the variant dropdown.

Last reviewed: 2026-04-19.
