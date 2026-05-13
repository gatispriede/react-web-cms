/**
 * Customer feature flags — client-account-settings-page (Phase 1.E).
 *
 * Declared at module-load time via `defineFlag()` so the
 * `SiteFlagsService` registry sees the entry without an edit to its
 * sub-record interfaces. The corresponding admin pane reads the value
 * via the standard `site.get-flag` MCP tool.
 *
 * Flags owned here:
 *   - `commerce.defaultCustomerType` — what a new sign-up defaults
 *     to. `'client'` (recommended) | `'company'` | `'ask'` (force
 *     picker at signup). Public-readable so the storefront signup
 *     page can SSR-pre-pick the radio.
 *   - `commerce.accountSettingsEnabled` — master switch for the
 *     `/account/settings` system page. Defaults `true` when
 *     `auth.clientLoginEnabled` is on; operators can hide the entire
 *     surface without touching the auth feature.
 *   - `commerce.accountSettingsHiddenTabs` — list of tabs the
 *     operator wants to hide (e.g. `['payment']` when no checkout).
 */
import {defineFlag, isOneOf} from '@services/features/Seo/siteFlagDefinitions';

defineFlag<'client' | 'company' | 'ask'>({
    path: 'commerce.defaultCustomerType',
    defaultValue: 'client',
    typeGuard: isOneOf(['client', 'company', 'ask'] as const),
    audience: 'public-readable',
    description: 'Default customer type at signup. "ask" forces the user to pick.',
});

defineFlag<boolean>({
    path: 'commerce.accountSettingsEnabled',
    defaultValue: true,
    typeGuard: (v): v is boolean => typeof v === 'boolean',
    audience: 'public-readable',
    description: 'Master switch for the customer-side /account/settings page.',
});

defineFlag<string[]>({
    path: 'commerce.accountSettingsHiddenTabs',
    defaultValue: [],
    typeGuard: (v): v is string[] =>
        Array.isArray(v) && v.every(x => typeof x === 'string'),
    audience: 'public-readable',
    description: 'Tabs hidden on the /account/settings page (operator override).',
});
