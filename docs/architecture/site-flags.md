# Site flags

`SiteFlagsService` persists the single `siteFlags` doc in `SiteSettings`. Every operator-facing toggle and tenant-scoped config knob the CMS exposes ultimately lands here. As the feature surface grew, the four-place add pattern (interface + `DEFAULT_SITE_FLAGS` + `get()` read-side guard + `save()` whitelist) pushed the service past the 400-line guidance threshold and made adding a flag an editorial chore.

This doc covers the **sub-record namespace pattern** and the **`defineFlag()`** helper introduced to collapse those four edits into one declaration.

## Shape

```ts
interface ISiteFlags {
    // Legacy top-level fields — kept untouched for back-compat.
    blogEnabled: boolean;
    layoutMode: 'tabs' | 'scroll' | 'auto';
    inquiryEnabled?: boolean;
    allowGuestCheckout?: boolean;
    stripeTaxEnabled?: boolean;
    // … plus mail config, inquiry tuning, currency selection, etc.

    // New namespaces — populated via defineFlag().
    commerce?: ICommerceFlags;
    auth?: IAuthFlags;
    theme?: IThemeFlags;
    seo?: ISeoSubFlags;
}
```

Each sub-record is a typed bag scoped to one domain. Adding a new commerce-related flag does not touch auth, theme, or SEO code paths.

## Adding a flag

Consuming features call `defineFlag()` at module load — typically next to their service constructor or feature manifest. The registry is walked by `SiteFlagsService.get / save`, so the service file never needs to change.

```ts
import {defineFlag, isBoolean, isOneOf} from '@services/features/Seo/siteFlagDefinitions';

defineFlag({
    path: 'commerce.checkoutEnabled',
    defaultValue: true,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Master toggle for storefront checkout.',
});

defineFlag({
    path: 'commerce.defaultProductAudience',
    defaultValue: 'retail',
    typeGuard: isOneOf(['retail', 'wholesale', 'both'] as const),
    audience: 'public-readable',
    description: 'Default audience tag applied when an admin creates a new product.',
});
```

### Type-guards

The registry ships three primitives + one combinator:

- `isBoolean(v)`
- `isString(v)` — plain string, no validation
- `isFiniteNumber(v)` — rejects NaN / Infinity
- `isOneOf(values)` — closure returning a guard that narrows to the literal union

Anything more elaborate (RFC-5322 email shape, hex colour, etc.) goes inline — write the predicate locally and pass it as `typeGuard`.

### Audience

- `public-readable` — safe to inject into `InitialPageData` for SSR. Use for flags that affect public-site rendering.
- `admin-only` (default) — never leaves the server. Use for tenant config, secret toggles, internal A/B switches.

## When to add a flag vs a settings field

| Use a flag | Use a dedicated settings field |
|---|---|
| Cross-cutting toggle (`checkoutEnabled`) | Domain-specific config with its own collection (`Redirects`, `EmailConfig`) |
| Default value applied to new records (`defaultProductAudience`) | Per-record override (the product's own `audience` field) |
| Tenant-wide A/B knob | Per-user preference (`IUser.adminUiMode`) |

Rule of thumb: if you'd be tempted to write `if (siteFlags.X)` from more than one feature, it belongs in a flag. If the value drives a single feature's UI state with its own write semantics, it belongs in that feature's own settings collection.

## Back-compat policy

The existing flat top-level fields stay where they are. `get()` and `save()` continue to handle them inline with their original validation. Tests and downstream consumers that read `flags.blogEnabled`, `flags.layoutMode`, `flags.allowGuestCheckout`, etc. are unaffected.

**New flags go in sub-records.** Re-locating a legacy flag into a sub-record would break every consumer in the tree; defer that migration to a separate, explicitly-scoped jump.

## MCP surface

- `site.flagDefinitions.list` — read the registry. Use `byNamespace=true` for grouped output. Powers generic admin settings UIs.
- `site.featureFlags` / `site.setFeatureFlag` / `site.clearFeatureFlag` — **separate concern**: feature-manifest plug-and-play toggles (`cart`, `products`, etc.). Not site flags. Don't confuse the two.
- `site.setLayoutMode` — convenience wrapper over `saveSiteFlags({layoutMode})`. Stays for back-compat.

## Tests

- `services/features/Seo/SiteFlagsService.test.ts` — legacy contract (blogEnabled, layoutMode, defaults, version conflict).
- `services/features/Seo/__tests__/siteFlagDefinitions.test.ts` — registry primitives, type-guards, integration through `SiteFlagsService.get / save`.

## Files

- `services/features/Seo/SiteFlagsService.ts` — the service, the legacy flat fields, the sub-record wiring.
- `services/features/Seo/siteFlagDefinitions.ts` — the registry + `defineFlag()` + type-guards.
- `services/features/Mcp/tools/site.ts` — `site.flagDefinitions.list` MCP tool.

Last reviewed: 2026-05-13.
