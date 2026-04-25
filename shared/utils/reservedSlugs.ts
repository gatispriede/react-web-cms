/**
 * Reserved page slugs — names an operator must never be allowed to use for
 * a site-builder page. The site-builder's catch-all route is
 * `pages/[...slug].tsx`; Next.js resolves any explicit page file BEFORE
 * the catch-all, so creating a Mongo navigation doc named e.g. `admin`
 * silently shadows the real `/admin` route in admin's mind but never
 * actually serves the doc — every link to that page 404s or routes to
 * the built-in surface. Blocking these at create time prevents the
 * confusion.
 *
 * Categories below are deliberate — keep them grouped so it's obvious
 * why each entry is here when someone wants to add or remove one.
 *
 * Compared case-insensitively after trimming so `Admin`, ` ADMIN `, etc.
 * all hit the block. Used by both `NavigationService` (server) and
 * `AddNewDialogNavigation` (admin form) so the rule is enforced at both
 * the API boundary and as you type — server-side is the source of truth,
 * client-side is just so the OK button disables and the operator gets a
 * hint without having to round-trip.
 */
export const RESERVED_PAGE_SLUGS: ReadonlyArray<string> = [
    // Built-in top-level routes shipped under `ui/client/pages/`. Each of
    // these resolves to a real page file and would shadow / be shadowed
    // by a Mongo navigation doc of the same name.
    'admin',     // pages/admin.tsx + pages/admin/*
    'blog',      // pages/blog/index.tsx + pages/blog/[slug].tsx
    'app',       // pages/app.tsx
    'auth',      // pages/auth/signin.tsx
    'dev',       // pages/dev/modules-preview.tsx

    // Next.js framework reserved paths — these are never serveable as
    // user pages and including them is purely defensive.
    'api',       // Next API routes
    '_next',     // Next runtime assets
    '_app',      // pages/_app.tsx (won't match a path anyway, but safe)
    '_document', // pages/_document.tsx
    '_error',    // Next error overlay
    '404',       // pages/404.tsx
    '500',       // Next default 500

    // i18n locale prefixes from `next-i18next.config.js`. Next bakes
    // these into URL routing, so a page named `lv` would collide with
    // the Latvian locale's URL prefix.
    'en', 'it', 'lt', 'lv', 'ru',

    // Static asset / rewrite paths from `next.config.js`. `locales`
    // serves the runtime translation JSON, the others are rewrites to
    // API handlers.
    'locales',
    'robots.txt',
    'sitemap.xml',

    // Sentinel — kept reserved so QA fixtures and ad-hoc smoke tests
    // can rely on `/test` always being safe to create/destroy without
    // colliding with a real operator-authored page.
    'test',
];

/** Normalise the input to the canonical comparison form. */
const normalize = (s: unknown): string =>
    typeof s === 'string' ? s.trim().toLowerCase() : '';

/** True if `name` is one of the hard-blocked page slugs. */
export function isReservedPageSlug(name: unknown): boolean {
    const n = normalize(name);
    if (!n) return false;
    return RESERVED_PAGE_SLUGS.includes(n);
}

/**
 * Throw-style guard for service callers — keeps the call sites short.
 * Throws an `Error` whose message is safe to surface to the operator.
 */
export function assertNotReservedPageSlug(name: unknown): void {
    if (isReservedPageSlug(name)) {
        throw new Error(
            `"${String(name).trim()}" is a reserved page name and can't be used. ` +
            `Reserved: ${RESERVED_PAGE_SLUGS.join(', ')}.`,
        );
    }
}
