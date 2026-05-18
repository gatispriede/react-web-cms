/**
 * Public catch-all (`/[...slug]`) — App Router migration, Batch 4.
 *
 * Direct port of `pages/[...slug].tsx`. Server Component: resolves the
 * navigation row for the requested slug-chain via `resolveSlugChain`,
 * fetches the per-request initial page data, and hands a hydrated
 * `<SiteShell>` (client) the same `page` / `pageId` / `slugChain` /
 * `initialData` props the Pages-Router shape provided.
 *
 * Locale handling: under the App Router we run in **no-locale-path mode**
 * (see `app/i18n.ts` — `localeInPath: false`). The Pages-Router catch-all
 * relied on `next.config.js`'s `i18n` block to strip a leading `/lv` /
 * `/lt` / `/ru` segment and surface `locale` as a separate `getStaticProps`
 * arg; that does NOT apply to App Router routes. To keep existing
 * locale-prefixed URLs working (`/lv/about` etc.), we detect a leading
 * supported-locale segment and strip it here before walking the
 * navigation tree. The active locale is still resolved cookie-first by
 * `app/layout.tsx`, so the prefix is purely a URL-shape concern.
 *
 * `generateStaticParams` is deliberately omitted: the root `app/layout.tsx`
 * is `dynamic = 'force-dynamic'`, so every public render is per-request
 * regardless. The Pages-Router `getStaticPaths` existed to seed the SSG
 * cache and that's gone. Re-add later if we layer revalidation in.
 *
 * Scroll-mode hash redirect (the `useEffect` from the old page that
 * rewrote `/about` → `/#about` when the site is in single-page scroll
 * mode) is intentionally NOT ported as part of B4 — under app router,
 * scroll-mode users hit `/` directly via the navigation, and the legacy
 * URL still SSRs the standalone page (which is real HTML for crawlers).
 * Folded into the SiteShell's own client-side hash handler in a follow-up
 * if QA flags it.
 */
import React from 'react';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import SiteShell from '@client/lib/SiteShell';
import {fetchInitialPageData, gqlFetch} from '@client/lib/gqlFetch';
import {resolveSlugChain, type NavRow} from '@client/lib/slugChain';
import {SUPPORTED_LNGS, FALLBACK_LNG} from '@client/app/i18nConfig';

export const dynamic = 'force-dynamic';

interface RouteParams {
    slug: string[];
}

/**
 * Strip a leading locale segment when present. Returns the locale (if
 * any) and the remaining slug chain. Empty chain → fall through to the
 * not-found path (the homepage is `app/page.tsx`, not this route).
 */
function splitLocalePrefix(raw: string[]): {locale: string | undefined; chain: string[]} {
    if (!Array.isArray(raw) || raw.length === 0) return {locale: undefined, chain: []};
    const first = raw[0];
    if (first && SUPPORTED_LNGS.includes(first)) {
        return {locale: first, chain: raw.slice(1)};
    }
    return {locale: undefined, chain: raw};
}

async function loadNavigation(): Promise<NavRow[]> {
    const data = await gqlFetch<{mongo: {getNavigationCollection: NavRow[]}}>(
        `{ mongo { getNavigationCollection { id page parent slug } } }`,
    );
    return data?.mongo?.getNavigationCollection ?? [];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<Metadata> {
    const {slug} = await params;
    const {locale, chain} = splitLocalePrefix(slug ?? []);
    if (chain.length === 0) return {};
    const pages = await loadNavigation();
    const matched = resolveSlugChain(pages, chain, locale ?? FALLBACK_LNG, FALLBACK_LNG);
    if (!matched) return {};
    return {
        title: matched.page,
    };
}

export default async function CatchAllPage({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<React.ReactElement> {
    const {slug} = await params;
    const {locale, chain} = splitLocalePrefix(slug ?? []);
    if (chain.length === 0) notFound();

    const pages = await loadNavigation();
    const matched = resolveSlugChain(pages, chain, locale ?? FALLBACK_LNG, FALLBACK_LNG);
    if (!matched) notFound();

    const initialData = await fetchInitialPageData();

    return (
        <SiteShell
            page={matched.page}
            pageId={matched.id}
            slugChain={chain}
            initialData={initialData}
        />
    );
}
