# AUI mode — simplified-base, advanced-extends-simplified hierarchy

> **Extended 2026-05-16 — three-tier mode hierarchy.** Original 2026-05-07
> spec covered two modes (simplified / advanced). Operator feedback adds
> a third tier: **AI-first**. The full hierarchy is now:
>
> | Mode | Target operator | Surface |
> |---|---|---|
> | **AI-first** | Operator who barely touches the UI; drives the site via natural-language conversation with an AI agent over MCP | Minimal admin chrome — just the homepage editor + an AI conversation pane. Everything else is MCP-driven from outside. The admin acts as a verification surface ("did the AI do what I asked?") rather than a control surface. |
> | **Simplified** (was the default) | Operator who configures one site, lightly. Wants to edit the homepage, post a blog, change a logo. Doesn't want to see anything they won't use. | Pages that only have what an operator-of-one needs. Bulk operations / version history / raw JSON / power-user toggles all hidden. |
> | **Advanced** (was the alternative) | Operator who wants full functionality — multi-site, complex content models, bulk operations, integrations, audit + observability | The full surface — everything the platform exposes. |
>
> Critically: **the mode is a runtime per-operator preference**, not a
> build-time flag. An operator can switch modes from their account
> settings; the admin re-renders with the chosen tier. The three modes
> share the same underlying state, mutation surface, and MCP coverage
> — only the UI extent differs.

## Goal

The admin UI mode flag lets operators pick **simplified** (fewer controls, common operations only) or **advanced** (full control surface). Today the dispatch is `modes.simplified ?? modes.advanced` — a feature ships either both or just advanced. Themes + Posts proved the dispatch works.

The pattern that wasn't pinned down: **what's the relationship between the two components?** Naïve answer: write each independently. That makes simplified components stripped-down forks of advanced, drift between them, and bloat the admin bundle.

Decision (2026-05-07): **simplified is the base; advanced extends simplified.**

## Why this hierarchy

- **Simplified is the common case.** Most admin sessions exercise create + edit + delete. The simplified pane covers that. Building it first locks the minimum-viable surface for every feature.
- **Advanced is the long tail.** Bulk operations, filters, version history, conflict resolution, raw JSON access. Each is an additive concern.
- **Drift is structural, not behavioural.** When advanced adds a new control, simplified shouldn't have to know about it — but the underlying state shape, mutation calls, and event handlers are shared. Inheritance / composition keeps the contract stable.
- **Bundle weight.** A user in simplified mode shouldn't pay for advanced-only Ant components, gqty queries, or admin libraries that aren't loaded. Lazy-loading the advanced extension keeps simplified light.

## Design

### Component hierarchy

Per feature, the layout becomes:

```
ui/admin/features/Themes/
├── Themes.simplified.tsx         # base — used by simplified mode + as the prop-passing parent
├── Themes.advanced.tsx           # extends simplified, adds bulk + advanced controls
├── Themes.types.ts               # shared types (ThemeProps, ThemeViewModel)
├── Themes.test.tsx               # tests both
├── index.ts                      # registers both: { simplified: ..., advanced: ... }
```

`Themes.advanced.tsx` imports the simplified component and renders it as the body, adding its own controls around / below / via a tab. Concretely:

```tsx
// Themes.advanced.tsx
import {ThemesSimplified} from './Themes.simplified';

export function ThemesAdvanced(props: ThemeProps) {
    return (
        <>
            <ThemesSimplified {...props} />
            <AdvancedControls {...props} />  {/* bulk delete, version history, raw token JSON */}
        </>
    );
}
```

Or wrap with provider + slot pattern when the simplified body needs context the advanced panel sets:

```tsx
// Themes.advanced.tsx
<AdvancedContext.Provider value={...}>
    <ThemesSimplified />        {/* same body, augmented context */}
    <AdvancedDrawer />
</AdvancedContext.Provider>
```

### Lazy-load the advanced extension

```ts
// ui/admin/features/Themes/index.ts
export const themesFeature = {
    simplified: () => import('./Themes.simplified').then(m => m.ThemesSimplified),
    advanced: () => import('./Themes.advanced').then(m => m.ThemesAdvanced),
};
```

The shell only imports the variant matching the active mode. Bundle splits naturally per feature × mode. A user in simplified mode never downloads the advanced bundle.

### Feature-flag gating (optional per-feature)

Some features have **advanced-only experimental controls** that aren't ready for general advanced-mode users yet. Wire them through site flags:

```tsx
// Themes.advanced.tsx
const flags = useSiteFlags();
return (
    <>
        <ThemesSimplified />
        {flags.themesAdvancedBulkDelete && <BulkDeletePanel />}
        {flags.themesAdvancedVersionHistory && <VersionHistory />}
    </>
);
```

Each new advanced sub-feature ships behind its own flag, defaulting off. Admin can flip the flag on for testing without touching code. Once stable, drop the flag.

### Co-location rule (re-state from architecture)

**Both variants stay inside `ui/admin/features/<X>/`.** No `ui/admin/features-simplified/` parallel hierarchy. The mode dispatch is metadata at the feature loader level, not a folder split.

This applies to **every** AUI mode rollout going forward. New panes that add a simplified variant land their `<Name>.simplified.tsx` alongside the existing `<Name>.tsx` (renamed to `<Name>.advanced.tsx` or kept as the canonical filename for the advanced variant).

### Migration of existing panes

