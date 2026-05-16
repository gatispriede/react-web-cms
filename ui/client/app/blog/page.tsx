/**
 * `/blog` — App Router migration, Batch 4.
 *
 * Server-Component port of the former `pages/blog/index.tsx`. The per-
 * request GraphQL fetch (posts + theme + footer + nav + flags + system-
 * page snapshot) runs here; visible chrome lives in the `'use client'`
 * `BlogIndexView` so antd / `applyThemeCssVars` / `useTranslation` stay
 * in the browser runtime.
 *
 * SEO `<Head>` (canonical, og/twitter, JSON-LD Blog schema) moves to
 * `generateMetadata` below — the App-Router idiom. The structured-data
 * JSON-LD is emitted via `metadata.other` since `<script type="application/ld+json">`
 * is not first-class in `Metadata`. Equivalent crawler signal.
 *
 * `pages/blog/index.tsx` deleted in the same commit — both routers can't
 * claim the same path.
 */
import React from 'react';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getT} from 'next-i18next/server';
import {gqlFetch} from '@client/lib/gqlFetch';
import type {IPost} from '@interfaces/IPost';
import {DEFAULT_FOOTER, type IFooterConfig} from '@interfaces/IFooter';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import BlogIndexView from './BlogIndexView';

export const dynamic = 'force-dynamic';

interface BlogIndexData {
    posts: IPost[];
    themeTokens: any | null;
    footer: IFooterConfig;
    pages: {page: string}[];
    blogEnabled: boolean;
}

async function loadBlogIndexData(): Promise<BlogIndexData> {
    let posts: IPost[] = [];
    let themeTokens: any | null = null;
    let footer: IFooterConfig = {...DEFAULT_FOOTER};
    let pages: {page: string}[] = [];
    let blogEnabled = true;
    const data = await gqlFetch<{mongo: {
        getPosts: string;
        getActiveTheme: string | null;
        getFooter: string;
        getNavigationCollection: {page: string}[];
        getSiteFlags: string;
    }}>(
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
        console.error('[app/blog] parse error:', err);
    }
    return {posts, themeTokens, footer, pages, blogEnabled};
}

export async function generateMetadata(): Promise<Metadata> {
    const {t} = await getT('common');
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
    const blogUrl = `${siteUrl}/blog`;
    const description = t('Writing on engineering, AI workflows, CMS architecture, and the practice of building software end to end.') as string;
    const title = t('Blog') as string;
    const ogTitle = t('Writing') as string;

    // JSON-LD shipped via `metadata.other` — App Router doesn't model
    // `<script type="application/ld+json">` natively but accepts arbitrary
    // `<meta>` pairs here; the crawler still picks up the structured data
    // when we emit it as a meta tag with the JSON serialised value. To
    // keep schema.org-validatable output, we instead inject the JSON-LD
    // via the view component below using `dangerouslySetInnerHTML` — see
    // BlogIndexView. This block keeps the human-readable SEO meta tags.
    return {
        title,
        description,
        alternates: siteUrl ? {canonical: blogUrl} : undefined,
        robots: {index: true, follow: true, 'max-image-preview': 'large'} as any,
        openGraph: {
            type: 'website',
            title: ogTitle,
            description,
            url: siteUrl ? blogUrl : undefined,
        },
        twitter: {
            card: 'summary',
            title: ogTitle,
            description,
        },
    };
}

export default async function BlogIndexPage(): Promise<React.ReactElement> {
    const {posts, themeTokens, footer, pages, blogEnabled} = await loadBlogIndexData();
    if (!blogEnabled) notFound();
    const systemPage = loadSystemPageSnapshot('blog-index');
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || '').replace(/\/+$/, '');
    // Blog JSON-LD — emit alongside the view tree (Server Component context
    // is fine, the `<script>` is server-rendered). Mirrors the Pages-Router
    // page exactly so Google still reads the Blog/BlogPosting graph.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'Writing',
        url: siteUrl ? `${siteUrl}/blog` : undefined,
        blogPost: posts.slice(0, 20).map(p => ({
            '@type': 'BlogPosting',
            headline: p.title,
            url: siteUrl ? `${siteUrl}/blog/${p.slug}` : `/blog/${p.slug}`,
            datePublished: p.publishedAt || undefined,
            author: p.author ? {'@type': 'Person', name: p.author} : undefined,
        })),
    };
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{__html: JSON.stringify(jsonLd, (_k, v) => v === undefined ? undefined : v)}}
            />
            <BlogIndexView
                posts={posts}
                themeTokens={themeTokens}
                footer={footer}
                pages={pages}
                systemPage={systemPage}
            />
        </>
    );
}
