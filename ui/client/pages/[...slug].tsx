import React, {useEffect} from 'react';
import type {GetStaticPaths, GetStaticProps} from 'next';
import {useRouter} from 'next/router';
import {useTranslation} from 'next-i18next';
import {usePathname} from 'next/navigation';
import {serverSideTranslations} from 'next-i18next/serverSideTranslations';
import App from './app';
import {fetchInitialPageData, gqlFetch, InitialPageData} from '@client/lib/gqlFetch';

interface Props {
    initialData: InitialPageData;
    page: string;
}

const Slug: React.FC<Props> = ({initialData, page}) => {
    const router = useRouter();
    const {t, i18n} = useTranslation('app');
    const pathname = usePathname();
    const routerPage = Array.isArray(router.query.slug) ? router.query.slug[0] : (router.query.slug as string | undefined);
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
            initialData={initialData}
        />
    );
};

export const getStaticPaths: GetStaticPaths = async () => {
    const data = await gqlFetch<{mongo: {getNavigationCollection: {page: string}[]}}>(
        `{ mongo { getNavigationCollection { page } } }`,
    );
    const pages = data?.mongo?.getNavigationCollection ?? [];
    const paths = pages.map(p => ({
        params: {slug: [p.page.replace(/ /g, '-').toLowerCase()]},
    }));
    return {paths, fallback: 'blocking'};
};

export const getStaticProps: GetStaticProps<Props> = async ({params, locale}) => {
    const slug = Array.isArray(params?.slug) ? params?.slug[0] : (params?.slug as string | undefined);
    const initialData = await fetchInitialPageData();
    return {
        props: {
            initialData,
            page: slug ?? '/',
            ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
        },
        revalidate: 60,
    };
};

export default Slug;
