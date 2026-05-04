import React from 'react';
import type {GetStaticProps} from 'next';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import ErrorScreen from '@client/features/ErrorScreen/ErrorScreen';

/**
 * Themed 500. Static per Next.js Pages Router convention. Triggers on
 * server-side rendering errors that propagate up to the framework.
 * Runtime errors caught in the React tree fall through to `_error.tsx`
 * — both render the same `<ErrorScreen/>`, just with different copy.
 */
const ServerError: React.FC = () => {
    const {t} = useTranslation('app');
    return (
        <ErrorScreen
            code={500}
            title={t('Something went wrong') as string}
            description={t('A server error occurred. Try again in a moment, or head back home and try a different route.') as string}
            t={t}
        />
    );
};

export const getStaticProps: GetStaticProps = async ({locale}) => ({
    props: {
        ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
    },
});

export default ServerError;
