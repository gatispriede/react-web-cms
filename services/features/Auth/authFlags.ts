/**
 * Auth feature flag registrations — auth-split-client-admin (Phase 1.A).
 *
 * Importing this module registers all `auth.*` site-flags via
 * `defineFlag()`. The new boot path imports it once via the Auth
 * feature manifest (`feature.manifest.ts`) so the registration runs
 * at process start. Re-importing is idempotent — `defineFlag()`
 * replaces an existing registration on the same `path`.
 *
 * The flags here drive:
 *
 *  - `auth.clientLoginEnabled` — master toggle for the storefront
 *    customer-login surface (header dropdown, footer links, account
 *    routes, signup banner, magic-link request form). When `false`,
 *    `/account/*` middleware-404s, sitemap omits the routes, and the
 *    storefront renders zero auth UI.
 *  - `auth.provider*` — per-provider sub-toggles. Magic-link is the
 *    only sub-flag that defaults `true` (W6c spec — magic-link first).
 *    Credentials + OAuth providers default `false` so the operator
 *    must explicitly opt in to passwords / OAuth.
 *
 * The flag namespace is `auth.*`, the matching `IAuthFlags`
 * sub-record on `ISiteFlags` already exists (see
 * `services/features/Seo/SiteFlagsService.ts`).
 *
 * Audience `public-readable` — these flags are safe to expose via
 * SSR `InitialPageData` so the storefront can decide what to render
 * without a per-request roundtrip.
 */
import {defineFlag, isBoolean, type FlagPath} from '@services/features/Seo/siteFlagDefinitions';

/** Stable list of `auth.*` flag paths — used by MCP `auth.config.get`
 *  and the admin Auth-settings pane to enumerate flags in deterministic
 *  order. */
export const AUTH_FLAG_PATHS: readonly FlagPath[] = [
    'auth.clientLoginEnabled',
    'auth.providerMagicLink',
    'auth.providerCredentials',
    'auth.providerGoogle',
    'auth.providerFacebook',
    'auth.providerApple',
] as const;

defineFlag<boolean>({
    path: 'auth.clientLoginEnabled',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Master switch — when off, /account/* 404s + no storefront login UI surfaces.',
});

defineFlag<boolean>({
    path: 'auth.providerMagicLink',
    defaultValue: true,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Per-provider toggle — magic-link email sign-in (W6c default).',
});

defineFlag<boolean>({
    path: 'auth.providerCredentials',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Per-provider toggle — email + password sign-in. Off by default; magic-link recommended instead.',
});

defineFlag<boolean>({
    path: 'auth.providerGoogle',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Per-provider toggle — customer Google OAuth. Requires AUTH_CUSTOMER_GOOGLE_ID + AUTH_CUSTOMER_GOOGLE_SECRET env vars.',
});

defineFlag<boolean>({
    path: 'auth.providerFacebook',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Per-provider toggle — customer Facebook OAuth. Requires FACEBOOK_OAUTH_ENABLED + AUTH_FACEBOOK_* env vars.',
});

defineFlag<boolean>({
    path: 'auth.providerApple',
    defaultValue: false,
    typeGuard: isBoolean,
    audience: 'public-readable',
    description: 'Per-provider toggle — customer Apple OAuth. Required equal-prominence on iOS when other socials are enabled.',
});
