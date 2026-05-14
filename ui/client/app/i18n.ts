/**
 * App Router i18n setup — App Router migration, Batch 1.
 *
 * `next-i18next@^16` exposes a separate App-Router surface
 * (`next-i18next/server` + `next-i18next/client`) distinct from the
 * Pages-Router `next-i18next/pages` subpath the legacy `pages/*` tree
 * still uses. Both can coexist while the migration is in flight.
 *
 * This module owns the single `initServerI18next()` call (it must run
 * once before any `getT()` in a Server Component) and re-exports the
 * config so `app/providers.tsx` can seed the client `<I18nProvider>`
 * with the matching `supportedLngs` / `defaultNS` / `localePath`.
 *
 * We run in **no-locale-path mode** (`localeInPath: false`): the App
 * Router pages migrated in Batch 1 (`/privacy`, `/terms`, the error
 * pages) are not locale-prefixed routes — locale is resolved from the
 * `i18next` cookie / `Accept-Language` header, mirroring the old
 * `_app.tsx` `universalLanguageDetect` behaviour. The Pages-Router
 * `next.config.js` `i18n` block still drives `/lv` etc. for the
 * not-yet-migrated pages.
 */
import path from 'path';
import {initServerI18next} from 'next-i18next/server';
import type {I18nConfig} from 'next-i18next';
import nextI18NextConfig from '../../../next-i18next.config.js';

/** Locales the public site supports — sourced from the shared config. */
export const SUPPORTED_LNGS: string[] = nextI18NextConfig.i18n.locales as string[];
/** Fallback / default locale (the one served at the un-prefixed root). */
export const FALLBACK_LNG: string = nextI18NextConfig.i18n.defaultLocale;
/** Namespaces the App-Router surface loads. Matches the Pages-Router `ns`. */
export const I18N_NAMESPACES: string[] = (nextI18NextConfig.ns as string[]) ?? ['app', 'common'];
/** Default namespace — keep parity with the Pages-Router `defaultNS`. */
export const I18N_DEFAULT_NS: string = (nextI18NextConfig.defaultNS as string) ?? 'app';

/**
 * On the server the v16 App-Router loader reads locale JSON straight off
 * disk; point it at the same `public/locales` tree the Pages-Router
 * backend uses so both surfaces serve identical copy.
 */
const SERVER_LOCALE_PATH =
    typeof window === 'undefined'
        ? path.resolve('./ui/client/public/locales')
        : '/locales';

export const appRouterI18nConfig: I18nConfig = {
    supportedLngs: SUPPORTED_LNGS,
    fallbackLng: FALLBACK_LNG,
    defaultNS: I18N_DEFAULT_NS,
    ns: I18N_NAMESPACES,
    localePath: SERVER_LOCALE_PATH,
    // No `/lv`-style prefix on the migrated App-Router routes — see header.
    localeInPath: false,
    // Match the legacy `i18next` cookie `_app.tsx` / the language dropdown
    // already write, so a locale chosen on a Pages-Router page carries
    // over to a migrated App-Router page and vice-versa.
    cookieName: 'i18next',
    // No cross-locale fallback at the i18next level — same rationale as
    // `next-i18next.config.js` `fallbackLng: false`: EN serves source
    // copy, LV serves translations, neither bleeds into the other. The
    // v16 `I18nConfig.fallbackLng` (top-level, above) is a *required*
    // string used only to pick the resource bundle to load when a
    // request locale is unrecognised — it is not an i18next-level
    // cross-locale key fallback, so it does not reintroduce the bleed.
};

/**
 * `initServerI18next` is idempotent-friendly but the App Router can
 * evaluate this module once per server worker; calling it at module
 * scope guarantees the singleton instance exists before the first
 * `getT()` in `layout.tsx` runs.
 */
initServerI18next(appRouterI18nConfig);
