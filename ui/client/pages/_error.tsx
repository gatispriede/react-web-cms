import React from 'react';
import type {NextPage, NextPageContext} from 'next';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import ErrorScreen from '@client/features/ErrorScreen/ErrorScreen';

interface ErrorPageProps {
    statusCode?: number;
}

/**
 * Catch-all error page for runtime / production-time errors that aren't
 * either a 404 (handled by `404.tsx`) or a hard 500 hit during SSR
 * (handled by `500.tsx`). Same `<ErrorScreen/>` shell so the brand and
 * theme stay consistent across every error state.
 */
const ErrorPage: NextPage<ErrorPageProps> = ({statusCode}) => {
    const {t} = useTranslation('app');
    const code = statusCode ?? 500;
    const isNotFound = code === 404;
    return (
        <ErrorScreen
            code={code}
            title={(isNotFound
                ? t('Page not found')
                : t('Something went wrong')) as string}
            description={(isNotFound
                ? t("The page you're looking for doesn't exist or has been moved.")
                : t('An unexpected error occurred. Try again in a moment, or head back home and try a different route.')) as string}
            t={t}
        />
    );
};

ErrorPage.getInitialProps = async (ctx: NextPageContext) => {
    const statusCode = ctx.res?.statusCode ?? ctx.err?.statusCode ?? 404;
    const locale = ctx.locale ?? 'en';
    return {
        statusCode,
        ...(await serverSideTranslations(locale, ['app', 'common'])),
    } as any;
};

export default ErrorPage;
