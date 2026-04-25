import React from 'react';
import {GetServerSideProps} from 'next';
import {useTranslation} from 'next-i18next/pages';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import ModulesPreview from '@client/lib/preview/ModulesPreview';

/**
 * Dev-only modules preview — same renderer as `/admin/modules-preview` but
 * with no auth gate. Returns a 404 when `NODE_ENV !== 'development'` so this
 * route never escapes into a production build.
 *
 * Use case: while iterating on new module code we want a fast hot-reload
 * loop without round-tripping through the admin login + UserStatusBar
 * shell. The admin route is the canonical surface for operators; this one
 * is for the developer running `npm run dev` locally.
 */
const DevModulesPreview = () => {
    const {t, i18n} = useTranslation('app');
    return <ModulesPreview t={t as any} tApp={i18n.getFixedT(i18n.language, 'app') as any}/>;
};

export const getServerSideProps: GetServerSideProps = async ({locale}) => {
    if (process.env.NODE_ENV !== 'development') {
        return {notFound: true};
    }
    return {
        props: {
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
    };
};

export default DevModulesPreview;
