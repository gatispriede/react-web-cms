// @ts-check
// `i18next-http-backend` v3 + `i18next-chained-backend` v5 both export the
// plugin class as the CJS module root (no `.default`). Earlier versions
// shipped a `.default` named export — using it now yields `undefined`,
// which crashes next-i18next's `userConfig.use.some(b => b.type)` check
// in createConfig.js.
const HttpBackend = require('i18next-http-backend/cjs')
const ChainedBackend = require('i18next-chained-backend')

const isBrowser = typeof window !== 'undefined'
const isDev = false// process.env.NODE_ENV === 'development'
const cacheTime = 0// 60 * 60 * 1000
/**
 * @type {import('next-i18next/pages').UserConfig}
 */
module.exports = {
    // https://www.i18next.com/overview/configuration-options#logging
    debug: isDev,
    i18n: {
        // Auto-redirect based on `Accept-Language` is disabled because it racey
        // with `/admin` (the admin surface lives outside the locale-prefix
        // scheme and the user drives admin language via `preferredAdminLocale`
        // / the admin dropdown, not the URL). Public site locale is still user-
        // selectable via the `.language-dropdown`.
        localeDetection: false,
        // Public-site default locale. Next.js bakes this into URL routing
        // at build time (the `Languages` admin doc's `default: true` flag
        // governs the *Mongo* default for bundle export and translation
        // fallback ordering, but Next.js i18n is static). Operators flip
        // this constant when the canonical site language changes — last
        // change 2026-04-25 from 'lv' → 'en' so `/` serves the English
        // home and `/lv` serves the Latvian variant.
        defaultLocale: 'en',
        locales: [
            // "aa",
            // "ab",
            // "ae",
            // "af",
            // "ak",
            // "am",
            // "an",
            // "ar",
            // "as",
            // "av",
            // "ay",
            // "az",
            // "ba",
            // "be",
            // "bg",
            // "bh",
            // "bi",
            // "bm",
            // "bn",
            // "bo",
            // "br",
            // "bs",
            // "ca",
            // "ce",
            // "ch",
            // "co",
            // "cr",
            // "cs",
            // "cu",
            // "cv",
            // "cy",
            // "da",
            // "de",
            // "dv",
            // "dz",
            // "ee",
            // "el",
             "en",
            // "eo",
            // "es",
            // "et",
            // "eu",
            // "fa",
            // "ff",
            // "fi",
            // "fj",
            // "fo",
            // "fr",
            // "fy",
            // "ga",
            // "gd",
            // "gl",
            // "gn",
            // "gu",
            // "gv",
            // "ha",
            // "he",
            // "hi",
            // "ho",
            // "hr",
            // "ht",
            // "hu",
            // "hy",
            // "hz",
            // "ia",
            // "id",
            // "ie",
            // "ig",
            // "ii",
            // "ik",
            // "io",
            // "is",
             "it",
            // "iu",
            // "ja",
            // "jv",
            // "ka",
            // "kg",
            // "ki",
            // "kj",
            // "kk",
            // "kl",
            // "km",
            // "kn",
            // "ko",
            // "kr",
            // "ks",
            // "ku",
            // "kv",
            // "kw",
            // "ky",
            // "la",
            // "lb",
            // "lg",
            // "li",
            // "ln",
            // "lo",
             "lt",
            // "lu",
             "lv",
            // "mg",
            // "mh",
            // "mi",
            // "mk",
            // "ml",
            // "mn",
            // "mr",
            // "ms",
            // "mt",
            // "my",
            // "na",
            // "nb",
            // "nd",
            // "ne",
            // "ng",
            // "nl",
            // "nn",
            // "no",
            // "nr",
            // "nv",
            // "ny",
            // "oc",
            // "oj",
            // "om",
            // "or",
            // "os",
            // "pa",
            // "pi",
            // "pl",
            // "ps",
            // "pt",
            // "qu",
            // "rm",
            // "rn",
            // "ro",
             "ru",
            // "rw",
            // "sa",
            // "sc",
            // "sd",
            // "se",
            // "sg",
            // "si",
            // "sk",
            // "sl",
            // "sm",
            // "sn",
            // "so",
            // "sq",
            // "sr",
            // "ss",
            // "st",
            // "su",
            // "sv",
            // "sw",
            // "ta",
            // "te",
            // "tg",
            // "th",
            // "ti",
            // "tk",
            // "tl",
            // "tn",
            // "to",
            // "tr",
            // "ts",
            // "tt",
            // "tw",
            // "ty",
            // "ug",
            // "uk",
            // "ur",
            // "uz",
            // "ve",
            // "vi",
            // "vo",
            // "wa",
            // "wo",
            // "xh",
            // "yi",
            // "yo",
            // "za",
            // "zh",
            // "zu"
        ],
    },
    defaultNS: "app",
    ns: ["app", "common"],
    // No cross-locale fallback. Without this, i18next inherits `fallbackLng`
    // from `defaultLocale` ('lv'), which means a missing EN key reads the
    // LV translation instead — so the English page renders Latvian phrases
    // for any string that wasn't authored in en/app.json. Source content
    // already carries the canonical English text, and `translateOrKeep`
    // returns the source value when a key is absent, so disabling the
    // language fallback is the correct behaviour: EN serves source, LV
    // serves translations, neither bleeds into the other.
    fallbackLng: false,
    use: isBrowser ? [ChainedBackend] : [],
    backend: {
        backendOptions: [{ expirationTime: isDev ? 0 : cacheTime }, {}], // 1 hour
        backends: [
            HttpBackend,
        ],
    },
    reloadOnPrerender: process.env.NODE_ENV === 'development',
    partialBundledLanguages: isBrowser && true,
    localePath:
        typeof window === 'undefined'
            ? require('path').resolve('./ui/client/public/locales')
            : '/locales/{{lng}}/{{ns}}.json',
    /**
     * @link https://github.com/i18next/next-i18next#6-advanced-configuration
     */
    saveMissing: true,
    // strictMode: true,
    serializeConfig: false,
    // react: { useSuspense: false }
}