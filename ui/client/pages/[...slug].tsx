import React, {useEffect} from 'react';
import type {GetStaticPaths, GetStaticProps} from 'next';
import {useRouter} from 'next/router';
import {useTranslation} from 'next-i18next/pages';
import {usePathname} from 'next/navigation';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import App from './app';
import {fetchInitialPageData, gqlFetch, InitialPageData} from '@client/lib/gqlFetch';
import {resolveSlugChain, slugChainForPage, NavRow} from '@client/lib/slugChain';

interface Props {
    initialData: InitialPageData;
    page: string;
    /** F7 — server-resolved page id for the current route. Threaded into
     *  `<App>` so the client never re-derives the active page from the
     *  display name. `undefined` only for legacy single-page mounts that
     *  bypass the catch-all. */
    pageId?: string;
    /** Full slug chain (root → leaf). Threaded into `<App>` so MainMenu's
     *  active-trail highlight works for nested routes. F1 sub-pages. */
    slugChain: string[];
}

const Slug: React.FC<Props> = ({initialData, page, pageId, slugChain}) => {
    const router = useRouter();
    const {t, i18n} = useTranslation('app');
    const pathname = usePathname();
    // F1 sub-pages — `slug` is now a string[] (catch-all). The legacy
    // single-segment behaviour collapses to `slug[slug.length - 1]`,
    // which is what `App` expects (the page-name lookup key).
    const querySlug = router.query.slug;
    const routerPage = Array.isArray(querySlug)
        ? querySlug[querySlug.length - 1]
        : (querySlug as string | undefined);
    const routerChain: string[] = Array.isArray(querySlug)
        ? querySlug
        : (querySlug ? [querySlug as string] : slugChain);
    // When the site is in single-page scroll mode, every page actually lives
    // as a `<section id>` on `/`. Legacy `/about` links should land users on
    // the correct anchor rather than a standalone page that's not part of the
    // layout. SSR still serves static content so crawlers see real HTML; the
    // client-side swap happens once React hydrates.
    useEffect(() => {
        if (initialData?.layoutMode !== 'scroll') return;
        const slug = (routerPage ?? page ?? '').toString()
            .replace(/\s+/g, '-')
            .toLowerCase();
        if (!slug || slug === '/') return;
        if (typeof window === 'undefined') return;
        // `replace` so the browser back button skips the intermediate URL.
        window.location.replace(`/#${slug}`);
    }, [initialData, routerPage, page]);
    return (
        <App
            pathname={pathname ?? ''}
            t={t}
            i18n={i18n}
            page={routerPage ?? page}
            pageId={pageId}
            slugChain={routerChain}
            initialData={initialData}
        />
    );
};

// next-i18next config holds the active locale set + default. Required
// here so per-locale slug paths emit at build time (F1 follow-up).
const i18nConfig = require('../../../next-i18next.config.js');

export const getStaticPaths: GetStaticPaths = async () => {
    // F1 — emit one path per page in the navigation tree, full slug
    // chain (root → leaf). Per-locale slugs (F1 follow-up): emit one
    // path per page × per locale so each translated URL has its own
    // SSG entry. `locale` is passed alongside `params` so Next.js
    // routes the right path → locale combo. Single-locale rows
    // (bare-string `slug`) collapse to identical chains across
    // locales — Next dedupes silently.
    const data = await gqlFetch<{mongo: {getNavigationCollection: NavRow[]}}>(
        `{ mongo { getNavigationCollection { id page parent slug } } }`,
    );
    const pages = data?.mongo?.getNavigationCollection ?? [];
    const locales: string[] = i18nConfig?.i18n?.locales ?? ['en'];
    const defaultLocale: string = i18nConfig?.i18n?.defaultLocale ?? 'en';
    const paths = pages.flatMap(p =>
        locales.map(loc => ({
            params: {slug: slugChainForPage(p, pages, loc, defaultLocale)},
            locale: loc,
        })),
    ).filter(p => p.params.slug.length > 0);
    return {paths, fallback: 'blocking'};
};

export const getStaticProps: GetStaticProps<Props> = async ({params, locale, defaultLocale}) => {
    const slugParam = params?.slug;
    const chain: string[] = Array.isArray(slugParam)
        ? slugParam
        : (slugParam ? [slugParam as string] : []);
    // F1 — walk the chain through the live navigation tree. If any
    // segment fails to resolve, return `notFound: true` so Next.js
    // serves the 404 page instead of rendering an empty App shell.
    const data = await gqlFetch<{mongo: {getNavigationCollection: NavRow[]}}>(
        `{ mongo { getNavigationCollection { id page parent slug } } }`,
    );
    const pages = data?.mongo?.getNavigationCollection ?? [];
    const matched = resolveSlugChain(pages, chain, locale, defaultLocale);
    if (!matched) {
        return {notFound: true, revalidate: 60};
    }
    const initialData = await fetchInitialPageData();
    return {
        props: {
            initialData,
            // `App` keys content lookup off `page` (display name).
            page: matched.page,
            // F7 — server-resolved id is the canonical handle for the
            // active page. Client uses it for exact id-based lookup
            // instead of re-deriving from the display name.
            pageId: matched.id,
            // Full slug chain so SSR + first paint can pre-compute the
            // SubMenu trail highlight without waiting on `router.query`.
            slugChain: chain,
            ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
        },
        revalidate: 3600,
    };
};

export default Slug;
