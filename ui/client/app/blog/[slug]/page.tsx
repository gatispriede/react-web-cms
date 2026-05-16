/**
 * `/blog/[slug]` — App Router migration, Batch 4.
 *
 * Server-Component port of the former `pages/blog/[slug].tsx`. Per-request
 * GraphQL fetch (post body + theme + footer + nav + posts-presence + flags
 * + system-page snapshot) here; chrome in the `'use client'` `BlogPostView`.
 *
 * SEO `<Head>` (canonical, og/twitter/article meta, JSON-LD Article schema)
 * moves to `generateMetadata`. The JSON-LD `<script>` is emitted inline
 * since `Metadata` has no first-class structured-data slot — same pattern
 * as the blog index.
 *
 * `pages/blog/[slug].tsx` deleted in the same commit.
 */
import React from 'react';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {gqlFetch} from '@client/lib/gqlFetch';
import type {IPost} from '@interfaces/IPost';
import {DEFAULT_FOOTER, type IFooterConfig} from '@interfaces/IFooter';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import BlogPostView from './BlogPostView';

export const dynamic = 'force-dynamic';

interface RouteParams {
    slug: string;
}

interface BlogPostData {
    post: IPost | null;
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
    hasPosts: boolean;
    blogEnabled: boolean;
}

async function loadBlogPostData(slug: string): Promise<BlogPostData> {
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
        {slug},
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
        console.error('[app/blog/[slug]] parse error:', err);
    }
    return {post, themeTokens, footer, pages, hasPosts, blogEnabled};
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
const absUrl = (path: string): string =>
    /^([a-z]+:|\/\/)/i.test(path)
        ? path
        : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

export async function generateMetadata({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<Metadata> {
    const {slug} = await params;
    const {post} = await loadBlogPostData(slug);
    if (!post) return {title: 'Post not found'};
    const postUrl = `${SITE_URL}/blog/${post.slug}`;
    const coverAbs = post.coverImage ? absUrl(post.coverImage) : undefined;
    const tagsCsv = (post.tags ?? []).join(', ');
    return {
        title: post.title,
        description: post.excerpt || undefined,
        keywords: tagsCsv || undefined,
        alternates: SITE_URL ? {canonical: postUrl} : undefined,
        robots: {index: true, follow: true, 'max-image-preview': 'large'} as any,
        openGraph: {
            type: 'article',
            title: post.title,
            description: post.excerpt || undefined,
            url: SITE_URL ? postUrl : undefined,
            images: coverAbs ? [{url: coverAbs}] : undefined,
            publishedTime: post.publishedAt || undefined,
            modifiedTime: post.editedAt || post.publishedAt || undefined,
            authors: post.author ? [post.author] : undefined,
            tags: post.tags ?? undefined,
        },
        twitter: {
            card: 'summary_large_image',
            title: post.title,
            description: post.excerpt || undefined,
            images: coverAbs ? [coverAbs] : undefined,
        },
    };
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<RouteParams>;
}): Promise<React.ReactElement> {
    const {slug} = await params;
    const {post, themeTokens, footer, pages, hasPosts, blogEnabled} = await loadBlogPostData(slug);
    if (!blogEnabled) notFound();
    if (!post) notFound();
    const systemPage = loadSystemPageSnapshot('blog-post');
    const postUrl = `${SITE_URL}/blog/${post.slug}`;
    const coverAbs = post.coverImage ? absUrl(post.coverImage) : undefined;
    const tagsCsv = (post.tags ?? []).join(', ');
    // JSON-LD Article schema — emit inline server-side (same as the blog
    // index). Drives Google rich-result eligibility.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt || undefined,
        image: coverAbs ? [coverAbs] : undefined,
        datePublished: post.publishedAt || undefined,
        dateModified: post.editedAt || post.publishedAt || undefined,
        author: post.author ? {'@type': 'Person', name: post.author} : undefined,
        publisher: SITE_URL ? {'@type': 'Organization', name: SITE_URL.replace(/^https?:\/\//, '')} : undefined,
        keywords: tagsCsv || undefined,
        mainEntityOfPage: {'@type': 'WebPage', '@id': postUrl},
    };
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd, (_k, v) => v === undefined ? undefined : v)}}
            />
            <BlogPostView
                post={post}
                themeTokens={themeTokens}
                footer={footer}
                pages={pages}
                hasPosts={hasPosts}
                systemPage={systemPage}
            />
        </>
    );
}
