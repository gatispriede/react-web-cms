# F7 — slug single source of truth

## Goal

One canonical slug helper, consumed by every site (server resolver, SSR builder, public-side active-tab matcher, admin link picker, footer URL builder, sitemap generator). Today the same string travels through three different transforms in three different files; mismatches silently render empty pages.

## Why now

Skyclimber's "Jaunumi un aktualitātes " (trailing space + diacritic) page resolved server-side fine but rendered an empty body. Root cause traced to `findIdForActiveTab` in `app.tsx`:

```ts
// tab side
encodeURIComponent(tab.page.replace(/ /g, '-')).toLowerCase()
// → "jaunumi-un-aktualit%c4%81tes-"

// props side
encodeURIComponent(propsPage).toLowerCase()
// → "jaunumi%20un%20aktualit%c4%81tes%20"
```

These don't match, `activeKey = -1`, content empty. Server already had the right page — client re-derived from the display name with different rules.

User feedback that crystallized the problem: **"either way we always should see on client side what we see on admin side, it's unacceptable to not match. See if 1 source of truth needs to be put in place."**

## Design

### The contract

Single helper `normalizeSlug(input: string): string` exported from one place (e.g. `shared/utils/slug.ts`):

```ts
/**
 * Canonical slug normalisation. Used for ALL slug comparison + URL
 * generation across the codebase. Output: lowercase, dash-separated,
 * no diacritics, no leading/trailing dashes.
 *
 * Idempotent: normalize(normalize(x)) === normalize(x).
 *
 * Used by:
 *   - server-side `findPageBySlugChain` (resolver)
 *   - SSR `resolveSlugChain` (build-time)
 *   - admin `LinkTargetPicker` registry
 *   - public `MainMenu` href builder
 *   - public `<Breadcrumb>` href builder
 *   - public `findIdForActiveTab` (active page lookup)
 *   - footer URL builder
 *   - sitemap path generator
 */
```

Today the equivalent helper exists in three places:
- `services/features/Navigation/NavigationService.ts` — `normalizeSlugForMatch` (server)
- `ui/client/lib/slugChain.ts` — inline copy (avoids server→client import cycle)
- `ui/client/pages/app.tsx` — inline `norm()` (just patched 2026-05-04)

Plus generation helpers that ALMOST match:
- `shared/utils/stringFunctions.ts` — `slugifyAnchor` (strips diacritics)
- legacy bundle export — `name.replace(/\s+/g,'-').toLowerCase()` (preserves diacritics)

The split between *generation* (`slugifyAnchor`) and *match* (`normalizeSlugForMatch`) is a feature: new pages get clean URLs while legacy URLs keep resolving via tolerant comparison. Don't merge those.

### Source of truth for "which page is active"

The deeper architectural fix: **never re-derive the active page on the client.** The server already resolved it via `findPageBySlugChain`. Pass the resolved row's `id` (or array index) from `[...slug].tsx` → `app.tsx` as a prop. `findIdForActiveTab` becomes:

```ts
findIdForActiveTab() {
    return this.props.activePageId
        ? this.state.tabProps.findIndex(tab => tab.id === this.props.activePageId)
        : 0; // fallback when rendered outside the slug catch-all
}
```

No string matching at all. The id-based lookup is exact. The display-name-based lookup we have today is brittle by construction.

### Migration plan

1. **Move `normalizeSlugForMatch` to `shared/utils/slug.ts`.** Exported from there. Both server (`@services/...`) and client (`@utils/slug`) import from the shared package. No copy-paste between server and client modules.
2. **Sweep all call sites to use the shared helper.** Three known sites today; grep for `normalize` + `slug`/`page` to catch any I missed.
3. **Pass `activePageId` from `[...slug].tsx` to `app.tsx`.** Update `app.tsx` props interface; thread through SSR and CSR paths.
4. **Refactor `findIdForActiveTab` to id-based lookup.** Display-name normalization becomes a fallback for the legacy single-page mount that doesn't go through the catch-all.
5. **Tests:** server-side resolver test + SSR helper test + `findIdForActiveTab` test all import from `@utils/slug` to confirm one source. Skyclimber's `Jaunumi un aktualitātes ` page is the canary.
6. **Document the policy** in `docs/PROJECT_ANALYSIS.md` under "URL + slug discipline": display name is the human label, slug is the URL identity, neither is computed twice.

## Files to touch

- `shared/utils/slug.ts` (new) — the canonical helper
- `services/features/Navigation/NavigationService.ts` — drop the inline definition, import from `@utils/slug`
- `ui/client/lib/slugChain.ts` — same
- `ui/client/pages/app.tsx` — replace inline `norm()` with shared helper; refactor `findIdForActiveTab` to id-based once `activePageId` prop is plumbed
- `ui/client/pages/[...slug].tsx` — pass `activePageId: matched.id` in props
- Tests covering each consumer

## Acceptance

- `grep -rn "normalize.*[Ss]lug\|slug.*[Nn]ormalize" services ui shared --include='*.ts' --include='*.tsx' | grep -v test` returns ONE `import` per consumer plus ONE definition.
- `findIdForActiveTab` no longer normalizes strings — it looks up by id.
- Skyclimber import → navigate to `/jaunumi-un-aktualit%C4%81tes-` AND `/jaunumi-un-aktualitates` AND `/Jaunumi-un-aktualitātes` (case-mixed) → ALL render the same content.
- 685+ tests still green.

## Risks / notes

- `findIdForActiveTab` has a fallback (root `/` or unknown route) that returns the first tab. Preserve that behavior in the id-based version when `activePageId` is undefined.
- Pages exported from one site and imported into another carry their original `id`. If `activePageId` from URL routing flow doesn't survive bundle round-trip, the prop chain breaks. Confirm via the bundle test suite (`BundleService.test.ts`).

## Effort

**S · 2-4 hours.** Mostly wiring + test updates; no new logic.

## Dependency notes

- Pairs with F1 (sub-pages). The server resolver already does the right thing; this just removes the client's re-derivation.
- Doesn't depend on F6 (site-mode toggle) — site-mode is orthogonal to slug discipline.

## Open questions

1. **Should the shared helper live in `shared/utils/` or `shared/types/`?** Recommend `shared/utils/slug.ts` — it's a function, not a type. Mirror the existing `stringFunctions.ts` pattern.
2. **Drop `slugifyAnchor` and merge with the new helper?** No — generation and match-tolerance have different rules by design. Keep two.
3. **`activePageId` prop name** — `activePageId`, `pageId`, or `resolvedPageId`? Recommend `pageId` (shortest, unambiguous in this context).
