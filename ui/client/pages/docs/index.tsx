import React, {useEffect} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import Head from 'next/head';
import {Card, Col, ConfigProvider, Empty, Row, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import {gqlFetch} from '@client/lib/gqlFetch';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import Logo from '@client/features/Logo/Logo';
import RevealOnScroll from '@client/lib/RevealOnScroll';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';

/**
 * Pages whose admin name starts with `Docs ` are surfaced through the
 * `/docs` route family. The convention keeps docs out of the main nav
 * (which uses the page list as-is) while still letting the same
 * sections / modules / theming pipeline render them. Slugs are derived
 * from the part after `Docs ` and lowercase-hyphenated.
 */
const DOCS_PREFIX = 'Docs ';

interface DocPage {
    page: string;
    slug: string;
    title: string;
}

interface Props {
    docs: DocPage[];
    themeTokens: any | null;
    footer: IFooterConfig;
    navPages: {page: string}[];
}

const slugify = (s: string) => s.replace(/\s+/g, '-').toLowerCase();

const DocsIndex: React.FC<Props> = ({docs, themeTokens, footer, navPages}) => {
    const {t} = useTranslation('common');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    return (
        <ConfigProvider theme={themeConfig}>
            <Head>
                <title>{t('Documentation')}</title>
                <meta name="description" content="CMS documentation: setup, feature reference, AI / MCP workflow."/>
            </Head>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <Logo t={t} admin={false}/>
                <Typography.Title level={1} style={{marginTop: 24}}>{t('Documentation')}</Typography.Title>
                <Typography.Paragraph type="secondary">
                    Setup, feature reference, and the AI / MCP authoring workflow.
                </Typography.Paragraph>
                {docs.length === 0 && (
                    <Empty description="No docs pages imported yet. Apply docs-bundle.json from the Bundle pane."/>
                )}
                <Row gutter={[16, 16]}>
                    {docs.map((d, i) => (
                        <Col xs={24} md={12} lg={8} key={d.slug}>
                            <RevealOnScroll delay={i * 40}>
                                <Link href={`/docs/${d.slug}`} style={{textDecoration: 'none'}}>
                                    <Card hoverable>
                                        <Card.Meta
                                            title={d.title}
                                            description={`/docs/${d.slug}`}
                                        />
                                    </Card>
                                </Link>
                            </RevealOnScroll>
                        </Col>
                    ))}
                </Row>
            </div>
            <SiteFooter config={footer} pages={navPages} hasPosts={false} blogEnabled={false} t={t as any}/>
        </ConfigProvider>
    );
};

// Switched from `getStaticProps + revalidate: 3600` to `getServerSideProps`
// 2026-05-09. Same root cause as `pages/index.tsx`, `pages/blog/index.tsx`,
// `pages/products/index.tsx` — build-time empty Mongo baked an empty docs
// list into the static page; ~1h stale window after every deploy until ISR
// caught up. Per-request render against runtime Mongo eliminates it.
export const getServerSideProps: GetServerSideProps<Props> = async ({locale}) => {
    let docs: DocPage[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let navPages: {page: string}[] = [];
    const data = await gqlFetch<{mongo: {
        getNavigationCollection: {page: string}[];
        getActiveTheme: string | null;
        getFooter: string;
    }}>(
        `{ mongo { getNavigationCollection { page } getActiveTheme getFooter } }`,
    );
    try {
        const all = data?.mongo?.getNavigationCollection ?? [];
        navPages = all.map(p => ({page: p.page})).filter(p => !p.page.startsWith(DOCS_PREFIX));
        docs = all
            .filter(p => p.page.startsWith(DOCS_PREFIX))
            .map(p => {
                const title = p.page.slice(DOCS_PREFIX.length);
                return {page: p.page, title, slug: slugify(title)};
            })
            .sort((a, b) => a.title.localeCompare(b.title));
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
    } catch (err) {
        console.error('[docs/index] parse error:', err);
    }
    return {
        props: {
            docs,
            themeTokens,
            footer,
            navPages,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
    };
};

export default DocsIndex;
