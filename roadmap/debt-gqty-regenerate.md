# Debt — GQty regenerate cleanly **Shipped**

`schema.generated.ts` is now a faithful introspection of the live `/api/graphql` endpoint. Every previously hand-patched field is emitted by the generator because it was backfilled into [`schema.graphql`](../src/Server/schema.graphql) + the resolver layer as each patch was added:

- `ILogo.id` / `type` / `version` — server schema exposes them
- `INewLanguage.flag` / `version`
- `INavigation.editedBy` / `editedAt`
- `ISection.slots` / `overlay` / `overlayAnchor` / `version` + audit fields
- `InSection` input mirrors the composition fields
- `IUser.mustChangePassword` / `preferredAdminLocale` + matching `InUser`
- `createDatabase` removal (never existed server-side; the old stub is gone)
- `getSiteSeo` / `saveSiteSeo` / `getAuditLog` / etc. — present in the schema

Regeneration workflow:

```bash
npm run dev            # boot the server so Mongo is reachable on :80/api/graphql
npm run generate-schema
git diff src/frontend/gqty/schema.generated.ts    # expect zero changes on a clean run
```

If a diff appears after regen, the root cause is an upstream mismatch — add the missing field to `schema.graphql` + resolver rather than editing the generated file.

Full test suite passes (136/136) against the regenerated schema; preview verified clean.

---

*Original plan below for history.*

## Goal

`schema.generated.ts` is hand-patched in several places. Every regeneration today loses the patches and breaks the build. Fix by pointing the generator at a stable running endpoint, regenerating once, then keeping the manual patches to zero going forward.

## Manual patches currently in place

- `getLogo` nullability
- `createDatabase` removal
- `getSiteSeo` / `saveSiteSeo` present
- `INewLanguage.flag`
- `ILogo.id` / `type` nullability
- `INavigation` / `ISection` audit fields
- `ISection` composition fields `slots` / `overlay` / `overlayAnchor` mirrored on `InSection`

## Design

- Boot the server against a real Mongo so every schema field that's currently patched in by hand is emitted by introspection
- Run `npm run generate-schema` against `http://localhost:3000/api/graphql`
- Diff — any missing fields mean the server schema needs fixing upstream, not the generated file
- Delete the manual patches, commit the regenerated file

## Files to touch

- `src/frontend/gqty/schema.generated.ts` — regenerate, no hand-edits
- `src/frontend/gqty/` any helper files that depend on field naming
- Possibly `src/Server/*Service.ts` GraphQL resolvers — if a field is missing after regen, add it server-side instead of patching the generated file

## Acceptance

- `git diff src/frontend/gqty/schema.generated.ts` is empty after a fresh `npm run generate-schema` against a seeded dev server
- All TypeScript errors the current hand-patches were covering are now resolved by genuine schema exposure
- README / contributor docs mention: "never hand-edit `schema.generated.ts`; add the missing field to the resolver and regenerate"

## Risks / notes

- Every patch was added for a real reason. Before deleting, verify the resolver actually exposes the field (hint: `audit` fields and composition fields on `InSection` may still be missing server-side)
- Regenerate when the server is **quiet** — in-flight schema changes mid-introspection produce junk output

## Effort

**S–M · 2–4 h**

- Boot stable dev server: 30 min
- Regenerate + diff: 30 min
- Resolve any missing server-side exposures: 1–3 h (depends on what's missing)
- Remove patches + commit: 30 min
