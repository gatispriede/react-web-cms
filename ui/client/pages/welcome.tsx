import React from 'react';
import type {GetStaticProps} from 'next';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import LandingPage from '@client/components/Marketing/LandingPage';

/**
 * Always-on marketing landing route. Reachable as `/welcome` regardless of
 * whether the customer has published their own homepage. The `/` route also
 * renders this page when the install is fresh (no published pages).
 */
const Welcome: React.FC = () => <LandingPage />;

export const getStaticProps: GetStaticProps = async ({locale}) => ({
    props: {
        ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
    },
    revalidate: 3600,
});

export default Welcome;
