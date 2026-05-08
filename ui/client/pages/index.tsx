import React from 'react';
import type {GetServerSideProps} from 'next';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {usePathname} from 'next/navigation';
import App from './app';
import LandingPage from '@client/features/Marketing/LandingPage';
import {fetchInitialPageData, InitialPageData} from '@client/lib/gqlFetch';

interface Props {
    initialData: InitialPageData;
    /** Fresh install (no published pages) — render the marketing landing. */
    showLanding: boolean;
}

const Index: React.FC<Props> = ({initialData, showLanding}) => {
    const {t, i18n} = useTranslation('app');
    const pathname = usePathname();
    if (showLanding) return <LandingPage />;
    return (
        <App
            pathname={pathname ?? ''}
            i18n={i18n}
            t={t}
            page={'/'}
            initialData={initialData}
        />
    );
};

// `/` was previously rendered via `getStaticProps + revalidate: 3600`
// but the production Docker build runs `tools/docker-prebuild.js` against
// an empty in-memory Mongo (the CMS data lives only on the running
// droplet at deploy time), which baked `showLanding=true` into the image.
// First hour after every deploy served the marketing landing instead of
// the configured site content; ISR eventually flipped it but the
// regression window was unacceptable. Switch to `getServerSideProps` so
// the `showLanding` decision happens against runtime Mongo on every
// request — no caching, but the page is cheap (one initialData fetch)
// and Caddy's SWR cache layer (production prod_cache feature) covers
// repeat-visitor performance.
export const getServerSideProps: GetServerSideProps<Props> = async ({locale}) => {
    const initialData = await fetchInitialPageData();
    // Fresh install (no Navigation entries): show the marketing landing.
    // After the first page is published, this flips automatically.
    const showLanding = (initialData.pages?.length ?? 0) === 0;
    return {
        props: {
            initialData,
            showLanding,
            ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
        },
    };
};

export default Index;
