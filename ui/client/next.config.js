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
    // Pages-Router `i18n` block removed in B7 of the App Router migration —
    // locale handling now lives in `app/layout.tsx` + `app/i18n.ts` (server
    // cookie/Accept-Language read + `next-i18next/server` init). The
    // `locale: false` flags on the admin redirects below are now no-ops
    // (Next ignores unknown redirect props) but kept for documentation of
    // intent: those rules must NEVER be locale-rewritten by any future
    // re-introduction of the `i18n` block. See
    // `docs/roadmap/platform/app-router-migration.md` (STATUS: SHIPPED).
    reactStrictMode: true,

    typescript: {
        tsconfigPath,
        // E2E baseline capture path — let next build emit even when type
        // errors exist in the working tree. Visual baseline capture is the
        // goal; runtime bundle is what matters, not the type-check pass.
        // Operator should fix TS errors before any non-E2E build / deploy.
        ignoreBuildErrors: process.env.E2E_BUILD === '1',
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
        // Phase 2 of admin segregation — `/admin/languages` was a flat
        // pages-router pane; translations live under Content now.
        {source: '/admin/languages', destination: '/admin/content/translations', permanent: false},
        // `/admin/settings` previously 301'd to `/admin/build` (Phase 2
        // of admin segregation). Re-pivot reclaims `/admin/settings` as
        // a top-level bucket landing — the redirect is dropped; the
        // route's `page.tsx` now bounces to the Footer demonstrator.
        //
        // admin-information-architecture re-pivot (2026-05-16, same day
        // as the first ship): the 6-bucket Site/Content/Commerce/People/
        // Analytics/System taxonomy collapses to 5 task-driven buckets:
        // Build / Content / Settings / Analytics / System. Old URLs 301
        // here.
        //
        // SCOPE NOTE: only the demonstrator panes whose loaders + App
        // Router page directories actually moved in this jump have
        // direct old→new redirects. The other ~40 panes still serve
        // from their legacy URLs (their loaders carry the legacy paneId
        // so the lookup keeps working); per-area sweep follow-ups add
        // their old→new rows here. Adding a redirect *before* the new
        // directory exists 404s the operator — don't.
        //
        // The shim ships for one release cycle (~2 months). After that
        // the redirects are dropped — anyone still hitting an old URL
        // gets a 404 and updates their bookmark.
        //
        // ── Demonstrator-pane direct redirects ─────────────────────
        // Footer: legacy → first-ship 6-bucket → re-pivot 5-bucket
        {source: '/admin/content/footer', destination: '/admin/settings/chrome/footer', permanent: false},
        {source: '/admin/site/footer', destination: '/admin/settings/chrome/footer', permanent: false},
        // Users: legacy → first-ship 6-bucket → re-pivot 5-bucket
        {source: '/admin/system/users', destination: '/admin/settings/access/users', permanent: false},
        {source: '/admin/people/users', destination: '/admin/settings/access/users', permanent: false},
        // Invoices: first-ship 6-bucket → re-pivot 5-bucket (Commerce
        // dissolved into Content for author-facing lists)
        {source: '/admin/commerce/invoices', destination: '/admin/content/invoices', permanent: false},
        // Analytics dashboard (first-ship URL stays canonical)
        {source: '/admin/seo/analytics', destination: '/admin/analytics', permanent: false},
        // Diagnostics (renamed from `info`; first-ship URL stays canonical)
        {source: '/admin/system/info', destination: '/admin/system/diagnostics', permanent: false},

        // ── First-ship 6-bucket landings (re-pivoted to 5-bucket) ──
        // Operators bookmarked yesterday's 6-bucket URLs need the same-
        // day re-pivot to keep working. Each defunct bucket maps to
        // its 5-bucket home; sub-paths fall through to the legacy
        // backing URLs (their loaders are still registered).
        {source: '/admin/site', destination: '/admin/settings/chrome/footer', permanent: false},
        {source: '/admin/commerce', destination: '/admin/content/invoices', permanent: false},
        {source: '/admin/people', destination: '/admin/settings/access/users', permanent: false},
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
        // Admin PWA manifest — referenced as `/admin/manifest.json` from
        // the admin shell `<link rel="manifest">`. The actual handler
        // lives under `pages/api/admin/` (Next pages-router only invokes
        // the `(req,res)=>…` shape under `pages/api/`); the rewrite gives
        // it the clean admin URL the spec + browsers expect.
        {
            source: "/admin/manifest.json",
            destination: "/api/admin/manifest.json",
        },
    ],
    // Next 16 introduced a per-middleware body-size cap (default 10 MB)
    // that's independent of the per-route `bodyParser.sizeLimit`. The
    // bundle import (`/api/import`) sends the entire serialised site —
    // photos, CMS pages, themes — and routinely exceeds 10 MB on
    // moderately-sized installs. Without this cap raised, the route
    // handler sees a truncated body and the JSON parse rejects with
    // "400 Invalid JSON". Key is `experimental.proxyClientMaxBodySize`
    // (renamed from `middlewareClientMaxBodySize` in Next 16). Matches
    // the route's 200 MB `api.bodyParser.sizeLimit` in import.ts.
    experimental: {
        proxyClientMaxBodySize: '200mb',
    },
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