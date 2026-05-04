import React from 'react';
import type {NextPage, NextPageContext} from 'next';
import {useTranslation} from 'next-i18next/pages';
import ErrorScreen from '@client/features/ErrorScreen/ErrorScreen';

interface ErrorPageProps {
    statusCode?: number;
}

/**
 * Catch-all error page for runtime / production-time errors that aren't
 * either a 404 (handled by `404.tsx`) or a hard 500 hit during SSR
 * (handled by `500.tsx`). Same `<ErrorScreen/>` shell so the brand and
 * theme stay consistent across every error state.
 *
 * No `serverSideTranslations` here on purpose. `_error.tsx` runs through
 * `getInitialProps`, which fires both server- AND client-side — and
 * `next-i18next/pages/serverSideTranslations` imports `node:module`,
 * which webpack can't bundle for the browser (Module not found: 'module').
 * Including it crashes every route that hits the error path,
 * `/auth/signin` included. The `appWithTranslation` HOC in `_app.tsx`
 * keeps the i18next instance live across navigations; copy keys missing
 * from the cold-render bundle fall back to the source string (per
 * `fallbackLng: false` in next-i18next.config.js), which for an error
 * page is fine — the message stays readable.
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

ErrorPage.getInitialProps = async (ctx: NextPageContext): Promise<ErrorPageProps> => {
    const statusCode = ctx.res?.statusCode ?? ctx.err?.statusCode ?? 404;
    return {statusCode};
};

export default ErrorPage;
