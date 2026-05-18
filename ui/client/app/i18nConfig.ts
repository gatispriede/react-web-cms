/**
 * App Router i18n constants — pure-data module, safe for client bundles.
 *
 * Split out of `app/i18n.ts` so `app/providers.tsx` (Client Component)
 * can read `SUPPORTED_LNGS` / `I18N_DEFAULT_NS` without dragging
 * `next-i18next/server` (Node-only, uses `fs/promises`) into the
 * client/SSR graph. The server-side `initServerI18next` call still
 * lives in `app/i18n.ts` and is only imported from Server Components
 * (`app/layout.tsx`, `app/not-found.tsx`).
 */
import type {I18nConfig} from 'next-i18next';
import nextI18NextConfig from '../../../next-i18next.config.js';

export const SUPPORTED_LNGS: string[] = nextI18NextConfig.i18n.locales as string[];
export const FALLBACK_LNG: string = nextI18NextConfig.i18n.defaultLocale;
export const I18N_NAMESPACES: string[] = (nextI18NextConfig.ns as string[]) ?? ['app', 'common'];
export const I18N_DEFAULT_NS: string = (nextI18NextConfig.defaultNS as string) ?? 'app';

/**
 * Builder for the server-side `I18nConfig`. Takes the resolved
 * `localePath` (server uses an on-disk absolute, client uses `/locales`)
 * so the only place that needs `path` / Node primitives is `app/i18n.ts`.
 */
export function buildAppRouterI18nConfig(localePath: string): I18nConfig {
    return {
        supportedLngs: SUPPORTED_LNGS,
        fallbackLng: FALLBACK_LNG,
        defaultNS: I18N_DEFAULT_NS,
        ns: I18N_NAMESPACES,
        localePath,
        localeInPath: false,
        cookieName: 'i18next',
    };
}
