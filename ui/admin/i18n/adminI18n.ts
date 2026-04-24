/**
 * Dedicated i18n instance for the admin chrome — separate from the public
 * site's `next-i18next` instance. Solves the "edit Latvian translations
 * and the admin nav also flips to Latvian" foot-gun: whatever locale the
 * admin picks for *editing* doesn't shift the chrome they're navigating
 * with.
 *
 * Bundles the locale resources in-process (no HTTP backend) — admin
 * locales are a small, version-controlled set and don't need translator
 * round-tripping through the same Languages collection the public site
 * uses. Adding a new admin locale: drop a JSON file under
 * `src/frontend/admin-locales/` and add it to `LOCALES` + `RESOURCES`.
 *
 * Locale precedence on the client (first match wins):
 *   1. `localStorage.admin.locale` — the explicit user choice
 *   2. `navigator.language`'s base code if it's in `LOCALES`
 *   3. `'en'` fallback
 *
 * SSR: returns `'en'` (no `localStorage` / `navigator`); the chrome
 * re-resolves on the client and triggers a language change to the
 * persisted preference. Acceptable since admin pages are SSR-then-
 * hydrate and the en→lv flip happens before user interaction.
 */
import i18n, {i18n as I18n} from 'i18next';
import {initReactI18next} from 'react-i18next';
import en from '@admin/i18n/en.json';
import lv from '@admin/i18n/lv.json';

export type AdminLocale = 'en' | 'lv';

export const ADMIN_LOCALES: ReadonlyArray<{code: AdminLocale; label: string}> = [
    {code: 'en', label: 'English'},
    {code: 'lv', label: 'Latvian'},
];

const RESOURCES: Record<AdminLocale, {translation: Record<string, string>}> = {
    en: {translation: en as Record<string, string>},
    lv: {translation: lv as Record<string, string>},
};

const STORAGE_KEY = 'admin.locale';

export function getStoredAdminLocale(): AdminLocale | null {
    if (typeof window === 'undefined') return null;
    try {
        const v = window.localStorage.getItem(STORAGE_KEY);
        if (v === 'en' || v === 'lv') return v;
    } catch { /* localStorage may be unavailable in sandboxed contexts */ }
    return null;
}

export function setStoredAdminLocale(locale: AdminLocale): void {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(STORAGE_KEY, locale); } catch { /* noop */ }
}

/**
 * Detect the operator's preferred locale from localStorage / navigator.
 * Returns null on the server (no access to either) — callers use that as
 * a signal to defer the language switch until after hydration.
 */
export function detectStoredOrNavigatorLocale(): AdminLocale | null {
    const stored = getStoredAdminLocale();
    if (stored) return stored;
    if (typeof navigator !== 'undefined') {
        const code = navigator.language?.split('-')[0]?.toLowerCase();
        if (code === 'en' || code === 'lv') return code;
    }
    return null;
}

const adminI18n: I18n = i18n.createInstance();

// Initial language is always `'en'` — matching the SSR default. The actual
// preferred locale is applied in a post-mount effect (see `UserStatusBar`)
// so the first client render matches the server HTML byte-for-byte and
// React's hydration doesn't spit a "text didn't match" warning into the
// dev overlay. A language change after hydration triggers a normal
// re-render, which is fine — no hydration contract is violated there.
void adminI18n
    .use(initReactI18next)
    .init({
        lng: 'en',
        fallbackLng: 'en',
        // Admin chrome uses literal English strings as keys (matching the
        // existing call sites pulled from `next-i18next` so the migration
        // is a search-and-replace). `keySeparator: false` stops i18next
        // from treating `Site settings → Users` as a nested path.
        keySeparator: false,
        nsSeparator: false,
        resources: RESOURCES,
        interpolation: {escapeValue: false},
        react: {useSuspense: false},
    });

export function setAdminLocale(locale: AdminLocale): void {
    setStoredAdminLocale(locale);
    void adminI18n.changeLanguage(locale);
}

export default adminI18n;
