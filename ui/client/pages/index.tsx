import React from 'react';
import type {GetStaticProps} from 'next';
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

export const getStaticProps: GetStaticProps<Props> = async ({locale}) => {
    const initialData = await fetchInitialPageData();
    // Fresh install: no published pages (and therefore nothing meaningful to
    // show on `/`). Defer to the marketing landing until the user authors
    // their first page. After publish, ISR revalidation flips this back.
    const showLanding = (initialData.pages?.length ?? 0) === 0;
    return {
        props: {
            initialData,
            showLanding,
            ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
        },
        revalidate: 3600,
    };
};

export default Index;
