const {i18n} = require('../../next-i18next.config.js')
const {loadCustomBuildParams} = require('./next-utils.config')
const {tsconfigPath} = loadCustomBuildParams()
// E2E full-suite builds (`pnpm e2e:full:build`) write into a sibling
// `.next-e2e/` so they don't clobber the local dev server's `.next/`.
// `next start` later in `e2e:full` reads from the same dir via the
// same env flag. Set by the script, never by humans directly.
const distDir = process.env.E2E_BUILD_DIR ? process.env.E2E_BUILD_DIR : '.next';

// Resolve the build SHA at config time so every entry tagged by the
// logger (server) and reportError (browser via window.__BUILD_ID__)
// names the exact deploy. Falls through to `dev` when git's missing.
let resolvedBuildId = process.env.BUILD_ID;
if (!resolvedBuildId) {
    try {
        const cp = require('child_process');
        resolvedBuildId = cp.execSync('git rev-parse --short HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
    } catch {
        resolvedBuildId = 'dev';
    }
    process.env.BUILD_ID = resolvedBuildId;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    distDir,
    // Standalone output (Wave 1 Terraform/Kamal followup, 2026-05-08).
    // Generates `.next/standalone/` with a minimal Node app + tree-shaken
    // `node_modules` containing only what the running server imports.
    // Replaces wholesale-COPY of `node_modules/` (1.1 GB) in the runtime
    // Dockerfile stage with `.next/standalone/` (~150 MB target).
    //
    // Required runtime layout (see `infra/AppDockerfile`):
    //   /app/server.js                     ← from .next/standalone/server.js
    //   /app/node_modules                  ← from .next/standalone/node_modules
    //   /app/<workspace>/.next/static      ← copy separately
    //   /app/<workspace>/public            ← copy separately
    //
    // CMD changes from `npm run start` (next start -p 80 ui/client) to
    // `node server.js` — server.js is what next emits to host the app.
    output: 'standalone',
    // Force-include packages whose conditional `exports` map points
    // at `.mjs` variants that Next's standalone tracer skips. Surfaced
    // 2026-05-08 with `@reduxjs/toolkit` — runtime tried to require
    // `dist/redux-toolkit.modern.mjs` (the ESM-condition target), but
    // standalone only copied `dist/cjs/` because the tracer follows
    // the CJS leg of the exports map. Result: 500 on /admin routes.
    //
    // If new packages surface the same bug at runtime (`Cannot find
    // module .../dist/...mjs`), add their dist/** glob here.
    // Path is relative to the project root (where next.config.js lives:
    // ui/client/), but node_modules is at the REPO root, so climb two
    // levels with `../../`.
    outputFileTracingIncludes: {
        '*': [
            '../../node_modules/@reduxjs/toolkit/dist/**',
        ],
    },
    // Server-only packages that should NEVER be bundled into the browser
    // chunk. The redis client + @node-rs/xxhash native digest helper are
    // imported transitively from `services/infra/redisConnection.ts` →
    // `services/api/graphqlResolvers.ts` → `pages/api/graphql.ts`.
    // Without this list, Turbopack tries to resolve their browser entry
    // (which chains to WASM/WASI variants that don't exist in this
    // dependency tree) and fails the build.
    serverExternalPackages: [
        'redis',
        '@redis/client',
        '@redis/bloom',
        '@redis/graph',
        '@redis/json',
        '@redis/search',
        '@redis/time-series',
        '@node-rs/xxhash',
    ],
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
        // Browser-readable build SHA — `reportError.ts` injects it on
        // every payload so an admin debugging a stale-tab error knows
        // which deploy the failing code came from.
        NEXT_PUBLIC_BUILD_ID: resolvedBuildId,
    } : {
        NEXTAUTH_URL: 'http://localhost:80',
        API_URL: 'http://localhost',
        NEXT_PUBLIC_BASE_URL: 'http://localhost:80',
        NEXT_PUBLIC_BUILD_ID: resolvedBuildId,
    },
    i18n: i18n,
    reactStrictMode: true,

    typescript: {
        tsconfigPath,
    },
    sassOptions: {},
    // Make webpack watch the shared services/ directory (sits outside ui/client/).
    // Without this, changes to services/agent/*.ts are not detected in dev mode.
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.watchOptions = {
                ...config.watchOptions,
                // On Windows, polling is needed for cross-drive or parent-dir watchers.
                poll: 1000,
                ignored: /node_modules/,
            };
        }
        return config;
    },
    // Locale-prefixed admin URLs from old bookmarks redirect to the prefix-
    // less admin. `locale: false` stops Next.js expanding the source with the
    // active locale. We intentionally skip the defaultLocale (`en`) — Next.js
    // i18n treats `/admin` and `/en/admin` as the same route (defaultLocale
    // canonical form), and adding a rule for `/en/admin` causes `/admin` to
    // 307-redirect to itself (internal canonicalization loop). Admin language
    // is driven by `preferredAdminLocale`, not the URL.
    redirects: async () => [
        // Locale-prefixed admin URLs from old bookmarks → prefix-stripped admin.
        {source: '/lv/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/lv/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        {source: '/it/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/it/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        {source: '/lt/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/lt/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        {source: '/ru/admin', destination: '/admin', permanent: false, locale: false},
        {source: '/ru/admin/:path*', destination: '/admin/:path*', permanent: false, locale: false},
        // Phase 2 of admin segregation — legacy URLs jump to the new area structure.
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