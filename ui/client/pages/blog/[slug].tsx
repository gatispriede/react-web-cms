/**
 * `/blog/[slug]` — system-page-backed single post
 * (all-pages-module-composed, Blog batch).
 *
 * The post body is now module-composed: it renders via
 * `<SystemPageDispatch>` over the registered `blog-post` system page,
 * whose locked `BlogPost` module reads the `[slug]` route param and
 * fetches the post (sanitising the stored HTML). The page keeps its
 * full SEO `<Head>` (Article JSON-LD, canonical, og/twitter/article:*)
 * + Logo + footer chrome.
 *
 * Converted `getStaticProps` → `getServerSideProps` — the system-page
 * registry is populated at server boot, not at static-build time, so
 * the snapshot must resolve per-request. Same migration the blog index
 * already made (see `blog/index.tsx` header).
 */
import React, {useEffect} from 'react';
import {GetServerSideProps} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import Link from 'next/link';
import Head from 'next/head';
import {ArrowLeftOutlined} from '@client/lib/icons';
import {Button, ConfigProvider, Typography} from 'antd';
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
    post: IPost | null;
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
    hasPosts: boolean;
    systemPage: ISystemPageSnapshot | null;
}

const BlogPostPage = ({post, themeTokens, footer, pages, hasPosts, systemPage}: Props) => {
    const {t} = useTranslation('common');
    const {t: tDispatch} = useTranslation('translation');
    const {t: tApp} = useTranslation('app');
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    if (!post) {
        return (
            <ConfigProvider theme={themeConfig}>
                <div style={{maxWidth: 720, margin: '0 auto', padding: 48}}>
                    <Typography.Title level={2}>{t('Post not found')}</Typography.Title>
                    <Link href="/blog">
                        <Button icon={<ArrowLeftOutlined/>}>{t('Back to blog')}</Button>
                    </Link>
                </div>
            </ConfigProvider>
        );
    }

    // ---- SEO helpers ------------------------------------------------------
    // Canonical URL + og:url need an absolute URL — Google penalises the
    // page if canonical resolves to a relative path. Prefer
    // NEXT_PUBLIC_SITE_URL but fall back to NEXTAUTH_URL because every
    // prod droplet already has that set.
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
    const postUrl = `${siteUrl}/blog/${post.slug}`;
    const absUrl = (path: string) =>
        /^([a-z]+:|\/\/)/i.test(path)
            ? path
            : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const coverAbs = post.coverImage ? absUrl(post.coverImage) : undefined;
    const tagsCsv = (post.tags ?? []).join(', ');
    // JSON-LD Article schema — drives Google rich-result eligibility.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt || undefined,
        image: coverAbs ? [coverAbs] : undefined,
        datePublished: post.publishedAt || undefined,
        dateModified: post.editedAt || post.publishedAt || undefined,
        author: post.author ? {'@type': 'Person', name: post.author} : undefined,
        publisher: siteUrl ? {'@type': 'Organization', name: siteUrl.replace(/^https?:\/\//, '')} : undefined,
        keywords: tagsCsv || undefined,
        mainEntityOfPage: {'@type': 'WebPage', '@id': postUrl},
    };

    return (
        <ConfigProvider theme={themeConfig}>
            <Head>
                <title>{post.title}</title>
                {post.excerpt && <meta name="description" content={post.excerpt}/>}
                <meta name="robots" content="index, follow, max-image-preview:large"/>
                {tagsCsv && <meta name="keywords" content={tagsCsv}/>}
                {siteUrl && <link rel="canonical" href={postUrl}/>}
                <meta property="og:type" content="article"/>
                <meta property="og:title" content={post.title}/>
                {post.excerpt && <meta property="og:description" content={post.excerpt}/>}
                {siteUrl && <meta property="og:url" content={postUrl}/>}
                {coverAbs && <meta property="og:image" content={coverAbs}/>}
                {post.publishedAt && <meta property="article:published_time" content={post.publishedAt}/>}
                {post.editedAt && <meta property="article:modified_time" content={post.editedAt}/>}
                {post.author && <meta property="article:author" content={post.author}/>}
                {(post.tags ?? []).map(tag => (
                    <meta key={tag} property="article:tag" content={tag}/>
                ))}
                <meta name="twitter:card" content="summary_large_image"/>
                <meta name="twitter:title" content={post.title}/>
                {post.excerpt && <meta name="twitter:description" content={post.excerpt}/>}
                {coverAbs && <meta name="twitter:image" content={coverAbs}/>}
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd, (_k, v) => v === undefined ? undefined : v)}}
                />
            </Head>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px'}}>
                <Logo t={t} admin={false}/>
                <div style={{marginTop: 16}}>
                    <Link href="/blog"><Button type="link" icon={<ArrowLeftOutlined/>}>{t('All posts')}</Button></Link>
                </div>
                {systemPage
                    ? <SystemPageDispatch systemKey="blog-post" sections={systemPage.defaultSections} t={tDispatch} tApp={tApp}/>
                    : null}
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={hasPosts} t={t as any}/>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<Props> = async ({params, locale}) => {
    const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
    let post: IPost | null = null;
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    let hasPosts = false;
    let blogEnabled = true;
    const data = await gqlFetch<{mongo: {
        getPost: string | null;
        getActiveTheme: string | null;
        getFooter: string;
        getNavigationCollection: {page: string}[];
        getPosts: string;
        getSiteFlags: string;
    }}>(
        `query($slug: String!){ mongo { getPost(slug: $slug) getActiveTheme getFooter getNavigationCollection { page } getPosts(limit: 1) getSiteFlags } }`,
        {slug: slug ?? ''},
    );
    try {
        const raw = data?.mongo?.getPost;
        post = raw ? JSON.parse(raw) : null;
        const themeRaw = data?.mongo?.getActiveTheme;
        if (themeRaw) themeTokens = JSON.parse(themeRaw).tokens ?? null;
        if (data?.mongo?.getFooter) footer = JSON.parse(data.mongo.getFooter);
        pages = (data?.mongo?.getNavigationCollection ?? []).map(p => ({page: p.page}));
        hasPosts = data?.mongo?.getPosts ? JSON.parse(data.mongo.getPosts).length > 0 : false;
        if (data?.mongo?.getSiteFlags) blogEnabled = JSON.parse(data.mongo.getSiteFlags).blogEnabled !== false;
    } catch (err) {
        console.error('[blog/[slug]] parse error:', err);
    }
    if (!blogEnabled) return {notFound: true};
    if (!post) return {notFound: true};
    return {
        props: {
            post,
            themeTokens,
            footer,
            pages,
            hasPosts,
            systemPage: loadSystemPageSnapshot('blog-post'),
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app', 'translation'])),
        },
    };
};

export default BlogPostPage;
