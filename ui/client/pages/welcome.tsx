/**
 * `/welcome` — system-page-backed marketing landing
 * (all-pages-module-composed, Marketing batch).
 *
 * The hand-coded `<LandingPage>` feature-component tree is replaced by
 * `<SystemPageDispatch>` over the registered `marketing-landing`
 * system page (Hero + FeatureGrid ×2 + LogoCloud + TestimonialWall +
 * PricingTable). Copy is carried in the registry's `defaultSections()`
 * and is now operator-editable via the module editors.
 *
 * Converted `getStaticProps` → `getServerSideProps` so the system-page
 * registry (populated at server boot) resolves per-request — same
 * migration the blog routes made.
 *
 * NOTE: `pages/index.tsx` still renders the legacy `<LandingPage>` for
 * the fresh-install homepage fallback; that component tree + its
 * `copy.ts` can be retired once `/` is migrated too.
 */
import React from 'react';
import Head from 'next/head';
import {ConfigProvider} from 'antd';
import {useTranslation} from 'next-i18next/pages';
import type {GetServerSideProps} from 'next';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import staticTheme from '@client/features/Themes/themeConfig';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface WelcomeProps {
    systemPage: ISystemPageSnapshot | null;
}

const Welcome: React.FC<WelcomeProps> = ({systemPage}) => {
    const {t} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    return (
        <ConfigProvider theme={staticTheme}>
            <Head>
                <title>CMS — MCP-native CMS for agencies</title>
                <meta
                    name="description"
                    content="An MCP-native CMS. Describe a page in plain English; modules, themes and copy land ready to publish."
                />
                <meta name="robots" content="index,follow"/>
            </Head>
            <main id="main" data-testid="page-welcome">
                {systemPage
                    ? <SystemPageDispatch systemKey="marketing-landing" sections={systemPage.defaultSections} t={t} tApp={tApp}/>
                    : null}
            </main>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<WelcomeProps> = async ({locale}) => ({
    props: {
        systemPage: loadSystemPageSnapshot('marketing-landing'),
        ...(await serverSideTranslations(locale ?? 'en', ['app', 'common', 'translation'])),
    },
});

export default Welcome;
