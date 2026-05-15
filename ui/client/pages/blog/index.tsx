/**
 * `/blog` — system-page-backed blog index
 * (all-pages-module-composed, Blog batch).
 *
 * The post grid is now module-composed: it renders via
 * `<SystemPageDispatch>` over the registered `blog-index` system page,
 * whose locked `BlogFeed` module self-fetches the post list. The page
 * keeps its full SEO `<Head>` (Blog JSON-LD, canonical, og/twitter) +
 * Logo + footer chrome — blog is an indexable surface, so the metadata
 * stays in the route while the visible content becomes themeable
 * modules.
 */
import React, {useEffect} from 'react';
import {GetServerSideProps} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import Head from 'next/head';
import {ConfigProvider, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {IPost} from '@interfaces/IPost';
import Logo from '@client/features/Logo/Logo';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SystemPageDispatch from '@client/lib/systemPage/SystemPageDispatch';

interface Props {
    posts: IPost[];
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
    systemPage: ISystemPageSnapshot | null;
}

const BlogIndex = ({posts, themeTokens, footer, pages, systemPage}: Props) => {
    const {t} = useTranslation('common');
    const {t: tDispatch} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
    const blogUrl = `${siteUrl}/blog`;
    const description = t('Writing on engineering, AI workflows, CMS architecture, and the practice of building software end to end.');
    // Blog index gets a Blog/CollectionPage schema rather than Article — it's
    // a listing, not a single piece. Still emits enough for Google Discover
    // and rich-card previews on share.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: t('Writing'),
        description,
        url: blogUrl || undefined,
        blogPost: posts.slice(0, 20).map(p => ({
            '@type': 'BlogPosting',
            headline: p.title,
            url: siteUrl ? `${siteUrl}/blog/${p.slug}` : `/blog/${p.slug}`,
            datePublished: p.publishedAt || undefined,
            author: p.author ? {'@type': 'Person', name: p.author} : undefined,
        })),
    };

    return (
        <ConfigProvider theme={themeConfig}>
            <Head>
                <title>{t('Blog')}</title>
                <meta name="description" content={description}/>
                <meta name="robots" content="index, follow, max-image-preview:large"/>
                {siteUrl && <link rel="canonical" href={blogUrl}/>}
                <meta property="og:type" content="website"/>
                <meta property="og:title" content={t('Writing')}/>
                <meta property="og:description" content={description}/>
                {siteUrl && <meta property="og:url" content={blogUrl}/>}
                <meta name="twitter:card" content="summary"/>
                <meta name="twitter:title" content={t('Writing')}/>
                <meta name="twitter:description" content={description}/>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd, (_k, v) => v === undefined ? undefined : v)}}
                />
            </Head>
            <div style={{maxWidth: 1100, margin: '0 auto', padding: 24}}>
                <Logo t={t} admin={false}/>
                <Typography.Title level={1} style={{marginTop: 24}}>{t('Writing')}</Typography.Title>
                {systemPage
                    ? <SystemPageDispatch systemKey="blog-index" sections={systemPage.defaultSections} t={tDispatch} tApp={tApp}/>
                    : null}
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={posts.length > 0} blogEnabled={true} t={t as any}/>
        </ConfigProvider>
    );
};

// Switched from `getStaticProps + revalidate: 3600` to `getServerSideProps`
// 2026-05-09. The static path baked an empty-Mongo state at image build
// time (the prebuild's in-memory Mongo holds no posts), so /blog served
// "No posts published yet." for ~1h after every deploy until ISR caught
// up. Per-request render against runtime Mongo eliminates the staleness
// window. Same fix pattern as `pages/index.tsx`.
export const getServerSideProps: GetServerSideProps<Props> = async ({locale}) => {
    let posts: IPost[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    let blogEnabled = true;
    const data = await gqlFetch<{mongo: {getPosts: string; getActiveTheme: string | null; getFooter: string; getNavigationCollection: {page: string}[]; getSiteFlags: string}}>(
        `{ mongo { getPosts(limit: 50) getActiveTheme getFooter getNavigationCollection { page } getSiteFlags } }`,
    );
    try {
        posts = data?.mongo?.getPosts ? JSON.parse(data.mongo.getPosts) : [];
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
        if (data?.mongo?.getSiteFlags) blogEnabled = JSON.parse(data.mongo.getSiteFlags).blogEnabled !== false;
    } catch (err) {
        console.error('[blog/index] parse error:', err);
    }
    if (!blogEnabled) return {notFound: true};
    return {
        props: {
            posts,
            themeTokens,
            footer,
            pages,
            systemPage: loadSystemPageSnapshot('blog-index'),
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app', 'translation'])),
        },
    };
};

export default BlogIndex;
