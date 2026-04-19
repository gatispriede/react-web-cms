# Auth & roles

NextAuth handles sessions; a custom `authz` Proxy gates GraphQL mutations by role. Optimistic concurrency layers a *second* gate on top — having `editor` rights doesn't help if your `expectedVersion` is stale.

## Roles

Three tiers, stored on the `User` doc and copied into the JWT session:

| Role | Can | Can't |
|---|---|---|
| `viewer` | Read everything (admin chrome included) | Mutate anything |
| `editor` | All content edits — sections, themes, posts, footer, languages, SEO | Manage users, publish to production (`canPublishProduction` flag) |
| `admin` | Everything | — |

`canPublishProduction` is a separate boolean flag on the user doc, not a role tier — both `editor` and `admin` can hold it. The Publish button in `AdminApp` is gated on this flag, not on role.

## NextAuth flow

1. Browser → `/api/auth/signin` → NextAuth signin page.
2. `CredentialsProvider.authorize` in [`pages/api/auth/[...nextauth].ts`](../../src/frontend/pages/api/auth/%5B...nextauth%5D.ts) calls `mongoApi.getUser({email})` through GQty.
3. `bcrypt.compare(submittedPassword, user.password)` — stored hash is precomputed (see seeded admin below).
4. JWT session (`strategy: "jwt"`); the `jwt` callback copies `id`, `name`, `email`, `role`, `canPublishProduction`, `mustChangePassword` into the token; the `session` callback re-exposes them on `session.user`.
5. NextAuth sets the session cookie; subsequent `/api/graphql` calls carry it; the Apollo context hands the session to resolvers.

`GoogleProvider` is registered **only** when both `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` env vars are set. Earlier the provider was registered unconditionally with empty strings, which broke the entire `/api/auth/*` handler (Credentials login included) whenever Google keys were absent.

Sign-in is rate-limited via [`pages/api/_rateLimit.ts`](../../src/frontend/pages/api/_rateLimit.ts); `/api/import` carries a same-origin guard so a malicious cross-site form can't replace the entire site database.

## Seeded admin

[`UserService.setupAdmin()`](../../src/Server/UserService.ts) inserts an admin **iff no user with `name: 'Admin'` exists**. Seeding runs in two places:

- On first `MongoDBConnection.setupClient()` — so the dev environment seeds automatically.
- Manually via the GraphQL `mongo.setupAdmin` query — usable from a fresh deployment that wants to seed via API.

Defaults: `email = ADMIN_USERNAME ?? 'Admin'` (lowercased + suffixed `@admin.com`), `password = ADMIN_DEFAULT_PASSWORD` plain-text or `ADMIN_PASSWORD_HASH` precomputed bcrypt. See [`DEPLOY.md`](../../DEPLOY.md) for the env var setup. The first-boot password story is captured in `roadmap/production/first-boot-admin-password.md` (Layer 1 shipped: `mustChangePassword` flag forces a rotate-on-first-login).

## `authz` Proxy — server-side mutation gates

[`src/Server/authz.ts`](../../src/Server/authz.ts) wraps `MongoDBConnection` in a `Proxy` whose `get` trap:

1. Looks up the called method name in `METHOD_ROLE_REQUIREMENTS` — the per-method minimum role.
2. If the session role is below the requirement, throws.
3. If the method is in `SESSION_INJECTED_METHODS`, the wrapper injects the caller's session as `args._session` so the underlying service can stamp `editedBy`.

Adding a new mutation: register it in **both** maps — its required role and (if it stamps audit) its session-injected name. Forgetting either is the most common authz bug.

```
'saveSiteFlags',
'saveSiteSeo',
'saveTranslationMeta',
'saveLogo',
'addUpdateLanguage',
…
```

Read-only `get*` methods are not in either map — they short-circuit through the Proxy with no role check. Anything that touches state (`save*` / `delete*` / `addUpdate*` / `setActive*`) must be listed.

## Optimistic concurrency — the second gate

Even with the right role, a mutation can be rejected if the doc moved past you while you were editing. [`src/Server/conflict.ts`](../../src/Server/conflict.ts) provides the primitive — `requireVersion(existing, existingVersion, expectedVersion)` throws `ConflictError` if `expectedVersion` was supplied and disagrees with the on-disk `version`.

`expectedVersion` is **optional** in the schema; a caller that omits it (legacy admin flows) applies the write unconditionally. New conflict-aware flows (today: the Section editor) read `version` at fetch time, send it back as `expectedVersion`, catch the typed `ConflictError` and surface a `<ConflictDialog>` with Take-theirs / Keep-mine.

Roll-out plan + the rest of the editor surfaces in `roadmap/multi-admin-conflict-mitigation.md`.

## Session injection cheat-sheet

When you write a new service method that needs to know **who** edited:

1. Add the method name to `SESSION_INJECTED_METHODS` in [`authz.ts`](../../src/Server/authz.ts).
2. Pull `_session` out of args server-side: `async myMethod({foo, _session}: {foo: string; _session?: {email?: string}}) { … }`.
3. Pass `_session?.email` into the service: `await this.fooService.save(foo, _session?.email)`.
4. Service applies `auditStamp(editedBy)` → `{editedAt, editedBy?}` patch into the `$set`.

The Proxy injection is opt-in by name (not by method shape) so a typo in the list silently produces unsigned audit rows. Worth a unit test if you're touching this code.

Last reviewed: 2026-04-19.
