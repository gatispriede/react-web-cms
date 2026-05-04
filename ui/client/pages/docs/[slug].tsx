import React, {useEffect, useRef} from 'react';
import {GetStaticPaths, GetStaticProps} from 'next';
import Link from 'next/link';
import Head from 'next/head';
import {Button, ConfigProvider, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import {gqlFetch} from '@client/lib/gqlFetch';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {sanitizeHtml} from '@utils/sanitize';
import Logo from '@client/features/Logo/Logo';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';

/**
 * Per-doc-page route. The matching admin page is named `Docs <Title>`
 * (e.g. `Docs Setup`); we reverse the slug → title lookup against the
 * navigation collection. Section content is fetched directly because
 * docs pages are intentionally simple (one RichText per page) — using
 * the full `<App>` shell here would pull in tabs/scroll layout logic
 * we don't want for static docs.
 */
const DOCS_PREFIX = 'Docs ';
const slugify = (s: string) => s.replace(/\s+/g, '-').toLowerCase();

interface Props {
    title: string | null;
    html: string;
    themeTokens: any | null;
    footer: IFooterConfig;
    navPages: {page: string}[];
}

const DocPage: React.FC<Props> = ({title, html, themeTokens, footer, navPages}) => {
    const {t} = useTranslation('common');
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    useEffect(() => {
        if (ref.current && html) ref.current.innerHTML = sanitizeHtml(html);
    }, [html]);

    if (!title) {
        return (
            <ConfigProvider theme={themeConfig}>
                <div style={{maxWidth: 720, margin: '0 auto', padding: 48}}>
                    <Typography.Title level={2}>{t('Doc not found')}</Typography.Title>
                    <Link href="/docs"><Button type="link">{t('All docs')}</Button></Link>
                </div>
            </ConfigProvider>
        );
    }

    return (
        <ConfigProvider theme={themeConfig}>
            <Head>
                <title>{`${title} — Docs`}</title>
                <meta name="description" content={`Documentation: ${title}.`}/>
            </Head>
            <div style={{maxWidth: 800, margin: '0 auto', padding: '24px 20px 80px'}}>
                <Logo t={t} admin={false}/>
                <div style={{marginTop: 16}}>
                    <Link href="/docs"><Button type="link">{t('All docs')}</Button></Link>
                </div>
                <Typography.Title level={1} style={{marginTop: 12}}>{title}</Typography.Title>
                <div ref={ref} className="rich-text"/>
            </div>
            <SiteFooter config={footer} pages={navPages} hasPosts={false} blogEnabled={false} t={t as any}/>
        </ConfigProvider>
    );
};

export const getStaticPaths: GetStaticPaths = async () => {
    const data = await gqlFetch<{mongo: {getNavigationCollection: {page: string}[]}}>(
        `{ mongo { getNavigationCollection { page } } }`,
    );
    const all = data?.mongo?.getNavigationCollection ?? [];
    const paths = all
        .filter(p => p.page.startsWith(DOCS_PREFIX))
        .map(p => ({params: {slug: slugify(p.page.slice(DOCS_PREFIX.length))}}));
    return {paths, fallback: 'blocking'};
};

export const getStaticProps: GetStaticProps<Props> = async ({params, locale}) => {
    const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug as string | undefined);
    let title: string | null = null;
    let html = '';
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let navPages: {page: string}[] = [];

    const data = await gqlFetch<{mongo: {
        getNavigationCollection: {page: string; sections: string[]}[];
        getActiveTheme: string | null;
        getFooter: string;
    }}>(
        `{ mongo { getNavigationCollection { page sections } getActiveTheme getFooter } }`,
    );
    try {
        const all = data?.mongo?.getNavigationCollection ?? [];
        navPages = all.map(p => ({page: p.page})).filter(p => !p.page.startsWith(DOCS_PREFIX));
        const docPages = all.filter(p => p.page.startsWith(DOCS_PREFIX));
        const match = docPages.find(p => slugify(p.page.slice(DOCS_PREFIX.length)) === slug);
        if (match) {
            title = match.page.slice(DOCS_PREFIX.length);
            const sectionIds = match.sections ?? [];
            if (sectionIds.length) {
                const secResp = await gqlFetch<{mongo: {getSections: {id: string; content: {type: string; content: string}[]}[]}}>(
                    `query($ids:[String]){ mongo { getSections(ids: $ids) { id content { type content } } } }`,
                    {ids: sectionIds},
                );
                const sections = secResp?.mongo?.getSections ?? [];
                // Concatenate every RichText payload across this page's sections
                // in authored order. Anything that isn't RichText is skipped —
                // docs pages are authored as RichText-only by the seeder, but
                // a hand-edited page might include other modules; ignoring
                // those keeps the docs view focused on prose.
                const ordered = sectionIds.map(id => sections.find(s => s.id === id)).filter(Boolean) as typeof sections;
                const parts: string[] = [];
                for (const sec of ordered) {
                    for (const item of sec.content ?? []) {
                        if (item.type !== 'RICH_TEXT') continue;
                        try {
                            const v = JSON.parse(item.content || '{}');
                            if (typeof v.value === 'string') parts.push(v.value);
                        } catch { /* skip unparseable */ }
                    }
                }
                html = parts.join('\n');
            }
        }
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
    } catch (err) {
        console.error('[docs/[slug]] parse error:', err);
    }

    if (!title) return {notFound: true, revalidate: 3600};
    return {
        props: {
            title,
            html,
            themeTokens,
            footer,
            navPages,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
        revalidate: 3600,
    };
};

export default DocPage;
