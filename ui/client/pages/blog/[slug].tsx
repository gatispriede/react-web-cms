import React, {useEffect, useRef} from 'react';
import {GetStaticPaths, GetStaticProps} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import Link from 'next/link';
import Head from 'next/head';
import {ArrowLeftOutlined} from '@client/lib/icons';
import {Button, ConfigProvider, Space, Tag, Typography} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';
import staticTheme from '@client/features/Themes/themeConfig';
import {buildThemeConfig} from '@client/features/Themes/buildThemeConfig';
import {applyThemeCssVars} from '@client/features/Themes/applyThemeCssVars';
import {sanitizeHtml} from '@utils/sanitize';
import {IPost} from '@interfaces/IPost';
import Logo from '@client/features/Logo/Logo';
import SiteFooter from '@client/features/Footer/SiteFooter';
import {DEFAULT_FOOTER, IFooterConfig} from '@interfaces/IFooter';

interface Props {
    post: IPost | null;
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
    hasPosts: boolean;
}

const BlogPost = ({post, themeTokens, footer, pages, hasPosts}: Props) => {
    const {t} = useTranslation('common');
    const ref = useRef<HTMLDivElement | null>(null);
    useEffect(() => { if (themeTokens) applyThemeCssVars(themeTokens); }, [themeTokens]);
    const themeConfig = themeTokens ? buildThemeConfig(themeTokens) : staticTheme;

    useEffect(() => {
        if (ref.current && post?.body) ref.current.innerHTML = sanitizeHtml(post.body);
    }, [post?.body]);

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

    return (
        <ConfigProvider theme={themeConfig}>
            <Head>
                <title>{post.title}</title>
                {post.excerpt && <meta name="description" content={post.excerpt}/>}
                {post.coverImage && <meta property="og:image" content={post.coverImage}/>}
            </Head>
            <div style={{maxWidth: 720, margin: '0 auto', padding: '24px 20px 80px'}}>
                <Logo t={t} admin={false}/>
                <div style={{marginTop: 16}}>
                    <Link href="/blog"><Button type="link" icon={<ArrowLeftOutlined/>}>{t('All posts')}</Button></Link>
                </div>
                {post.coverImage && (
                    // Force a leading slash so the browser doesn't resolve
                    // relative cover paths (e.g. `api/cover.jpg`) against
                    // the current URL — on `/blog/cms` that would 404 as
                    // `/blog/api/cover.jpg`. Absolute URLs (http(s)://, //)
                    // and root-relative paths pass through unchanged.
                    <img
                        src={/^([a-z]+:|\/\/|\/)/i.test(post.coverImage) ? post.coverImage : `/${post.coverImage}`}
                        alt={post.title}
                        style={{width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 'var(--theme-borderRadius, 8px)', marginTop: 16}}
                    />
                )}
                <Typography.Title level={1} style={{marginTop: 20}}>{post.title}</Typography.Title>
                <Space size={12} style={{marginBottom: 16}}>
                    <Typography.Text type="secondary">
                        {post.publishedAt ? post.publishedAt.slice(0, 10) : ''}
                        {post.author ? ` · ${post.author}` : ''}
                    </Typography.Text>
                    {post.tags.length > 0 && (
                        <Space size={4} wrap>
                            {post.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
                        </Space>
                    )}
                </Space>
                <div ref={ref} className="rich-text"/>
            </div>
            <SiteFooter config={footer} pages={pages} hasPosts={hasPosts} t={t as any}/>
        </ConfigProvider>
    );
};

export const getStaticPaths: GetStaticPaths = async () => {
    const data = await gqlFetch<{mongo: {getPosts: string; getSiteFlags: string}}>(
        `{ mongo { getPosts(limit: 200) getSiteFlags } }`,
    );
    const blogEnabled = data?.mongo?.getSiteFlags
        ? JSON.parse(data.mongo.getSiteFlags).blogEnabled !== false
        : true;
    if (!blogEnabled) return {paths: [], fallback: false};
    const posts: {slug: string}[] = data?.mongo?.getPosts ? JSON.parse(data.mongo.getPosts) : [];
    return {
        paths: posts.map(p => ({params: {slug: p.slug}})),
        fallback: 'blocking',
    };
};

export const getStaticProps: GetStaticProps<Props> = async ({params, locale}) => {
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
    if (!blogEnabled) return {notFound: true, revalidate: 3600};
    if (!post) return {notFound: true, revalidate: 3600};
    return {
        props: {
            post,
            themeTokens,
            footer,
            pages,
            hasPosts,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
        revalidate: 3600,
    };
};

export default BlogPost;
