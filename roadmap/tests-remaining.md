# Remaining tests — Partial **Shipped**

**Frontend pass — partial:**

- [`src/frontend/api/MongoApi.test.ts`](../src/frontend/api/MongoApi.test.ts) — new. 6 tests mock each `*Api` constructor and assert the facade forwards every public method with the original args. Catches typos in delegate names, missed args, accidental transformation. Stops the facade from silently dropping methods during refactors.
- [`src/frontend/lib/conflict.test.ts`](../src/frontend/lib/conflict.test.ts) — new. 9 tests lock the `parseMutationResponse` / `isConflictPayload` / `ConflictError` contract that the rolled-out conflict-aware editors depend on.
- [`src/frontend/theme/googleFonts.test.ts`](../src/frontend/theme/googleFonts.test.ts) — new. 10 tests cover `extractFontFamily` / `buildFontStack` / `buildGoogleFontsUrl` and the catalogue shape so a hand-edit of `google-fonts.json` or a regression in `_document.tsx` font composition fails the suite.

Total this pass: **+25 tests, 23 test files / 135 tests** in the green build.

**Still deferred (the rest of this item):**

- `LoginBtn` + session render — needs `next-auth/react` mocked at the `useSession` boundary; doable but ~1 h on its own.
- Per-section-type snapshots — ~6 h to do all 17 item types properly without snapshot rot.
- API route integration via `supertest` or direct Next handler invocation (`/api/setup` idempotency, `/api/export`+`/api/import` round-trip, `/api/rescan-images` no-op behaviour) — ~4–6 h plus `mongodb-memory-server` global setup wiring.

## Implementation plan

`mongodb-memory-server` is already used in server tests. 8 frontend test files exist. The infra is ready — just need the test files.

1. **`LoginBtn` test** (`src/frontend/components/Auth/login-btn.test.tsx`) — mock `next-auth/react` at the module level (`vi.mock('next-auth/react')`). Test three states: `{ status: 'loading' }` (renders loading indicator), `{ status: 'unauthenticated' }` (renders login button), `{ status: 'authenticated', data: { user: {...} } }` (renders user name + logout button). ~1–2 h.
2. **Section snapshot tests** — pick 6 representative types: `Hero`, `Gallery`, `Timeline`, `Services`, `RichText`, `SocialLinks`. For each, create `*.test.tsx` with `@vitest-environment jsdom`. Render with `@testing-library/react` and assert structural elements (headings present, item count, no broken img tags) — not pixel snapshots. ~4–6 h total.
3. **API integration tests** — use `mongodb-memory-server` global setup (already in `vitest.config.ts` for server tests). Call Next.js route handlers directly (import handler, call with mock `req`/`res`). Tests:
   - `/api/setup` — run twice, assert only one admin user in DB
   - `/api/export` — assert returned JSON has `manifest`, `site`, `assets` keys
   - `/api/import` → `/api/export` round-trip — shapes match
   - `/api/rescan-images` — seed DB without an image file record, run, assert record created; run again, assert count unchanged
   - ~4–6 h total.
4. **CI caching** — add `mongodb-memory-server` binary path to CI cache key (GitHub Actions `actions/cache` with `~/.cache/mongodb-binaries`).

## Goal

Close the two test gaps left after the autosave / helpers / translate-or-keep passes landed:

1. Frontend unit tests for the remaining high-traffic components
2. API route integration tests for setup + export/import round-trip

## Design

### Frontend unit (vitest + jsdom)

Infra already in place — see `src/frontend/lib/useAutosave.test.tsx` for the pattern. Use `// @vitest-environment jsdom` directive per file.

Coverage targets:

- **`LoginBtn` + session render** — unauthenticated state, authenticated state, loading state, logout transition
- **Section component snapshots** — each section type rendered with realistic content + "empty content" edge case (no items, no overlay)
- **`MongoApi` facade delegation** — mock each `*Api` module, assert the facade forwards calls unchanged. Stops the facade from silently dropping methods during refactors.

### API route integration (supertest OR direct Next handler invocation)

Standalone — no live Mongo required if we spin up an in-memory instance (`mongodb-memory-server`) in a vitest global setup.

Coverage targets:

- **`/api/setup`** — idempotent: run twice, no second admin user created, no new password file
- **`/api/export`** — returns a bundle with manifest + site + assets; editor role sufficient
- **`/api/import`** — happy path + rejects non-admin + round-trips with /api/export (export → import → export again = same shape)
- **`/api/rescan-images`** — files on disk but missing from DB get inserted; second run is a no-op

## Files to touch

- `src/frontend/components/Auth/login-btn.test.tsx` (new)
- `src/frontend/components/SectionComponents/*.test.tsx` (new, per type)
- `src/frontend/api/MongoApi.test.ts` (new)
- `src/frontend/pages/api/*.integration.test.ts` (new)
- `vitest.config.ts` — global setup for `mongodb-memory-server` if we use it
- `package.json` — `mongodb-memory-server` devDep

## Acceptance

- `npm test` passes in CI with all new tests included
- Frontend coverage for the targeted files ≥ 70% (we're not chasing 100%)
- API integration tests run in under 30 s total (keep the memory server fast)
- Breaking the `MongoApi` facade surface (say, by removing a method) fails the test instead of silently shipping

## Risks / notes

- `mongodb-memory-server` adds a ~100 MB download on first run. Cache it in CI.
- Don't test the section snapshots against pixel-perfect output — test structure + critical-text presence. Snapshots rot fast otherwise.

## Effort

**L · 1.5–2 engineering days**

- LoginBtn + session tests: 1–2 h
- Section component tests (per type): 4–6 h
- MongoApi facade tests: 1 h
- API integration harness + tests: 4–6 h
- CI wiring + flake hunt: 1–2 h