Themes + Posts already shipped both variants under the existing `simplified ?? advanced` dispatch. Migrate them to the inheritance shape:

1. Confirm `ThemesSimplified` is the smaller component.
2. If `ThemesAdvanced` was independent, refactor it to compose `ThemesSimplified` + the extra controls.
3. Verify both variants render identically to today (snapshot test).
4. Add lazy-load to the registry.

This is mechanical refactor — ~half a day per existing pane.

## Files to touch (per new pane)

- `ui/admin/features/<Name>/<Name>.simplified.tsx` — new
- `ui/admin/features/<Name>/<Name>.advanced.tsx` — wraps simplified + adds controls
- `ui/admin/features/<Name>/<Name>.types.ts` — shared props
- `ui/admin/features/<Name>/index.ts` — registers both with lazy-load
- `services/features/<Name>/feature.manifest.ts` — site-flag entries for any gated advanced sub-features

Per-pane budget: M (~1 day each, less if simplified surface is already known from other admin work).

## Acceptance

1. Simplified mode bundle weight measurably smaller than advanced (verify via `next build` analyse).
2. Switching mode without reload swaps the rendered component.
3. Adding a new advanced control requires touching only `<Name>.advanced.tsx` + (optional) a feature flag — never `<Name>.simplified.tsx`.
4. Existing Themes + Posts panes re-shaped onto the hierarchy without behavior regression.
5. ESLint rule (or pre-commit hook) prevents `ui/admin/features-simplified/` paths.

## Effort

**Foundational chunk (this roadmap item) — M · ~1-2h AI:**
- Refactor existing Themes + Posts onto inheritance shape: ~45 min
- ESLint rule + lazy-load convention helper: ~30 min
- Tests + docs: ~30 min

**Per future pane onboarded** (each one is its own roadmap item, picked up by demand): M · ~1-2h AI per pane.

(Pre-AI human estimate: 1 day for foundational refactor + 1 day per pane.)

## Priority order for new panes (suggested)

Highest editing volume first:

1. **Navigation** (page CRUD) — most-used feature
2. **Modules / Sections** editor — deep, current advanced UI overwhelms novices
3. **Inquiries** — already simple-shaped, easy win
4. **Languages / Translations** — pairs with F8-bulk-introspection translation work
5. **Bundle** — already advanced-only; simplified version: "publish current state, no diff visible"
6. **Users** — simplified: invite + role; advanced: lockout, force password reset, audit
7. **SEO** — simplified: per-page description + image; advanced: site-wide flags + JSON-LD overrides

## Testids — for e2e

Every pane that ships both variants needs **mode-prefixed testids** so e2e specs target the right component unambiguously. Pattern from the universal rule:

- `<feature>-simplified-{role}` for simplified-mode interactive surfaces
- `<feature>-advanced-{role}` for advanced-mode-only controls
- `<feature>-{role}` (no prefix) for surfaces shared between variants — testids that live on the simplified base component and inherit when the advanced variant composes it

Examples (Themes):
- `themes-simplified-card-{themeId}` — the simplified card layout
- `themes-simplified-set-active-button-{themeId}` — set-active action (shared, same in both modes)
- `themes-advanced-bulk-delete-button` — advanced-only
- `themes-advanced-version-history-toggle-{themeId}` — advanced-only
- `themes-mode-flag-bulk-delete` — the site-flag toggle (when the flag UI is visible)

Per pane, e2e coverage tests both variants:
- `tests/e2e/admin/<feature>-simplified.spec.ts` — happy-path with simplified mode active
- `tests/e2e/admin/<feature>-advanced.spec.ts` — advanced controls + flag-gated sub-features

The shell switches mode via `defaultAdminUiMode` (already exists). e2e test setup can flip the mode per spec via the existing API.

## MCP coverage

Each per-feature site flag (e.g. `themesAdvancedBulkDelete`, `themesAdvancedVersionHistory`) lives in `siteFlags`. Already covered by `site.featureFlags` (read) and `site.setFeatureFlag` / `site.clearFeatureFlag` (write). No new MCP tools needed.

When adding a new advanced sub-feature behind a flag:
1. Add the flag's default to `services/features/Seo/SiteFlagsService.ts`
2. Add the flag name to `site.setFeatureFlag`'s description so agents discover it
3. (Optional) add a typed accessor to `shared/types/ISiteFlags.ts` so admin-side code reads the flag with autocomplete

The dispatch metadata itself (`{simplified, advanced}` per feature loader) is code-only — agents shouldn't be flipping which component renders for a user. That stays a human-driven UX setting per `defaultAdminUiMode` (already exists).

## Docs follow-up

- `docs/architecture/aui-mode.md` (new) — document the simplified-base / advanced-extends pattern, the lazy-load convention, and the feature-flag escape hatch.
- Per-pane: when onboarding a new pane to simplified mode, update `docs/architecture/admin-feature-shape.md` (or equivalent) with the file checklist.
- Update `docs/roadmap/shipped.md` per pane onboarded.

## Open questions (resolved 2026-05-07)

1. ~~Same folder or parallel hierarchy?~~ → **Same folder.** `ui/admin/features/<X>/` for both variants.
2. ~~Inheritance direction?~~ → **Simplified is base; advanced composes it.**
3. ~~Feature-flag every advanced control?~~ → **Optional per-feature** — flag the experimental ones, ship the stable ones unflagged.
4. ~~Bundle splitting?~~ → **Lazy-load each variant** so simplified mode never downloads advanced.