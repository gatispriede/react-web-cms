const {i18n} = require('../../next-i18next.config.js')
const {loadCustomBuildParams} = require('./next-utils.config')
const {tsconfigPath} = loadCustomBuildParams()
// E2E full-suite builds (`pnpm e2e:full:build`) write into a sibling
// `.next-e2e/` so they don't clobber the local dev server's `.next/`.
// `next start` later in `e2e:full` reads from the same dir via the
// same env flag. Set by the script, never by humans directly.
const distDir = process.env.E2E_BUILD_DIR ? process.env.E2E_BUILD_DIR : '.next';

/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir,
    transpilePackages: [
        //
        "@glidejs",
        // antd & deps
        "@ant-design",
        "@rc-component",
        "antd",
        "rc-cascader",
        "rc-checkbox",
        "rc-collapse",
        "rc-dialog",
        "rc-drawer",
        "rc-dropdown",
        "rc-field-form",
        "rc-image",
        "rc-input",
        "rc-input-number",
        "rc-mentions",
        "rc-menu",
        "rc-motion",
        "rc-notification",
        "rc-pagination",
        "rc-picker",
        "rc-progress",
        "rc-rate",
        "rc-resize-observer",
        "rc-segmented",
        "rc-select",
        "rc-slider",
        "rc-steps",
        "rc-switch",
        "rc-table",
        "rc-tabs",
        "rc-textarea",
        "rc-tooltip",
        "rc-tree",
        "rc-tree-select",
        "rc-upload",
        "rc-util",
    ],
    // E2E builds run each Playwright worker on a different free port —
    // baking `NEXTAUTH_URL` here would freeze it to :80 and NextAuth's
    // prod-mode CSRF/cookie origin check would reject every worker login.
    // Skip the inline when E2E_BUILD_DIR is set; runtime `process.env`
    // (set by the worker's `server.ts`) drives the value instead.
    env: process.env.E2E_BUILD_DIR ? {
        API_URL: 'http://localhost',
    } : {
        NEXTAUTH_URL: 'http://localhost:80',
        API_URL: 'http://localhost',
        NEXT_PUBLIC_BASE_URL: 'http://localhost:80',
    },
    i18n: i18n,
    reactStrictMode: true,

    typescript: {
        tsconfigPath,
    },
    sassOptions: {},
    // Locale-prefixed admin URLs from old bookmarks redirect to the prefix-
    // less admin. `locale: false` stops Next.js expanding the source with the
    // active locale. We intentionally skip the defaultLocale (`en`) — Next.js
    // i18n treats `/admin` and `/en/admin` as the same route (defaultLocale
    // canonical form), and adding a rule for `/en/admin` causes `/admin` to
    // 307-redirect to itself (internal canonicalization loop). Admin language
    // is driven by `preferredAdminLocale`, not the URL.
    redirects: async () => [
        {source: '/lv/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/lv/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        {source: '/it/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/it/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        {source: '/lt/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/lt/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        {source: '/ru/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/ru/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        // Phase 2 of admin segregation — legacy URLs jump to the new area
        // structure. Keep `/admin/settings` reachable only as a redirect
        // target (the file remains for the AdminSettings legacy fallback).
        {source: '/admin/settings', destination: '/admin/build', permanent: false},
        {source: '/admin/languages', destination: '/admin/content/translations', permanent: false},
        {source: '/admin/modules-preview', destination: '/admin/build/modules-preview', permanent: false},
    ],
    rewrites: async () => [
        {
            source: "/robots.txt",
            destination: "/api/robots.txt",
        },
        {
            source: "/sitemap.xml",
            destination: "/api/sitemap.xml",
        },
        {
            source: "/sitemap-:id.xml",
            destination: "/api/sitemap-:id.xml",
        },
    ],
    // Locale JSON files are the runtime translation store — admin saves
    // rewrite them live, so browsers MUST fetch fresh every time. Without
    // this, the first reload after a save serves cached JSON and changes
    // only appear on the second refresh.
    headers: async () => [
        {
            source: "/locales/:lang/:ns.json",
            headers: [
                {key: "Cache-Control", value: "no-store, max-age=0, must-revalidate"},
            ],
        },
    ],
}

module.exports = nextConfig