/**
 * App Router i18n SERVER setup — App Router migration, Batch 1.
 *
 * Owns the single `initServerI18next()` call (it must run once before
 * any `getT()` in a Server Component). Server-only: imports
 * `next-i18next/server`, which pulls in `fs/promises` and friends.
 * Anything in the client/SSR graph must use `./i18nConfig.ts` instead.
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
import {buildAppRouterI18nConfig} from './i18nConfig';

export {SUPPORTED_LNGS, FALLBACK_LNG, I18N_NAMESPACES, I18N_DEFAULT_NS} from './i18nConfig';

/**
 * On the server the v16 App-Router loader reads locale JSON straight off
 * disk; point it at the same `public/locales` tree the Pages-Router
 * backend uses so both surfaces serve identical copy.
 */
const SERVER_LOCALE_PATH = path.resolve('./ui/client/public/locales');

export const appRouterI18nConfig = buildAppRouterI18nConfig(SERVER_LOCALE_PATH);

/**
 * `initServerI18next` is idempotent-friendly but the App Router can
 * evaluate this module once per server worker; calling it at module
 * scope guarantees the singleton instance exists before the first
 * `getT()` in `layout.tsx` runs.
 */
initServerI18next(appRouterI18nConfig);
