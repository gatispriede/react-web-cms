# Multi-admin conflict mitigation — Layers 1 + 2 **Shipped**

**Layer 1 (optimistic concurrency) live across every editable surface.** **Layer 2 (presence avatars) live** via a TTL-indexed `Presence` collection + `/api/presence` route + a `<PresenceHost>` mounted once at `_app` level.

Server foundation in [`src/Server/conflict.ts`](../src/Server/conflict.ts):

- `ConflictError<T>` carries the on-disk `currentDoc` + `currentVersion`.
- `requireVersion(existing, existingVersion, expectedVersion, kind)` throws when the caller asked for a check and the version moved.
- `nextVersion(existingVersion)` returns the next integer (new docs start at 1).
- `serialiseConflict(err)` formats the JSON wrapper the frontend detects.

Mutation glue in [`mongoDBConnection.ts`](../src/Server/mongoDBConnection.ts):

- `runMutation(action, fn)` wraps every conflict-aware mutation; `ConflictError` becomes `{conflict, currentVersion, currentDoc, message}`, other errors become `{error}`.
- Sections take a slightly different shape because their service can also throw a non-conflict validation error before reaching the helper, so the wrapper is inlined in `addUpdateSectionItem`.

Services with version + `expectedVersion` plumbing:

- [`NavigationService.addUpdateSectionItem`](../src/Server/NavigationService.ts) — sections (the most-edited surface, end-to-end UI wired)
- [`ThemeService.saveTheme`](../src/Server/ThemeService.ts)
- [`PostService.save`](../src/Server/PostService.ts)
- [`FooterService.save`](../src/Server/FooterService.ts)
- [`SiteFlagsService.save`](../src/Server/SiteFlagsService.ts)
- [`SiteSeoService.save`](../src/Server/SiteSeoService.ts)
- [`TranslationMetaService.save`](../src/Server/TranslationMetaService.ts)

GraphQL: every relevant mutation grew an optional `expectedVersion: Int` arg in [`schema.graphql`](../src/Server/schema.graphql); `schema.generated.ts` patched to match.

Frontend:

- [`lib/conflict.ts`](../src/frontend/lib/conflict.ts) — typed `ConflictError`, `parseMutationResponse(raw)` that throws on the conflict shape, plus a `onConflict` / `emitConflict` bus for non-editor surfaces that want a global handler.
- [`components/common/ConflictDialog.tsx`](../src/frontend/components/common/ConflictDialog.tsx) — reusable Modal with Take-theirs / Keep-mine actions and peer attribution.
- [`api/SectionApi.ts`](../src/frontend/api/SectionApi.ts) — `addRemoveSectionItem` reads `section.version`, sends as `expectedVersion`, then parses the response and bumps local `version` so subsequent saves stay aligned.
- [`components/DynamicTabsContent.tsx`](../src/frontend/components/DynamicTabsContent.tsx) — catches `ConflictError`, renders `<ConflictDialog>`, retries with the bumped version on Keep-mine, refetches on Take-theirs.

End-to-end test verified live: stale `expectedVersion=0` against a server-side `version=1` returns the conflict JSON with `currentDoc` + `currentVersion`; subsequent save with the bumped version succeeds. Presence heartbeat + list verified via `POST /api/presence` + `GET /api/presence?docId=…`.

**Layer 3 (soft lock) — still deferred.** Revisit only if Layers 1 + 2 prove insufficient. Design captured below.

**Editor rollout — complete.** Wired across Section / Theme / Post / Footer / SiteFlags ([Layout](../src/frontend/components/Admin/AdminSettings/Layout.tsx)) / SiteSeo ([SEO](../src/frontend/components/Admin/AdminSettings/SEO.tsx)) / TranslationMeta ([ContentLoaderCompare](../src/frontend/components/Admin/AdminSettings/ContentLoaderCompare.tsx)) / Logo ([LogoSettings](../src/frontend/components/Admin/AdminSettings/LogoSettings.tsx)) / Language ([Languages](../src/frontend/components/Admin/AdminSettings/Languages.tsx)). Each reads `version` at fetch time, sends it back as `expectedVersion`, catches `ConflictError` and surfaces a `<ConflictDialog>` with Take-theirs (refresh) and Keep-mine (retry adopting the bumped version). Every API (`ThemeApi`, `PostApi`, `FooterApi`, `SiteFlagsApi`, `SiteSeoApi`, `TranslationMetaApi`, `AssetApi` / Logo, `LanguageApi`) uses `parseMutationResponse` to throw the typed conflict. `getTranslationMeta` GraphQL shape now returns `{value, version}` so the compare view can seed its version on load. `ILogo` + `INewLanguage` GraphQL types grew a `version: Int` field.

