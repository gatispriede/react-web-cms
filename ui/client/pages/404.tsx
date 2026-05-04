import React from 'react';
import type {GetStaticProps} from 'next';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import ErrorScreen from '@client/features/ErrorScreen/ErrorScreen';

/**
 * Themed 404. Picks up the active theme's CSS vars from `_document.tsx`
 * (already injected on every route) so the page matches whatever theme
 * the operator picked in admin. Static — Next.js Pages Router requires
 * 404 to be statically generated, so no `getServerSideProps` here.
 */
const NotFound: React.FC = () => {
    const {t} = useTranslation('app');
    return (
        <ErrorScreen
            code={404}
            title={t('Page not found') as string}
            description={t("The page you're looking for doesn't exist or has been moved.") as string}
            t={t}
        />
    );
};

export const getStaticProps: GetStaticProps = async ({locale}) => ({
    props: {
        ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
    },
});

export default NotFound;
