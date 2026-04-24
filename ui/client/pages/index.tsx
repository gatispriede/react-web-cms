import React from 'react';
import type {GetStaticProps} from 'next';
import {useTranslation} from 'next-i18next';
import {serverSideTranslations} from 'next-i18next/serverSideTranslations';
import {usePathname} from 'next/navigation';
import App from './app';
import {fetchInitialPageData, InitialPageData} from '@client/lib/gqlFetch';

interface Props {
    initialData: InitialPageData;
}

const Index: React.FC<Props> = ({initialData}) => {
    const {t, i18n} = useTranslation('app');
    const pathname = usePathname();
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
    return {
        props: {
            initialData,
            ...(await serverSideTranslations(locale ?? 'en', ['app', 'common'])),
        },
        revalidate: 60,
    };
};

export default Index;
