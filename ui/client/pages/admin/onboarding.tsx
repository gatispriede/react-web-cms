import React from 'react';
import type {GetServerSideProps, GetServerSidePropsContext} from 'next';
import {useRouter} from 'next/router';
import {ConfigProvider} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import OnboardingWizard from '@admin/features/Onboarding/OnboardingWizard';
import staticTheme from '@client/features/Themes/themeConfig';

/**
 * Q7 — `/admin/onboarding`. SSR-gated: if `isFreshInstall()` returns
 * false, the visitor gets a 307 to `/admin/build` so the wizard can't
 * be re-run after an admin already exists. The fresh-install probe runs
 * in-process via the mongo connection — we don't go back through HTTP
 * to our own GraphQL endpoint just to read one boolean.
 */
const AdminOnboardingPage: React.FC = () => {
    const router = useRouter();
    return (
        <ConfigProvider theme={staticTheme}>
            <OnboardingWizard onComplete={() => router.push('/admin/build')}/>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps = async (
    ctx: GetServerSidePropsContext,
) => {
    let fresh = true;
    try {
        // Lazy require — same pattern as `MongoApi.addCustomerFromGoogle`.
        // Keeps the mongo connection out of the browser bundle graph; the
        // Turbopack/webpack analysis won't see this require.

        const nodeRequire = eval('require') as NodeJS.Require;
        const {getMongoConnection} = nodeRequire('@services/infra/mongoDBConnection');
        const conn = getMongoConnection() as any;
        const svc = conn.featureServices?.onboarding;
        if (svc?.isFreshInstall) {
            fresh = await svc.isFreshInstall();
        } else {
            // OnboardingService not booted yet — bail safely.
            fresh = false;
        }
    } catch {
        fresh = false;
    }
    if (!fresh) {
        return {redirect: {destination: '/admin/build', permanent: false}};
    }
    return {
        props: {
            ...(await serverSideTranslations(ctx.locale ?? 'en', ['common', 'app'])),
        },
    };
};

export default AdminOnboardingPage;