**Layer 2 (presence) — shipped.** [`PresenceService`](../src/Server/PresenceService.ts) writes to a `Presence` collection with a 45 s TTL index on `at` and a `{email, docId}` unique composite index so heartbeats upsert in O(1). [`/api/presence`](../src/frontend/pages/api/presence.ts) (POST = heartbeat, GET = list) gates on editor-role session + same-origin + per-IP rate limit. [`<PresenceBar>`](../src/frontend/components/common/PresenceBar.tsx) polls every 15 s and renders stacked avatars of other editors on the same `docId`; it renders nothing when only self is active so solo editing stays clean. [`<PresenceHost>`](../src/frontend/components/common/PresenceBar.tsx) is mounted once in [`_app.tsx`](../src/frontend/pages/_app.tsx), scopes `docId` to the current admin route (`route:/en/admin/settings`) via a patched `window.history.pushState` + `popstate` listener so SPA navigations repoint cleanly. Finer-grained per-doc ids (e.g. `theme:<id>`) can be wired later by rendering `<PresenceBar>` directly inside specific editor panes.
- "Merge" UI (cherry-pick fields per side) — the dialog only offers take-theirs / keep-mine. Diff-aware merge is out of scope for v1.
- Layer 2 (presence avatars via TTL `Presence` collection + `/api/presence`) — design captured below.
- Layer 3 (soft lock) — only revisit if Layers 1 + 2 prove insufficient.

## Goal

Two admins editing the same page / same section shouldn't silently overwrite each other. Today "last write wins" — the second save clobbers the first with no warning. Target: detect concurrent editors, warn on entry, and prevent silent overwrites on save.

## Design

Approach in layers, cheapest first. Ship in this order; stop at whichever layer is sufficient.

### Layer 1 — Optimistic concurrency via version check (must-have)

- Every editable doc (Section, Navigation, Post, Theme, SiteSettings, Footer, SiteSeo) gets a `version: number` field incremented on every mutation server-side
- Frontend stashes the `version` at read-time
- Every mutation sends `expectedVersion`; server compares and:
  - Matches → increment, apply, return new version
  - Mismatches → reject with `409 Conflict` + the current server doc
- Admin UI catches 409, shows a modal: "Someone else saved this since you opened it. Review the incoming change and choose: keep mine / take theirs / merge."

Covers the "silently clobber" case without any presence / realtime infra.

### Layer 2 — Presence indicator (nice-to-have)

- Lightweight heartbeat: each admin posts `{ email, docId, at }` every 15 s to `/api/presence` while editing
- Server keeps a TTL Mongo collection (`Presence`, 45 s TTL) of active editors per doc
- UI pulls `/api/presence?docId=…` every 15 s and renders avatars of other active editors in the top-right of the editor pane
- Not blocking — informational. Combined with Layer 1, editors see "someone else is here" BEFORE hitting save, so surprises are rare

### Layer 3 — Soft lock (opt-in per doc, phase 2)

- "Take editing lock" button on high-stakes docs (Theme, SiteSettings)
- Holder has a 5-minute lock (renewed on activity); others see a banner "Locked by alice@… — take over?"
- Not strict — any editor can break the lock with a confirm click. Purely social

Skip Layer 3 until Layers 1 + 2 prove insufficient.

### Layer 4 — Real-time collaboration (out of scope)

- CRDT (Yjs) per doc with websocket sync. Hugely complex. Only consider if multiple simultaneous editors per section becomes the norm, which is unlikely for a CMS of this size

## Files to touch

- Every service with editable docs — `Section`, `Navigation`, `Post`, `Theme`, `SiteSettings`, `Footer`, `SiteSeo`, `Language`. Add `version: number`, guard writes
- GraphQL schema — mutations accept `expectedVersion`
- GQty regen or manual patch
- `src/frontend/components/common/ConflictDialog.tsx` (new) — shown on 409
- `src/frontend/components/common/PresenceBar.tsx` (new) — avatars in editor pane
- `src/Server/PresenceService.ts` (new)
- `src/frontend/pages/api/presence.ts` (new)
- `src/frontend/lib/useAutosave.ts` — catch 409, surface through a topic subscription

## Acceptance

### Layer 1
- Open a section in two tabs. Save in tab A. Save in tab B → conflict dialog, no silent overwrite
- Pick "take theirs" → tab B shows the server version
- Pick "keep mine" → tab B resubmits with the new version

### Layer 2
- Open same section in two tabs (as two different users) → both see the other's avatar in PresenceBar within 15 s
- Close one tab → avatar disappears from the other within 45 s

### Layer 3 (if built)
- Take lock, walk away for 6 min → lock auto-released
- Other user sees takeover prompt, confirms → lock transfers

## Risks / notes

- Forgetting to bump `version` on a service write is how silent-overwrite bugs creep back in. Centralise via the same helper that wraps `auditStamp` so it's hard to forget
- GQty regen + manual patches will churn — budget for it, or commit to regenerating (see [debt-gqty-regenerate.md](debt-gqty-regenerate.md)) first
- Presence heartbeats at 15 s × many editors can be chatty. Cap at 20 active admins before we worry; with TTL index cost is low

## Effort

**L · 2 engineering days**

- Layer 1 (must-have): 6–8 h
  - Service-layer version field + guards across all doc types: 3–4 h
  - Conflict dialog + autosave integration: 2–3 h
  - GQty regen / patch: 1 h
- Layer 2 (nice-to-have): 3–5 h
  - PresenceService + TTL collection + API: 1–2 h
  - PresenceBar + polling hook: 1–2 h
  - Integration + testing: 1 h
- Layer 3 (phase 2): 3–4 h (only if scoped in)
